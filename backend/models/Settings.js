const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'system_branding'
  },
  websiteName: {
    type: String,
    required: true,
    default: 'ApexResolve'
  },
  websiteDescription: {
    type: String,
    required: true,
    default: 'Managing and tracking issues efficiently'
  },
  websiteLogo: {
    type: String,
    default: '' // Empty means default icon, otherwise uploaded relative image path
  },
  primaryColor: {
    type: String,
    required: true,
    default: '#6366f1' // Default Indigo hex
  },
  contactEmail: {
    type: String,
    default: 'support@apexresolve.com'
  },
  allowCitizenRegistration: {
    type: Boolean,
    default: true
  },
  feedbackExpiryDays: {
    type: Number,
    required: true,
    default: 3
  },
  feedbackWelcomeMessage: {
    type: String,
    required: true,
    default: 'Please take a moment to rate your satisfaction with how we resolved your complaint. Your feedback helps us improve our public services.'
  },
  feedbackSuccessMessage: {
    type: String,
    required: true,
    default: 'Thank you for your feedback! It helps us improve our services.'
  },
  feedbackRatingIcon: {
    type: String,
    required: true,
    enum: ['star', 'heart', 'smile', 'thumb'],
    default: 'star'
  },
  feedbackQuestions: {
    type: [{
      id: { type: String, required: true },
      label: { type: String, required: true },
      type: { type: String, enum: ['rating', 'text', 'boolean', 'choice'], default: 'rating' },
      required: { type: Boolean, default: true },
      choices: [{ type: String }],
      order: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true }
    }],
    default: [
      { id: 'overallRating', label: 'Overall Satisfaction', type: 'rating', required: true, order: 1, isActive: true },
      { id: 'responseTimeRating', label: 'Response Time Satisfaction', type: 'rating', required: true, order: 2, isActive: true },
      { id: 'communicationRating', label: 'Staff Communication', type: 'rating', required: true, order: 3, isActive: true },
      { id: 'resolutionQualityRating', label: 'Resolution Quality', type: 'rating', required: true, order: 4, isActive: true },
      { id: 'resolvedCompletely', label: 'Was the issue fully resolved?', type: 'boolean', required: true, order: 5, isActive: true },
      { id: 'recommendation', label: 'Would you recommend this service to others?', type: 'boolean', required: true, order: 6, isActive: true },
      { id: 'comment', label: 'Additional Comments or Feedback', type: 'text', required: false, order: 7, isActive: true }
    ]
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = createTenantModelProxy('Settings', SettingsSchema);
