const mongoose = require('mongoose');
const EscalationRule = require('../models/EscalationRule');
const Complaint = require('../models/Ticket');
const Category = require('../models/Category');
const Department = require('../models/Department');
const User = require('../models/User');
const { sendEscalationNotifications } = require('../services/notificationService');

const isSuperAdmin = (user) => (
  user.role === 'admin' && (
    (user.groups && user.groups.length > 0 && user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
    ((!user.groups || user.groups.length === 0) && (!user.department || user.department === 'General Administration'))
  )
);

const canManageComplaint = (user, complaint) => {
  if (user.role !== 'admin') return false;
  if (isSuperAdmin(user)) return true;
  
  const userDeptIds = (user.groups || []).map(g => ((g.department && g.department._id) || g.department || '').toString()).filter(Boolean);
  const complaintDeptId = complaint.department ? (complaint.department._id || complaint.department).toString() : '';
  
  return userDeptIds.includes(complaintDeptId);
};

// Helper to validate escalation levels for loops, contiguous ordering, and valid targets
const validateEscalationRule = async (departmentId, categoryId, levels) => {
  if (!levels || !Array.isArray(levels) || levels.length === 0) {
    throw new Error('Escalation rule must have at least one level defined');
  }

  // 1. Fetch category to verify it exists
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new Error('Target category not found');
  }
  
  const startDeptDoc = await Department.findById(departmentId);
  const startDept = startDeptDoc ? startDeptDoc.name : '';

  // 2. Sort levels by level number to process contiguously
  levels.sort((a, b) => a.level - b.level);

  // 3. Verify contiguous level numbers starting at 1 and validate fields
  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i];
    if (lvl.level !== i + 1) {
      throw new Error(`Escalation levels must be contiguous starting from 1. Level ${i + 1} is missing or misconfigured.`);
    }

    if (!lvl.targetType) {
      lvl.targetType = 'department';
    }

    // Check SLA times
    if (lvl.responseSlaMinutes !== undefined && typeof lvl.responseSlaMinutes === 'number' && lvl.responseSlaMinutes < 0) {
      throw new Error(`Level ${lvl.level} response SLA minutes cannot be negative`);
    }
    if (lvl.resolutionSlaMinutes !== undefined && typeof lvl.resolutionSlaMinutes === 'number' && lvl.resolutionSlaMinutes < 0) {
      throw new Error(`Level ${lvl.level} resolution SLA minutes cannot be negative`);
    }

    // Check durationHours fallback if minutes not set
    if (!lvl.responseSlaMinutes && !lvl.resolutionSlaMinutes && (!lvl.durationHours || lvl.durationHours <= 0)) {
      throw new Error(`Level ${lvl.level} must specify either response/resolution SLA minutes or positive duration hours.`);
    }

    // Validate custom SLA breach actions
    const validResponseActions = ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'PRIORITY_UPGRADE', 'LEVEL_ESCALATION', 'MARK_ATTENTION'];
    const validResolutionActions = ['AUDIT_LOG', 'HISTORY_LOG', 'LEVEL_ESCALATION', 'NOTIFY_DEPT_HEAD', 'NOTIFY_ASSIGNED', 'INCREASE_RISK_SCORE', 'FLAG_DASHBOARD', 'PRIORITY_UPGRADE'];

    if (lvl.responseSlaActions !== undefined && lvl.responseSlaActions !== null) {
      if (!Array.isArray(lvl.responseSlaActions)) {
        throw new Error(`Level ${lvl.level} response SLA actions must be an array`);
      }
      for (const act of lvl.responseSlaActions) {
        if (!validResponseActions.includes(act)) {
          throw new Error(`Level ${lvl.level} response SLA action "${act}" is invalid`);
        }
      }
    }

    if (lvl.resolutionSlaActions !== undefined && lvl.resolutionSlaActions !== null) {
      if (!Array.isArray(lvl.resolutionSlaActions)) {
        throw new Error(`Level ${lvl.level} resolution SLA actions must be an array`);
      }
      for (const act of lvl.resolutionSlaActions) {
        if (!validResolutionActions.includes(act)) {
          throw new Error(`Level ${lvl.level} resolution SLA action "${act}" is invalid`);
        }
      }
    }

    // Validate targets based on targetType
    if (lvl.targetType === 'department') {
      if (!lvl.department || !lvl.department.trim()) {
        if (lvl.targetId) {
          lvl.department = lvl.targetId;
        } else {
          throw new Error(`Level ${lvl.level} must specify a target department.`);
        }
      }

      const deptExists = await Department.findOne({ name: lvl.department.trim() });
      if (!deptExists) {
        if (mongoose.Types.ObjectId.isValid(lvl.department)) {
          const deptById = await Department.findById(lvl.department);
          if (deptById) {
            lvl.department = deptById.name;
          } else {
            throw new Error(`Department ID "${lvl.department}" specified at Level ${lvl.level} does not exist.`);
          }
        } else {
          throw new Error(`Department "${lvl.department}" specified at Level ${lvl.level} does not exist.`);
        }
      }
    } else if (lvl.targetType === 'group') {
      if (!lvl.targetId) {
        throw new Error(`Level ${lvl.level} must specify a target group ID.`);
      }
      const EscalationGroup = require('../models/EscalationGroup');
      const groupExists = await EscalationGroup.findById(lvl.targetId);
      if (!groupExists) {
        throw new Error(`Group ID "${lvl.targetId}" specified at Level ${lvl.level} does not exist.`);
      }
    } else if (lvl.targetType === 'user') {
      if (!lvl.targetId) {
        throw new Error(`Level ${lvl.level} must specify a target user ID.`);
      }
      const userExists = await User.findById(lvl.targetId);
      if (!userExists) {
        throw new Error(`User ID "${lvl.targetId}" specified at Level ${lvl.level} does not exist.`);
      }
    } else if (lvl.targetType === 'role') {
      if (!lvl.targetId || !['agent', 'lead', 'manager', 'director'].includes(lvl.targetId.toLowerCase())) {
        throw new Error(`Level ${lvl.level} must specify a valid role (agent, lead, manager, director) in targetId.`);
      }
    }
  }

  // Loop/circular check for departments
  const deptLevels = levels.filter(l => l.targetType === 'department');
  const targetDepts = deptLevels.map(l => l.department.trim());
  const uniqueDepts = [...new Set(targetDepts)];

  if (targetDepts.length !== uniqueDepts.length) {
    throw new Error('Circular routing detected: Each escalation level targeting a department must be unique.');
  }

  if (startDept && uniqueDepts.includes(startDept)) {
    throw new Error(`Circular routing detected: Escalation levels cannot route back to the category's starting department ("${startDept}").`);
  }

  return { categoryName: category.name, levels };
};

