const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const MetadataAuditSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'DELETE'],
    trim: true
  },
  targetType: {
    type: String,
    required: true,
    enum: ['Entity', 'Field', 'Relationship'],
    trim: true
  },
  targetCode: {
    type: String,
    required: true,
    trim: true
  },
  changeSummary: {
    type: String,
    required: true,
    trim: true
  },
  oldValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  actor: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

MetadataAuditSchema.index({ targetType: 1, targetCode: 1 });
MetadataAuditSchema.index({ timestamp: -1 });

module.exports = createTenantModelProxy('MetadataAudit', MetadataAuditSchema);
