const rateLimitCache = new Map();

/**
 * Creates an IP-based rate limiting middleware.
 * @param {number} limit - Maximum requests allowed in the time window
 * @param {number} windowMs - Time window in milliseconds
 * @param {string} limiterName - Display name for logging/telemetry
 */
const rateLimiter = (limit = 100, windowMs = 15 * 60 * 1000, limiterName = 'API') => {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Bypass rate limiting for local loopback development and testing
    if (process.env.NODE_ENV !== 'production' && (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1')) {
      return next();
    }
    const now = Date.now();

    // Clean up expired cache items to prevent memory leaks if cache grows large
    if (rateLimitCache.size > 5000) {
      for (const [key, val] of rateLimitCache.entries()) {
        if (now > val.resetTime) {
          rateLimitCache.delete(key);
        }
      }
    }

    const key = `${limiterName}:${ip}`;

    if (!rateLimitCache.has(key)) {
      rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = rateLimitCache.get(key);
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    record.count++;
    if (record.count > limit) {
      return res.status(429).json({
        success: false,
        message: `Too many requests to the ${limiterName} endpoints. Please try again in a few minutes.`
      });
    }

    next();
  };
};

module.exports = {
  apiLimiter: rateLimiter(150, 15 * 60 * 1000, 'Global API'),
  authLimiter: rateLimiter(15, 15 * 60 * 1000, 'Authentication')
};
