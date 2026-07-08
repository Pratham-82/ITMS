const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Settings = require('../models/Settings');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }
  return process.env.JWT_SECRET || 'apexresolve_development_jwt_secret';
};

// Generate JWT token helper
const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public

// @desc    Register a new user with email verification
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    const settings = await Settings.findOne({ key: 'system_branding' });
    if (settings && settings.allowCitizenRegistration === false) {
      return res.status(403).json({ success: false, message: 'Public registration is currently disabled' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email }).setOptions({ bypassTenant: true });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'citizen',
      department: department || '',
      isVerified: true
    });

    // Auto-link assets matching this email address
    try {
      const Asset = require('../models/Asset');
      const emailLower = email.trim().toLowerCase();
      await Asset.updateMany(
        { ownerEmail: emailLower, ownerUserId: null },
        { ownerUserId: user._id }
      );
      await Asset.updateMany(
        { custodianEmail: emailLower, custodianUserId: null },
        { custodianUserId: user._id }
      );
    } catch (err) {
      console.error('Asset auto-link failed on registerUser:', err);
    }

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId || 'default-tenant',
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email }).setOptions({ bypassTenant: true }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Verify that the user belongs to this tenant/subdomain workspace
    const resolvedTenant = req.tenantId || 'default-tenant';
    const userTenant = user.tenantId || 'default-tenant';
    if (userTenant.toLowerCase() !== resolvedTenant.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Your account is registered under a different organization workspace. Please log in from the correct URL.'
      });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId || 'default-tenant',
        department: user.department,
        dashboardConfig: user.dashboardConfig,
        maxCapacity: user.maxCapacity,
        availabilityStatus: user.availabilityStatus,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user dashboard config
