const tenantLocalStorage = require('./tenantContext');
const Tenant = require('../models/Tenant');

const resolveTenant = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const parts = host.split('.');
  
  // 1. Resolve from subdomain (excluding www, api)
  // Check for localhost subdomains (e.g. acme.localhost:5001 -> parts: ['acme', 'localhost:5001'])
  if (parts.length === 2) {
    const domainPart = parts[1].toLowerCase();
    if (domainPart === 'localhost' || domainPart.startsWith('localhost:')) {
      const subdomain = parts[0].toLowerCase();
      if (subdomain !== 'www' && subdomain !== 'api') {
        return subdomain;
      }
    }
  }

  // Check for standard multi-level domains (e.g. acme.apexresolve.com)
  if (parts.length > 2) {
    const subdomain = parts[0].toLowerCase();
    if (subdomain !== 'www' && subdomain !== 'api') {
      return subdomain;
    }
  }

  // 2. Resolve from custom header
  if (req.headers['x-tenant-id']) {
    return req.headers['x-tenant-id'].toLowerCase();
  }

  // 3. Resolve from query param
  if (req.query && req.query.tenantId) {
    return req.query.tenantId.toLowerCase();
  }

  return 'default-tenant';
};

const tenantMiddleware = async (req, res, next) => {
  const tenantId = resolveTenant(req);
  req.tenantId = tenantId;

  if (tenantId && tenantId !== 'default-tenant') {
    try {
      const tenantExists = await Tenant.findOne({ subdomain: tenantId });
      if (!tenantExists) {
        return res.status(404).json({ success: false, message: `Tenant subdomain "${tenantId}" not found` });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Internal server error resolving tenant context' });
    }
  }

  tenantLocalStorage.run(tenantId, () => {
    next();
  });
};

const tenantAuthMiddleware = (req, res, next) => {
  if (req.user && req.user.tenantId) {
    // Override context to enforce the authenticated user's registered tenantId
    req.tenantId = req.user.tenantId.toLowerCase();
    tenantLocalStorage.run(req.tenantId, () => {
      next();
    });
  } else {
    next();
  }
};

module.exports = { tenantMiddleware, tenantAuthMiddleware };
