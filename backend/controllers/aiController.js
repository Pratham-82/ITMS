const AiSettings = require('../models/AiSettings');
const AiPrompt = require('../models/AiPrompt');
const AiRoutingLog = require('../models/AiRoutingLog');
const AiConfigAuditLog = require('../models/AiConfigAuditLog');
const Category = require('../models/Category');
const Department = require('../models/Department');
const { encrypt } = require('../services/encryptionHelper');
const aiService = require('../services/aiService');

/**
 * Normalizes input text helper
 */
const normalizeText = (title, desc) => {
  return `${title || ''} ${desc || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Helper to initialize settings on request if missing
 */
const getOrInitializeSettings = async (userId) => {
  let settings = await AiSettings.findOne({ key: 'ai_routing_config' });
  if (!settings) {
    // Create initial prompt first
    const defaultPrompt = await aiService.getActivePrompt(null, userId);
    settings = await AiSettings.create({
      key: 'ai_routing_config',
      activePromptId: defaultPrompt._id,
      updatedBy: userId
    });
  }
  return settings;
};

// @desc    Retrieve real-time classification for complaint title/description
// @route   POST /api/ai/classify
// @access  Private (Citizen only, rate limited)
const getAiClassification = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title && !description) {
      return res.status(400).json({ success: false, message: 'Please provide issue title or description' });
    }

    const settings = await getOrInitializeSettings(req.user.id);
    
    // Dynamic Rate Limiting Check
    const userId = req.user.id;
    const now = Date.now();
    const limitMin = 20;
    const windowMinMs = 60 * 1000;
    
    if (!global.aiRateLimiterCache) {
      global.aiRateLimiterCache = new Map();
    }
    if (!global.aiRateLimiterCache.has(userId)) {
      global.aiRateLimiterCache.set(userId, []);
    }
    
    const userRequests = global.aiRateLimiterCache.get(userId).filter(timestamp => now - timestamp < windowMinMs);
    userRequests.push(now);
    global.aiRateLimiterCache.set(userId, userRequests);
    
    if (userRequests.length > limitMin) {
      return res.status(429).json({
        success: false,
        message: `Too many requests. Limit is ${limitMin} requests per minute.`
      });
    }

    if (!settings.enableAiRouting) {
      return res.status(200).json({
        success: true,
        aiEnabled: false,
        message: 'AI Routing is currently disabled.'
      });
    }

    const inputText = normalizeText(title, description);
    
    // 1. Check Caching
    const cached = aiService.getCachedClassification(inputText);
    if (cached) {
      // Register cached response audit log
      if (settings.loggingEnabled !== false) {
        await AiRoutingLog.create({
          userId: req.user.id,
          inputText,
          suggestedDepartmentName: cached.suggestedDepartmentName,
          suggestedCategoryId: cached.suggestedCategoryId,
          suggestedCategoryName: cached.suggestedCategoryName,
          confidence: cached.confidence,
          reasoning: cached.reasoning,
          responseTimeMs: 0,
          cachedResponse: true
        });
      }

      return res.status(200).json({
        success: true,
        aiEnabled: true,
        data: cached,
        settings: {
          autoAcceptThreshold: settings.autoAcceptThreshold,
          suggestionThreshold: settings.suggestionThreshold,
          autoSelectDepartment: settings.autoSelectDepartment !== undefined ? settings.autoSelectDepartment : true,
          autoSelectCategory: settings.autoSelectCategory !== undefined ? settings.autoSelectCategory : true,
          autoLoadDynamicFields: settings.autoLoadDynamicFields !== undefined ? settings.autoLoadDynamicFields : true
        }
      });
    }

    // 2. Query LLM
    try {
      const result = await aiService.classifyComplaint({
        title,
        description,
        settings
      });

      // 4. Save Log
      if (settings.loggingEnabled !== false) {
        const minConfidence = result.category
          ? Math.min(result.department.confidence, result.category.confidence)
          : result.department.confidence;

        await AiRoutingLog.create({
          userId: req.user.id,
          inputText,
          suggestedDepartmentName: result.department.name,
          suggestedCategoryId: result.category ? result.category.id : null,
          suggestedCategoryName: result.category ? result.category.name : null,
          confidence: minConfidence,
          reasoning: `Department: ${result.department.reasoning || ''}${result.category?.reasoning ? `; Category: ${result.category.reasoning}` : ''}`,
          responseTimeMs: result.responseTimeMs,
          cachedResponse: false
        });
      }

      return res.status(200).json({
        success: true,
        aiEnabled: true,
        department: result.department,
        category: result.category,
        classificationMethod: result.classificationMethod,
        processingTime: result.responseTimeMs,
        settings: {
          autoAcceptThreshold: settings.autoAcceptThreshold,
          suggestionThreshold: settings.suggestionThreshold,
          autoSelectDepartment: settings.autoSelectDepartment !== undefined ? settings.autoSelectDepartment : true,
          autoSelectCategory: settings.autoSelectCategory !== undefined ? settings.autoSelectCategory : true,
          autoLoadDynamicFields: settings.autoLoadDynamicFields !== undefined ? settings.autoLoadDynamicFields : true
        }
      });

    } catch (apiError) {
      console.error('AI Classification API Error:', apiError);
      
      // Register failure audit log
      if (settings.loggingEnabled !== false) {
        await AiRoutingLog.create({
          userId: req.user.id,
          inputText,
          isSuccess: false,
          errorType: apiError.message.includes('Timeout') ? 'Timeout' : 'APIError',
          reasoning: apiError.message
        });
      }

      // Failsafe Mode fallback: return success: false to prompt manual forms rendering
      return res.status(200).json({
        success: false,
        aiEnabled: true,
        message: apiError.message || 'AI Provider unavailable. Falling back to manual selection.',
        fallback: true
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI Routing Settings
// @route   GET /api/ai/settings
// @access  Private (Admin only)
const getAiSettings = async (req, res) => {
  try {
    const settings = await getOrInitializeSettings(req.user.id);
    
    // Obscure API key
    const settingsObj = settings.toObject();
    settingsObj.apiKey = settings.apiKey ? '••••••••••••••••' : '';

    res.status(200).json({
      success: true,
      data: settingsObj
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update AI Routing Settings
// @route   PUT /api/ai/settings
// @access  Private (Super Admin only)
const updateAiSettings = async (req, res) => {
  try {
    const settings = await getOrInitializeSettings(req.user.id);
    const originalSettings = settings.toObject();

    const {
      enableAiRouting,
      enableClassification,
      autoSelectDepartment,
      autoSelectCategory,
      autoLoadDynamicFields,
      autoAcceptThreshold,
      suggestionThreshold,
      aiProvider,
      apiKey,
      modelName,
      temperature,
      maxTokens,
      timeoutMs,
      cacheDurationMinutes,
      rateLimitPerUserPerMinute,
      rateLimitPerUserPerHour,
      rateLimitPerUserPerDay,
      globalUsageLimitPerDay,
      loggingEnabled
    } = req.body;

    const auditChanges = [];

    const trackChange = (field, newVal) => {
      if (newVal !== undefined && originalSettings[field] !== newVal) {
        settings[field] = newVal;
        auditChanges.push({
          field,
          oldVal: originalSettings[field],
          newVal
        });
      }
    };

    trackChange('enableAiRouting', enableAiRouting);
    trackChange('enableClassification', enableClassification);
    trackChange('autoSelectDepartment', autoSelectDepartment);
    trackChange('autoSelectCategory', autoSelectCategory);
    trackChange('autoLoadDynamicFields', autoLoadDynamicFields);
    trackChange('autoAcceptThreshold', autoAcceptThreshold);
    trackChange('suggestionThreshold', suggestionThreshold);
    trackChange('aiProvider', aiProvider);
    trackChange('modelName', modelName);
    trackChange('temperature', temperature);
    trackChange('maxTokens', maxTokens);
    trackChange('timeoutMs', timeoutMs);
    trackChange('cacheDurationMinutes', cacheDurationMinutes);
    trackChange('rateLimitPerUserPerMinute', rateLimitPerUserPerMinute);
    trackChange('rateLimitPerUserPerHour', rateLimitPerUserPerHour);
    trackChange('rateLimitPerUserPerDay', rateLimitPerUserPerDay);
    trackChange('globalUsageLimitPerDay', globalUsageLimitPerDay);
    trackChange('loggingEnabled', loggingEnabled);

    // Process API Key
    if (apiKey !== undefined && apiKey !== '••••••••••••••••' && apiKey !== '') {
      const encryptedKey = encrypt(apiKey);
      settings.apiKey = encryptedKey;
      auditChanges.push({
        field: 'apiKey',
        oldVal: originalSettings.apiKey ? '[CONFIGURED]' : '[EMPTY]',
        newVal: '[UPDATED]'
      });
    }

    if (auditChanges.length > 0) {
      settings.updatedAt = Date.now();
      settings.updatedBy = req.user.id;
      await settings.save();

      // Log config audit
      await AiConfigAuditLog.create({
        userId: req.user.id,
        userName: req.user.name,
        action: 'AI_SETTINGS_UPDATED',
        newValue: auditChanges
      });
    }

    const settingsObj = settings.toObject();
    settingsObj.apiKey = settings.apiKey ? '••••••••••••••••' : '';

    res.status(200).json({
      success: true,
      message: 'AI Configuration settings updated successfully',
      data: settingsObj
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Prompts Version History
// @route   GET /api/ai/prompts
// @access  Private (Super Admin only)
const getPromptsHistory = async (req, res) => {
  try {
    const history = await AiPrompt.find()
      .populate('createdBy', 'name email')
      .sort({ version: -1 });
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save new Prompt Version
// @route   POST /api/ai/prompts
// @access  Private (Super Admin only)
const createPromptVersion = async (req, res) => {
  try {
    const { systemPrompt, classificationPrompt, fallbackPrompt, reasoningPrompt, description } = req.body;
    if (!systemPrompt || !classificationPrompt || !fallbackPrompt || !reasoningPrompt) {
      return res.status(400).json({ success: false, message: 'All prompt fields are required.' });
    }

    const latest = await AiPrompt.findOne().sort({ version: -1 });
    const nextVersion = latest ? latest.version + 1 : 1;

    const newPrompt = await AiPrompt.create({
      version: nextVersion,
      description: description || `Saved version ${nextVersion}`,
      systemPrompt,
      classificationPrompt,
      fallbackPrompt,
      reasoningPrompt,
      createdBy: req.user.id
    });

    const settings = await getOrInitializeSettings(req.user.id);
    const oldPromptId = settings.activePromptId;
    settings.activePromptId = newPrompt._id;
    settings.updatedAt = Date.now();
    settings.updatedBy = req.user.id;
    await settings.save();

    // Log Config Audit
    await AiConfigAuditLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'PROMPT_VERSION_CREATED',
      oldValue: oldPromptId,
      newValue: newPrompt._id
    });

    res.status(201).json({
      success: true,
      message: `Prompt version ${nextVersion} saved and set active.`,
      data: newPrompt
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Rollback to previous prompt version
// @route   POST /api/ai/prompts/rollback
// @access  Private (Super Admin only)
const rollbackPrompt = async (req, res) => {
  try {
    const { promptId } = req.body;
    const targetPrompt = await AiPrompt.findById(promptId);
    if (!targetPrompt) {
      return res.status(404).json({ success: false, message: 'Prompt version not found.' });
    }

    const settings = await getOrInitializeSettings(req.user.id);
    const oldPromptId = settings.activePromptId;
    settings.activePromptId = targetPrompt._id;
    settings.updatedAt = Date.now();
    settings.updatedBy = req.user.id;
    await settings.save();

    // Log Config Audit
    await AiConfigAuditLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'PROMPT_ROLLED_BACK',
      oldValue: oldPromptId,
      newValue: targetPrompt._id
    });

    res.status(200).json({
      success: true,
      message: `Rolled back actively running prompts to Version ${targetPrompt.version}.`,
      data: targetPrompt
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI Analytics metrics
// @route   GET /api/ai/analytics
// @access  Private (Admin only)
const getAiAnalytics = async (req, res) => {
  try {
    const logs = await AiRoutingLog.find();
    
    const totalClassifications = logs.length;
    const successfulLogs = logs.filter(l => l.isSuccess);
    const filedLogs = logs.filter(l => l.complaintId); // logs tied to actual filed tickets
    const overriddenLogs = filedLogs.filter(l => l.userOverride);
    const acceptedLogs = filedLogs.filter(l => l.acceptedRecommendation);

    const averageConfidence = successfulLogs.length > 0
      ? (successfulLogs.reduce((acc, curr) => acc + curr.confidence, 0) / successfulLogs.length) * 100
      : 0;

    const averageResponseTime = successfulLogs.length > 0
      ? successfulLogs.reduce((acc, curr) => acc + curr.responseTimeMs, 0) / successfulLogs.length
      : 0;

    const overrideRate = filedLogs.length > 0
      ? (overriddenLogs.length / filedLogs.length) * 100
      : 0;

    const classificationAccuracy = filedLogs.length > 0
      ? (acceptedLogs.length / filedLogs.length) * 100
      : 0;

    // Top predicted categories/departments counts
    const categoryCounts = {};
    const departmentCounts = {};
    const overrideReasonList = [];
    const categoryOverrides = {};

    logs.forEach(l => {
      if (l.isSuccess && l.suggestedCategoryName) {
        categoryCounts[l.suggestedCategoryName] = (categoryCounts[l.suggestedCategoryName] || 0) + 1;
      }
      if (l.isSuccess && l.suggestedDepartmentName) {
        departmentCounts[l.suggestedDepartmentName] = (departmentCounts[l.suggestedDepartmentName] || 0) + 1;
      }
      if (l.complaintId && l.userOverride) {
        if (l.overrideReason) {
          overrideReasonList.push({
            reason: l.overrideReason,
            suggestedCat: l.suggestedCategoryName,
            createdAt: l.createdAt
          });
        }
        if (l.suggestedCategoryName) {
          categoryOverrides[l.suggestedCategoryName] = (categoryOverrides[l.suggestedCategoryName] || 0) + 1;
        }
      }
    });

    const mostPredictedCategories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const mostPredictedDepartments = Object.entries(departmentCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const highestOverrideCategories = Object.entries(categoryOverrides)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Confidence distribution calculation (buckets: >90, 70-89, <70)
    const confidenceBuckets = { above90: 0, from70to89: 0, below70: 0 };
    successfulLogs.forEach(l => {
      if (l.confidence >= 0.90) confidenceBuckets.above90++;
      else if (l.confidence >= 0.70) confidenceBuckets.from70to89++;
      else confidenceBuckets.below70++;
    });

    res.status(200).json({
      success: true,
      data: {
        totalClassifications,
        classificationAccuracy,
        overrideRate,
        averageConfidence,
        averageResponseTime,
        mostPredictedCategories,
        mostPredictedDepartments,
        highestOverrideCategories,
        confidenceBuckets,
        overrideReasons: overrideReasonList.slice(-10) // last 10 reasons
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI Health Metrics Telemetry
// @route   GET /api/ai/health
// @access  Private (Admin only)
const getAiHealthMetrics = async (req, res) => {
  try {
    const recentLogs = await AiRoutingLog.find().sort({ createdAt: -1 }).limit(100);
    const settings = await getOrInitializeSettings(req.user.id);

    const total = recentLogs.length;
    if (total === 0) {
      return res.status(200).json({
        success: true,
        data: {
          providerStatus: 'Unknown',
          successRate: 100,
          avgLatencyMs: 0,
          timeoutCount: 0,
          apiErrorCount: 0,
          currentModel: settings.modelName
        }
      });
    }

    const successLogs = recentLogs.filter(l => l.isSuccess);
    const failureLogs = recentLogs.filter(l => !l.isSuccess);

    const successRate = (successLogs.length / total) * 100;
    const avgLatencyMs = successLogs.length > 0
      ? successLogs.reduce((acc, curr) => acc + curr.responseTimeMs, 0) / successLogs.length
      : 0;

    const timeoutCount = failureLogs.filter(l => l.errorType === 'Timeout').length;
    const apiErrorCount = failureLogs.filter(l => l.errorType === 'APIError').length;

    // Evaluate health state
    let providerStatus = 'Healthy';
    if (successRate < 50) {
      providerStatus = 'Down';
    } else if (successRate < 90 || avgLatencyMs > 3000) {
      providerStatus = 'Degraded';
    }

    // Last successful classification timestamp
    const lastSuccessfulLog = successLogs[0];
    const lastSuccessTimestamp = lastSuccessfulLog ? lastSuccessfulLog.createdAt : null;

    res.status(200).json({
      success: true,
      data: {
        providerStatus,
        successRate,
        avgLatencyMs,
        timeoutCount,
        apiErrorCount,
        currentModel: settings.modelName,
        lastSuccessTimestamp
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear active classification in-memory cache
// @route   POST /api/ai/cache/clear
// @access  Private (Super Admin only)
const clearCache = async (req, res) => {
  try {
    aiService.clearClassificationCache();

    // Log config audit
    await AiConfigAuditLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'CLASSIFICATION_CACHE_CLEARED'
    });

    res.status(200).json({ success: true, message: 'Classification memory cache cleared successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI Audit logs of configurations changes
// @route   GET /api/ai/audit-logs
// @access  Private (Super Admin only)
const getAiAuditLogs = async (req, res) => {
  try {
    const logs = await AiConfigAuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
