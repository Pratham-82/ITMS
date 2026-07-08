const SlaConfiguration = require('../../models/SlaConfiguration');
const EscalationRule = require('../../models/EscalationRule');
const CalendarEngine = require('./CalendarEngine');

/**
 * SlaEngine is responsible for calculating Response/Resolution SLA targets
 * and evaluating SLA warnings and breaches for active complaints.
 */
class SlaEngine {
  /**
   * Helper to retrieve priority-based SLA configurations.
   */
  async getPrioritySlaConfig(priority, ticketType = null, tenantId = 'default-tenant') {
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
    if (!slaConfig) {
      slaConfig = {
        priorities: {
          Critical: { responseSlaMinutes: 15, resolutionSlaMinutes: 240 },
          High: { responseSlaMinutes: 60, resolutionSlaMinutes: 480 },
          Medium: { responseSlaMinutes: 240, resolutionSlaMinutes: 1440 },
          Low: { responseSlaMinutes: 480, resolutionSlaMinutes: 4320 }
        }
      };
    }
    return slaConfig.priorities[priority || 'Low'] || slaConfig.priorities['Low'];
  }

  /**
   * Calculates the due date for first response.
   */
  async calculateResponseDueDate(complaint, calendar) {
    const priorityConfig = await this.getPrioritySlaConfig(complaint.priority, complaint.ticketType, complaint.tenantId);
    let minutes = priorityConfig.responseSlaMinutes;

    // Check level overrides if escalation rule exists
    if (complaint.escalationWorkflowId) {
      const rule = await EscalationRule.findById(complaint.escalationWorkflowId);
      if (rule && rule.levels && rule.levels.length > 0) {
        const currentLevel = complaint.currentEscalationLevel || 0;
        const targetLevel = currentLevel === 0 ? 1 : currentLevel;
        const levelDetails = rule.levels.find(l => l.level === targetLevel);
        if (levelDetails && levelDetails.responseSlaMinutes && levelDetails.responseSlaMinutes > 0) {
          minutes = levelDetails.responseSlaMinutes;
        }
      }
    }

    return await CalendarEngine.calculateDueDate(new Date(), minutes, calendar, complaint.assignedDepartment);
  }

  /**
   * Calculates the due date for final resolution.
   */
  async calculateResolutionDueDate(complaint, calendar) {
    const priorityConfig = await this.getPrioritySlaConfig(complaint.priority, complaint.ticketType, complaint.tenantId);
    let minutes = priorityConfig.resolutionSlaMinutes;

    if (complaint.escalationWorkflowId) {
      const rule = await EscalationRule.findById(complaint.escalationWorkflowId);
      if (rule && rule.levels && rule.levels.length > 0) {
        const currentLevel = complaint.currentEscalationLevel || 0;
        const targetLevel = currentLevel === 0 ? 1 : currentLevel;
        const levelDetails = rule.levels.find(l => l.level === targetLevel);
        if (levelDetails && levelDetails.resolutionSlaMinutes && levelDetails.resolutionSlaMinutes > 0) {
          minutes = levelDetails.resolutionSlaMinutes;
        }
      }
    }

    return await CalendarEngine.calculateDueDate(new Date(), minutes, calendar, complaint.assignedDepartment);
  }

  /**
   * Evaluates the current SLA states (warnings, breaches) of a complaint.
   * Modifies complaint object but does NOT call save().
   * @returns {Object} Evaluation summary
   */
  async evaluateComplaint(complaint, now = new Date()) {
    let isUpdated = false;
    const events = [];

    // Skip SLA checks for resolved/rejected/closed/paused complaints
    if (['Resolved', 'Rejected', 'Closed'].includes(complaint.status) || complaint.slaPaused) {
      return { isUpdated, events };
    }

    // 1. Evaluate Response SLA
    if (
      complaint.responseDueAt &&
      !complaint.firstResponseAt &&
      complaint.responseSlaStatus !== 'Breached' &&
      complaint.responseSlaStatus !== 'Met'
    ) {
      if (complaint.responseDueAt <= now) {
        complaint.responseSlaStatus = 'Breached';
        complaint.history.push({
          action: 'First Response SLA Breached',
          actor: 'System'
        });
        events.push({ type: 'RESPONSE_SLA_BREACH' });
        isUpdated = true;
      } else {
        const createdTime = complaint.createdAt.getTime();
        const dueTime = complaint.responseDueAt.getTime();
        const totalDuration = dueTime - createdTime;
        const elapsed = now.getTime() - createdTime;
        const percentConsumed = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

        const thresholds = [50, 75, 90, 95];
        for (const threshold of thresholds) {
          if (percentConsumed >= threshold && !complaint.firedSlaWarnings.includes(threshold)) {
            complaint.firedSlaWarnings.push(threshold);
            complaint.responseSlaStatus = 'Warning';
            complaint.history.push({
              action: `Response SLA warning triggered: ${threshold}% time consumed`,
              actor: 'System'
            });
            events.push({ type: 'RESPONSE_SLA_WARNING', threshold });
            isUpdated = true;
            break; // trigger one warning level at a time
          }
        }
      }
    }

    // 2. Evaluate Resolution SLA
    if (
      complaint.resolutionDueAt &&
      complaint.resolutionSlaStatus !== 'Breached' &&
      complaint.resolutionSlaStatus !== 'Met'
    ) {
      if (complaint.resolutionDueAt <= now) {
        complaint.resolutionSlaStatus = 'Breached';
        complaint.history.push({
          action: 'Resolution SLA Breached',
          actor: 'System'
        });
        events.push({ type: 'RESOLUTION_SLA_BREACH' });
        isUpdated = true;
      } else {
        const createdTime = complaint.createdAt.getTime();
        const dueTime = complaint.resolutionDueAt.getTime();
        const totalDuration = dueTime - createdTime;
        const elapsed = now.getTime() - createdTime;
        const percentConsumed = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

        const thresholds = [50, 75, 90, 95];
        for (const threshold of thresholds) {
          if (percentConsumed >= threshold && !complaint.firedSlaWarnings.includes(100 + threshold)) {
            complaint.firedSlaWarnings.push(100 + threshold);
            complaint.resolutionSlaStatus = 'Warning';
            complaint.history.push({
              action: `Resolution SLA warning triggered: ${threshold}% time consumed`,
              actor: 'System'
            });
            events.push({ type: 'RESOLUTION_SLA_WARNING', threshold });
            isUpdated = true;
            break;
          }
        }
      }
    }

    return { isUpdated, events };
  }
}

module.exports = new SlaEngine();
