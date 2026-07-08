const SlaConfiguration = require('../../models/SlaConfiguration');
const User = require('../../models/User');
const AuditEngine = require('./AuditEngine');
const NotificationEngine = require('./NotificationEngine');
const EscalationEngine = require('./EscalationEngine');

/**
 * SlaActionEngine executes configurable actions, priority upgrades, risk scoring,
 * and executive escalations when SLA thresholds are breached.
 */
class SlaActionEngine {
  /**
   * Helper to retrieve current configuration.
   */
  async getSlaConfig(ticket = null) {
    const tenantId = ticket ? (ticket.tenantId || 'default-tenant') : 'default-tenant';
    const ticketType = ticket ? ticket.ticketType : null;
    
    let query = { tenantId };
    if (ticketType) {
      query.ticketTypeId = ticketType;
    } else {
      query.isDefault = true;
    }
    
    let slaConfig = await SlaConfiguration.findOne(query);
    if (!slaConfig && ticketType) {
      slaConfig = await SlaConfiguration.findOne({ tenantId, isDefault: true });
    }
    
    return slaConfig || {
      breachActions: {
        responseSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'PRIORITY_UPGRADE', 'LEVEL_ESCALATION', 'MARK_ATTENTION'],
        resolutionSla: ['AUDIT_LOG', 'HISTORY_LOG', 'LEVEL_ESCALATION', 'NOTIFY_DEPT_HEAD', 'NOTIFY_ASSIGNED', 'INCREASE_RISK_SCORE', 'FLAG_DASHBOARD']
      },
      multiBreachRules: [
        { breachCount: 1, action: 'NOTIFY_MANAGER' },
        { breachCount: 2, action: 'PRIORITY_UPGRADE' },
        { breachCount: 3, action: 'NOTIFY_DEPT_HEAD' },
        { breachCount: 4, action: 'EXECUTIVE_ESCALATE' },
        { breachCount: 5, action: 'CRITICAL_INCIDENT_FLAG' }
      ],
      riskScoreRules: {
        responseBreachIncrease: 10,
        resolutionBreachIncrease: 20,
        reopenIncrease: 15,
        escalationIncrease: 10,
        lowRatingIncrease: 15,
        criticalPriorityIncrease: 20
      }
    };
  }

  /**
   * Upgrade ticket priority automatically.
   */
  upgradePriority(complaint, reason, actor = 'SLA Engine') {
    const priorities = ['Low', 'Medium', 'High', 'Critical'];
    const currentIdx = priorities.indexOf(complaint.priority || 'Low');
    
    if (currentIdx < 3 && currentIdx >= 0) {
      const prevPriority = complaint.priority;
      const nextPriority = priorities[currentIdx + 1];
      
      complaint.priority = nextPriority;
      complaint.priorityEscalatedAt = new Date();
      complaint.priorityEscalationReason = reason;
      complaint.priorityEscalationHistory.push({
        fromPriority: prevPriority,
        toPriority: nextPriority,
        reason,
        timestamp: new Date(),
        actor
      });
      complaint.history.push({
        action: `Priority Increased: ${prevPriority} → ${nextPriority}. Reason: ${reason}`,
        actor
      });
      
      console.log(`[SlaActionEngine] Auto-upgraded priority for #${complaint.trackingId} (${prevPriority} -> ${nextPriority})`);
      return { prevPriority, nextPriority };
    }
    return null;
  }

  /**
   * Recalculates response and resolution SLAs dynamically after a priority upgrade breach event.
   */
  async recalculateSlaAfterPriorityUpgrade(complaint, now = new Date()) {
    const CalendarEngine = require('./CalendarEngine');
    const SlaEngine = require('./SlaEngine');
    
    const calendar = await CalendarEngine.resolveCalendarForComplaint(complaint);
    
    // Recalculate response SLA target using newly upgraded priority
    const newResponseDueAt = await SlaEngine.calculateResponseDueDate(complaint, calendar);
    if (newResponseDueAt) {
      complaint.responseDueAt = newResponseDueAt;
      if (newResponseDueAt > now) {
        complaint.responseSlaStatus = 'Within SLA';
        // Reset fired warnings for response SLA so they can trigger again
        complaint.firedSlaWarnings = complaint.firedSlaWarnings.filter(w => w >= 100);
      }
    }
    
    // Recalculate resolution SLA target using newly upgraded priority
    const newResolutionDueAt = await SlaEngine.calculateResolutionDueDate(complaint, calendar);
    if (newResolutionDueAt) {
      complaint.resolutionDueAt = newResolutionDueAt;
      if (newResolutionDueAt > now) {
        complaint.resolutionSlaStatus = 'Within SLA';
        // Reset fired warnings for resolution SLA (warnings >= 100) so they can trigger again
        complaint.firedSlaWarnings = complaint.firedSlaWarnings.filter(w => w < 100);
      }
    }
    
    console.log(`[SlaActionEngine] SLA targets recalculated for upgraded priority "${complaint.priority}". New targets -> Response: ${newResponseDueAt}, Resolution: ${newResolutionDueAt}`);
  }

  /**
   * Recalculates risk score for the complaint.
   */
  calculateRiskScore(complaint, config) {
    const rules = config.riskScoreRules || {
      responseBreachIncrease: 10,
      resolutionBreachIncrease: 20,
      reopenIncrease: 15,
      escalationIncrease: 10,
      lowRatingIncrease: 15,
      criticalPriorityIncrease: 20
    };

    let score = 0;

    // Response Breaches
    score += (complaint.responseBreachCount || 0) * rules.responseBreachIncrease;

    // Resolution Breaches
    score += (complaint.resolutionBreachCount || 0) * rules.resolutionBreachIncrease;

    // Repeated Reopen
    score += (complaint.reopenedCount || 0) * rules.reopenIncrease;

    // Repeated Escalation
    score += (complaint.currentEscalationLevel || 0) * rules.escalationIncrease;

    // Low Customer Rating
    if (complaint.feedback && complaint.feedback.overallRating && complaint.feedback.overallRating <= 2) {
      score += rules.lowRatingIncrease;
    }

    // Critical Priority
    if (complaint.priority === 'Critical') {
      score += rules.criticalPriorityIncrease;
    }

    complaint.riskScore = Math.max(0, Math.min(100, score));
    return complaint.riskScore;
  }

  /**
   * Resolves notification recipients for team management.
   */
  async getManagementRecipients(complaint) {
    const recipients = new Set();
    if (complaint.assignedTo) {
      recipients.add(complaint.assignedTo.toString());
    }

    // Find managers/admins in the department
    const admins = await User.find({
      department: complaint.assignedDepartment,
      role: 'admin'
    });
    
    admins.forEach(admin => {
      recipients.add(admin._id.toString());
    });

    return Array.from(recipients);
  }

  /**
   * Sends manager alert notifications.
   */
  async notifyManagers(complaint, title, message) {
    const userIds = await this.getManagementRecipients(complaint);
    for (const userId of userIds) {
      await NotificationEngine.sendInApp(userId, title, message, complaint._id);
    }
  }

  /**
   * Process Response SLA breach actions.
   */
  async processResponseSlaBreach(complaint, now = new Date()) {
    const config = await this.getSlaConfig(complaint);
    let actions = (config.breachActions && config.breachActions.responseSla) || [];

    // Check if the current escalation level has custom actions configured
    if (complaint.escalationWorkflowId) {
      const EscalationRule = require('../../models/EscalationRule');
      const rule = await EscalationRule.findById(complaint.escalationWorkflowId);
      if (rule && rule.levels && rule.levels.length > 0) {
        const currentLevel = complaint.currentEscalationLevel || 0;
        const targetLevel = currentLevel === 0 ? 1 : currentLevel;
        const levelDetails = rule.levels.find(l => l.level === targetLevel);
        if (levelDetails && levelDetails.responseSlaActions && levelDetails.responseSlaActions.length > 0) {
          actions = levelDetails.responseSlaActions;
        }
      }
    }

    console.log(`[SlaActionEngine] Processing Response SLA Breach for complaint #${complaint.trackingId}...`);

    complaint.responseBreachCount = (complaint.responseBreachCount || 0) + 1;
    complaint.totalBreachCount = (complaint.totalBreachCount || 0) + 1;

    const previousPriority = complaint.priority;
    const previousEscalationLevel = complaint.currentEscalationLevel || 0;

    // Execute actions
    if (actions.includes('MARK_ATTENTION')) {
      complaint.attentionRequired = true;
    }

    if (actions.includes('PRIORITY_UPGRADE')) {
      const upgraded = this.upgradePriority(complaint, 'First Response SLA Breached');
      if (upgraded) {
        await this.recalculateSlaAfterPriorityUpgrade(complaint, now);
      }
    }

    if (actions.includes('INCREASE_RISK_SCORE')) {
      this.calculateRiskScore(complaint, config);
    }

    // Trigger Escalation Engine Level escalation
    let newEscalationLevel = previousEscalationLevel;
    if (actions.includes('LEVEL_ESCALATION')) {
      const escalated = await EscalationEngine.processSlaBreach(complaint, 'response', now);
      if (escalated) {
        newEscalationLevel = complaint.currentEscalationLevel;
      }
    }

    // Manager Notifications
    if (actions.includes('NOTIFY_MANAGER')) {
      const title = `Response SLA Breached on Complaint #${complaint.trackingId}`;
      const message = `Complaint #${complaint.trackingId} has breached its First Response SLA. Attention required!`;
      await this.notifyManagers(complaint, title, message);
    }

    // Multi breach checks
    await this.processMultiBreachRules(complaint, config, now);

    // Audit logs
    if (actions.includes('AUDIT_LOG')) {
      await AuditEngine.logEscalationAction({
        action: 'SLA_BREACH',
        complaintId: complaint._id,
        level: complaint.currentEscalationLevel,
        previousOwner: complaint.assignedTo,
        newOwner: complaint.assignedTo,
        reason: 'First Response SLA Breached',
        actor: 'System'
      });

      // Persistent structured audit entry required by Phase 11
      const EscalationAudit = require('../../models/EscalationAudit');
      await EscalationAudit.create({
        action: 'SLA_BREACH',
        complaintId: complaint._id,
        breachType: 'response',
        previousPriority,
        newPriority: complaint.priority,
        previousEscalationLevel,
        newEscalationLevel: complaint.currentEscalationLevel,
        reason: 'Response SLA Breached',
        actor: 'System',
        timestamp: now
      });
    }
  }

  /**
   * Process Resolution SLA breach actions.
   */
  async processResolutionSlaBreach(complaint, now = new Date()) {
    const config = await this.getSlaConfig(complaint);
    let actions = (config.breachActions && config.breachActions.resolutionSla) || [];

    // Check if the current escalation level has custom actions configured
    if (complaint.escalationWorkflowId) {
      const EscalationRule = require('../../models/EscalationRule');
      const rule = await EscalationRule.findById(complaint.escalationWorkflowId);
      if (rule && rule.levels && rule.levels.length > 0) {
        const currentLevel = complaint.currentEscalationLevel || 0;
        const targetLevel = currentLevel === 0 ? 1 : currentLevel;
        const levelDetails = rule.levels.find(l => l.level === targetLevel);
        if (levelDetails && levelDetails.resolutionSlaActions && levelDetails.resolutionSlaActions.length > 0) {
          actions = levelDetails.resolutionSlaActions;
        }
      }
    }

    console.log(`[SlaActionEngine] Processing Resolution SLA Breach for complaint #${complaint.trackingId}...`);

    complaint.resolutionBreachCount = (complaint.resolutionBreachCount || 0) + 1;
    complaint.totalBreachCount = (complaint.totalBreachCount || 0) + 1;

    const previousPriority = complaint.priority;
    const previousEscalationLevel = complaint.currentEscalationLevel || 0;

    // Execute actions
    if (actions.includes('MARK_ATTENTION')) {
      complaint.attentionRequired = true;
    }

    if (actions.includes('PRIORITY_UPGRADE')) {
      const upgraded = this.upgradePriority(complaint, 'Resolution SLA Breached');
      if (upgraded) {
        await this.recalculateSlaAfterPriorityUpgrade(complaint, now);
      }
    }

    if (actions.includes('INCREASE_RISK_SCORE')) {
      this.calculateRiskScore(complaint, config);
    }

    let newEscalationLevel = previousEscalationLevel;
    if (actions.includes('LEVEL_ESCALATION')) {
      // SLA Engine Resolves rule, but delegates escalation execution to EscalationEngine
      const escalated = await EscalationEngine.processSlaBreach(complaint, 'resolution', now);
      if (escalated) {
        newEscalationLevel = complaint.currentEscalationLevel;
      }
    }

    // Manager Notifications
    if (actions.includes('NOTIFY_MANAGER')) {
      const title = `Resolution SLA Breached on Complaint #${complaint.trackingId}`;
      const message = `Complaint #${complaint.trackingId} has breached its Resolution SLA limit. Attention required!`;
      await this.notifyManagers(complaint, title, message);
    }

    if (actions.includes('NOTIFY_DEPT_HEAD')) {
      const title = `Resolution SLA Breached on Complaint #${complaint.trackingId}`;
      const message = `URGENT: Complaint #${complaint.trackingId} has breached its Resolution SLA limit.`;
      await this.notifyManagers(complaint, title, message);
    }

    // Multi breach checks
    await this.processMultiBreachRules(complaint, config, now);

    // Audit logs
    if (actions.includes('AUDIT_LOG')) {
      await AuditEngine.logEscalationAction({
        action: 'SLA_BREACH',
        complaintId: complaint._id,
        level: complaint.currentEscalationLevel,
        previousOwner: complaint.assignedTo,
        newOwner: complaint.assignedTo,
        reason: 'Resolution SLA Breached',
        actor: 'System'
      });

      // Persistent structured audit entry
      const EscalationAudit = require('../../models/EscalationAudit');
      await EscalationAudit.create({
        action: 'SLA_BREACH',
        complaintId: complaint._id,
        breachType: 'resolution',
        previousPriority,
        newPriority: complaint.priority,
        previousEscalationLevel,
        newEscalationLevel: complaint.currentEscalationLevel,
        reason: 'Resolution SLA Breached',
        actor: 'System',
        timestamp: now
      });
    }
  }

  /**
   * Multi breach threshold checks.
   */
  async processMultiBreachRules(complaint, config, now) {
    const count = complaint.totalBreachCount || 0;
    const rules = config.multiBreachRules || [];
    const rule = rules.find(r => r.breachCount === count);
    
    if (!rule) return;

    console.log(`[SlaActionEngine] Multi-Breach Rule Triggered for count ${count}: ${rule.action}`);

    if (rule.action === 'NOTIFY_MANAGER') {
      await this.notifyManagers(complaint, `Multi-Breach (Level 1) Alert`, `Complaint #${complaint.trackingId} reached ${count} SLA breach.`);
    } else if (rule.action === 'PRIORITY_UPGRADE') {
      const upgraded = this.upgradePriority(complaint, `Multi-Breach Rule: Total SLA Breach Count reached ${count}`);
      if (upgraded) {
        await this.recalculateSlaAfterPriorityUpgrade(complaint, now);
      }
    } else if (rule.action === 'NOTIFY_DEPT_HEAD') {
      // Notify department manager / head
      const title = `Multi-Breach (Level 3) Department Head Alert`;
      const message = `CRITICAL: Complaint #${complaint.trackingId} has breached SLA ${count} times.`;
      await this.notifyManagers(complaint, title, message);
    } else if (rule.action === 'EXECUTIVE_ESCALATE') {
      complaint.executiveEscalated = true;
      complaint.executiveEscalatedAt = now;
      complaint.executiveEscalationReason = `Multi-Breach Rule: Total SLA Breach Count reached ${count}`;
      complaint.history.push({
        action: 'Executive Escalation triggered due to repeated SLA failures',
        actor: 'SLA Engine'
      });
      await this.notifyManagers(complaint, 'EXECUTIVE ESCALATION ALERT', `Complaint #${complaint.trackingId} escalated to Directors due to SLA failure.`);
    } else if (rule.action === 'CRITICAL_INCIDENT_FLAG') {
      complaint.attentionRequired = true;
      complaint.riskScore = 100;
      complaint.history.push({
        action: 'Complaint flagged as Critical Incident due to maximum SLA failures',
        actor: 'SLA Engine'
      });
    }
  }
}

module.exports = new SlaActionEngine();
