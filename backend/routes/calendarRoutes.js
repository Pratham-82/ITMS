const express = require('express');
const router = express.Router();
const {
  getCalendars,
  getDefaultCalendar,
  getCalendarById,
  createCalendar,
  updateCalendar,
  deleteCalendar
} = require('../controllers/calendarController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('admin'), getCalendars)
  .post(protect, authorize('admin'), checkSettingsPermission('systemSettings'), createCalendar);

router.route('/default')
  .get(protect, authorize('admin'), getDefaultCalendar);

router.route('/:id')
  .get(protect, authorize('admin'), getCalendarById)
  .put(protect, authorize('admin'), checkSettingsPermission('systemSettings'), updateCalendar)
  .delete(protect, authorize('admin'), checkSettingsPermission('systemSettings'), deleteCalendar);

module.exports = router;
