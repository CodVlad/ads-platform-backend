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
  if (process.env.NODE_ENV === 'production') {
    return authRateLimiter(req, res, next);
  }
  // In development, skip rate limiting
  next();
};

// Rate limiting for general API routes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  validate: false, // Disable validation to prevent ERR_ERL_UNEXPECTED_X_FORWARDED_FOR crash
  keyGenerator: (req) => req.ip, // Safe key generator that does not depend on X-Forwarded-For
});

