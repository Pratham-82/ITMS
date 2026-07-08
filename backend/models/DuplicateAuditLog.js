const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const DuplicateAuditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  userName: {
    type: String,
    default: 'System'
  },
  action: {
    type: String,
    required: true,
    enum: ['DUPLICATE_DETECTED', 'COMPLAINT_JOINED', 'COMPLAINT_MERGED', 'PRIORITY_CHANGED', 'ESCALATION_TRIGGERED']
  },
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    default: null
  },
  parentComplaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    default: null
  },
  reason: {
    type: String,
    default: null
  },
  previousValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index on action and createdAt
DuplicateAuditLogSchema.index({ action: 1 });
DuplicateAuditLogSchema.index({ createdAt: -1 });

module.exports = createTenantModelProxy('DuplicateAuditLog', DuplicateAuditLogSchema);
