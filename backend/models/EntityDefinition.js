const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const EntityDefinitionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Please add an entity code'],
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Please add an entity name'],
    trim: true
  },
  pluralName: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    default: 'Core',
    trim: true
  },
  version: {
    type: Number,
    default: 1
  },
  icon: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  supportsWorkflow: {
    type: Boolean,
    default: false
  },
  supportsApproval: {
    type: Boolean,
    default: false
  },
  supportsComments: {
    type: Boolean,
    default: false
  },
  supportsAttachments: {
    type: Boolean,
    default: false
  },
  supportsAudit: {
    type: Boolean,
    default: false
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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
}, {
  timestamps: true
});

module.exports = createTenantModelProxy('EntityDefinition', EntityDefinitionSchema);
