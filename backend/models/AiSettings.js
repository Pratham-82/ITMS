const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const AiSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'ai_routing_config'
  },
  enableAiRouting: {
    type: Boolean,
    default: true
  },
  enableClassification: {
    type: Boolean,
    default: true
  },
  autoSelectDepartment: {
    type: Boolean,
    default: true
  },
  autoSelectCategory: {
    type: Boolean,
    default: true
  },
  autoLoadDynamicFields: {
    type: Boolean,
    default: true
  },
  autoAcceptThreshold: {
    type: Number,
    default: 0.90
  },
  suggestionThreshold: {
    type: Number,
    default: 0.70
  },
  aiProvider: {
    type: String,
    enum: ['google_gemini', 'openai', 'claude', 'groq'],
    default: 'google_gemini'
  },
  apiKey: {
    type: String,
    default: ''
  },
  modelName: {
    type: String,
    default: 'gemini-2.5-flash'
  },
  temperature: {
    type: Number,
    default: 0.1
  },
  maxTokens: {
    type: Number,
    default: 500
  },
  timeoutMs: {
    type: Number,
    default: 5000
  },
  cacheDurationMinutes: {
    type: Number,
    default: 30
  },
  rateLimitPerUserPerMinute: {
    type: Number,
    default: 20
  },
  rateLimitPerUserPerHour: {
    type: Number,
    default: 100
  },
  rateLimitPerUserPerDay: {
    type: Number,
    default: 500
  },
  globalUsageLimitPerDay: {
    type: Number,
    default: 5000
  },
  loggingEnabled: {
    type: Boolean,
    default: true
  },
  activePromptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AiPrompt',
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
});

module.exports = createTenantModelProxy('AiSettings', AiSettingsSchema);
