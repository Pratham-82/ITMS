const express = require('express');
const router = express.Router();
const {
  checkDuplicateLive,
  joinComplaint,
  mergeComplaints,
  getAuditLogs,
  getRecurringRecommendations
} = require('../controllers/duplicateController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Check duplicates and join endpoint (all logged-in citizens and officers)
router.post('/check', protect, checkDuplicateLive);
router.post('/:id/join', protect, joinComplaint);

// Administrative duplicate management endpoints (officers only)
router.post('/merge', protect, authorize('admin'), mergeComplaints);
router.get('/audits', protect, authorize('admin'), getAuditLogs);
router.get('/recurring', protect, authorize('admin'), getRecurringRecommendations);

module.exports = router;
