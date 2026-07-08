const WebhookSubscription = require('../models/WebhookSubscription');
const webhookService = require('../services/webhookService');

// @desc    Get all webhook subscriptions
// @route   GET /api/webhooks
// @access  Private (Admin only)
const getWebhooks = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'default-tenant';
    const subscriptions = await WebhookSubscription.find({ tenantId }).sort('-createdAt');
    res.status(200).json({ success: true, count: subscriptions.length, data: subscriptions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new webhook subscription
// @route   POST /api/webhooks
// @access  Private (Admin only)
const createWebhook = async (req, res) => {
  try {
    const { name, url, secret, events, isActive } = req.body;
    const tenantId = req.user.tenantId || 'default-tenant';

    if (!name || !url) {
      return res.status(400).json({ success: false, message: 'Please provide a name and destination URL' });
    }

    const subscription = await WebhookSubscription.create({
      tenantId,
      name,
      url,
      secret: secret || '',
      events: events || [],
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({ success: true, data: subscription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a webhook subscription
// @route   PUT /api/webhooks/:id
// @access  Private (Admin only)
const updateWebhook = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'default-tenant';
    let subscription = await WebhookSubscription.findOne({ _id: req.params.id, tenantId });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Webhook subscription not found' });
    }

    subscription = await WebhookSubscription.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, data: subscription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a webhook subscription
// @route   DELETE /api/webhooks/:id
// @access  Private (Admin only)
const deleteWebhook = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'default-tenant';
    const subscription = await WebhookSubscription.findOne({ _id: req.params.id, tenantId });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Webhook subscription not found' });
    }

    await WebhookSubscription.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Webhook subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Test a webhook subscription by sending a mock event payload
// @route   POST /api/webhooks/:id/test
// @access  Private (Admin only)
const testWebhook = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'default-tenant';
    const subscription = await WebhookSubscription.findOne({ _id: req.params.id, tenantId });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Webhook subscription not found' });
    }

    // Mock payload matching real webhook formats
    const mockPayload = {
      event: 'webhook.test',
      tenantId,
      timestamp: new Date().toISOString(),
      data: {
        testId: req.params.id,
        message: 'Hello! This is a test event dispatched from your ApexResolve developer console.',
        generatedBy: req.user.name,
        systemStatus: 'healthy'
      }
    };

    const payloadString = JSON.stringify(mockPayload);

    try {
      await webhookService.dispatch(subscription, 'webhook.test', payloadString);
      res.status(200).json({
        success: true,
        message: `Test ping to "${subscription.name}" was successfully received and acknowledged by the target server.`
      });
    } catch (dispatchError) {
      res.status(400).json({
        success: false,
        message: `Test dispatch failed: ${dispatchError.message}`
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook
};
