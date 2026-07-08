const express = require('express');
const router = express.Router();
const {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday
} = require('../controllers/holidayController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('admin'), getHolidays)
  .post(protect, authorize('admin'), checkSettingsPermission('systemSettings'), createHoliday);

router.route('/:id')
  .put(protect, authorize('admin'), checkSettingsPermission('systemSettings'), updateHoliday)
  .delete(protect, authorize('admin'), checkSettingsPermission('systemSettings'), deleteHoliday);

module.exports = router;
