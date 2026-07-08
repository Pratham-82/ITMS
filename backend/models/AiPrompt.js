const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const AiPromptSchema = new mongoose.Schema({
  version: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    default: 'Prompt version configuration'
  },
  systemPrompt: {
    type: String,
    required: true
  },
  classificationPrompt: {
    type: String,
    required: true
  },
  fallbackPrompt: {
    type: String,
    required: true
  },
  reasoningPrompt: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

module.exports = createTenantModelProxy('AiPrompt', AiPromptSchema);
