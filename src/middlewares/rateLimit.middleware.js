import rateLimit from 'express-rate-limit';

// Rate limiting for auth routes (anti brute force)
// Disabled in development, active in production
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests too
  validate: false, // Disable validation to prevent ERR_ERL_UNEXPECTED_X_FORWARDED_FOR crash
  keyGenerator: (req) => req.ip, // Safe key generator that does not depend on X-Forwarded-For
});

// Conditional middleware: only apply rate limiting in production
export const authLimiter = (req, res, next) => {
  // Skip OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }
  if (process.env.NODE_ENV === 'production') {
    return authRateLimiter(req, res, next);
  }
  // In development, skip rate limiting
  next();
};

// Rate limiting for read operations (GET requests)
// Higher limit, shorter window for read-heavy endpoints
const readRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 seconds (1 minute)
  max: 120, // Limit each IP to 120 GET requests per minute
  handler: (req, res) => {
    const retryAfter = req.rateLimit?.resetTime 
      ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
      : 60;
    res.status(429).json({
      success: false,
      message: 'Too many requests, try again later',
      details: {
        type: 'RATE_LIMIT',
        retryAfterSeconds: retryAfter > 0 ? retryAfter : 60,
      },
    });
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Don't count successful requests
  validate: false, // Disable validation to prevent ERR_ERL_UNEXPECTED_X_FORWARDED_FOR crash
  keyGenerator: (req) => req.ip, // Safe key generator that does not depend on X-Forwarded-For
});

// Rate limiting for write operations (POST/PUT/PATCH/DELETE)
// Lower limit, longer window for write operations
const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, // Limit each IP to 40 write requests per 15 minutes
  handler: (req, res) => {
    const retryAfter = req.rateLimit?.resetTime
      ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
      : 900;
    res.status(429).json({
      success: false,
      message: 'Too many requests, try again later',
      details: {
        type: 'RATE_LIMIT',
        retryAfterSeconds: retryAfter > 0 ? retryAfter : 900,
      },
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all write requests (including successful)
  validate: false,
  keyGenerator: (req) => req.ip,
});

// Smart middleware: applies readLimiter for GET, writeLimiter for POST/PUT/PATCH/DELETE
export const apiLimiter = (req, res, next) => {
  // Skip OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Apply readLimiter for GET requests
  if (req.method === 'GET') {
    return readRateLimiter(req, res, next);
  }

  // Apply writeLimiter for POST, PUT, PATCH, DELETE
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return writeRateLimiter(req, res, next);
  }

  // For other methods, skip rate limiting
  next();
};

// Export individual limiters for specific use cases if needed
export const readLimiter = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return readRateLimiter(req, res, next);
};

export const writeLimiter = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return writeRateLimiter(req, res, next);
};

// Rate limiting for forgot-password (more lenient than general auth)
const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 20, // 5 in production, 20 in development
  message: {
    success: false,
    message: 'Too many reset attempts, try again later',
    details: {
      type: 'RATE_LIMIT',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count successful requests too
  validate: false, // Disable validation to prevent ERR_ERL_UNEXPECTED_X_FORWARDED_FOR crash
  keyGenerator: (req) => req.ip, // Safe key generator that does not depend on X-Forwarded-For
});

// Wrapper for forgot-password limiter
export const forgotPasswordLimiter = (req, res, next) => {
  // Skip OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }
  return forgotPasswordRateLimiter(req, res, next);
};

// Rate limiting for reset-password (more lenient than forgot-password)
const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 30, // 10 in production, 30 in development
  message: {
    success: false,
    message: 'Too many reset attempts, try again later',
    details: {
      type: 'RATE_LIMIT',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count successful requests too
  validate: false, // Disable validation to prevent ERR_ERL_UNEXPECTED_X_FORWARDED_FOR crash
  keyGenerator: (req) => req.ip, // Safe key generator that does not depend on X-Forwarded-For
});

// Wrapper for reset-password limiter
export const resetPasswordLimiter = (req, res, next) => {
  // Skip OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }
  return resetPasswordRateLimiter(req, res, next);
};

