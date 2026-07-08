const express = require('express');
const router = express.Router();
const {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestById,
  updateServiceRequestStatus,
  addServiceRequestComment
} = require('../controllers/serviceRequestController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getServiceRequests)
  .post(protect, createServiceRequest);

router.route('/:id')
  .get(protect, getServiceRequestById);

router.route('/:id/status')
  .put(protect, updateServiceRequestStatus);

router.route('/:id/comments')
  .post(protect, addServiceRequestComment);

module.exports = router;
