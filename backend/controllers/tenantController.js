const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { seedTenantDefaults } = require('../services/tenantDefaults');
const tenantLocalStorage = require('../middleware/tenantContext');

// @desc    Register a new tenant (onboard company)
// @route   POST /api/tenants/register
// @access  Public
const registerTenant = async (req, res) => {
  try {
    const { name, subdomain, adminName, adminEmail, adminPassword } = req.body;

    if (!name || !subdomain || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const subdomainLower = subdomain.trim().toLowerCase();

    // Check if subdomain is already taken
    const tenantExists = await Tenant.findOne({ subdomain: subdomainLower });
    if (tenantExists) {
      return res.status(400).json({ success: false, message: 'This subdomain is already registered' });
    }

    // Check if admin email is already taken globally
    const emailLower = adminEmail.trim().toLowerCase();
    const userExists = await User.findOne({ email: emailLower }).setOptions({ bypassTenant: true });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'A user with this email address already exists' });
    }

    // 1. Create Tenant Record
    const tenant = await Tenant.create({
      name,
      subdomain: subdomainLower,
      branding: {
        websiteName: `${name} Helpdesk`,
        websiteDescription: `Service Desk for ${name}`,
        primaryColor: '#6366f1' // Default Indigo
      }
    });

    // 2. Seed Default Settings & Categories for this new tenant
    await seedTenantDefaults(subdomainLower);

    // 3. Create Tenant Admin inside their tenant context
    let admin;
    await tenantLocalStorage.run(subdomainLower, async () => {
      admin = await User.create({
        name: adminName,
        email: emailLower,
        password: adminPassword,
        role: 'admin',
        tenantId: subdomainLower,
        department: 'General Administration',
        isVerified: true
      });
    });

    res.status(201).json({
      success: true,
      message: 'Tenant registered and bootstrapped successfully',
      data: {
        tenant,
        admin: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current resolved tenant branding details
// @route   GET /api/tenants/info
// @access  Public
const getTenantInfo = async (req, res) => {
  try {
    const activeTenantId = req.tenantId || 'default-tenant';
    
    let tenant = null;
    if (activeTenantId !== 'default-tenant') {
      tenant = await Tenant.findOne({ subdomain: activeTenantId });
    }

    if (!tenant) {
      // Return default branding info
      return res.status(200).json({
        success: true,
        data: {
          name: 'Default Portal',
          subdomain: 'default-tenant',
          branding: {
            websiteName: 'ApexResolve Portal',
            websiteDescription: 'Enterprise ITSM & Asset Management Portal',
            primaryColor: '#6366f1',
            logoUrl: ''
          }
        }
      });
    }

    res.status(200).json({
      success: true,
      data: tenant
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all tenants (for SaaS owner)
// @route   GET /api/tenants
// @access  Private (SaaS Owner only)
const getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find({}).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: tenants.length,
      data: tenants
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update tenant status or details
// @route   PUT /api/tenants/:id
// @access  Private (SaaS Owner only)
const updateTenant = async (req, res) => {
  try {
    const { name, isActive, branding } = req.body;
    let tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    if (name !== undefined) tenant.name = name.trim();
    if (isActive !== undefined) tenant.isActive = isActive;
    if (branding !== undefined) {
      tenant.branding = {
        ...tenant.branding,
        ...branding
      };
    }

    await tenant.save();

    res.status(200).json({
      success: true,
      data: tenant
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete tenant (hard delete)
// @route   DELETE /api/tenants/:id
// @access  Private (SaaS Owner only)
const deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    await Tenant.deleteOne({ _id: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Tenant deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerTenant,
  getTenantInfo,
  getAllTenants,
  updateTenant,
  deleteTenant
};

