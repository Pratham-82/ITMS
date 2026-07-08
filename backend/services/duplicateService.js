const Fuse = require('fuse.js');
const { decrypt } = require('./encryptionHelper');
const Complaint = require('../models/Ticket');

// In-Memory Caching for Embeddings to prevent redundant API calls on keystrokes
const embeddingCache = new Map();

/**
 * Gets cached embedding values for normalized text.
 * @param {string} text - Input text
 * @returns {number[]|null} Cached embedding vector or null
 */
const getCachedEmbedding = (text) => {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (embeddingCache.has(normalized)) {
    const entry = embeddingCache.get(normalized);
    // Cache TTL: 30 minutes
    if (Date.now() - entry.timestamp < 30 * 60 * 1000) {
      return entry.vector;
    }
    embeddingCache.delete(normalized);
  }
  return null;
};

/**
 * Sets embedding values in the cache.
 * @param {string} text - Input text
 * @param {number[]} vector - Embedding vector
 */
const setCachedEmbedding = (text, vector) => {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  embeddingCache.set(normalized, {
    timestamp: Date.now(),
    vector
  });
};

/**
 * Generates high-quality text embedding using configured AI provider.
 * Falls back to empty array if API fails (resilient failsafe mode).
 * @param {string} text - Input text to embed
 * @param {Object} settings - Active AiSettings document
 * @returns {Promise<number[]>} Array of floats representing embedding vector
 */
const generateEmbedding = async (text, settings) => {
  try {
    const cached = getCachedEmbedding(text);
    if (cached) {
      return cached;
    }

    const decryptedKey = decrypt(settings.apiKey) || process.env.GEMINI_API_KEY || '';
    if (!decryptedKey) {
      console.warn('[Embeddings] API Key is missing. Returning empty vector.');
      return [];
    }

    const provider = settings.aiProvider || 'google_gemini';
    const model = (provider === 'google_gemini') ? 'text-embedding-004' : 'text-embedding-3-small';

    let url = '';
    let headers = {};
    let body = {};

    if (provider === 'google_gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${decryptedKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = {
        model: `models/${model}`,
        content: {
          parts: [{ text }]
        }
      };
    } else if (provider === 'openai') {
      url = 'https://api.openai.com/v1/embeddings';
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${decryptedKey}`
      };
      body = {
        model,
        input: text
      };
    } else {
      // Groq, Claude, and other providers don't support embeddings — rely on fuzzy matching
      console.warn(`[Embeddings] Provider "${provider}" does not support embeddings. Using fuzzy matching fallback.`);
      return [];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Embeddings] API Http Error (${response.status}):`, errText);
      return [];
    }

    const data = await response.json();
    let vector = [];
    if (provider === 'google_gemini') {
      vector = data.embedding?.values || [];
    } else {
      vector = data.data?.[0]?.embedding || [];
    }

    if (vector && vector.length > 0) {
      setCachedEmbedding(text, vector);
    }
    return vector;
  } catch (err) {
    console.error('[Embeddings] Failed to fetch embeddings:', err);
    return [];
  }
};

/**
 * Calculates standard cosine similarity between two float vectors.
 */
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Finds duplicate candidates using a hybrid pre-filtered Fuse.js + Cosine Similarity approach.
 */
