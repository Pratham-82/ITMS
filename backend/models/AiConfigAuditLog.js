const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const AiConfigAuditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = createTenantModelProxy('AiConfigAuditLog', AiConfigAuditLogSchema);
