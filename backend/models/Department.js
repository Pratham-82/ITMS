const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a department name'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  calendar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessCalendar',
    default: null
  },
  routingGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscalationGroup',
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

DepartmentSchema.index({ isActive: 1 });

module.exports = createTenantModelProxy('Department', DepartmentSchema);
