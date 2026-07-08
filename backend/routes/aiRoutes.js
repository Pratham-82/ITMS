const express = require('express');
const router = express.Router();
const {
  getAiClassification,
  getAiSettings,
  updateAiSettings,
  getPromptsHistory,
  createPromptVersion,
  rollbackPrompt,
  getAiAnalytics,
  getAiHealthMetrics,
  clearCache,
  getAiAuditLogs
} = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Custom middleware to enforce Super Admin role
const authorizeSuperAdmin = (req, res, next) => {
  const isSuper = req.user.role === 'admin' && (!req.user.department || req.user.department === 'General Administration');
  if (!isSuper) {
    return res.status(403).json({ success: false, message: 'Access denied. Super Administrators only.' });
  }
  next();
};

// Route for real-time classification (Citizen/all authenticated users)
router.post('/classify', protect, getAiClassification);

// Route for settings dashboard (Admin read, Super Admin write)
router.route('/settings')
  .get(protect, authorize('admin'), getAiSettings)
  .put(protect, authorizeSuperAdmin, updateAiSettings);

// Routes for prompt management (Super Admin only)
router.route('/prompts')
  .get(protect, authorizeSuperAdmin, getPromptsHistory)
  .post(protect, authorizeSuperAdmin, createPromptVersion);

router.post('/prompts/rollback', protect, authorizeSuperAdmin, rollbackPrompt);

// Routes for analytics and health monitoring (Admin only)
router.get('/analytics', protect, authorize('admin'), getAiAnalytics);
router.get('/health', protect, authorize('admin'), getAiHealthMetrics);

// Routes for cache and audit logs (Super Admin only)
router.post('/cache/clear', protect, authorizeSuperAdmin, clearCache);
router.get('/audit-logs', protect, authorizeSuperAdmin, getAiAuditLogs);

module.exports = router;
