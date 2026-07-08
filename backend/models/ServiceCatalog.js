const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const ServiceCatalogSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a catalog name'],
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    default: 'Folder'
  },
  color: {
    type: String,
    default: '#6366f1'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = createTenantModelProxy('ServiceCatalog', ServiceCatalogSchema);
