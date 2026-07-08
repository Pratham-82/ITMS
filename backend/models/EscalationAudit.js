const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const EscalationAuditSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  level: {
    type: Number,
    default: 0
  },
  previousOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  newOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  previousDepartment: {
    type: String,
    default: null
  },
  newDepartment: {
    type: String,
    default: null
  },
  reason: {
    type: String,
    default: null
  },
  actor: {
    type: String,
    required: true,
    default: 'System'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

EscalationAuditSchema.index({ complaintId: 1 });
EscalationAuditSchema.index({ timestamp: -1 });

module.exports = createTenantModelProxy('EscalationAudit', EscalationAuditSchema);
