const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const TicketType = require('../models/TicketType');
const Category = require('../models/Category');
const Department = require('../models/Department');
const DepartmentCategory = require('../models/DepartmentCategory');
const EscalationProcessor = require('./escalation/EscalationProcessor');
const AiRoutingLog = require('../models/AiRoutingLog');
const DuplicateAuditLog = require('../models/DuplicateAuditLog');
const tenantLocalStorage = require('../middleware/tenantContext');

/**
 * Centrally manages the lifecycle of Tickets in the ITSM domain.
 */
class TicketService {
  /**
   * Creates a new ticket record, executing assignments, SLAs, duplicate checks and embeddings.
   */
  static async createTicket(ticketData, user) {
    const {
      title,
      description,
      category,
      department,
      priority,
      ticketType, // TicketType ID or Name
      duplicateOverrideReason,
      parentTicketId,
      relatedAssets,
      customFields,
      aiRouting,
      attachments
    } = ticketData;

    // 1. Resolve TicketType reference
    let typeId = ticketType;
    if (!typeId) {
      // Default fallback to Complaint
      const defaultType = await TicketType.findOne({ name: 'Complaint' });
      typeId = defaultType ? defaultType._id : null;
    } else if (typeof typeId === 'string' && !mongoose.Types.ObjectId.isValid(typeId)) {
      const matchedType = await TicketType.findOne({ name: typeId });
      typeId = matchedType ? matchedType._id : null;
    }

    if (!typeId) {
      throw new Error('Invalid or unspecified ticket type');
    }

    // 2. Load and validate category/department linkages
    console.log(`[Ticket Creation Debug] Lookup category ID: "${category}" in tenant database: "${tenantLocalStorage.getStore() || 'default-tenant'}"`);
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      console.error(`[Ticket Creation Debug] Category ID "${category}" was NOT found in tenant database: "${tenantLocalStorage.getStore() || 'default-tenant'}"`);
      throw new Error('Category not found');
    }

    const deptDoc = await Department.findById(department);
    if (!deptDoc) throw new Error('Department not found');

    const mapping = await DepartmentCategory.findOne({
      department,
      category,
      isActive: true
    });

    if (!mapping) {
      throw new Error('Selected category is not linked to the selected department');
    }

    // 3. Instantiate the Ticket
    const ticket = new Ticket({
      tenantId: user.tenantId || 'default-tenant',
      ticketType: typeId,
      title: title.trim(),
      description: description.trim(),
      department,
      category,
      categoryName: categoryDoc.name,
      priority: priority || 'Low',
      citizen: user.id,
      attachments: attachments || [],
      customFields: customFields || {},
      aiRouting: aiRouting || undefined,
      relatedAssets: relatedAssets || [],
      assignedGroup: mapping.assignedGroup || deptDoc.routingGroup || null
    });

    // 4. Invoke Assignment / Escalation initialization pipeline
    await EscalationProcessor.processLifecycle(ticket, 'CREATE', {
      actorName: user.name,
      actorId: user.id
    });

    const savedTicket = await ticket.save();

    // 5. Link AI Auto-Routing Logs if applicable
    if (aiRouting) {
      try {
        const latestLog = await AiRoutingLog.findOne({
          userId: user.id,
          isSuccess: true,
          complaintId: null
        }).sort({ createdAt: -1 });

        if (latestLog) {
          latestLog.complaintId = savedTicket._id;
          latestLog.userOverride = aiRouting.userOverride || false;
          latestLog.overrideReason = aiRouting.overrideReason || null;
          latestLog.acceptedRecommendation = aiRouting.acceptedRecommendation || false;
          await latestLog.save();
        }
      } catch (logErr) {
        console.error('[TicketService] AI Routing Log mapping failed:', logErr);
      }
    }

    // 6. Handle duplicate prevention audit logging
    if (duplicateOverrideReason && parentTicketId) {
      try {
        savedTicket.history.push({
          action: `Definite duplicate warning overrode. Reason: ${duplicateOverrideReason}`,
          actor: user.name
        });
        await savedTicket.save();

        await DuplicateAuditLog.create({
          userId: user.id,
          userName: user.name,
          action: 'DUPLICATE_DETECTED',
          complaintId: savedTicket._id,
          parentComplaintId: parentTicketId,
          reason: duplicateOverrideReason
        });
      } catch (auditErr) {
        console.error('[TicketService] Duplicate Override Logging failed:', auditErr);
      }
    }

