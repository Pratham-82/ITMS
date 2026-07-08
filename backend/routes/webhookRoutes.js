const express = require('express');
const router = express.Router();
const {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook
} = require('../controllers/webhookController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

// Base path: /api/webhooks
router.route('/')
  .get(protect, authorize('admin'), checkSettingsPermission('systemSettings'), getWebhooks)
  .post(protect, authorize('admin'), checkSettingsPermission('systemSettings'), createWebhook);

router.route('/:id')
  .put(protect, authorize('admin'), checkSettingsPermission('systemSettings'), updateWebhook)
  .delete(protect, authorize('admin'), checkSettingsPermission('systemSettings'), deleteWebhook);

router.route('/:id/test')
  .post(protect, authorize('admin'), checkSettingsPermission('systemSettings'), testWebhook);

module.exports = router;
