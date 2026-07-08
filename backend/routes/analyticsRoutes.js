const express = require('express');
const router = express.Router();
const { getDashboardWidgets } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/widgets', protect, authorize('admin'), getDashboardWidgets);

module.exports = router;
