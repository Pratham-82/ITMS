const tenantLocalStorage = require('../middleware/tenantContext');

class MetadataCache {
  constructor() {
    this.memoryCache = new Map();
    this.redisClient = null;

    if (process.env.REDIS_URL) {
      try {
        const redis = require('redis');
        this.redisClient = redis.createClient({ url: process.env.REDIS_URL });
        this.redisClient.connect().catch(err => {
          console.warn('MetadataCache: Redis connection failed, using memory fallback.', err.message);
          this.redisClient = null;
        });
      } catch (e) {
        // redis module not available, fall back quietly
      }
    }
  }

  getTenantId() {
    return tenantLocalStorage.getStore() || 'default-tenant';
  }

  getCacheKey(tenantId, category, identifier = '') {
    return `metadata:${tenantId}:${category}:${identifier}`;
  }

  async get(category, identifier = '') {
    const tenantId = this.getTenantId();
    const key = this.getCacheKey(tenantId, category, identifier);

    if (this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        // Fall back to memory on Redis read error
      }
    }

    const cachedObj = this.memoryCache.get(key);
    if (!cachedObj) return null;

    if (Date.now() > cachedObj.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    return cachedObj.value;
  }

  async set(category, identifier, value, ttlSeconds = 3600) {
    const tenantId = this.getTenantId();
    const key = this.getCacheKey(tenantId, category, identifier);

    if (this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
      } catch (err) {
        // Fall back to memory on Redis write error
      }
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  async invalidate(category, identifier = '') {
    const tenantId = this.getTenantId();

    if (identifier) {
      const key = this.getCacheKey(tenantId, category, identifier);
      if (this.redisClient) {
        try {
          await this.redisClient.del(key);
        } catch (err) {}
      }
      this.memoryCache.delete(key);
    } else {
      const prefix = `metadata:${tenantId}:${category}:`;
      if (this.redisClient) {
        try {
          const keys = await this.redisClient.keys(`${prefix}*`);
          if (keys && keys.length > 0) {
            await this.redisClient.del(keys);
          }
        } catch (err) {}
      }
      for (const k of this.memoryCache.keys()) {
        if (k.startsWith(prefix)) {
          this.memoryCache.delete(k);
        }
      }
    }

    // Always invalidate composite fullschema keys for this tenant
    const compositePrefix = `metadata:${tenantId}:fullschema:`;
    if (this.redisClient) {
      try {
        const keys = await this.redisClient.keys(`${compositePrefix}*`);
        if (keys && keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } catch (err) {}
    }
    for (const k of this.memoryCache.keys()) {
      if (k.startsWith(compositePrefix)) {
        this.memoryCache.delete(k);
      }
    }
  }

  async flush() {
    const tenantId = this.getTenantId();
    const prefix = `metadata:${tenantId}:`;

    if (this.redisClient) {
      try {
        const keys = await this.redisClient.keys(`${prefix}*`);
        if (keys && keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } catch (err) {}
    }

    for (const k of this.memoryCache.keys()) {
      if (k.startsWith(prefix)) {
        this.memoryCache.delete(k);
      }
    }
  }
}

module.exports = new MetadataCache();
