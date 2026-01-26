import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import connectDB from './config/db.js';
import app from './app.js';
import logger from './config/logger.js';
import validateEnv from './config/validateEnv.js';

// Check if integrations routes are mounted by inspecting router stack
const integrationsMounted = app._router?.stack?.some((layer) => {
  const path = layer?.regexp?.toString() || '';
  return path.includes('integrations') || path.includes('/api/integrations');
}) || false;

console.log('[BOOT] app.js loaded, integrations mounted:', integrationsMounted);

app.set('trust proxy', true);
console.log("trust proxy:", app.get("trust proxy"));

const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Start server only after successful database connection
 */
const startServer = async () => {
  try {
    // Validate environment variables FIRST (before connecting to DB)
    validateEnv();

    // Connect to MongoDB Atlas
    await connectDB();
    logger.info('Mongo connected');

    // Start Express server only if DB connection is successful
    // Listen on 0.0.0.0 to accept connections from Railway
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server started successfully`, {
        port: PORT,
        environment: NODE_ENV,
        database: 'MongoDB Atlas',
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      message: error.message,
      stack: error.stack,
    });
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

// Start the application
startServer();

