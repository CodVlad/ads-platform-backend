import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

// Custom error class
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle MongoDB Cast Error (invalid ObjectId)
const handleCastError = (error) => {
  const message = `Resource not found with id: ${error.value}`;
  return new AppError(message, 404, { field: error.path, value: error.value });
};

// Handle MongoDB Duplicate Key Error
const handleDuplicateKeyError = (error) => {
  const field = Object.keys(error.keyPattern)[0];
  const value = error.keyValue[field];
  const message = `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`;
  return new AppError(message, 400, { field, value });
};

// Handle MongoDB Validation Error
const handleValidationError = (error) => {
  const errors = Object.values(error.errors).map((err) => ({
    field: err.path,
    message: err.message,
  }));
  const message = 'Validation failed';
  return new AppError(message, 400, { errors });
};

// Handle JWT Errors
const handleJWTError = (error) => {
  if (error instanceof jwt.JsonWebTokenError) {
    return new AppError('Invalid token. Please login again', 401, { type: 'INVALID_TOKEN' });
  }
  if (error instanceof jwt.TokenExpiredError) {
    return new AppError('Token expired. Please login again', 401, { type: 'TOKEN_EXPIRED' });
  }
  return new AppError('Authentication failed', 401, { type: 'AUTH_ERROR' });
};

// Global error handler middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  const logData = {
    message: err.message,
    stack: err.stack,
    statusCode: error.statusCode || 500,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
  };

  // Add user ID if authenticated
  if (req.user) {
    logData.userId = req.user._id;
  }

  // Log based on severity
  if (error.statusCode >= 500) {
    logger.error('Server Error', logData);
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error', logData);
  } else {
    logger.info('Error', logData);
  }

  // MongoDB Cast Error (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    error = handleCastError(err);
  }

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }

  // MongoDB Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    error = handleValidationError(err);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError(err);
  }

  // Use AppError if it's already an AppError instance
  if (err instanceof AppError) {
    error = err;
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  const details = error.details || null;

  // Production: Don't expose stack trace or internal errors
  const isProduction = process.env.NODE_ENV === 'production';
  
  // For 500 errors in production, use generic message
  const errorMessage = isProduction && statusCode === 500
    ? 'Something went wrong. Please try again later.'
    : message;

  // Standardize response format
  const response = {
    success: false,
    message: errorMessage,
  };

  // Standardize validation errors: ensure details.errors format
  if (details) {
    // If details has errors array, use it directly
    if (details.errors && Array.isArray(details.errors)) {
      response.details = { errors: details.errors };
    }
    // If details is an object with other properties, include them
    else if (typeof details === 'object') {
      response.details = details;
    }
  }

  // Regression safeguard: Never send success:true with status >= 400
  if (statusCode >= 400 && response.success !== false) {
    response.success = false;
    logger.warn('Error handler: Forced success to false for error status', {
      statusCode,
      originalSuccess: response.success,
    });
  }

  // Never expose stack trace in production
  if (!isProduction && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// 404 Not Found middleware
export const notFound = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    { method: req.method, path: req.originalUrl }
  );
  next(error);
};

