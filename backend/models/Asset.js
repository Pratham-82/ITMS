const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');
const tenantLocalStorage = require('../middleware/tenantContext');

const AssetSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'default-tenant',
    index: true
  },
  assetCode: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Please add an asset name'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssetCategory',
    required: [true, 'Please specify an asset category']
  },
  assetTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssetType',
    required: [true, 'Please specify an asset type']
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  ownerEmail: {
    type: String,
    default: '',
    index: true,
    lowercase: true,
    trim: true
  },
  custodianUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  custodianEmail: {
    type: String,
    default: '',
    index: true,
    lowercase: true,
    trim: true
  },
  status: {
    type: String,
    default: 'Active'
  },
  purchaseDate: {
    type: Date,
    default: null
  },
  warrantyExpiry: {
    type: Date,
    default: null
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  serialNumber: {
    type: String,
    trim: true,
    default: '',
    index: true
  },
  dynamicValues: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Pre-save hook to generate sequential assetCode based on assetType prefix
AssetSchema.pre('save', async function(next) {
  if (this.isNew && !this.assetCode) {
    try {
      const AssetType = require('./AssetType');
      const Counter = require('./Counter');
      const typeDoc = await AssetType.findById(this.assetTypeId);
      const prefix = typeDoc ? typeDoc.assetPrefix : 'AST';

      const activeTenant = tenantLocalStorage.getStore() || this.tenantId || 'default-tenant';
      this.tenantId = activeTenant;
      const counterKey = `assetCode_${activeTenant}_${prefix.toLowerCase()}`;
      
      // Initialize sequence at 1 if not exists
      const counter = await Counter.findByIdAndUpdate(
        { _id: counterKey },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      const paddedSeq = String(counter.seq).padStart(6, '0');
      this.assetCode = `${prefix}-${paddedSeq}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});



module.exports = createTenantModelProxy('Asset', AssetSchema);
