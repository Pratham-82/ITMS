const CalendarEngine = require('./CalendarEngine');
const SlaEngine = require('./SlaEngine');
const AssignmentEngine = require('./AssignmentEngine');
const EscalationEngine = require('./EscalationEngine');
const NotificationEngine = require('./NotificationEngine');
const AuditEngine = require('./AuditEngine');
const EscalationRuleResolver = require('./EscalationRuleResolver');
const User = require('../../models/User');

/**
 * EscalationProcessor implements the single unified processing pipeline:
 * Assignment -> SLA -> Calendar -> Escalation -> Notification -> Audit.
 */
class EscalationProcessor {
  /**
   * Process a lifecycle stage event on a complaint.
   * @param {Object} complaint - The Complaint document.
   * @param {String} eventType - The lifecycle event ('CREATE', 'STATUS_CHANGE', 'REOPEN', 'COMMENT')
   * @param {Object} context - Metadata like actor information and overrides.
   */
  async processLifecycle(complaint, eventType, context = {}) {
    const tenantLocalStorage = require('../../middleware/tenantContext');
    const complaintTenantId = complaint.tenantId || 'default-tenant';

    return await tenantLocalStorage.run(complaintTenantId, async () => {
      const actorName = context.actorName || 'System';
      const actorId = context.actorId || null;
      const now = new Date();

      console.log(`[EscalationProcessor] Pipeline starting for complaint #${complaint.trackingId || 'New'} | Event: ${eventType}`);

      // 1. Resolve Calendar
      const calendar = await CalendarEngine.resolveCalendarForComplaint(complaint);
      complaint.calendar = calendar ? calendar._id : null;

      // Resolve cached department and category names if needed
      if (complaint.department && (!complaint.assignedDepartment || complaint.assignedDepartment === 'General Administration')) {
        const Department = require('../../models/Department');
        const deptDoc = await Department.findById(complaint.department);
        if (deptDoc) {
          complaint.assignedDepartment = deptDoc.name;
        }
      }
      if (complaint.category && !complaint.categoryName) {
        const Category = require('../../models/Category');
        const catDoc = await Category.findById(complaint.category);
        if (catDoc) {
          complaint.categoryName = catDoc.name;
        }
      }

      if (eventType === 'CREATE') {
        // 2. Resolve Rule & Initialize Escalation Levels
        const rule = await EscalationRuleResolver.resolveRule(complaint);
        if (rule) {
          complaint.escalationWorkflowId = rule._id;
          if (rule.levels && rule.levels.length > 0) {
            const level1 = rule.levels.find(l => l.level === 1);
            if (level1) {
              complaint.currentEscalationLevel = 0;
              complaint.escalationStatus = 'pending';
              const hours = level1.durationHours || 24;
              complaint.nextEscalationDueAt = await CalendarEngine.calculateDueDate(now, hours * 60, calendar, complaint.assignedDepartment);
            }
          }
        }

        // 3. Central SLA Engine: Calculate Deadlines
        complaint.responseDueAt = await SlaEngine.calculateResponseDueDate(complaint, calendar);
        complaint.resolutionDueAt = await SlaEngine.calculateResolutionDueDate(complaint, calendar);
        complaint.responseSlaStatus = 'Within SLA';
        complaint.resolutionSlaStatus = 'Within SLA';

        // 4. Central Assignment Engine: Auto Assign
        const DepartmentCategory = require('../../models/DepartmentCategory');
        const mapping = await DepartmentCategory.findOne({
          department: complaint.department,
          category: complaint.category,
          isActive: true
        });
        if (mapping && mapping.assignedGroup) {
          complaint.assignedGroup = mapping.assignedGroup;
        }

        const assignRes = await AssignmentEngine.assignComplaint(complaint, 'workload');
        const assignedUser = assignRes ? assignRes.assignedUser : null;

        // 5. Audit Logging
        await AuditEngine.logEscalationAction({
          action: 'CREATED',
          complaintId: complaint._id,
          level: 0,
          newOwner: assignedUser ? assignedUser._id : null,
          newDepartment: complaint.assignedDepartment,
          reason: 'New ticket filed',
          actor: actorName
        });

        // 6. Notification dispatching
        if (assignedUser) {
          await NotificationEngine.sendAssignment(complaint, assignedUser);
        }
      } 

      else if (eventType === 'STATUS_CHANGE' || eventType === 'STATUS_UPDATE') {
        const prevStatus = eventType === 'STATUS_UPDATE' ? context.previousStatus : complaint.status;
        let newStatus = eventType === 'STATUS_UPDATE' ? complaint.status : context.newStatus;

        // Intercept Resolved and redirect to Awaiting Feedback for customer CSAT
        if (newStatus === 'Resolved' && !complaint.feedbackRequested) {
          newStatus = 'Awaiting Feedback';
        }
        complaint.status = newStatus;

        // Handle resolution / closure states
        if (['Resolved', 'Closed', 'Rejected'].includes(newStatus)) {
          if (!complaint.resolvedAt) {
            complaint.resolvedAt = now;
          }
          if (complaint.resolutionSlaStatus !== 'Breached') {
            complaint.resolutionSlaStatus = 'Met';
          }
          if (!complaint.firstResponseAt) {
            complaint.firstResponseAt = now;
            if (complaint.responseSlaStatus !== 'Breached') {
              complaint.responseSlaStatus = 'Met';
            }
          }
          complaint.nextEscalationDueAt = null;
          complaint.escalationStatus = 'completed';

          // Notify Resolution
          await NotificationEngine.sendResolution(complaint);
        }

        // Set feedback requested fields when resolved or awaiting feedback
        if (['Awaiting Feedback', 'Resolved'].includes(newStatus)) {
          if (!complaint.feedbackRequested) {
            complaint.feedbackRequested = true;
            complaint.feedbackRequestedAt = now;
          }
        }

        // Handle reassignments if assignedTo changes
        if (context.assignedToUser) {
          const prevUser = complaint.assignedTo ? await User.findById(complaint.assignedTo) : null;
          complaint.assignedTo = context.assignedToUser._id;
          complaint.assignedAt = now;
          await NotificationEngine.sendReassignment(complaint, prevUser, context.assignedToUser);
        }

        // Audit Log
        await AuditEngine.logEscalationAction({
          action: 'STATUS_UPDATED',
          complaintId: complaint._id,
          level: complaint.currentEscalationLevel,
          previousOwner: complaint.assignedTo,
          reason: `Status transition from "${prevStatus}" to "${newStatus}"`,
          actor: actorName
        });
      }

      else if (eventType === 'REOPEN') {
        // Reset SLA targets and state back to Investigating
        complaint.status = 'Investigating';
        complaint.reopenedCount = (complaint.reopenedCount || 0) + 1;
        complaint.reopenedAt = now;
        complaint.reopenedReason = context.reason;
        complaint.resolvedAt = null;
        complaint.firstResponseAt = null;
        complaint.responseSlaStatus = 'Within SLA';
        complaint.resolutionSlaStatus = 'Within SLA';
        complaint.firedSlaWarnings = [];

        // Reset feedback fields
        complaint.feedbackRequested = false;
        complaint.feedbackRequestedAt = null;
        complaint.feedbackSubmitted = false;
        complaint.feedbackSubmittedAt = null;
        complaint.feedback = undefined;

        // Re-resolve workflow and calculate SLAs
        const rule = await EscalationRuleResolver.resolveRule(complaint);
        if (rule && rule.levels && rule.levels.length > 0) {
          const currentLevel = complaint.currentEscalationLevel || 0;
          const targetLevel = currentLevel === 0 ? 1 : currentLevel;
          const levelDetails = rule.levels.find(l => l.level === targetLevel);
          if (levelDetails) {
            const hours = levelDetails.durationHours || 24;
            complaint.nextEscalationDueAt = await CalendarEngine.calculateDueDate(now, hours * 60, calendar, complaint.assignedDepartment);
            complaint.escalationStatus = 'pending';
          }
        }

        complaint.responseDueAt = await SlaEngine.calculateResponseDueDate(complaint, calendar);
        complaint.resolutionDueAt = await SlaEngine.calculateResolutionDueDate(complaint, calendar);

        // Resolve assigned group from mapping
        const DepartmentCategory = require('../../models/DepartmentCategory');
        const mapping = await DepartmentCategory.findOne({
          department: complaint.department,
          category: complaint.category,
          isActive: true
        });
        if (mapping && mapping.assignedGroup) {
          complaint.assignedGroup = mapping.assignedGroup;
        }

        // Re-assign ticket
        const assignRes = await AssignmentEngine.assignComplaint(complaint, 'workload');
        const assignedUser = assignRes ? assignRes.assignedUser : null;

        // Audit Log
        await AuditEngine.logEscalationAction({
          action: 'REOPENED',
          complaintId: complaint._id,
          level: complaint.currentEscalationLevel,
          newOwner: assignedUser ? assignedUser._id : null,
          reason: `Reopen request approved: "${context.reason}"`,
          actor: actorName
        });

        if (assignedUser) {
          await NotificationEngine.sendAssignment(complaint, assignedUser);
        }
      }

      else if (eventType === 'COMMENT') {
        // Comments by admins count as first response
        if (context.senderRole === 'admin' && !complaint.firstResponseAt) {
          complaint.firstResponseAt = now;
          if (complaint.responseSlaStatus !== 'Breached') {
            complaint.responseSlaStatus = 'Met';
          }
          
          await AuditEngine.logEscalationAction({
            action: 'FIRST_RESPONSE_MET',
            complaintId: complaint._id,
            reason: 'Officer replied with a comment',
            actor: actorName
          });
        }
      }

      // Trigger Webhooks asynchronously
      const webhookService = require('../webhookService');
      const webhookEventMap = {
        'CREATE': 'ticket.created',
        'STATUS_CHANGE': 'ticket.status_changed',
        'STATUS_UPDATE': 'ticket.status_changed',
        'REOPEN': 'ticket.reopened',
        'COMMENT': 'ticket.comment_added'
      };
      const targetWebhookEvent = webhookEventMap[eventType];
      if (targetWebhookEvent) {
        webhookService.triggerWebhook(targetWebhookEvent, complaint.toObject ? complaint.toObject() : complaint, complaintTenantId)
          .catch(err => console.error('[EscalationProcessor] Webhook trigger error:', err));
      }

      console.log(`[EscalationProcessor] Pipeline finished for complaint #${complaint.trackingId}`);
    });
  }
}

module.exports = new EscalationProcessor();