// @desc    Get all escalation rules
// @route   GET /api/escalations
// @access  Private (Admin only)
const getEscalationRules = async (req, res) => {
  try {
    const filter = {};
    if (!isSuperAdmin(req.user)) {
      const deptIds = (req.user.groups || []).map(g => (g.department && g.department._id) || g.department).filter(Boolean);
      filter.departmentId = { $in: deptIds };
    }
    const rules = await EscalationRule.find(filter)
      .populate('departmentId', 'name')
      .populate('categoryId', 'name')
      .sort({ categoryName: 1 });
    res.status(200).json({
      success: true,
      count: rules.length,
      data: rules
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single escalation rule by ID
// @route   GET /api/escalations/:id
// @access  Private (Admin only)
const getEscalationRuleById = async (req, res) => {
  try {
    const rule = await EscalationRule.findById(req.params.id)
      .populate('departmentId', 'name')
      .populate('categoryId', 'name');
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Escalation rule not found' });
    }
    if (!isSuperAdmin(req.user)) {
      const deptIds = (req.user.groups || []).map(g => ((g.department && g.department._id) || g.department || '').toString()).filter(Boolean);
      if (!rule.departmentId || !deptIds.includes(rule.departmentId._id.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized to view rules in this department' });
      }
    }
    res.status(200).json({
      success: true,
      data: rule
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new escalation rule
// @route   POST /api/escalations
// @access  Private (Admin only)
const createEscalationRule = async (req, res) => {
  try {
    const { departmentId, categoryId, workflowName, levels, isActive } = req.body;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department ID is required' });
    }
    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Category ID is required' });
    }
    if (!isSuperAdmin(req.user)) {
      const deptIds = (req.user.groups || []).map(g => ((g.department && g.department._id) || g.department || '').toString()).filter(Boolean);
      if (!deptIds.includes(departmentId.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized to create rules in this department' });
      }
    }

    // Check if a rule already exists for this department and category
    const existingRule = await EscalationRule.findOne({ departmentId, categoryId });
    if (existingRule) {
      return res.status(400).json({
        success: false,
        message: 'An escalation rule already exists for this category under this department. Please update the existing rule instead.'
      });
    }

    // Run validations
    let validatedData;
    try {
      validatedData = await validateEscalationRule(departmentId, categoryId, levels);
    } catch (validationErr) {
      return res.status(400).json({ success: false, message: validationErr.message });
    }

    const rule = await EscalationRule.create({
      departmentId,
      categoryId,
      categoryName: validatedData.categoryName,
      workflowName,
      levels: validatedData.levels,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update escalation rule
// @route   PUT /api/escalations/:id
// @access  Private (Admin only)
const updateEscalationRule = async (req, res) => {
  try {
    const { workflowName, levels, isActive } = req.body;

    let rule = await EscalationRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Escalation rule not found' });
    }
    if (!isSuperAdmin(req.user)) {
      const deptIds = (req.user.groups || []).map(g => ((g.department && g.department._id) || g.department || '').toString()).filter(Boolean);
      if (!rule.departmentId || !deptIds.includes(rule.departmentId.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized to update rules in this department' });
      }
    }

    if (workflowName !== undefined) rule.workflowName = workflowName;
    if (isActive !== undefined) rule.isActive = isActive;

    if (levels) {
      let validatedData;
      try {
        validatedData = await validateEscalationRule(rule.departmentId, rule.categoryId, levels);
      } catch (validationErr) {
        return res.status(400).json({ success: false, message: validationErr.message });
      }
      rule.levels = validatedData.levels;
    }

    const updatedRule = await rule.save();

    res.status(200).json({
      success: true,
      data: updatedRule
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete escalation rule
// @route   DELETE /api/escalations/:id
// @access  Private (Admin only)
const deleteEscalationRule = async (req, res) => {
  try {
    let rule = await EscalationRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Escalation rule not found' });
    }
    if (!isSuperAdmin(req.user)) {
      const deptIds = (req.user.groups || []).map(g => ((g.department && g.department._id) || g.department || '').toString()).filter(Boolean);
      if (!rule.departmentId || !deptIds.includes(rule.departmentId.toString())) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete rules in this department' });
      }
    }
    await rule.deleteOne();
    res.status(200).json({
      success: true,
      message: 'Escalation rule deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Manually escalate a complaint to the next workflow level
// @route   PUT /api/complaints/:id/escalate-manual
// @access  Private (Admin only)
const manualEscalateComplaint = async (req, res) => {
  try {
    const { reason, assigneeId } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (!canManageComplaint(req.user, complaint)) {
      return res.status(403).json({ success: false, message: 'Not authorized to escalate this complaint' });
    }

    // Check if complaint is resolved, rejected, awaiting feedback, or closed
    if (
      complaint.status === 'Resolved' ||
      complaint.status === 'Rejected' ||
      complaint.status === 'Awaiting Feedback' ||
      complaint.status === 'Closed' ||
      complaint.status === 'Reopen Requested'
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot escalate a complaint that is resolved, rejected, closed, or pending reopen approval`
      });
    }

    const previousDept = complaint.assignedDepartment;
    const previousAssigneeId = complaint.assignedTo;

    if (assigneeId) {
      // Direct assignment to anyone (admin)
      const targetUser = await User.findById(assigneeId);
      if (!targetUser || targetUser.role !== 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Invalid assignee: Target user must be an administrator'
        });
      }

      let newDept = 'General Administration';
      if (targetUser.groups && targetUser.groups.length > 0) {
        const EscalationGroup = require('../models/EscalationGroup');
        const Department = require('../models/Department');
        const targetGroup = await EscalationGroup.findById(targetUser.groups[0]);
        if (targetGroup && targetGroup.department) {
          const dept = await Department.findById(targetGroup.department);
          if (dept) {
            newDept = dept.name;
            complaint.department = dept._id;
          }
        }
      } else if (targetUser.department) {
        newDept = targetUser.department;
      }

      complaint.status = 'Escalated';
      complaint.isEscalated = true;
      complaint.priority = 'High';
      complaint.assignedTo = targetUser._id;
      complaint.assignedDepartment = newDept;
      complaint.isAutoEscalated = false;
      complaint.nextEscalationDueAt = null;
      complaint.escalationStatus = 'completed';

      const now = new Date();
      complaint.lastEscalatedAt = now;
      if (!complaint.escalationStartedAt) {
        complaint.escalationStartedAt = now;
      }

      // Add path trail
      const escalationReason = reason || `Manually escalated and assigned to ${targetUser.name}`;
      complaint.escalationPath.push({
        level: (complaint.currentEscalationLevel || 0) + 1,
        department: newDept,
        escalatedAt: now,
        escalatedBy: req.user.name,
        reason: escalationReason
      });

      // Add timeline history
      complaint.history.push({
        action: `Escalated manually and assigned to ${targetUser.name} (${newDept}): "${escalationReason}"`,
        actor: req.user.name
      });

      await complaint.save();

      // Recalculate workloads
      const { calculateWorkloadScore } = require('../services/assignmentService');
      if (previousAssigneeId) {
        const previousAssignee = await User.findById(previousAssigneeId);
        if (previousAssignee) await calculateWorkloadScore(previousAssignee);
      }
      await calculateWorkloadScore(targetUser);

      // Trigger in-app notifications
      await sendEscalationNotifications({
        complaintId: complaint._id,
        citizenId: complaint.citizen,
        title: `Complaint Escalated manually to ${targetUser.name}`,
        message: `Complaint #${complaint.trackingId} has been manually escalated and assigned to ${targetUser.name} (${newDept}) by ${req.user.name}.`,
        previousDepartment: previousDept,
        newDepartment: newDept
      });

      // Notify target staff explicitly
      const Notification = require('../models/Notification');
      await Notification.create({
        recipient: targetUser._id,
        title: 'Complaint Escalation Assigned',
        message: `Complaint #${complaint.trackingId} has been manually escalated and assigned to you by ${req.user.name}.`,
        complaint: complaint._id
      });

      return res.status(200).json({
        success: true,
        message: `Complaint successfully escalated and assigned to ${targetUser.name}`,
        data: complaint
      });
    }

    // Otherwise, fall back to standard level escalation using EscalationRule
    const rule = await EscalationRule.findOne({ 
      departmentId: complaint.department,
      categoryId: complaint.category, 
      isActive: true 
    });
    if (!rule) {
      return res.status(400).json({
        success: false,
        message: 'No active escalation rule configured for this category'
      });
    }

    const currentLevel = complaint.currentEscalationLevel || 0;
    const nextLevelNum = currentLevel + 1;
    const nextLevelDetails = rule.levels.find(l => l.level === nextLevelNum);

    if (!nextLevelDetails) {
      return res.status(400).json({
        success: false,
        message: `Complaint is already at the highest escalation level (Level ${currentLevel})`
      });
    }

    const newDept = nextLevelDetails.department;

    // Apply manual escalation status
    complaint.currentEscalationLevel = nextLevelNum;
    complaint.isAutoEscalated = false;
    complaint.status = 'Escalated';
    complaint.isEscalated = true; // backward compatibility

    // Reassign assignee properties based on targetType
    if (nextLevelDetails.targetType === 'department') {
      complaint.assignedDepartment = newDept;
      complaint.assignedGroup = null;
      complaint.escalationRole = null;
      
      const Department = require('../models/Department');
      const deptDoc = await Department.findOne({ name: newDept });
      if (deptDoc) {
        complaint.department = deptDoc._id;
      }
    } else if (nextLevelDetails.targetType === 'group') {
      complaint.assignedGroup = nextLevelDetails.targetId;
      complaint.escalationRole = null;
      
      const EscalationGroup = require('../models/EscalationGroup');
      const Department = require('../models/Department');
      const groupDoc = await EscalationGroup.findById(nextLevelDetails.targetId);
      if (groupDoc && groupDoc.department) {
        const deptDoc = await Department.findById(groupDoc.department);
        if (deptDoc) {
          complaint.department = deptDoc._id;
          complaint.assignedDepartment = deptDoc.name;
        }
      }
    } else if (nextLevelDetails.targetType === 'role') {
      complaint.escalationRole = nextLevelDetails.targetId;
    } else if (nextLevelDetails.targetType === 'user') {
      complaint.assignedTo = nextLevelDetails.targetId;
    }

    const now = new Date();
    complaint.lastEscalatedAt = now;
    if (currentLevel === 0) {
      complaint.escalationStartedAt = now;
    }

    // Check if there is another level after this
    const hasNextLevel = rule.levels.some(l => l.level === nextLevelNum + 1);
    if (hasNextLevel) {
      const CalendarEngine = require('../services/escalation/CalendarEngine');
      const calendar = await CalendarEngine.resolveCalendarForComplaint(complaint);
      const hours = nextLevelDetails.durationHours || 24;
      complaint.nextEscalationDueAt = await CalendarEngine.calculateDueDate(now, hours * 60, calendar, newDept);
      complaint.escalationStatus = 'pending';
    } else {
      complaint.nextEscalationDueAt = null;
      complaint.escalationStatus = 'completed';
    }

    complaint.escalationWorkflowId = rule._id;

    const escalationReason = reason || `Manually escalated to level ${nextLevelNum}`;
    complaint.escalationPath.push({
      level: nextLevelNum,
      department: newDept,
      escalatedAt: now,
      escalatedBy: req.user.name,
      reason: escalationReason
    });

    complaint.history.push({
      action: `Escalated manually to Level ${nextLevelNum} (${newDept}): "${escalationReason}"`,
      actor: req.user.name
    });

    const { autoAssign } = require('../services/assignmentService');
    await autoAssign(complaint);

    await complaint.save();

    // Recalculate workload of previous owner if existed
    if (previousAssigneeId) {
      const { calculateWorkloadScore } = require('../services/assignmentService');
      const previousAssignee = await User.findById(previousAssigneeId);
      if (previousAssignee) await calculateWorkloadScore(previousAssignee);
    }

    await sendEscalationNotifications({
      complaintId: complaint._id,
      citizenId: complaint.citizen,
      title: `Complaint Escalated manually (Level ${nextLevelNum})`,
      message: `Complaint #${complaint.trackingId} has been manually escalated to ${newDept} by ${req.user.name}.`,
      previousDepartment: previousDept,
      newDepartment: newDept
    });

    res.status(200).json({
      success: true,
      message: `Complaint successfully escalated to level ${nextLevelNum}`,
      data: complaint
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getEscalationRules,
  getEscalationRuleById,
  createEscalationRule,
  updateEscalationRule,
  deleteEscalationRule,
  manualEscalateComplaint
};
