const express = require('express');
const router = express.Router();
const {
  getMaintenanceWindows,
  createMaintenanceWindow,
  updateMaintenanceWindow,
  deleteMaintenanceWindow
} = require('../controllers/maintenanceWindowController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('admin'), getMaintenanceWindows)
  .post(protect, authorize('admin'), checkSettingsPermission('systemSettings'), createMaintenanceWindow);

router.route('/:id')
  .put(protect, authorize('admin'), checkSettingsPermission('systemSettings'), updateMaintenanceWindow)
  .delete(protect, authorize('admin'), checkSettingsPermission('systemSettings'), deleteMaintenanceWindow);

module.exports = router;
