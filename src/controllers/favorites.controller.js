import User from '../models/User.js';
import Ad from '../models/Ad.js';
import mongoose from 'mongoose';
import { AppError } from '../middlewares/error.middleware.js';

/**
 * Add ad to user's favorites
 * Only allows active ads to be favorited
 * Prevents duplicates
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

    // Check if ad exists
    if (!ad) {
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }

    // Only allow favoriting active ads
    if (ad.status !== 'active') {
      return next(
        new AppError('Only active ads can be added to favorites', 400, {
          type: 'INVALID_AD_STATUS',
          message: `Cannot favorite ad with status: ${ad.status}`,
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

    // Check if ad is already in favorites
    if (user.favorites && user.favorites.includes(adId)) {
      return next(
        new AppError('Ad is already in favorites', 400, {
          type: 'ALREADY_FAVORITE',
          message: 'This ad is already in your favorites',
        })
      );
    }

    // Add ad to favorites using $addToSet (prevents duplicates)
    await User.findByIdAndUpdate(
      req.user.id,
      {
        $addToSet: { favorites: adId },
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Ad added to favorites successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove ad from user's favorites
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

    // Check if ad is in favorites
    if (!user.favorites || !user.favorites.includes(adId)) {
      return next(
        new AppError('Ad is not in favorites', 400, {
          type: 'NOT_IN_FAVORITES',
          message: 'This ad is not in your favorites',
        })
      );
    }

    // Remove ad from favorites using $pull
    await User.findByIdAndUpdate(
      req.user.id,
      {
        $pull: { favorites: adId },
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Ad removed from favorites successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's favorite ads
 * Returns only active, non-deleted ads
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
        status: 'active',
        isDeleted: false,
      },
      select: 'title price images status user createdAt',
      populate: {
        path: 'user',
        select: 'name email',
      },
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

    res.json({
      success: true,
      count: favorites.length,
      favorites,
    });
  } catch (error) {
    next(error);
  }
};

