const Department = require('../models/Department');
const Category = require('../models/Category');
const AiPrompt = require('../models/AiPrompt');
const { decrypt } = require('./encryptionHelper');
const duplicateService = require('./duplicateService');

// In-Memory Caching Stores
const classificationCache = new Map();
const departmentCache = new Map();
const categoryCache = new Map();

/**
 * Gets cached classification results for normalized text.
 * @param {string} text - Normalized query text
 * @returns {Object|null} Cached result or null
 */
const getCachedClassification = (text) => {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (classificationCache.has(normalized)) {
    const entry = classificationCache.get(normalized);
    if (Date.now() - entry.timestamp < entry.durationMs) {
      return entry.data;
    }
    classificationCache.delete(normalized);
  }
  return null;
};

/**
 * Sets classification results in the cache.
 * @param {string} text - Raw input text
 * @param {Object} data - Prediction data
 * @param {number} durationMinutes - TTL in minutes
 */
const setCachedClassification = (text, data, durationMinutes) => {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  classificationCache.set(normalized, {
    timestamp: Date.now(),
    durationMs: durationMinutes * 60 * 1000,
    data
  });
};

/**
 * Gets cached department predictions for normalized text.
 */
const getCachedDepartment = (text) => {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (departmentCache.has(normalized)) {
    const entry = departmentCache.get(normalized);
    if (Date.now() - entry.timestamp < entry.durationMs) {
      return entry.data;
    }
    departmentCache.delete(normalized);
  }
  return null;
};

/**
 * Sets department predictions in the cache.
 */
const setCachedDepartment = (text, data, durationMinutes) => {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  departmentCache.set(normalized, {
    timestamp: Date.now(),
    durationMs: durationMinutes * 60 * 1000,
    data
  });
};

/**
 * Gets cached category predictions for normalized text and departmentId.
 */
const getCachedCategory = (text, departmentId) => {
  const normalized = `${text.trim().toLowerCase().replace(/\s+/g, ' ')}::${departmentId}`;
  if (categoryCache.has(normalized)) {
    const entry = categoryCache.get(normalized);
    if (Date.now() - entry.timestamp < entry.durationMs) {
      return entry.data;
    }
    categoryCache.delete(normalized);
  }
  return null;
};

/**
 * Sets category predictions in the cache.
 */
const setCachedCategory = (text, departmentId, data, durationMinutes) => {
  const normalized = `${text.trim().toLowerCase().replace(/\s+/g, ' ')}::${departmentId}`;
  categoryCache.set(normalized, {
    timestamp: Date.now(),
    durationMs: durationMinutes * 60 * 1000,
    data
  });
};

/**
 * Clears the in-memory classification cache.
 */
const clearClassificationCache = () => {
  classificationCache.clear();
  departmentCache.clear();
  categoryCache.clear();
};

/**
 * Retrieves the latest active prompt version or creates a default version.
 * @param {string} activePromptId - Configured active prompt ID
 * @param {string} fallbackUserId - User ID for seeder fallback creation
 * @returns {Promise<Object>} Active prompt document
 */
const getActivePrompt = async (activePromptId, fallbackUserId) => {
  let prompt = null;
  if (activePromptId) {
    prompt = await AiPrompt.findById(activePromptId);
  }
  if (!prompt) {
    prompt = await AiPrompt.findOne().sort({ version: -1 });
  }
  if (!prompt) {
    prompt = await AiPrompt.create({
      version: 1,
      description: 'System Default Prompts v1',
      systemPrompt: 'You are an AI Routing Assistant for ApexResolve, a complaint management system. Your job is to classify user complaints into the most appropriate Department and Category.',
      classificationPrompt: 'Based on the complaint title and description, choose the single best department and category. Here is the list of departments: {departments}. Here is the list of categories: {categories}. Make sure the categoryId you choose belongs to the departmentId you select (matching the departmentId specified in the category object). Return ONLY a valid JSON object in the format: {"departmentId": "...", "categoryId": "...", "confidence": "...", "reasoning": "..."}. Do not return any other text, markdown, or block tags.',
      fallbackPrompt: 'If the complaint does not fit any category clearly, select the fallback General Administration department and General Feedback category.',
      reasoningPrompt: 'Keep the reasoning brief (under 15 words) explaining why you made this prediction.',
      createdBy: fallbackUserId
    });
  }
  return prompt;
};

