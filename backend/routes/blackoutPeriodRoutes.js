const express = require('express');
const router = express.Router();
const {
  getBlackoutPeriods,
  createBlackoutPeriod,
  updateBlackoutPeriod,
  deleteBlackoutPeriod
} = require('../controllers/blackoutPeriodController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('admin'), getBlackoutPeriods)
  .post(protect, authorize('admin'), checkSettingsPermission('systemSettings'), createBlackoutPeriod);

router.route('/:id')
  .put(protect, authorize('admin'), checkSettingsPermission('systemSettings'), updateBlackoutPeriod)
  .delete(protect, authorize('admin'), checkSettingsPermission('systemSettings'), deleteBlackoutPeriod);

module.exports = router;
