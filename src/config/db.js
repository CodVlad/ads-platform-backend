import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

/**
 * Connect to MongoDB Atlas using Mongoose
 * Uses connection string from MONGO_URI environment variable
 */
const connectDB = async () => {
  try {
    // Check if MONGO_URI is provided
    if (!process.env.MONGO_URI) {
      logger.error('MongoDB Connection Error', {
        message: 'MONGO_URI is not defined in environment variables',
      });
      process.exit(1);
    }

    // Mongoose connection options for production
    const options = {
      // Use new URL parser
      // Remove deprecated options - Mongoose 6+ handles these automatically
    };

    // Connect to MongoDB Atlas
    const conn = await mongoose.connect(process.env.MONGO_URI, options);

    logger.info('MongoDB Atlas Connected Successfully', {
      host: conn.connection.host,
      database: conn.connection.name,
      state: conn.connection.readyState === 1 ? 'connected' : 'disconnected',
    });

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB Connection Error', {
        message: err.message,
      });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB Disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });
  } catch (error) {
    logger.error('MongoDB Connection Error', {
      message: error.message,
      stack: error.stack,
    });
    // Exit process if DB connection fails
    process.exit(1);
  }
};

export default connectDB;

