const express = require('express');
const router = express.Router();
const {
  getSlaConfigs,
  getDefaultSlaConfig,
  getSlaConfigById,
  createSlaConfig,
  updateSlaConfig,
  deleteSlaConfig
} = require('../controllers/slaConfigController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('admin'), checkSettingsPermission('slaSettings'), getSlaConfigs)
  .post(protect, authorize('admin'), checkSettingsPermission('slaSettings'), createSlaConfig);

router.route('/default')
  .get(protect, authorize('admin'), checkSettingsPermission('slaSettings'), getDefaultSlaConfig);

router.route('/:id')
  .get(protect, authorize('admin'), checkSettingsPermission('slaSettings'), getSlaConfigById)
  .put(protect, authorize('admin'), checkSettingsPermission('slaSettings'), updateSlaConfig)
  .delete(protect, authorize('admin'), checkSettingsPermission('slaSettings'), deleteSlaConfig);

module.exports = router;
