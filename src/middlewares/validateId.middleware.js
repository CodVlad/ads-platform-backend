import mongoose from 'mongoose';
import { AppError } from './error.middleware.js';

/**
 * Middleware to validate MongoDB ObjectId
 * Prevents ID injection attacks by validating the ID format
 */
export const validateObjectId = (req, res, next) => {
  const { id } = req.params;

  // Check if ID is provided
  if (!id) {
    return next(
      new AppError('ID parameter is required', 400, {
        type: 'MISSING_ID',
      })
    );
  }

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(
      new AppError('Invalid ID format', 400, {
        type: 'INVALID_ID',
        id,
      })
    );
  }

  next();
};

