const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const EscalationLevelSchema = new mongoose.Schema({
  level: {
    type: Number,
    required: true
  },
  department: {
    type: String,
    default: ''
  },
  durationHours: {
    type: Number,
    default: 0
  },
  targetType: {
    type: String,
    enum: ['department', 'group', 'role', 'user'],
    default: 'department'
  },
  targetId: {
    type: String,
    default: ''
  },
  responseSlaMinutes: {
    type: Number,
    default: 0
  },
  resolutionSlaMinutes: {
    type: Number,
    default: 0
  },
  warningThresholds: {
    type: [Number],
    default: [50, 75, 90]
  },
  isParallelBranch: {
    type: Boolean,
    default: false
  },
  responseSlaActions: {
    type: [String],
    default: undefined
  },
  resolutionSlaActions: {
    type: [String],
    default: undefined
  },
  description: {
    type: String,
    trim: true
  }
});

const EscalationRuleSchema = new mongoose.Schema({
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
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Please specify a department for this escalation rule']
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Please specify a category for this escalation rule']
  },
  categoryName: {
    type: String,
    required: true
  },
  workflowName: {
    type: String,
    required: [true, 'Please specify a name for the workflow'],
    trim: true
  },
  levels: [EscalationLevelSchema],
  calendar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessCalendar',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

EscalationRuleSchema.index({ tenantId: 1, departmentId: 1, categoryId: 1, ticketTypeId: 1 }, { unique: true });
EscalationRuleSchema.index({ tenantId: 1, categoryId: 1, isActive: 1 });

module.exports = createTenantModelProxy('EscalationRule', EscalationRuleSchema);
