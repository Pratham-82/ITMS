const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const TicketTypeSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'default-tenant',
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please add a ticket type name'],
    trim: true,
    unique: true
  },
  code: {
    type: String,
    required: [true, 'Please add a prefix code'],
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: 'HelpCircle'
  },
  color: {
    type: String,
    default: '#6366f1'
  },
  allowedRoles: {
    type: [String],
    default: ['citizen', 'admin']
  },
  settings: {
    enableSla: { type: Boolean, default: true },
    enableEscalation: { type: Boolean, default: true },
    enableAiRouting: { type: Boolean, default: true },
    enableDuplicateDetection: { type: Boolean, default: true }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Scope query to tenant
const scopeQuery = function() {
  if (!this.getQuery().tenantId && !this.getQuery()._id) {
    this.where({ tenantId: 'default-tenant' });
  }
};

TicketTypeSchema.pre('find', scopeQuery);
TicketTypeSchema.pre('findOne', scopeQuery);
TicketTypeSchema.pre('countDocuments', scopeQuery);

module.exports = createTenantModelProxy('TicketType', TicketTypeSchema);
