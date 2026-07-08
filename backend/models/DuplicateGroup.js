const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const DuplicateGroupSchema = new mongoose.Schema({
  parentComplaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true,
    unique: true
  },
  duplicateCount: {
    type: Number,
    default: 0
  },
  impactScore: {
    type: Number,
    default: 0
  },
  supporterCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for speed query
DuplicateGroupSchema.index({ parentComplaintId: 1 });

module.exports = createTenantModelProxy('DuplicateGroup', DuplicateGroupSchema);
