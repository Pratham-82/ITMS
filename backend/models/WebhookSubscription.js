const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const WebhookSubscriptionSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'default-tenant',
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please add a webhook name'],
    trim: true
  },
  url: {
    type: String,
    required: [true, 'Please specify the webhook destination URL'],
    trim: true
  },
  secret: {
    type: String,
    default: ''
  },
  events: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = createTenantModelProxy('WebhookSubscription', WebhookSubscriptionSchema);
