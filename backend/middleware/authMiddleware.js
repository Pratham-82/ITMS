const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }
  return process.env.JWT_SECRET || 'apexresolve_development_jwt_secret';
};

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, getJwtSecret());

      // Get user from the token, exclude password, bypass tenant plugin for validation, populate groups & department
      req.user = await User.findOne({ _id: decoded.id })
        .setOptions({ bypassTenant: true })
        .select('-password')
        .populate({
          path: 'groups',
          populate: {
            path: 'department'
          }
        });
      
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      // Enforce the user's actual registered tenantId for all downstream operations
      const tenantLocalStorage = require('./tenantContext');
      const activeTenant = req.user.tenantId || 'default-tenant';
      req.tenantId = activeTenant;

      tenantLocalStorage.run(activeTenant, () => {
        next();
      });
    } catch (error) {
      console.error(error);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user ? req.user.role : 'none'}' is not authorized to access this route`
      });
    }
    next();
  };
};

const defaultPermissions = {
  allowAll: true,
  systemSettings: false,
  slaSettings: false,
  escalationRules: false,
  escalationAnalytics: true,
  manageFields: true,
  manageStaff: false,
  manageDepartments: true
};

const checkSettingsPermission = (permissionKey) => {
  return (req, res, next) => {
    const isSuperAdmin = req.user && req.user.role === 'admin' && (
      (req.user.groups && req.user.groups.length > 0 && req.user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
      ((!req.user.groups || req.user.groups.length === 0) && (!req.user.department || req.user.department === 'General Administration'))
    );
    if (isSuperAdmin) {
      return next();
    }

    const perms = {
      ...defaultPermissions,
      ...(req.user && req.user.settingsPermissions ? (req.user.settingsPermissions.toObject ? req.user.settingsPermissions.toObject() : req.user.settingsPermissions) : {})
    };

    if (
      req.user &&
      req.user.role === 'admin' &&
      perms.allowAll &&
      perms[permissionKey]
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied: You do not have permission to access or modify settings: ${permissionKey}`
    });
  };
};

module.exports = { protect, authorize, checkSettingsPermission };
