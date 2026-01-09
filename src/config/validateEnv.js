import logger from './logger.js';

/**
 * Validate required environment variables
 * Throws error with clear message if any required vars are missing
 * FRONTEND_URL is optional - only warns if missing
 */
const validateEnv = () => {
  const required = [
    'MONGO_URI',
    'JWT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];

  // Check required variables
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const errorMessage = `Missing environment variables: ${missing.join(', ')}`;
    throw new Error(errorMessage);
  }

  // Warn if FRONTEND_URL is missing (optional)
  if (!process.env.FRONTEND_URL) {
    logger.warn('FRONTEND_URL not set. Using localhost origins only.');
  }
};

export default validateEnv;

