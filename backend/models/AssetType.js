const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const DynamicFieldSchema = new mongoose.Schema({
  fieldKey: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: ['text', 'textarea', 'number', 'date', 'datetime', 'boolean', 'email', 'phone', 'url', 'select', 'multiselect', 'user', 'department', 'asset'],
    default: 'text'
  },
  required: { type: Boolean, default: false },
  defaultValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  helpText: { type: String, default: '' },
  searchable: { type: Boolean, default: true },
  filterable: { type: Boolean, default: true },
  editable: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  options: { type: [String], default: [] },
  validationRules: { type: mongoose.Schema.Types.Mixed, default: {} },
  inboundMappingKey: { type: String, default: '' }
});

const AssetTypeSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'default-tenant',
    index: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssetCategory',
    required: [true, 'Please specify an asset category']
  },
  name: {
    type: String,
    required: [true, 'Please add an asset type name'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  assetPrefix: {
    type: String,
    required: [true, 'Please specify an asset code prefix'],
    trim: true,
    uppercase: true
  },
  lifecycleStatuses: {
    type: [String],
    default: ['Active', 'In Maintenance', 'Retired']
  },
  dynamicFields: [DynamicFieldSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Scope query to tenant
AssetTypeSchema.pre('find', function() {
  if (!this.getQuery().tenantId && !this.getQuery()._id) {
    this.where({ tenantId: 'default-tenant' });
  }
});
AssetTypeSchema.pre('findOne', function() {
  if (!this.getQuery().tenantId && !this.getQuery()._id) {
    this.where({ tenantId: 'default-tenant' });
  }
});
AssetTypeSchema.pre('countDocuments', function() {
  if (!this.getQuery().tenantId && !this.getQuery()._id) {
    this.where({ tenantId: 'default-tenant' });
  }
});

module.exports = createTenantModelProxy('AssetType', AssetTypeSchema);
