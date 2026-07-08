const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, updateDashboardConfig, getAdmins, createAdmin, forgotPassword, resetPassword, verifyEmail, updateAdminPermissions, updateProfile, getUsers, createUser } = require('../controllers/authController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/dashboard-config', protect, updateDashboardConfig);
router.put('/profile', protect, updateProfile);
router.get('/verify-email', verifyEmail);

router.route('/users')
  .get(protect, authorize('admin'), getUsers)
  .post(protect, authorize('admin'), createUser);

router.route('/admins')
  .get(protect, authorize('admin'), checkSettingsPermission('manageStaff'), getAdmins)
  .post(protect, authorize('admin'), checkSettingsPermission('manageStaff'), createAdmin);

router.put('/admins/:id/permissions', protect, authorize('admin'), updateAdminPermissions);

module.exports = router;
