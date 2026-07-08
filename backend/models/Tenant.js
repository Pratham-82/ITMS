const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a tenant name'],
    trim: true
  },
  subdomain: {
    type: String,
    required: [true, 'Please add a subdomain'],
    unique: true,
    lowercase: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  branding: {
    logoUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#6366f1' },
    secondaryColor: { type: String, default: '#1f2937' },
    websiteName: { type: String, default: 'ApexResolve Portal' },
    websiteDescription: { type: String, default: 'Enterprise ITSM & Asset Management' }
  }
}, { 
  timestamps: true,
  bypassTenantPlugin: true, // Instructs the tenantPlugin to ignore this schema
  globalModel: true // Instructs the tenantModelProxy to keep this in the central database
});

module.exports = createTenantModelProxy('Tenant', TenantSchema);
