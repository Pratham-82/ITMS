const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const DepartmentCategorySchema = new mongoose.Schema({
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department reference is required']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category reference is required']
  },
  assignedGroup: {
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
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound unique index for department and category combination
DepartmentCategorySchema.index({ department: 1, category: 1 }, { unique: true });

// Also add a basic index for category querying
DepartmentCategorySchema.index({ category: 1 });

module.exports = createTenantModelProxy('DepartmentCategory', DepartmentCategorySchema);
