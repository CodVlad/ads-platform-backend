import mongoose from 'mongoose';
import Ad from '../models/Ad.js';
import { AppError } from './error.middleware.js';

/**
 * Middleware to check if the authenticated user owns the ad
 * Attaches the ad to req.ad if ownership is verified
 * 
 * IMPORTANT: This middleware does NOT filter by status.
 * It allows access to ads with ANY status (draft, active, sold)
 * as long as the user owns the ad and it's not deleted.
 * 
 * Status filtering is handled in controllers/routes where needed.
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params.id - Ad ID from URL
 * @param {Object} req.user - User object from JWT auth middleware
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const checkAdOwnership = async (req, res, next) => {
  try {
    // Ensure req.user exists and has id (should be set by protect middleware)
    if (!req.user || !req.user.id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    // Ensure req.params.id exists (should be set by route parameter)
    // Route parameter name must match: :id (not :adId or other)
    const adId = req.params.id;
    if (!adId) {
      return next(
        new AppError('Ad ID is required', 400, {
          type: 'MISSING_ID',
        })
      );
    }

    // Validate ObjectId format to prevent ID injection
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return next(
        new AppError('Invalid ID format', 400, {
          type: 'INVALID_ID',
        })
      );
    }

    // Find ad by ID only (no query conditions to avoid ObjectId vs string issues)
    // Use findById for direct ID lookup - MongoDB handles ObjectId conversion automatically
    const ad = await Ad.findById(adId);

    // Check if ad exists (404 - not found)
    if (!ad) {
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }

    // Check if ad is deleted (404 - not found)
    // Verify isDeleted separately to avoid query issues
    if (ad.isDeleted === true) {
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }

    // Verify ownership: compare ObjectId with string
    // ad.user is ObjectId (from MongoDB), req.user.id is string (from JWT middleware)
    // Convert ObjectId to string for safe comparison
    const adUserId = ad.user.toString();
    const currentUserId = req.user.id; // Already a string from auth middleware

    // Verify ownership (403 - forbidden)
    // Only the owner can access their ads (regardless of status)
    if (adUserId !== currentUserId) {
      return next(
        new AppError('You do not own this resource', 403, {
          type: 'FORBIDDEN',
        })
      );
    }

    // Attach ad to request for use in controller
    // The ad is available with ANY status (draft, active, sold)
    req.ad = ad;
    next();
  } catch (error) {
    next(error);
  }
};

