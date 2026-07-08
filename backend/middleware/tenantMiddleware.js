const tenantLocalStorage = require('./tenantContext');
const Tenant = require('../models/Tenant');

const resolveTenant = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  // Remove port number if present (e.g. localhost:5001 -> localhost)
  const hostname = host.split(':')[0].toLowerCase();
  const parts = hostname.split('.');
  
  // 1. Resolve from custom header
  if (req.headers['x-tenant-id']) {
    return req.headers['x-tenant-id'].toLowerCase();
  }
  
  // 2. Resolve from query param
  if (req.query && req.query.tenantId) {
    return req.query.tenantId.toLowerCase();
  }

  // 3. Resolve from hostname subdomain
  
  // Check for localhost subdomains (e.g. acme.localhost -> parts: ['acme', 'localhost'])
  if (parts.length === 2 && parts[1] === 'localhost') {
    const subdomain = parts[0];
    if (subdomain !== 'www' && subdomain !== 'api') {
      return subdomain;
    }
  }

  // Check for Render default domains (e.g. app-name.onrender.com)
  if (hostname.endsWith('.onrender.com')) {
    if (parts.length === 3) {
      // e.g. itms-rppx.onrender.com -> base app domain, return default-tenant
      return 'default-tenant';
    } else if (parts.length > 3) {
      // e.g. acme.itms-rppx.onrender.com -> acme is the tenant subdomain
      const subdomain = parts[0];
      if (subdomain !== 'www' && subdomain !== 'api') {
        return subdomain;
      }
    }
  }

  // Check for standard custom multi-level domains (e.g. acme.apexresolve.com)
  if (parts.length > 2 && !hostname.endsWith('.onrender.com')) {
    const subdomain = parts[0];
    if (subdomain !== 'www' && subdomain !== 'api') {
      return subdomain;
    }
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