/**
 * Reusable helper to execute an LLM query and clean the response text to return a JSON object.
 */
const callLLM = async ({ promptText, settings }) => {
  const decryptedKey = decrypt(settings.apiKey) || process.env.GEMINI_API_KEY || '';
  if (!decryptedKey) {
    throw new Error('API Key is missing or invalid. Please configure it in Settings.');
  }

  const model = settings.modelName || 'gemini-2.5-flash';
  const provider = settings.aiProvider || 'google_gemini';
  const temp = settings.temperature !== undefined ? settings.temperature : 0.1;
  const maxT = settings.maxTokens !== undefined ? settings.maxTokens : 500;
  const timeoutMs = settings.timeoutMs !== undefined ? settings.timeoutMs : 15000;

  let url = '';
  let headers = {};
  let body = {};

  if (provider === 'google_gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${decryptedKey}`;
    headers = { 'Content-Type': 'application/json' };
    body = {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: temp,
        maxOutputTokens: maxT
      }
    };
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions';
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${decryptedKey}`
    };
    body = {
      model,
      messages: [{ role: 'user', content: promptText }],
      temperature: temp,
      max_tokens: maxT,
      response_format: { type: 'json_object' }
    };
  } else if (provider === 'claude') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': decryptedKey,
      'anthropic-version': '2023-06-01'
    };
    body = {
      model,
      max_tokens: maxT,
      messages: [{ role: 'user', content: promptText }],
      temperature: temp
    };
  } else if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${decryptedKey}`
    };
    body = {
      model,
      messages: [{ role: 'user', content: promptText }],
      temperature: temp,
      max_tokens: maxT,
      response_format: { type: 'json_object' }
    };
  } else {
    throw new Error(`Unsupported AI Provider: ${provider}`);
  }

  const maxRetries = 1;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle rate limiting with retry
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = parseFloat(response.headers.get('retry-after')) || 3;
        const waitMs = Math.min(retryAfter * 1000, 5000);
        console.warn(`[AI] Rate limited (429). Retrying in ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI Provider HTTP Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      let jsonText = '';

      if (provider === 'google_gemini') {
        jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (provider === 'openai' || provider === 'groq') {
        jsonText = data.choices?.[0]?.message?.content || '';
      } else if (provider === 'claude') {
        jsonText = data.content?.[0]?.text || '';
      }

      // Clean JSON formatting tags if returned by LLM
      let cleanText = jsonText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7);
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.substring(3);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }

      return JSON.parse(cleanText.trim());
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
    }
  }
  throw lastError;
};

/**
 * Predicts the most appropriate Department based on complaint title and description (Stage 1).
 */
const predictDepartment = async ({ title, description, settings }) => {
  const inputText = `${title || ''} ${description || ''}`.trim();

  // 1. Check department cache
  const cached = getCachedDepartment(inputText);
  if (cached) {
    return cached;
  }

  // 2. Fetch active departments and categories
  const activeDepts = await Department.find({ isActive: true });
  const DepartmentCategory = require('../models/DepartmentCategory');
  const activeMappings = await DepartmentCategory.find({ isActive: true })
    .populate('category')
    .lean();

  // Map category names/descriptions to departments representing the relationships
  const deptRelationships = {};
  activeMappings.forEach(m => {
    if (!m.category || !m.category.isActive) return;
    const dId = m.department.toString();
    if (!deptRelationships[dId]) {
      deptRelationships[dId] = [];
    }
    deptRelationships[dId].push({
      name: m.category.name,
      description: m.category.description || ''
    });
  });

  const deptsJson = activeDepts.map(d => ({
    id: d._id.toString(),
    name: d.name,
    description: d.description || '',
    categories: deptRelationships[d._id.toString()] || []
  }));

  // 3. Retrieve up to 5 similar historical complaints as examples
  let examplesText = 'No historical examples available.';
  try {
    const candidates = await duplicateService.findCandidates({
      title,
      description,
      settings
    });
    if (candidates && candidates.length > 0) {
      const top5 = candidates.slice(0, 5);
      examplesText = top5.map((cand, idx) => {
        return `Example ${idx + 1}:
Title: "${cand.title}"
Description: "${cand.description || ''}"
Predicted Department: "${cand.department || 'General Administration'}"`;
      }).join('\n\n');
    }
  } catch (err) {
    console.warn('[AI Service] Failed to retrieve candidates for department examples:', err);
  }

  // 4. Load Prompts history config
  const activePrompt = await getActivePrompt(settings.activePromptId, settings.updatedBy || settings._id);

  // Construct Stage 1 Prompt
  const promptText = `
You are an AI Routing Assistant for ApexResolve.
Your job is to analyze the user's complaint title and description, and predict the single most appropriate Department from the list below.
Do not predict categories in this stage.

List of available Departments, their descriptions, and related categories:
${JSON.stringify(deptsJson, null, 2)}

Historical Examples for context:
${examplesText}

Instructions:
Select only the most appropriate department from the list above. Do not create new department IDs.
Return ONLY a valid JSON object in the format:
{
  "departmentId": "...",
  "confidence": "...",
  "reasoning": "..."
}
Keep reasoning under 15 words. Do not return any other text, markdown, or block tags.
`;

  const fullPrompt = `${activePrompt.systemPrompt}\n\n${promptText}\n\n${activePrompt.fallbackPrompt}\n\n${activePrompt.reasoningPrompt}\n\nComplaint Title: "${title}"\nComplaint Description: "${description}"`;

  // 5. Invoke LLM
  const result = await callLLM({ promptText: fullPrompt, settings });

  if (!result || !result.departmentId) {
    throw new Error('LLM response missing departmentId');
  }

  // 6. Validate department exists in database
  const matchedDept = activeDepts.find(d => d._id.toString() === result.departmentId.toString());
  if (!matchedDept) {
    throw new Error(`Predicted departmentId ${result.departmentId} is not a valid active department in the database.`);
  }

  const prediction = {
    departmentId: matchedDept._id.toString(),
    departmentName: matchedDept.name,
    confidence: result.confidence !== undefined ? Number(result.confidence) : 0,
    reasoning: result.reasoning || ''
  };

  // 7. Store in Cache
  const cacheMinutes = settings.cacheDurationMinutes !== undefined ? settings.cacheDurationMinutes : 30;
  setCachedDepartment(inputText, prediction, cacheMinutes);

  return prediction;
};

/**
 * Predicts the most appropriate Category within the predicted Department (Stage 2).
 */
const predictCategory = async ({ title, description, departmentId, settings }) => {
  const inputText = `${title || ''} ${description || ''}`.trim();

  // 1. Check category cache
  const cached = getCachedCategory(inputText, departmentId);
  if (cached) {
    return cached;
  }

  // 2. Fetch categories linked to the predicted department
  const DepartmentCategory = require('../models/DepartmentCategory');
  const mappings = await DepartmentCategory.find({
    department: departmentId,
    isActive: true
  }).populate('category');

  const activeCats = mappings
    .map(m => m.category)
    .filter(Boolean)
    .filter(c => c.isActive);

  if (activeCats.length === 0) {
    throw new Error(`No active categories found for department ID ${departmentId}`);
  }

  const catsJson = activeCats.map(c => ({
    id: c._id.toString(),
    name: c.name,
    description: c.description || ''
  }));

  // 3. Retrieve up to 5 similar historical complaints as examples
  let examplesText = 'No historical examples available.';
  try {
    const candidates = await duplicateService.findCandidates({
      title,
      description,
      settings
    });
    if (candidates && candidates.length > 0) {
      const top5 = candidates.slice(0, 5);
      examplesText = top5.map((cand, idx) => {
        return `Example ${idx + 1}:
Title: "${cand.title}"
Description: "${cand.description || ''}"
Category: "${cand.categoryName || ''}"`;
      }).join('\n\n');
    }
  } catch (err) {
    console.warn('[AI Service] Failed to retrieve candidates for category examples:', err);
  }

  // 4. Load prompt config
  const activePrompt = await getActivePrompt(settings.activePromptId, settings.updatedBy || settings._id);

  // Construct Stage 2 Prompt
  const promptText = `
You are an AI Routing Assistant for ApexResolve.
Your job is to analyze the user's complaint title and description, and predict the single most appropriate Category from the list below.
Only select from the categories listed below, which belong to the pre-selected department.

List of available Categories and their descriptions:
${JSON.stringify(catsJson, null, 2)}

Historical Examples for context:
${examplesText}

Instructions:
Select only one category. Do not create new category IDs. Only select one of the IDs listed above.
Return ONLY a valid JSON object in the format:
{
  "categoryId": "...",
  "confidence": "...",
  "reasoning": "..."
}
Keep reasoning under 15 words. Do not return any other text, markdown, or block tags.
`;

  const fullPrompt = `${activePrompt.systemPrompt}\n\n${promptText}\n\n${activePrompt.fallbackPrompt}\n\n${activePrompt.reasoningPrompt}\n\nComplaint Title: "${title}"\nComplaint Description: "${description}"`;

  // 5. Invoke LLM
  const result = await callLLM({ promptText: fullPrompt, settings });

  if (!result || !result.categoryId) {
    throw new Error('LLM response missing categoryId');
  }

  // 6. Validate Category exists and belongs to predicted department
  const matchedCat = activeCats.find(c => c._id.toString() === result.categoryId.toString());
  if (!matchedCat) {
    throw new Error(`Predicted categoryId ${result.categoryId} is not a valid active category for department ${departmentId}.`);
  }

  const prediction = {
    categoryId: matchedCat._id.toString(),
    categoryName: matchedCat.name,
    confidence: result.confidence !== undefined ? Number(result.confidence) : 0,
    reasoning: result.reasoning || ''
  };

  // 7. Store in Cache
  const cacheMinutes = settings.cacheDurationMinutes !== undefined ? settings.cacheDurationMinutes : 30;
  setCachedCategory(inputText, departmentId, prediction, cacheMinutes);

  return prediction;
};

/**
 * Invokes the configured AI provider to classify a complaint hierarchically (2 stages).
 * @param {Object} params - parameters
 * @param {string} params.title - Complaint title
 * @param {string} params.description - Complaint description
 * @param {Object} params.settings - Active AiSettings document
 * @returns {Promise<Object>} Classification results
 */
const classifyComplaint = async ({ title, description, settings }) => {
  const startTime = Date.now();
  const inputText = `${title || ''} ${description || ''}`.trim();

  // 1. Check global classificationCache
  const cachedFinal = getCachedClassification(inputText);
  if (cachedFinal) {
    return {
      ...cachedFinal,
      responseTimeMs: 0,
      cachedResponse: true
    };
  }

  let departmentResult = null;
  let categoryResult = null;

  // 2. Stage 1: Predict Department
  try {
    departmentResult = await predictDepartment({ title, description, settings });
  } catch (error) {
    console.error('[AI Service] Department Stage Failed:', error);
    // If department prediction fails, throw to fall back to manual selection
    throw error;
  }

  // 3. Stage 2: Predict Category
  try {
    categoryResult = await predictCategory({
      title,
      description,
      departmentId: departmentResult.departmentId,
      settings
    });
  } catch (error) {
    console.error('[AI Service] Category Stage Failed:', error);
    // If category prediction fails, return department only and allow manual category selection.
  }

  const responseTimeMs = Date.now() - startTime;

  const finalResult = {
    success: true,
    department: {
      id: departmentResult.departmentId,
      name: departmentResult.departmentName,
      confidence: departmentResult.confidence,
      reasoning: departmentResult.reasoning
    },
    category: categoryResult ? {
      id: categoryResult.categoryId,
      name: categoryResult.categoryName,
      confidence: categoryResult.confidence,
      reasoning: categoryResult.reasoning
    } : null,
    classificationMethod: 'two_stage_ai',
    responseTimeMs
  };

  // 4. Store in global classificationCache (only if both predictions succeeded)
  if (departmentResult && categoryResult) {
    const cacheMinutes = settings.cacheDurationMinutes !== undefined ? settings.cacheDurationMinutes : 30;
    setCachedClassification(inputText, {
      department: finalResult.department,
      category: finalResult.category,
      classificationMethod: finalResult.classificationMethod
    }, cacheMinutes);
  }

  return finalResult;
};

module.exports = {
  classifyComplaint,
  getCachedClassification,
  setCachedClassification,
  clearClassificationCache,
  getActivePrompt
};
