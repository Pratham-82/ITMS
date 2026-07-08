const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const MaintenanceWindowSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a maintenance window title'],
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Please specify the start date']
  },
  endDate: {
    type: Date,
    required: [true, 'Please specify the end date']
  },
  affectedDepartments: {
    type: [String],
    default: [] // Empty means all departments
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

MaintenanceWindowSchema.index({ startDate: 1, endDate: 1 });

module.exports = createTenantModelProxy('MaintenanceWindow', MaintenanceWindowSchema);
