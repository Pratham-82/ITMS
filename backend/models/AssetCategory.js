const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const AssetCategorySchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'default-tenant',
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please add a category name'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    default: 'box'
  },
  color: {
    type: String,
    default: '#6366f1'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Scope query to tenant
AssetCategorySchema.pre('find', function() {
  if (!this.getQuery().tenantId && !this.getQuery()._id) {
    this.where({ tenantId: 'default-tenant' });
  }
});
AssetCategorySchema.pre('findOne', function() {
  if (!this.getQuery().tenantId && !this.getQuery()._id) {
    this.where({ tenantId: 'default-tenant' });
  }
});
AssetCategorySchema.pre('countDocuments', function() {
  if (!this.getQuery().tenantId && !this.getQuery()._id) {
    this.where({ tenantId: 'default-tenant' });
  }
});

module.exports = createTenantModelProxy('AssetCategory', AssetCategorySchema);
