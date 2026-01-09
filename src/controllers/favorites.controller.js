import User from '../models/User.js';
import Ad from '../models/Ad.js';
import mongoose from 'mongoose';
import { AppError } from '../middlewares/error.middleware.js';

/**
 * Add ad to user's favorites
 * Only allows active ads to be favorited
 * Idempotent: returns 200 if already in favorites
 */
export const addToFavorites = async (req, res, next) => {
  try {
    // Ensure req.user exists and has id
    if (!req.user || !req.user.id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    // Validate ObjectId format to prevent ID injection
    const adId = req.params.adId;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[FAVORITES] Invalid adId format:', adId);
      }
      return next(
        new AppError('Invalid ad ID format', 400, {
          type: 'INVALID_ID',
        })
      );
    }

    // Find ad in database
    const ad = await Ad.findOne({
      _id: adId,
      isDeleted: false,
    });

    // Check if ad exists -> 404
    if (!ad) {
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }

    // Only allow favoriting active ads -> 400
    if (ad.status !== 'active') {
      return next(
        new AppError('Only active ads can be added to favorites', 400, {
          type: 'NOT_ACTIVE',
        })
      );
    }

    // Find user and check if ad is already in favorites
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(
        new AppError('User not found', 404, {
          type: 'USER_NOT_FOUND',
        })
      );
    }

    // Check if ad is already in favorites -> 200 (idempotent, not an error)
    const favoritesIds = (user.favorites || []).map((id) => id.toString());
    if (favoritesIds.includes(adId)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[FAVORITES] Ad already in favorites:', adId, 'for user:', req.user.id);
      }
      // Success response - ALWAYS use status 200 for success
      return res.status(200).json({
        success: true,
        message: 'Ad already in favorites',
        favorite: true,
      });
    }

    // Add ad to favorites using $addToSet (prevents duplicates)
    await User.findByIdAndUpdate(
      req.user.id,
      {
        $addToSet: { favorites: adId },
      },
      { new: true, runValidators: true }
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('[FAVORITES] Ad added to favorites:', adId, 'for user:', req.user.id);
    }

    // Success response - ALWAYS use status 200 for success
    return res.status(200).json({
      success: true,
      message: 'Ad added to favorites',
      favorite: true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove ad from user's favorites
 * Idempotent: returns 200 if not in favorites
 */
export const removeFromFavorites = async (req, res, next) => {
  try {
    // Ensure req.user exists and has id
    if (!req.user || !req.user.id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    // Validate ObjectId format to prevent ID injection
    const adId = req.params.adId;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[FAVORITES] Invalid adId format:', adId);
      }
      return next(
        new AppError('Invalid ad ID format', 400, {
          type: 'INVALID_ID',
        })
      );
    }

    // Find user
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(
        new AppError('User not found', 404, {
          type: 'USER_NOT_FOUND',
        })
      );
    }

    // Check if ad is in favorites -> 200 (idempotent)
    const favoritesIds = (user.favorites || []).map((id) => id.toString());
    if (!favoritesIds.includes(adId)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[FAVORITES] Ad not in favorites:', adId, 'for user:', req.user.id);
      }
      return res.status(200).json({
        success: true,
        message: 'Ad not in favorites',
        favorite: false,
      });
    }

    // Remove ad from favorites using $pull
    await User.findByIdAndUpdate(
      req.user.id,
      {
        $pull: { favorites: adId },
      },
      { new: true, runValidators: true }
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('[FAVORITES] Ad removed from favorites:', adId, 'for user:', req.user.id);
    }

    // Success response - ALWAYS use status 200 for success
    return res.status(200).json({
      success: true,
      message: 'Ad removed from favorites',
      favorite: false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's favorite ads
 * Returns stable shape with _id, title, images, price, currency, status
 */
export const getFavorites = async (req, res, next) => {
  try {
    // Ensure req.user exists and has id
    if (!req.user || !req.user.id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    // Find user with populated favorites
    const user = await User.findById(req.user.id).populate({
      path: 'favorites',
      match: {
        isDeleted: false,
      },
      select: '_id title images price currency status',
    });

    if (!user) {
      return next(
        new AppError('User not found', 404, {
          type: 'USER_NOT_FOUND',
        })
      );
    }

    // Filter out null values (ads that don't match the populate match condition)
    const favorites = (user.favorites || []).filter((ad) => ad !== null);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[FAVORITES] Retrieved', favorites.length, 'favorites for user:', req.user.id);
    }

    res.status(200).json({
      success: true,
      favorites,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's favorite ads
 * Returns stable shape with _id, title, images, price, currency, status
 */
export const getMyFavorites = async (req, res, next) => {
  try {
    // Ensure req.user exists and has id
    if (!req.user || !req.user.id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    // Find user with populated favorites
    const user = await User.findById(req.user.id).populate({
      path: 'favorites',
      match: {
        isDeleted: false,
      },
      select: '_id title images price currency status',
    });

    if (!user) {
      return next(
        new AppError('User not found', 404, {
          type: 'USER_NOT_FOUND',
        })
      );
    }

    // Filter out null values (ads that don't match the populate match condition)
    const favorites = (user.favorites || []).filter((ad) => ad !== null);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[FAVORITES] Retrieved', favorites.length, 'favorites for user:', req.user.id);
    }

    res.status(200).json({
      success: true,
      favorites,
    });
  } catch (error) {
    next(error);
  }
};

