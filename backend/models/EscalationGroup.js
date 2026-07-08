const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const EscalationGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a support group name'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  backupLeader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
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

module.exports = createTenantModelProxy('EscalationGroup', EscalationGroupSchema);
