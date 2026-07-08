const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const MetadataTypeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Please add a metadata type code'],
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Please add a metadata type name'],
    trim: true
  }
}, {
  timestamps: true,
  bypassTenantPlugin: true,
  globalModel: true
});

module.exports = createTenantModelProxy('MetadataType', MetadataTypeSchema);
