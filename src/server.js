import dotenv from 'dotenv';
import connectDB from './config/db.js';
import app from './app.js';
import logger from './config/logger.js';

// Only load .env file in development (not required in production if env vars are provided)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const PORT = process.env.PORT || 5001;

/**
 * Start server only after successful database connection
 */
const startServer = async () => {
  try {
    // Connect to MongoDB Atlas first
    await connectDB();

    // Start Express server only if DB connection is successful
    app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        database: 'MongoDB Atlas',
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

// Start the application
startServer();

