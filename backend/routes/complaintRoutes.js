/**
 * @deprecated Legacy complaint routes (compatibility layer).
 * @description These routes are frozen. Active clients should call `/api/tickets` directly.
 * All write requests delegate to TicketService behavior.
 */

const express = require('express');
const router = express.Router();
const {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  addComment,
  escalateComplaint,
  submitComplaintFeedback,
  reopenComplaint,
  reviewReopenRequest
} = require('../controllers/complaintController');
const { manualEscalateComplaint } = require('../controllers/escalationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Base route: /api/complaints
router.route('/')
  .post(protect, authorize('citizen'), upload.array('attachments', 5), createComplaint)
  .get(protect, getComplaints);

router.route('/:id')
  .get(protect, getComplaintById);

router.route('/:id/status')
  .put(protect, authorize('admin'), updateComplaintStatus);

router.route('/:id/comments')
  .post(protect, addComment);

router.route('/:id/escalate')
  .put(protect, authorize('citizen'), escalateComplaint);

router.route('/:id/escalate-manual')
  .put(protect, authorize('admin'), manualEscalateComplaint);

router.route('/:id/feedback')
  .post(protect, authorize('citizen'), submitComplaintFeedback);

router.route('/:id/reopen')
  .post(protect, authorize('citizen'), reopenComplaint);

router.route('/:id/reopen/review')
  .post(protect, authorize('admin'), reviewReopenRequest);

module.exports = router;
