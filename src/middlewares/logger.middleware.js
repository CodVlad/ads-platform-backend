import logger from '../config/logger.js';

/**
 * Middleware to log important requests
 * Only logs POST, PUT, PATCH, DELETE requests to avoid spam
 */
export const requestLogger = (req, res, next) => {
  const method = req.method;
  const importantMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  // Only log important methods
  if (importantMethods.includes(method)) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    // Add user ID if authenticated
    if (req.user) {
      logData.userId = req.user._id;
    }

    logger.info('Request', logData);
  }

  next();
};