    // 7. Background embedding vector generation
    try {
      const AiSettings = require('../models/AiSettings');
      let settings = await AiSettings.findOne({ key: 'ai_routing_config' });
      if (settings && settings.enableAiRouting) {
        const duplicateService = require('./duplicateService');
        const textToEmbed = `${savedTicket.title} ${savedTicket.description}`;
        duplicateService.generateEmbedding(textToEmbed, settings)
          .then(vector => {
            if (vector && vector.length > 0) {
              Ticket.findByIdAndUpdate(savedTicket._id, { embeddingVector: vector }).exec();
            }
          })
          .catch(err => console.error('[TicketService] Background embedding error:', err));
      }
    } catch (embedErr) {
      console.error('[TicketService] Background embedding settings loading failed:', embedErr);
    }

    return savedTicket;
  }

  /**
   * Retrieves paginated tickets matching query filters.
   */
  static async getTickets(queryParams, user) {
    const tenantId = user.tenantId || 'default-tenant';
    const {
      categoryId, category, ticketTypeId, departmentId,
      status, priority, search, page, limit, sort,
      startDate, endDate
    } = queryParams;

    const filter = { tenantId };

    // Support both `category` (name) and `categoryId` (ObjectId)
    if (categoryId) {
      filter.category = categoryId;
    } else if (category) {
      // Category filter sent by Dashboard may be a name — resolve to ObjectId(s)
      const catDocs = await Category.find({ name: { $regex: `^${category}$`, $options: 'i' } }).select('_id');
      if (catDocs.length > 0) {
        filter.category = { $in: catDocs.map(c => c._id) };
      } else {
        // If name lookup fails, try treating as an ObjectId
        if (mongoose.Types.ObjectId.isValid(category)) {
          filter.category = category;
        }
      }
    }

    if (ticketTypeId) filter.ticketType = ticketTypeId;
    if (departmentId) filter.department = departmentId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    // Date range filtering
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } }, // legacy name checks
        { title: { $regex: search, $options: 'i' } },
        { trackingId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Citizens can only retrieve their own tickets; regular admins can only retrieve tickets assigned directly to them.
    if (user.role === 'citizen') {
      filter.citizen = user.id;
    } else if (user.role === 'admin') {
      const isSuperAdmin = user.role === 'admin' && (
        (user.groups && user.groups.length > 0 && user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
        ((!user.groups || user.groups.length === 0) && (!user.department || user.department === 'General Administration'))
      );
      if (!isSuperAdmin) {
        const userGroupIds = (user.groups || []).map(g => g._id || g);
        filter.$or = [
          { assignedTo: user.id },
          { assignedGroup: { $in: userGroupIds } }
        ];
      }
    }

    const p = parseInt(page, 10) || 1;
    // Default to 500 to ensure dashboard gets all complaints for statistics
    const l = parseInt(limit, 10) || 500;
    const skip = (p - 1) * l;

    // Translate friendly sort names from the frontend
    let sortField = '-createdAt';
    if (sort) {
      switch (sort) {
        case 'newest': sortField = '-createdAt'; break;
        case 'oldest': sortField = 'createdAt'; break;
        case 'priority': sortField = '-priority createdAt'; break;
        default: sortField = sort.split(',').join(' ');
      }
    }

    const tickets = await Ticket.find(filter)
      .populate('category', 'name fields')
      .populate('ticketType', 'name code color icon allowedRoles settings')
      .populate('department', 'name')
      .populate('assignedTo', 'name email department')
      .populate('citizen', 'name email')
      .populate('assignedGroup', 'name')
      .sort(sortField)
      .skip(skip)
      .limit(l)
      .lean();

    const total = await Ticket.countDocuments(filter);

    return {
      tickets,
      total,
      page: p,
      pages: Math.ceil(total / l),
      limit: l
    };
  }

  /**
   * Retrieves a single ticket by its ID and ensures RBAC validation.
   */
  static async getTicketById(ticketId, user) {
    const tenantId = user.tenantId || 'default-tenant';
    const ticket = await Ticket.findOne({ _id: ticketId, tenantId })
      .populate('category', 'name fields')
      .populate('ticketType', 'name code color icon allowedRoles settings')
      .populate('department', 'name')
      .populate('assignedTo', 'name email department')
      .populate('citizen', 'name email')
      .populate('comments.sender', 'name role')
      .populate('assignedGroup', 'name')
      .populate({
        path: 'relatedAssets',
        populate: [
          { path: 'categoryId', select: 'name icon color' },
          { path: 'assetTypeId', select: 'name assetPrefix dynamicFields' },
          { path: 'departmentId', select: 'name' },
          { path: 'ownerUserId', select: 'name email' }
        ]
      });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Role-based access validation
    if (user.role === 'citizen') {
      const citizenId = ticket.citizen?._id || ticket.citizen;
      if (citizenId && citizenId.toString() !== user.id) {
        throw new Error('Unauthorized to view this ticket');
      }
    } else if (user.role === 'admin') {
      const isSuperAdmin = user.role === 'admin' && (
        (user.groups && user.groups.length > 0 && user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
        ((!user.groups || user.groups.length === 0) && (!user.department || user.department === 'General Administration'))
      );
      
      if (!isSuperAdmin) {
        const assignedUserId = ticket.assignedTo?._id || ticket.assignedTo;
        const isAssignedToUser = assignedUserId && assignedUserId.toString() === user.id;

        const assignedGroupId = ticket.assignedGroup?._id || ticket.assignedGroup;
        const userGroupIds = (user.groups || []).map(g => (g._id || g).toString());
        const isAssignedToUserGroup = assignedGroupId && userGroupIds.includes(assignedGroupId.toString());

        if (!isAssignedToUser && !isAssignedToUserGroup) {
          throw new Error('Unauthorized to view this ticket');
        }
      }
    }

    return ticket;
  }

  /**
   * Performs workflow transitions and updates ticket statuses.
   */
  static async updateTicketStatus(ticketId, { status, assignedTo, escalationType, escalationGroupId, holdDuration, holdUntilCustom }, user) {
    const tenantId = user.tenantId || 'default-tenant';
    const ticket = await Ticket.findOne({ _id: ticketId, tenantId });
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Validate assignee role permissions if changing assignee
    const isSuperAdmin = user.role === 'admin' && (
      (user.groups && user.groups.length > 0 && user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
      ((!user.groups || user.groups.length === 0) && (!user.department || user.department === 'General Administration'))
    );

    // Validate resolve permission
    if (status === 'Resolved' && !isSuperAdmin) {
      const canResolve = user.settingsPermissions && user.settingsPermissions.resolveComplaints !== false;
      if (!canResolve) {
        throw new Error('You do not have permission to resolve complaints');
      }
    }

    if (!isSuperAdmin && assignedTo && assignedTo !== ticket.assignedDepartment) {
      const canEscalateAnywhere = user.settingsPermissions && user.settingsPermissions.escalateAnywhere === true;
      if (!canEscalateAnywhere) {
        const allowedDepts = (user.groups || []).map(g => g.department && (g.department.name || g.department.toString())).filter(Boolean);
        if (!allowedDepts.includes(assignedTo)) {
          throw new Error('Support staff can only assign complaints to departments associated with their assigned groups/teams');
        }
      }
    }

    const previousStatus = ticket.status;

    // Check custom state transition workflows
    const Workflow = require('../models/Workflow');
    const workflow = await Workflow.findOne({ categoryId: ticket.category, isActive: true });

    if (workflow && status && status !== previousStatus) {
      const stateNames = workflow.states.map(s => s.name);
      if (!stateNames.includes(status)) {
        throw new Error(`Invalid status: "${status}" is not defined in the custom workflow states.`);
      }

      const transitionRule = workflow.transitions.find(
        (t) => t.fromState === previousStatus && t.toState === status
      );
      if (!transitionRule) {
        throw new Error(`Invalid status transition: "${previousStatus}" to "${status}" is not defined.`);
      }

      if (transitionRule.allowedRole !== 'any') {
        if (transitionRule.allowedRole === 'admin' && user.role !== 'admin') {
          throw new Error('Only administrators can execute this status transition');
        }
        if (transitionRule.allowedRole === 'citizen' && user.role !== 'citizen') {
          throw new Error('Only the citizen can execute this status transition');
        }
      }
      ticket.status = status;

      // Execute transition actions
      if (transitionRule.actions) {
        if (transitionRule.actions.autoRouteToDepartment) {
          const Department = require('../models/Department');
          const targetDept = await Department.findOne({
            name: transitionRule.actions.autoRouteToDepartment,
            tenantId
          });
          if (targetDept) {
            ticket.department = targetDept._id;
            ticket.assignedDepartment = targetDept.name;
            // Clear previous assignee when department changes so it can be re-assigned
            ticket.assignedTo = null;
            ticket.assignedToName = null;
          }
        }

        if (transitionRule.actions.escalationDurationHours) {
          const CalendarEngine = require('./escalation/CalendarEngine');
          const calendar = await CalendarEngine.resolveCalendarForComplaint(ticket);
          ticket.calendar = calendar ? calendar._id : null;
          const now = new Date();
          ticket.nextEscalationDueAt = await CalendarEngine.calculateDueDate(
            now,
            transitionRule.actions.escalationDurationHours * 60,
            calendar,
            ticket.assignedDepartment
          );
          ticket.escalationStatus = 'pending';
        }
      }
    } else if (status && status !== previousStatus) {
      // Legacy hardcoded fallback status change bounds
      const lockedStatuses = ['Resolved', 'Rejected', 'Closed'];
      if (lockedStatuses.includes(previousStatus) && user.role !== 'admin') {
        throw new Error('Cannot modify a resolved, rejected, or closed ticket');
      }
      ticket.status = status;
    }

    // Escalation routing logic (groups vs department)
    if (ticket.status === 'Escalated') {
      if (escalationType === 'group' && escalationGroupId) {
        const EscalationGroup = require('../models/EscalationGroup');
        const Department = require('../models/Department');
        const User = require('../models/User');

        const groupDoc = await EscalationGroup.findById(escalationGroupId);
        if (groupDoc) {
          ticket.assignedGroup = groupDoc._id;
          
          if (groupDoc.department) {
            const deptDoc = await Department.findById(groupDoc.department);
            if (deptDoc) {
              ticket.department = deptDoc._id;
              ticket.assignedDepartment = deptDoc.name;
            }
          }

          // Find member with lowest workload of open tickets
          if (groupDoc.members && groupDoc.members.length > 0) {
            const memberWorkloads = await Promise.all(groupDoc.members.map(async (memberId) => {
              const count = await Ticket.countDocuments({
                assignedTo: memberId,
                status: { $nin: ['Resolved', 'Rejected', 'Closed'] }
              });
              return { memberId, count };
            }));

            // Sort by count ascending (lowest workload first)
            memberWorkloads.sort((a, b) => a.count - b.count);
            const chosenMemberId = memberWorkloads[0].memberId;

            ticket.assignedTo = chosenMemberId;
            ticket.assignedAt = new Date();

            const chosenUser = await User.findById(chosenMemberId);
            const chosenUserName = chosenUser ? chosenUser.name : 'Staff';

            ticket.history.push({
              action: `Escalated to Group "${groupDoc.name}" and assigned to "${chosenUserName}" (Workload: ${memberWorkloads[0].count} open tickets)`,
              actor: user.name
            });
          } else if (groupDoc.leader || groupDoc.backupLeader) {
            const leaderId = groupDoc.leader || groupDoc.backupLeader;
            ticket.assignedTo = leaderId;
            ticket.assignedAt = new Date();
            
            const leaderUser = await User.findById(leaderId);
            const leaderName = leaderUser ? leaderUser.name : 'Leader';
            
            ticket.history.push({
              action: `Escalated to Group "${groupDoc.name}" and assigned to group leader/backup "${leaderName}" as fallback`,
              actor: user.name
            });
          } else {
            ticket.assignedTo = null;
            ticket.history.push({
              action: `Escalated to Group "${groupDoc.name}" (No members or leaders available in group)`,
              actor: user.name
            });
          }
        }
      } else if (assignedTo) {
        // Escalate to Department
        const Department = require('../models/Department');
        const targetDept = await Department.findOne({ name: assignedTo, tenantId });
        if (targetDept) {
          ticket.department = targetDept._id;
          ticket.assignedDepartment = targetDept.name;
          ticket.assignedTo = null;
          ticket.assignedGroup = null;
        }
      }
    }
    // Handle hold status settings
    if (ticket.status === 'On Hold') {
      ticket.previousStatusBeforeHold = previousStatus;
      let holdUntil = null;
      if (holdDuration === 'custom' && holdUntilCustom) {
        holdUntil = new Date(holdUntilCustom);
      } else if (holdDuration) {
        holdUntil = new Date(Date.now() + Number(holdDuration) * 60 * 60 * 1000);
      }
      ticket.holdUntil = holdUntil;
      ticket.holdDuration = holdDuration;
    } else if (previousStatus === 'On Hold' && ticket.status !== 'On Hold') {
      // Clear hold fields if resuming/transitioning away from hold
      ticket.holdUntil = null;
      ticket.holdDuration = null;
      ticket.previousStatusBeforeHold = null;
    }

    ticket.history.push({
      action: `Status updated from "${previousStatus}" to "${ticket.status}"`,
      actor: user.name
    });

    await EscalationProcessor.processLifecycle(ticket, 'STATUS_UPDATE', {
      actorName: user.name,
      actorId: user.id,
      previousStatus
    });

    return await ticket.save();
  }

  /**
   * Helper to check if a user is super admin.
   */
  static isSuperAdmin(user) {
    return user.role === 'admin' && (
      (user.groups && user.groups.length > 0 && user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
      ((!user.groups || user.groups.length === 0) && (!user.department || user.department === 'General Administration'))
    );
  }

  /**
   * Helper to check if user has access to ticket.
   */
  static canAccessTicket(user, ticket) {
    if (user.role === 'citizen') {
      const citizenId = ticket.citizen?._id || ticket.citizen;
      return citizenId && citizenId.toString() === user.id;
    }

    if (user.role === 'admin') {
      const assignedUserId = ticket.assignedTo?._id || ticket.assignedTo;
      const isAssignedToUser = assignedUserId && assignedUserId.toString() === user.id;

      const assignedGroupId = ticket.assignedGroup?._id || ticket.assignedGroup;
      const userGroupIds = (user.groups || []).map(g => (g._id || g).toString());
      const isAssignedToUserGroup = assignedGroupId && userGroupIds.includes(assignedGroupId.toString());

      return (
        this.isSuperAdmin(user) ||
        isAssignedToUser ||
        isAssignedToUserGroup
      );
    }

    return false;
  }

  /**
   * Adds a comment to a ticket.
   */
  static async addComment(ticketId, { message }, user) {
    const tenantId = user.tenantId || 'default-tenant';
    const ticket = await Ticket.findOne({ _id: ticketId, tenantId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (
      ticket.status === 'Resolved' ||
      ticket.status === 'Rejected' ||
      ticket.status === 'Awaiting Feedback' ||
      ticket.status === 'Closed'
    ) {
      throw new Error('Cannot add comments to a resolved, rejected, or closed ticket');
    }

    if (!this.canAccessTicket(user, ticket)) {
      throw new Error('Unauthorized');
    }

    const newComment = {
      sender: user.id,
      senderName: user.name,
      message,
      createdAt: new Date()
    };

    ticket.comments.push(newComment);
    
    ticket.history.push({
      action: `New response added by ${user.role === 'admin' ? 'Officer' : 'Citizen'} (${user.name})`,
      actor: user.name
    });

    const EscalationProcessor = require('./escalation/EscalationProcessor');
    await EscalationProcessor.processLifecycle(ticket, 'COMMENT', {
      senderRole: user.role,
      actorName: user.name,
      actorId: user.id
    });

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticketId)
      .populate('comments.sender', 'name role');

    return updatedTicket.comments;
  }

  /**
   * Escalates a ticket (Citizen only).
   */
  static async escalateTicket(ticketId, { reason }, user) {
    if (!reason || !reason.trim()) {
      throw new Error('Please provide a reason for escalation');
    }

    const tenantId = user.tenantId || 'default-tenant';
    const ticket = await Ticket.findOne({ _id: ticketId, tenantId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const citizenId = ticket.citizen?._id || ticket.citizen;
    if (!citizenId || citizenId.toString() !== user.id) {
      throw new Error('Not authorized to escalate this ticket');
    }

    if (ticket.isEscalated) {
      throw new Error('This ticket has already been escalated');
    }
    if (ticket.status === 'Resolved' || ticket.status === 'Rejected') {
      throw new Error(`Cannot escalate a ticket that is already ${ticket.status.toLowerCase()}`);
    }

    ticket.status = 'Escalated';
    ticket.isEscalated = true;
    ticket.priority = 'High';
    ticket.assignedTo = null;
    ticket.assignedDepartment = 'General Administration';
    ticket.escalationReason = reason.trim();
    ticket.escalatedAt = Date.now();

    ticket.history.push({
      action: `Ticket escalated: "${reason.trim()}"`,
      actor: user.name
    });

    return await ticket.save();
  }

  /**
   * Submits feedback for a resolved ticket.
   */
  static async submitTicketFeedback(ticketId, feedbackData, user) {
    const { 
      overallRating, 
      responseTimeRating, 
      communicationRating, 
      resolutionQualityRating,
      resolvedCompletely,
      recommendation,
      comment,
      responses
    } = feedbackData;

    const tenantId = user.tenantId || 'default-tenant';
    const ticket = await Ticket.findOne({ _id: ticketId, tenantId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const citizenId = ticket.citizen?._id || ticket.citizen;
    if (user.role !== 'citizen' || (citizenId && citizenId.toString() !== user.id)) {
      throw new Error('Not authorized to submit feedback for this ticket');
    }

    if (ticket.status !== 'Awaiting Feedback' && ticket.status !== 'Resolved') {
      throw new Error('Feedback can only be submitted for resolved tickets');
    }

    let finalOverallRating = overallRating;
    let finalResponseTimeRating = responseTimeRating;
    let finalCommunicationRating = communicationRating;
    let finalResolutionQualityRating = resolutionQualityRating;
    let finalResolvedCompletely = resolvedCompletely;
    let finalRecommendation = recommendation;
    let finalComment = comment;

    if (Array.isArray(responses)) {
      const overall = responses.find(r => r.questionId === 'overallRating')?.value;
      if (overall !== undefined) finalOverallRating = overall;

      const respTime = responses.find(r => r.questionId === 'responseTimeRating')?.value;
      if (respTime !== undefined) finalResponseTimeRating = respTime;

      const comm = responses.find(r => r.questionId === 'communicationRating')?.value;
      if (comm !== undefined) finalCommunicationRating = comm;

      const qual = responses.find(r => r.questionId === 'resolutionQualityRating')?.value;
      if (qual !== undefined) finalResolutionQualityRating = qual;

      const comp = responses.find(r => r.questionId === 'resolvedCompletely')?.value;
      if (comp !== undefined) finalResolvedCompletely = comp;

      const rec = responses.find(r => r.questionId === 'recommendation')?.value;
      if (rec !== undefined) finalRecommendation = rec;

      const commText = responses.find(r => r.questionId === 'comment')?.value;
      if (commText !== undefined) finalComment = commText;
    }

    ticket.feedback = {
      overallRating: finalOverallRating !== undefined ? Number(finalOverallRating) : 5,
      responseTimeRating: finalResponseTimeRating !== undefined ? Number(finalResponseTimeRating) : 5,
      communicationRating: finalCommunicationRating !== undefined ? Number(finalCommunicationRating) : 5,
      resolutionQualityRating: finalResolutionQualityRating !== undefined ? Number(finalResolutionQualityRating) : 5,
      resolvedCompletely: finalResolvedCompletely || 'Yes',
      recommendation: finalRecommendation !== undefined ? Boolean(finalRecommendation) : true,
      comment: finalComment || '',
      submittedAt: new Date(),
      submittedBy: user.id,
      responses: Array.isArray(responses) ? responses : []
    };

    ticket.feedbackSubmitted = true;
    ticket.feedbackSubmittedAt = new Date();
    ticket.status = 'Resolved';
    ticket.closureType = 'Citizen Resolved';

    ticket.history.push({
      action: `Feedback submitted. Rating: ${finalOverallRating || 5}/5. Ticket marked resolved by citizen.`,
      actor: user.name
    });

    await ticket.save();

    const { sendEscalationNotifications } = require('./notificationService');
    await sendEscalationNotifications({
      complaintId: ticket._id,
      citizenId: null,
      title: 'Feedback Submitted',
      message: `Citizen ${user.name} submitted feedback for ticket #${ticket.trackingId} (Rating: ${overallRating}/5).`
    });

    return ticket;
  }

  /**
   * Reopens a resolved ticket.
   */
  static async reopenTicket(ticketId, { reason }, user) {
    if (!reason || !reason.trim()) {
      throw new Error('Please provide a reason for reopening the ticket');
    }

    const tenantId = user.tenantId || 'default-tenant';
    const ticket = await Ticket.findOne({ _id: ticketId, tenantId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const citizenId = ticket.citizen?._id || ticket.citizen;
    if (user.role !== 'citizen' || (citizenId && citizenId.toString() !== user.id)) {
      throw new Error('Not authorized to reopen this ticket');
    }

    if (ticket.status !== 'Resolved' && ticket.status !== 'Awaiting Feedback' && ticket.status !== 'Closed') {
      throw new Error('Only resolved or closed tickets can be reopened');
    }

    ticket.status = 'Reopen Requested';
    ticket.reopenRequest = {
      reason: reason.trim(),
      requestedAt: new Date(),
      status: 'pending',
      reviewedAt: null,
      reviewedBy: null,
      reviewComment: null
    };

    ticket.history.push({
      action: `Reopen request submitted by citizen. Reason: "${reason.trim()}"`,
      actor: user.name
    });

    await ticket.save();

    const { sendEscalationNotifications } = require('./notificationService');
    await sendEscalationNotifications({
      complaintId: ticket._id,
      citizenId: null,
      title: 'Ticket Reopen Requested',
      message: `Reopen request submitted for ticket #${ticket.trackingId} by citizen ${user.name}. Reason: "${reason.trim()}".`
    });

    return ticket;
  }

  /**
   * Approves or rejects a reopening request.
   */
  static async reviewReopenRequest(ticketId, { action, comment }, user) {
    if (!action || !['approve', 'reject'].includes(action)) {
      throw new Error('Please specify a valid action (approve or reject)');
    }

    const tenantId = user.tenantId || 'default-tenant';
    const ticket = await Ticket.findOne({ _id: ticketId, tenantId });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (user.role !== 'admin') {
      throw new Error('Not authorized: Admins only');
    }

    if (!this.canAccessTicket(user, ticket)) {
      throw new Error('Not authorized to review this ticket request');
    }

    if (ticket.status !== 'Reopen Requested') {
      throw new Error('This ticket does not have a pending reopen request');
    }

    const reviewNote = comment ? comment.trim() : '';
    const requestReason = ticket.reopenRequest?.reason || 'No reason specified';

    if (action === 'approve') {
      ticket.reopenRequest.status = 'approved';
      ticket.reopenRequest.reviewedAt = new Date();
      ticket.reopenRequest.reviewedBy = user.id;
      ticket.reopenRequest.reviewComment = reviewNote;

      const EscalationProcessor = require('./escalation/EscalationProcessor');
      await EscalationProcessor.processLifecycle(ticket, 'REOPEN', {
        reason: requestReason,
        actorName: user.name,
        actorId: user.id
      });
    } else {
      ticket.status = 'Resolved';
      ticket.closureType = 'Citizen Resolved';
      ticket.reopenRequest.status = 'rejected';
      ticket.reopenRequest.reviewedAt = new Date();
      ticket.reopenRequest.reviewedBy = user.id;
      ticket.reopenRequest.reviewComment = reviewNote;

      ticket.history.push({
        action: `Reopen request rejected by officer ${user.name}. Comment: "${reviewNote}".`,
        actor: user.name
      });
    }

    return await ticket.save();
  }
}

module.exports = TicketService;
