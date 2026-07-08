const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const AssetRelationshipSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'default-tenant',
    index: true
  },
  sourceAssetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: [true, 'Please specify the source asset']
  },
  targetAssetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: [true, 'Please specify the target asset']
  },
  relationshipType: {
    type: String,
    required: [true, 'Please specify the relationship type']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  }
}, { timestamps: true });

// Scope query to tenant
AssetRelationshipSchema.pre('find', function() {
  if (!this.getQuery().tenantId && !this.getQuery()._id) {
    this.where({ tenantId: 'default-tenant' });
  }
});
AssetRelationshipSchema.pre('findOne', function() {
  if (!this.getQuery().tenantId && !this.getQuery()._id) {
    this.where({ tenantId: 'default-tenant' });
  }
});
AssetRelationshipSchema.pre('countDocuments', function() {
  if (!this.getQuery().tenantId && !this.getQuery()._id) {
    this.where({ tenantId: 'default-tenant' });
  }
});

module.exports = createTenantModelProxy('AssetRelationship', AssetRelationshipSchema);
