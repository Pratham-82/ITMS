const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const JobQueueSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'default-tenant',
    index: true
  },
  jobType: {
    type: String,
    required: [true, 'Please specify the job type'],
    enum: ['SLA_BREACH_CHECK', 'NOTIFICATION_DISPATCH', 'AUTO_CLOSE_CHECK', 'ESCALATION_CHECK']
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed', 'dlq'],
    default: 'queued'
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  runAt: {
    type: Date,
    required: [true, 'Please specify the execution time']
  },
  lockedAt: {
    type: Date,
    default: null
  },
  lastError: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { bypassTenantPlugin: true, globalModel: true });

// Indexes for query performance
JobQueueSchema.index({ status: 1, runAt: 1 });
JobQueueSchema.index({ runAt: 1 });

module.exports = createTenantModelProxy('JobQueue', JobQueueSchema);
