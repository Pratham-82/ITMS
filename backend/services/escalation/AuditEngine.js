const EscalationAudit = require('../../models/EscalationAudit');

/**
 * AuditEngine records all audit events for assignments and escalations.
 */
class AuditEngine {
  /**
   * Log an escalation or assignment event.
   */
  async logEscalationAction({
    action,
    complaintId,
    level = 0,
    previousOwner = null,
    newOwner = null,
    previousDepartment = null,
    newDepartment = null,
    reason = null,
    actor = 'System'
  }) {
    try {
      await EscalationAudit.create({
        action,
        complaintId,
        level,
        previousOwner,
        newOwner,
        previousDepartment,
        newDepartment,
        reason,
        actor,
        timestamp: new Date()
      });
      console.log(`[AuditEngine] Logged audit action: "${action}" for complaint ID ${complaintId}`);
    } catch (error) {
      console.error('[AuditEngine] Error creating escalation audit log:', error);
    }
  }
}

module.exports = new AuditEngine();
