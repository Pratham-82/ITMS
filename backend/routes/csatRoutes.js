const express = require('express');
const router = express.Router();
const {
  getCsatDashboard,
  getDepartmentCsat,
  getCategoryCsat,
  getCsatReports
} = require('../controllers/csatController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Mount all routes with admin protection
router.route('/dashboard').get(protect, authorize('admin'), getCsatDashboard);
router.route('/departments').get(protect, authorize('admin'), getDepartmentCsat);
router.route('/categories').get(protect, authorize('admin'), getCategoryCsat);
router.route('/reports').get(protect, authorize('admin'), getCsatReports);

module.exports = router;
