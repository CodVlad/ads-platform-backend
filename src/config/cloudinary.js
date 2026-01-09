import { v2 as cloudinary } from 'cloudinary';
import logger from './logger.js';

/**
 * Configure Cloudinary with environment variables
 * Validates that all required credentials are present
 */
const configureCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // Validate required environment variables
  if (!cloudName || !apiKey || !apiSecret) {
    const missing = [];
    if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!apiKey) missing.push('CLOUDINARY_API_KEY');
    if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');

    logger.error('Cloudinary configuration error', {
      message: `Missing required environment variables: ${missing.join(', ')}`,
      missing,
    });

    throw new Error(
      `Cloudinary configuration error: Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // Configure Cloudinary
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true, // Always use HTTPS
  });

  logger.info('Cloudinary configured successfully', {
    cloud_name: cloudName,
  });
};

// Initialize Cloudinary configuration
try {
  configureCloudinary();
} catch (error) {
  logger.error('Failed to configure Cloudinary', {
    message: error.message,
  });
  // Don't exit process - allow server to start but uploads will fail
}

export default cloudinary;