// @route   PUT /api/auth/dashboard-config
// @access  Private
const updateDashboardConfig = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.dashboardConfig = req.body;
    user.markModified('dashboardConfig');
    await user.save();

    res.status(200).json({
      success: true,
      data: user.dashboardConfig
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all admin users
// @route   GET /api/auth/admins
// @access  Private (Admin only)
const getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).populate({
      path: 'groups',
      populate: {
        path: 'department'
      }
    });
    res.status(200).json({
      success: true,
      count: admins.length,
      data: admins
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all users (admins and citizens)
// @route   GET /api/auth/users
// @access  Private (Admin only)
const getUsers = async (req, res) => {
  try {
    const users = await User.find({});
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new admin user
// @route   POST /api/auth/admins
// @access  Private (Admin only)
const createAdmin = async (req, res) => {
  try {
    const { name, email, password, department, groups } = req.body;

    const userExists = await User.findOne({ email }).setOptions({ bypassTenant: true });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin',
      department: department || '',
      groups: groups || [],
      dashboardConfig: {
        showStatusChart: true,
        showCategoryChart: true,
        showPriorityStats: true,
        widgetsOrder: ['stats', 'charts', 'queue']
      },
      settingsPermissions: {
        allowAll: true,
        systemSettings: false,
        slaSettings: false,
        escalationRules: false,
        escalationAnalytics: true,
        manageFields: true,
        manageStaff: false,
        manageDepartments: true
      }
    });

    if (groups && groups.length > 0) {
      const EscalationGroup = require('../models/EscalationGroup');
      await EscalationGroup.updateMany(
        { _id: { $in: groups } },
        { $addToSet: { members: admin._id } }
      );
    }

    // Auto-link assets matching this email address
    try {
      const Asset = require('../models/Asset');
      const emailLower = email.trim().toLowerCase();
      await Asset.updateMany(
        { ownerEmail: emailLower, ownerUserId: null },
        { ownerUserId: admin._id }
      );
      await Asset.updateMany(
        { custodianEmail: emailLower, custodianUserId: null },
        { custodianUserId: admin._id }
      );
    } catch (err) {
      console.error('Asset auto-link failed on createAdmin:', err);
    }

    res.status(201).json({
      success: true,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        department: admin.department,
        groups: admin.groups
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Forgot Password - Request OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email }).setOptions({ bypassTenant: true });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If the account exists, a reset OTP has been generated'
      });
    }

    // Verify that the user belongs to this tenant/subdomain workspace
    const resolvedTenant = req.tenantId || 'default-tenant';
    const userTenant = user.tenantId || 'default-tenant';
    if (userTenant.toLowerCase() !== resolvedTenant.toLowerCase()) {
      return res.status(200).json({
        success: true,
        message: 'If the account exists, a reset OTP has been generated'
      });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP and expiration (10 minutes)
    user.resetPasswordToken = otp;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const { sendEmail } = require('../services/emailService');
    await sendEmail({
      email: user.email,
      subject: 'Your Password Reset OTP',
      message: `Your verification code is: ${otp}. It expires in 10 minutes.`
    });

    res.status(200).json({
      success: true,
      message: 'If the account exists, a reset OTP has been generated'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset Password - Verify OTP & Set New Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordToken: otp,
      resetPasswordExpire: { $gt: Date.now() }
    }).setOptions({ bypassTenant: true });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    // Set new password (pre-save hook will automatically hash it)
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify Email Token and Activate Account
// @route   GET /api/auth/verify-email?token=...
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token missing' });
    }
    const user = await User.findOne({ verificationToken: token }).setOptions({ bypassTenant: true });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update settings permissions of an admin user (Super Admin only)
// @route   PUT /api/auth/admins/:id/permissions
// @access  Private (Super Admin only)
const updateAdminPermissions = async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'admin' && (
      (req.user.groups && req.user.groups.length > 0 && req.user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
      ((!req.user.groups || req.user.groups.length === 0) && (!req.user.department || req.user.department === 'General Administration'))
    );
    if (!isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied: Only Super Administrators can update permissions' });
    }

    const admin = await User.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Administrator not found' });
    }

    if (admin.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'User is not an administrator' });
    }

    if (req.body.settingsPermissions) {
      admin.settingsPermissions = {
        allowAll: req.body.settingsPermissions.allowAll !== undefined ? req.body.settingsPermissions.allowAll : admin.settingsPermissions.allowAll,
        systemSettings: req.body.settingsPermissions.systemSettings !== undefined ? req.body.settingsPermissions.systemSettings : admin.settingsPermissions.systemSettings,
        slaSettings: req.body.settingsPermissions.slaSettings !== undefined ? req.body.settingsPermissions.slaSettings : admin.settingsPermissions.slaSettings,
        escalationRules: req.body.settingsPermissions.escalationRules !== undefined ? req.body.settingsPermissions.escalationRules : admin.settingsPermissions.escalationRules,
        escalationAnalytics: req.body.settingsPermissions.escalationAnalytics !== undefined ? req.body.settingsPermissions.escalationAnalytics : admin.settingsPermissions.escalationAnalytics,
        manageFields: req.body.settingsPermissions.manageFields !== undefined ? req.body.settingsPermissions.manageFields : admin.settingsPermissions.manageFields,
        manageStaff: req.body.settingsPermissions.manageStaff !== undefined ? req.body.settingsPermissions.manageStaff : admin.settingsPermissions.manageStaff,
        manageDepartments: req.body.settingsPermissions.manageDepartments !== undefined ? req.body.settingsPermissions.manageDepartments : admin.settingsPermissions.manageDepartments
      };
      admin.markModified('settingsPermissions');
    }

    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Permissions updated successfully',
      data: admin
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { name, email, currentPassword, newPassword, maxCapacity, availabilityStatus, department } = req.body;

    // Validate name if provided
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: 'Name cannot be empty' });
      }
      user.name = name.trim();
    }

    // Validate and update email if provided
    if (email !== undefined && email.trim().toLowerCase() !== user.email.toLowerCase()) {
      if (!email.trim()) {
        return res.status(400).json({ success: false, message: 'Email cannot be empty' });
      }
      const emailExists = await User.findOne({ email: email.trim().toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email is already in use by another account' });
      }
      user.email = email.trim().toLowerCase();
    }

    // Update department if provided
    if (department !== undefined) {
      user.department = department.trim();
    }

    // Update password if newPassword is provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to change password' });
      }
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect current password' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
      }
      user.password = newPassword;
    }

    // Update capacity and availability for admins
    if (user.role === 'admin') {
      if (maxCapacity !== undefined) {
        user.maxCapacity = Number(maxCapacity);
      }
      if (availabilityStatus !== undefined) {
        user.availabilityStatus = availabilityStatus;
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        dashboardConfig: user.dashboardConfig,
        maxCapacity: user.maxCapacity,
        availabilityStatus: user.availabilityStatus,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new user (admin or citizen)
// @route   POST /api/auth/users
// @access  Private (Admin only)
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department, groups } = req.body;

    const userExists = await User.findOne({ email }).setOptions({ bypassTenant: true });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const isCreatingAdmin = role === 'admin';

    const newUser = await User.create({
      name,
      email,
      password,
      role: role || 'citizen',
      department: isCreatingAdmin ? (department || '') : '',
      groups: isCreatingAdmin ? (groups || []) : [],
      isVerified: true,
      dashboardConfig: isCreatingAdmin ? {
        showStatusChart: true,
        showCategoryChart: true,
        showPriorityStats: true,
        widgetsOrder: ['stats', 'charts', 'queue']
      } : undefined,
      settingsPermissions: isCreatingAdmin ? {
        allowAll: true,
        systemSettings: false,
        slaSettings: false,
        escalationRules: false,
        escalationAnalytics: true,
        manageFields: true,
        manageStaff: false,
        manageDepartments: true
      } : undefined
    });

    if (isCreatingAdmin && groups && groups.length > 0) {
      const EscalationGroup = require('../models/EscalationGroup');
      await EscalationGroup.updateMany(
        { _id: { $in: groups } },
        { $addToSet: { members: newUser._id } }
      );
    }

    // Auto-link assets matching this email address
    try {
      const Asset = require('../models/Asset');
      const emailLower = email.trim().toLowerCase();
      await Asset.updateMany(
        { ownerEmail: emailLower, ownerUserId: null },
        { ownerUserId: newUser._id }
      );
      await Asset.updateMany(
        { custodianEmail: emailLower, custodianUserId: null },
        { custodianUserId: newUser._id }
      );
    } catch (err) {
      console.error('Asset auto-link failed on createUser:', err);
    }

    res.status(201).json({
      success: true,
      data: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        groups: newUser.groups
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  verifyEmail,
  registerUser,
  loginUser,
  getMe,
  updateDashboardConfig,
  getAdmins,
  createAdmin,
  forgotPassword,
  resetPassword,
  updateAdminPermissions,
  updateProfile,
  getUsers,
  createUser
};
