const express = require('express');
const router = express.Router();
const {
  getStaffWorkloads,
  getWorkloadDashboard,
  getWorkloadAlerts,
  transferComplaint,
  bulkReassign,
  updateStaffConfig
} = require('../controllers/workloadController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Base route: /api/workload
router.get('/staff', protect, authorize('admin'), getStaffWorkloads);
router.get('/dashboard', protect, authorize('admin'), getWorkloadDashboard);
router.get('/alerts', protect, authorize('admin'), getWorkloadAlerts);
router.post('/transfer', protect, authorize('admin'), transferComplaint);
router.post('/bulk-reassign', protect, authorize('admin'), bulkReassign);
router.put('/staff/:id', protect, authorize('admin'), updateStaffConfig);

module.exports = router;
