const superAdminOnly = (req, res, next) => {
  if (
    req.user &&
    req.user.role === 'admin' &&
    req.user.department === 'General Administration' &&
    (req.user.tenantId === 'default-tenant' || !req.user.tenantId)
  ) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Only SaaS Platform Owner can perform this action'
    });
  }
};

module.exports = { superAdminOnly };

