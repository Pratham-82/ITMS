const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const SlaTargetSchema = new mongoose.Schema({
  responseSlaMinutes: {
    type: Number,
    required: true,
    min: [1, 'Response SLA must be at least 1 minute']
  },
  resolutionSlaMinutes: {
    type: Number,
    required: true,
    min: [1, 'Resolution SLA must be at least 1 minute']
  }
});

const SlaConfigurationSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'default-tenant',
    index: true
  },
  ticketTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketType',
    default: null
  },
  name: {
    type: String,
    required: true,
    default: 'Standard SLA Matrix',
    unique: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  priorities: {
    Critical: {
      type: SlaTargetSchema,
      default: () => ({ responseSlaMinutes: 15, resolutionSlaMinutes: 240 })
    },
    High: {
      type: SlaTargetSchema,
      default: () => ({ responseSlaMinutes: 60, resolutionSlaMinutes: 480 })
    },
    Medium: {
      type: SlaTargetSchema,
      default: () => ({ responseSlaMinutes: 240, resolutionSlaMinutes: 1440 })
    },
    Low: {
      type: SlaTargetSchema,
      default: () => ({ responseSlaMinutes: 480, resolutionSlaMinutes: 4320 })
    }
  },
  breachActions: {
    responseSla: {
      type: [String],
      enum: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'NOTIFY_DEPT_HEAD', 'PRIORITY_UPGRADE', 'LEVEL_ESCALATION', 'MARK_ATTENTION', 'INCREASE_RISK_SCORE', 'FLAG_DASHBOARD', 'EXECUTIVE_ESCALATE'],
      default: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'PRIORITY_UPGRADE', 'LEVEL_ESCALATION', 'MARK_ATTENTION']
    },
    resolutionSla: {
      type: [String],
      enum: ['AUDIT_LOG', 'HISTORY_LOG', 'LEVEL_ESCALATION', 'NOTIFY_DEPT_HEAD', 'NOTIFY_ASSIGNED', 'INCREASE_RISK_SCORE', 'FLAG_DASHBOARD', 'PRIORITY_UPGRADE', 'EXECUTIVE_ESCALATE', 'NOTIFY_MANAGER', 'MARK_ATTENTION'],
      default: ['AUDIT_LOG', 'HISTORY_LOG', 'LEVEL_ESCALATION', 'NOTIFY_DEPT_HEAD', 'NOTIFY_ASSIGNED', 'INCREASE_RISK_SCORE', 'FLAG_DASHBOARD']
    }
  },
  multiBreachRules: {
    type: [{
      breachCount: { type: Number },
      action: { type: String, enum: ['NOTIFY_MANAGER', 'PRIORITY_UPGRADE', 'NOTIFY_DEPT_HEAD', 'EXECUTIVE_ESCALATE', 'CRITICAL_INCIDENT_FLAG'] }
    }],
    default: [
      { breachCount: 1, action: 'NOTIFY_MANAGER' },
      { breachCount: 2, action: 'PRIORITY_UPGRADE' },
      { breachCount: 3, action: 'NOTIFY_DEPT_HEAD' },
      { breachCount: 4, action: 'EXECUTIVE_ESCALATE' },
      { breachCount: 5, action: 'CRITICAL_INCIDENT_FLAG' }
    ]
  },
  riskScoreRules: {
    responseBreachIncrease: { type: Number, default: 10 },
    resolutionBreachIncrease: { type: Number, default: 20 },
    reopenIncrease: { type: Number, default: 15 },
    escalationIncrease: { type: Number, default: 10 },
    lowRatingIncrease: { type: Number, default: 15 },
    criticalPriorityIncrease: { type: Number, default: 20 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to ensure only one default SLA matrix exists
SlaConfigurationSchema.pre('save', async function (next) {
  if (this.isDefault) {
    try {
      await this.constructor.updateMany(
        { _id: { $ne: this._id }, tenantId: this.tenantId || 'default-tenant' },
        { isDefault: false }
      );
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = createTenantModelProxy('SlaConfiguration', SlaConfigurationSchema);
