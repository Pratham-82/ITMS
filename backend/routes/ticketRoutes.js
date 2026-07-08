const express = require('express');
const router = express.Router();
const {
  getTicketTypes,
  createTicketType,
  updateTicketType,
  deleteTicketType,
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  addComment,
  escalateTicket,
  submitTicketFeedback,
  reopenTicket,
  reviewReopenRequest
} = require('../controllers/ticketController');
const { manualEscalateComplaint } = require('../controllers/escalationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Base route: /api/tickets/types
router.route('/types')
  .get(protect, getTicketTypes)
  .post(protect, authorize('admin'), createTicketType);

router.route('/types/:id')
  .put(protect, authorize('admin'), updateTicketType)
  .delete(protect, authorize('admin'), deleteTicketType);

// Base route: /api/tickets
router.route('/')
  .post(protect, upload.array('attachments', 5), createTicket)
  .get(protect, getTickets);

router.route('/:id')
  .get(protect, getTicketById);

router.route('/:id/status')
  .put(protect, authorize('admin'), updateTicketStatus);

router.route('/:id/comments')
  .post(protect, addComment);

router.route('/:id/escalate')
  .put(protect, authorize('citizen'), escalateTicket);

router.route('/:id/escalate-manual')
  .put(protect, authorize('admin'), manualEscalateComplaint);

router.route('/:id/feedback')
  .post(protect, authorize('citizen'), submitTicketFeedback);

router.route('/:id/reopen')
  .post(protect, authorize('citizen'), reopenTicket);

router.route('/:id/reopen/review')
  .post(protect, authorize('admin'), reviewReopenRequest);

module.exports = router;
