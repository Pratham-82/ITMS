const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const AiRoutingLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  inputText: {
    type: String,
    required: true
  },
  suggestedDepartmentName: {
    type: String,
    default: null
  },
  suggestedCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  suggestedCategoryName: {
    type: String,
    default: null
  },
  confidence: {
    type: Number,
    default: 0
  },
  reasoning: {
    type: String,
    default: null
  },
  responseTimeMs: {
    type: Number,
    default: 0
  },
  isSuccess: {
    type: Boolean,
    default: true
  },
  errorType: {
    type: String,
    default: null
  },
  cachedResponse: {
    type: Boolean,
    default: false
  },
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    default: null
  },
  userOverride: {
    type: Boolean,
    default: false
  },
  acceptedRecommendation: {
    type: Boolean,
    default: false
  },
  overrideReason: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for telemetry and audit log searches
AiRoutingLogSchema.index({ createdAt: -1 });
AiRoutingLogSchema.index({ userId: 1 });

module.exports = createTenantModelProxy('AiRoutingLog', AiRoutingLogSchema);
