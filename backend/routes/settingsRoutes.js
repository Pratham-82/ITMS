const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Mount routes: /api/settings
router.route('/')
  .get(getSettings)
  .put(protect, authorize('admin'), checkSettingsPermission('systemSettings'), upload.single('logo'), updateSettings);

module.exports = router;