const findCandidates = async ({ title, description, categoryId, departmentName, settings }) => {
  try {
    // Search globally across all departments to prevent missing duplicates due to incorrect/default department selection
    const query = {
      isDuplicate: false,
      status: { $in: ['Pending', 'Assigned', 'In Progress', 'Resolved'] }
    };

    const candidates = await Complaint.find(
      query,
      'trackingId title description status department assignedDepartment category categoryName supporters createdAt embeddingVector priority'
    );
    if (candidates.length === 0) {
      return [];
    }

    // 1. Fuzzy Text Search (title+description against candidates)
    const fuse = new Fuse(candidates, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'description', weight: 1 }
      ],
      includeScore: true,
      threshold: 0.75,
      ignoreLocation: true,
      minMatchCharLength: 3
    });

    const fuzzyResultsTitle = fuse.search(title);
    const fuzzyScoresMap = new Map();
    fuzzyResultsTitle.forEach(res => {
      const score = 1 - res.score;
      const existing = fuzzyScoresMap.get(res.item._id.toString()) || 0;
      fuzzyScoresMap.set(res.item._id.toString(), Math.max(existing, score));
    });

    // Also search by description for better recall when embeddings are unavailable
    if (description && description.trim().length > 10) {
      const fuzzyResultsDesc = fuse.search(description.substring(0, 200));
      fuzzyResultsDesc.forEach(res => {
        const score = 1 - res.score;
        const id = res.item._id.toString();
        const existing = fuzzyScoresMap.get(id) || 0;
        fuzzyScoresMap.set(id, Math.max(existing, score));
      });
    }

    // Keyword overlap scoring (helps when fuzzy misses semantic matches)
    const stopWords = new Set(['the','a','an','is','are','was','were','be','in','on','at','to','for','of','and','or','not','it','my','our','this','that','with','from','has','have','had','but','by','as','very','been']);
    const extractKeywords = (text) => {
      return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    };
    const inputKeywords = new Set(extractKeywords(`${title} ${description}`));

    // 2. Semantic Embedding Similarity
    let inputVector = [];
    if (settings.enableAiRouting) {
      inputVector = await generateEmbedding(`${title} ${description}`, settings);
    }

    const hasSemantic = inputVector.length > 0;
    const matchedList = [];
    for (const cand of candidates) {
      const candId = cand._id.toString();
      const fuzzyScore = fuzzyScoresMap.get(candId) || 0;
      
      // Keyword overlap score
      const candKeywords = extractKeywords(`${cand.title} ${cand.description || ''}`);
      const overlap = candKeywords.filter(kw => inputKeywords.has(kw)).length;
      const keywordScore = candKeywords.length > 0 ? Math.min(overlap / Math.max(inputKeywords.size, 1), 1) : 0;

      let semanticScore = 0;
      if (hasSemantic && cand.embeddingVector && cand.embeddingVector.length > 0) {
        semanticScore = cosineSimilarity(inputVector, cand.embeddingVector);
      }

      // Combined score weighting depends on what signals are available
      const hasEmbeddings = hasSemantic && cand.embeddingVector && cand.embeddingVector.length > 0;
      let combinedScore;
      if (hasEmbeddings) {
        // Full mode: Semantic 50% + Fuzzy 30% + Keywords 20%
        combinedScore = (semanticScore * 0.5 + fuzzyScore * 0.3 + keywordScore * 0.2);
      } else {
        // Fuzzy-only mode: Fuzzy 60% + Keywords 40%
        combinedScore = (fuzzyScore * 0.6 + keywordScore * 0.4);
      }

      // Filter by threshold (lower for fuzzy-only mode since scores are naturally lower)
      const minThreshold = hasEmbeddings ? 0.70 : 0.40;
      if (combinedScore >= minThreshold) {
        let matchLevel = 'Related Complaint';
        if (combinedScore >= 0.95) {
          matchLevel = 'Definite Duplicate';
        } else if (combinedScore >= 0.85) {
          matchLevel = 'Probable Duplicate';
        } else if (combinedScore >= 0.70) {
          matchLevel = 'Likely Related';
        }

        matchedList.push({
          complaintId: cand._id,
          trackingId: cand.trackingId,
          title: cand.title,
          description: cand.description,
          status: cand.status,
          priority: cand.priority,
          department: cand.assignedDepartment,
          categoryId: cand.category ? cand.category.toString() : null,
          categoryName: cand.categoryName || null,
          supporterCount: cand.supporters ? cand.supporters.length : 0,
          createdAt: cand.createdAt,
          similarityScore: combinedScore,
          semanticScore,
          fuzzyScore,
          matchLevel
        });
      }
    }

    // Sort by similarity descending
    return matchedList.sort((a, b) => b.similarityScore - a.similarityScore);
  } catch (err) {
    console.error('[DuplicateService] Failed searching candidates:', err);
    return [];
  }
};

module.exports = {
  generateEmbedding,
  cosineSimilarity,
  findCandidates
};
