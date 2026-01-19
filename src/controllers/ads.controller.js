import Ad from '../models/Ad.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AppError } from '../middlewares/error.middleware.js';
import cloudinary from '../config/cloudinary.js';
import logger from '../config/logger.js';
import { getCategoryTree, isValidCategory, isValidSubCategory } from '../utils/categoryValidator.js';

/**
 * Escape regex special characters to prevent regex injection
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for use in regex
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Get all categories with subcategories
 * GET /api/categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = getCategoryTree();

    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

export const getAds = async (req, res, next) => {
  try {
    const {
      q,
      minPrice,
      maxPrice,
      currency,
      category,
      subCategory,
      page,
      limit,
    } = req.query;

    // Build query object - only active, non-deleted ads
    const query = {
      status: 'active',
      isDeleted: false,
    };

    // Text search by title or description (case-insensitive)
    // Only apply if q exists and has non-empty content after trimming
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const qEscaped = escapeRegex(q.trim());
      query.$or = [
        { title: { $regex: qEscaped, $options: 'i' } },
        { description: { $regex: qEscaped, $options: 'i' } },
      ];
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) {
        const minPriceNum = parseFloat(minPrice);
        if (!isNaN(minPriceNum) && minPriceNum >= 0) {
          query.price.$gte = minPriceNum;
        }
      }
      if (maxPrice) {
        const maxPriceNum = parseFloat(maxPrice);
        if (!isNaN(maxPriceNum) && maxPriceNum >= 0) {
          query.price.$lte = maxPriceNum;
        }
      }
      // If price object is empty, remove it
      if (Object.keys(query.price).length === 0) {
        delete query.price;
      }
    }

    // Filter by currency (exact match if provided)
    if (currency && typeof currency === 'string' && currency.trim().length > 0) {
      query.currency = currency.trim();
    }

    // Filter by category and subCategory
    // Validate category if provided
    if (category) {
      if (typeof category !== 'string' || category.trim().length === 0) {
        return next(
          new AppError('Invalid category parameter', 400, {
            type: 'INVALID_CATEGORY',
            field: 'category',
          })
        );
      }

      const categorySlug = category.trim();
      if (!isValidCategory(categorySlug)) {
        return next(
          new AppError('Invalid category', 400, {
            type: 'INVALID_CATEGORY',
            field: 'category',
          })
        );
      }

      query.categorySlug = categorySlug;

      // If subCategory is provided, validate it belongs to category
      if (subCategory) {
        if (typeof subCategory !== 'string' || subCategory.trim().length === 0) {
          return next(
            new AppError('Invalid subCategory parameter', 400, {
              type: 'INVALID_SUBCATEGORY',
              field: 'subCategory',
            })
          );
        }

        const subCategorySlug = subCategory.trim();
        if (!isValidSubCategory(categorySlug, subCategorySlug)) {
          return next(
            new AppError('Invalid subcategory for the selected category', 400, {
              type: 'INVALID_SUBCATEGORY',
              field: 'subCategory',
            })
          );
        }

        query.subCategorySlug = subCategorySlug;
      }
    } else if (subCategory) {
      // subCategory provided without category -> error
      return next(
        new AppError('Category must be provided when filtering by subcategory', 400, {
          type: 'INVALID_FILTER',
          field: 'subCategory',
        })
      );
    }

    // Pagination logic
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const [ads, total] = await Promise.all([
      Ad.find(query)
        .populate('user', 'name email')
        .sort({ createdAt: -1 }) // Sort newest first
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Ad.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const pages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      ads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages,
        hasNext: pageNum < pages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyAds = async (req, res, next) => {
  try {
    // Ensure req.user exists and has id (should be set by protect middleware)
    if (!req.user || !req.user.id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    // Fetch all ads for the authenticated user
    // Include all statuses (draft/active/sold)
    // Exclude soft-deleted ads
    const ads = await Ad.find({
      user: req.user.id,
      isDeleted: false,
    })
      .populate('user', 'name email')
      .sort({ createdAt: -1 }) // Sort by newest first
      .lean();

    res.json({
      success: true,
      ads,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdById = async (req, res, next) => {
  try {
    // Validate ObjectId format to prevent ID injection
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(
        new AppError('Invalid ID format', 400, {
          type: 'INVALID_ID',
        })
      );
    }

    // Find ad (excluding deleted) - don't filter by status yet
    const ad = await Ad.findOne({
      _id: req.params.id,
      isDeleted: false,
    }).populate('user', 'name email');

    // If ad doesn't exist, return 404
    if (!ad) {
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }

    // If ad is ACTIVE: return it publicly (no auth required)
    if (ad.status === 'active') {
      return res.json({
        success: true,
        ad,
      });
    }

    // If ad is NOT active (draft/sold): check if user is authenticated and is owner
    // Extract token from Authorization header (optional - no error if missing)
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token provided, return 404 (don't leak that ad exists)
    if (!token) {
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }

    // Verify JWT token
    try {
      if (!process.env.JWT_SECRET) {
        // If JWT_SECRET not configured, treat as no auth
        return next(
          new AppError('Ad not found', 404, {
            type: 'NOT_FOUND',
          })
        );
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user still exists
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        // User doesn't exist, return 404 (don't leak ad existence)
        return next(
          new AppError('Ad not found', 404, {
            type: 'NOT_FOUND',
          })
        );
      }

      // Check if user is the owner of the ad
      const adUserId = ad.user._id.toString();
      const currentUserId = user._id.toString();

      if (adUserId === currentUserId) {
        // User is owner: return ad (any status)
        return res.json({
      success: true,
      ad,
    });
      } else {
        // User is authenticated but not owner: return 404 (don't leak ad existence)
        return next(
          new AppError('Ad not found', 404, {
            type: 'NOT_FOUND',
          })
        );
      }
    } catch (error) {
      // Token invalid, expired, or malformed: return 404 (don't leak ad existence)
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }
  } catch (error) {
    next(error);
  }
};

export const createAd = async (req, res, next) => {
  try {
    // Ensure req.user exists and has id
    if (!req.user || !req.user.id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    // Prevent status modification at creation - always create as draft
    if (req.body.status) {
      return next(
        new AppError('Cannot set status during creation. Ad is created as draft', 400, {
          type: 'STATUS_NOT_ALLOWED',
        })
      );
    }

    // Extract ONLY allowed fields from request body
    // Strict filtering to prevent injection of protected fields
    const allowedFields = {
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      currency: req.body.currency,
      categorySlug: req.body.categorySlug,
      subCategorySlug: req.body.subCategorySlug,
    };

    // Validate required fields
    if (!allowedFields.title || !allowedFields.description || allowedFields.price === undefined || !allowedFields.categorySlug || !allowedFields.subCategorySlug) {
      return next(
        new AppError('Title, description, price, category, and subcategory are required', 400, {
          type: 'MISSING_REQUIRED_FIELDS',
        })
      );
    }

    // Validate that images array exists and is not empty (set by uploadToCloudinary middleware)
    const images = req.body.images;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return next(
        new AppError('At least one image is required', 400, {
          type: 'IMAGES_REQUIRED',
        })
      );
    }

    // Create controlled ad object with ONLY allowed fields
    // Protected fields are set explicitly, NOT from request body
    const adData = {
      // Allowed fields from request body (strictly filtered)
      title: allowedFields.title.trim(),
      description: allowedFields.description.trim(),
      price: parseFloat(allowedFields.price),
      currency: allowedFields.currency || 'EUR',
      categorySlug: allowedFields.categorySlug.trim(),
      subCategorySlug: allowedFields.subCategorySlug.trim(),
      
      // Images from upload middleware (NOT from request body directly)
      images: images, // Array of Cloudinary URLs from uploadToCloudinary middleware
      
      // Protected fields - set explicitly, NEVER from request body
      status: 'draft', // Always create as draft - cannot be changed at creation
      user: req.user.id, // User comes ONLY from req.user.id (JWT token)
      // isDeleted defaults to false in schema
    };

    // Validate price is a valid number
    if (isNaN(adData.price) || adData.price < 0) {
      return next(
        new AppError('Price must be a valid positive number', 400, {
          type: 'INVALID_PRICE',
        })
      );
    }

    // Create ad using controlled object (no protected fields from request)
    const ad = await Ad.create(adData);

    const populatedAd = await Ad.findById(ad._id).populate('user', 'name email');

    res.status(201).json({
      success: true,
      message: 'Ad created successfully',
      ad: populatedAd,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update ad status
 * Validates status transitions: draft -> active -> sold
 * Only owner can change status
 */
export const updateAdStatus = async (req, res, next) => {
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(
        new AppError('Invalid ID format', 400, {
          type: 'INVALID_ID',
        })
      );
    }

    // Find ad in database - exclude deleted ads
    const ad = await Ad.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    // Check if ad exists (404 - not found)
    if (!ad) {
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }

    // Check if ad is deleted (404 - not found)
    if (ad.isDeleted === true) {
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }

    // Verify ownership: compare as strings (403 - forbidden)
    const adUserId = ad.user.toString();
    const currentUserId = req.user.id.toString();

    if (adUserId !== currentUserId) {
      return next(
        new AppError('You do not own this resource', 403, {
          type: 'FORBIDDEN',
        })
      );
    }

    // Extract status from request body (already validated by middleware)
    const { status } = req.body;

    // Validate status is one of allowed values (double-check, should be validated by middleware)
    const allowedStatuses = ['draft', 'active', 'sold'];
    if (!allowedStatuses.includes(status)) {
      return next(
        new AppError(`Status must be one of: ${allowedStatuses.join(', ')}`, 400, {
          type: 'INVALID_STATUS',
        })
      );
    }

    // Status transition validation
    // Allowed transitions:
    // - draft -> active (OK)
    // - active -> sold (OK)
    // - draft -> sold (NOT ALLOWED)
    // - active -> draft (NOT ALLOWED)
    // - sold -> anything (NOT ALLOWED)
    const validTransitions = {
      draft: ['active'], // draft can only become active
      active: ['sold'], // active can only become sold
      sold: [], // sold cannot change status
    };

    // Check if current status allows transition to new status
    if (ad.status === 'sold') {
      return next(
        new AppError('Cannot change status of sold ad', 400, {
          type: 'INVALID_STATUS_TRANSITION',
          currentStatus: ad.status,
          requestedStatus: status,
        })
      );
    }

    // Check if transition is valid
    if (!validTransitions[ad.status] || !validTransitions[ad.status].includes(status)) {
      const allowed = validTransitions[ad.status]?.join(', ') || 'none';
      return next(
        new AppError(
          `Invalid status transition. Current status: "${ad.status}", Allowed transitions: ${allowed}`,
          400,
          {
            type: 'INVALID_STATUS_TRANSITION',
            currentStatus: ad.status,
            requestedStatus: status,
            allowedTransitions: validTransitions[ad.status] || [],
          }
        )
      );
    }

    // Update status
    ad.status = status;
    await ad.save();

    // Populate user data for response
    const populatedAd = await Ad.findById(ad._id).populate('user', 'name email');

    // Return consistent JSON format
    res.json({
      success: true,
      data: populatedAd,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update ad details
 * Only allows editing: title, description, price, currency
 * Does NOT allow editing: user, status, isDeleted, images
 * Blocks editing for sold ads
 */
export const updateAd = async (req, res, next) => {
  try {
    // Use ad from checkAdOwnership middleware (already verified for ownership and existence)
    const ad = req.ad;

    // Check if ad is sold - sold ads cannot be edited
    if (ad.status === 'sold') {
      return next(
        new AppError('Cannot edit sold ad', 400, {
          type: 'SOLD_AD_NOT_EDITABLE',
          message: 'Sold ads cannot be edited',
        })
      );
    }

    // Extract ONLY allowed fields from request body
    // Protected fields (user, status, isDeleted, images) are NOT allowed
    const { title, description, price, currency, categorySlug, subCategorySlug } = req.body;

    // Check if at least one field is being updated (should be validated by middleware, but double-check)
    const hasUpdates =
      title !== undefined ||
      description !== undefined ||
      price !== undefined ||
      currency !== undefined ||
      categorySlug !== undefined ||
      subCategorySlug !== undefined;

    if (!hasUpdates) {
      return next(
        new AppError('At least one field must be provided for update', 400, {
          type: 'NO_FIELDS',
        })
      );
    }

    // Update allowed fields only
    // Use controlled updates to prevent injection of protected fields
    if (title !== undefined) {
      ad.title = title.trim();
    }
    if (description !== undefined) {
      ad.description = description.trim();
    }
    if (price !== undefined) {
      ad.price = parseFloat(price);
      // Validate price is positive (should be validated by middleware, but double-check)
      if (isNaN(ad.price) || ad.price <= 0) {
        return next(
          new AppError('Price must be a positive number greater than 0', 400, {
            type: 'INVALID_PRICE',
          })
        );
      }
    }
    if (currency !== undefined) {
      ad.currency = currency;
    }
    if (categorySlug !== undefined) {
      ad.categorySlug = categorySlug.trim();
    }
    if (subCategorySlug !== undefined) {
      ad.subCategorySlug = subCategorySlug.trim();
    }

    // Validate category/subcategory combination if both are being updated
    if (categorySlug !== undefined || subCategorySlug !== undefined) {
      const finalCategorySlug = categorySlug !== undefined ? categorySlug.trim() : ad.categorySlug;
      const finalSubCategorySlug = subCategorySlug !== undefined ? subCategorySlug.trim() : ad.subCategorySlug;
      
      if (!isValidSubCategory(finalCategorySlug, finalSubCategorySlug)) {
        return next(
          new AppError('Invalid subcategory for the selected category', 400, {
            type: 'INVALID_SUBCATEGORY',
          })
        );
      }
    }

    // Save changes (Mongoose will validate schema constraints)
    await ad.save();

    // Populate user data for response
    const populatedAd = await Ad.findById(ad._id).populate('user', 'name email');

    // Return success response
    res.json({
      success: true,
      message: 'Ad updated successfully',
      ad: populatedAd,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAd = async (req, res, next) => {
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(
        new AppError('Invalid ID format', 400, {
          type: 'INVALID_ID',
        })
      );
    }

    // Find ad in database - exclude already deleted ads
    const ad = await Ad.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    // Check if ad exists (404 - not found)
    if (!ad) {
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }

    // Verify ownership: compare as strings (403 - forbidden)
    const adUserId = ad.user.toString();
    const currentUserId = req.user.id.toString();

    if (adUserId !== currentUserId) {
      return next(
        new AppError('You do not own this resource', 403, {
          type: 'FORBIDDEN',
        })
      );
    }

    // Soft delete: set isDeleted = true
    ad.isDeleted = true;
    await ad.save();

    res.json({
      success: true,
      message: 'Ad deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Extract public_id from Cloudinary URL
 * Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{folder}/{public_id}.{format}
 * Or: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{folder}/{public_id}.{format}
 * 
 * @param {string} imageUrl - Full Cloudinary URL
 * @returns {string} public_id (with folder if present)
 */
const extractPublicIdFromUrl = (imageUrl) => {
  try {
    // Parse Cloudinary URL
    // Format: https://res.cloudinary.com/{cloud_name}/image/upload/{path}
    const url = new URL(imageUrl);
    
    // Extract path after /image/upload/
    const pathParts = url.pathname.split('/image/upload/');
    if (pathParts.length !== 2) {
      throw new Error('Invalid Cloudinary URL format');
    }
    
    // Get the path after /image/upload/
    let uploadPath = pathParts[1];
    
    // Remove version prefix if present (v1234567890/)
    uploadPath = uploadPath.replace(/^v\d+\//, '');
    
    // Remove file extension (.jpg, .png, etc.)
    uploadPath = uploadPath.replace(/\.[^/.]+$/, '');
    
    return uploadPath;
  } catch (error) {
    throw new Error(`Invalid Cloudinary URL: ${error.message}`);
  }
};

/**
 * Delete an image from an ad
 * Removes image from Cloudinary and from ad.images array
 * Only owner can delete images
 * Cannot delete last image (minimum 1 image required)
 * Cannot delete from sold ads
 */
export const deleteAdImage = async (req, res, next) => {
  try {
    // Use ad from checkAdOwnership middleware (already verified for ownership and existence)
    const ad = req.ad;

    // Check if ad is sold - sold ads cannot be edited
    if (ad.status === 'sold') {
      return next(
        new AppError('Cannot delete images from sold ad', 400, {
          type: 'SOLD_AD_NOT_EDITABLE',
          message: 'Sold ads cannot be modified',
        })
      );
    }

    // Extract imageUrl from request body
    // Only allow imageUrl field - reject any extra fields
    const bodyKeys = Object.keys(req.body || {});
    const allowedFields = ['imageUrl'];
    const extraFields = bodyKeys.filter((key) => !allowedFields.includes(key));

    if (extraFields.length > 0) {
      return next(
        new AppError('Extra fields not allowed', 400, {
          type: 'EXTRA_FIELDS',
          errors: extraFields.map((field) => ({
            field,
            message: `Field '${field}' is not allowed. Only 'imageUrl' is accepted.`,
          })),
        })
      );
    }

    const { imageUrl } = req.body;

    // Validate imageUrl is provided
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
      return next(
        new AppError('imageUrl is required and must be a non-empty string', 400, {
          type: 'MISSING_IMAGE_URL',
        })
      );
    }

    // Check if imageUrl exists in ad.images array
    if (!ad.images || !Array.isArray(ad.images) || !ad.images.includes(imageUrl)) {
      return next(
        new AppError('Image not found in ad', 400, {
          type: 'IMAGE_NOT_FOUND',
          message: 'The specified image URL does not exist in this ad',
        })
      );
    }

    // Check that ad has more than 1 image (cannot delete last image)
    if (ad.images.length <= 1) {
      return next(
        new AppError('Cannot delete last image', 400, {
          type: 'LAST_IMAGE',
          message: 'An ad must have at least one image',
        })
      );
    }

    // Extract public_id from Cloudinary URL
    let publicId;
    try {
      publicId = extractPublicIdFromUrl(imageUrl);
    } catch (error) {
      return next(
        new AppError(`Invalid Cloudinary URL: ${error.message}`, 400, {
          type: 'INVALID_CLOUDINARY_URL',
        })
      );
    }

    // Delete image from Cloudinary
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });

      // Check if deletion was successful
      if (result.result !== 'ok' && result.result !== 'not found') {
        // 'not found' is acceptable (image might already be deleted)
        logger.warn('Cloudinary delete result', {
          result: result.result,
          publicId,
          adId: ad._id,
        });
      }

      logger.info('Image deleted from Cloudinary', {
        publicId,
        result: result.result,
        adId: ad._id,
      });
    } catch (cloudinaryError) {
      // Log error but don't fail the request if image doesn't exist in Cloudinary
      logger.error('Cloudinary delete error', {
        message: cloudinaryError.message,
        publicId,
        adId: ad._id,
      });

      // If it's not a "not found" error, fail the request
      if (!cloudinaryError.message?.includes('not found')) {
        return next(
          new AppError('Failed to delete image from Cloudinary', 500, {
            type: 'CLOUDINARY_DELETE_ERROR',
          })
        );
      }
      // If image not found in Cloudinary, continue (might already be deleted)
    }

    // Remove image from ad.images array
    ad.images = ad.images.filter((url) => url !== imageUrl);

    // Save ad with updated images array
    await ad.save();

    // Return success response with updated images list
    res.json({
      success: true,
      message: 'Image deleted successfully',
      images: ad.images,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set cover image (first image in array)
 * Reorders ad.images array to place specified image at index 0
 * Only owner can set cover image
 * Cannot modify sold ads
 */
export const setAdCover = async (req, res, next) => {
  try {
    // Use ad from checkAdOwnership middleware (already verified for ownership and existence)
    const ad = req.ad;

    // Check if ad is sold - sold ads cannot be edited
    if (ad.status === 'sold') {
      return next(
        new AppError('Cannot modify sold ad', 400, {
          type: 'SOLD_AD_NOT_EDITABLE',
          message: 'Sold ads cannot be modified',
        })
      );
    }

    // Extract imageUrl from request body
    // Only allow imageUrl field - reject any extra fields
    const bodyKeys = Object.keys(req.body || {});
    const allowedFields = ['imageUrl'];
    const extraFields = bodyKeys.filter((key) => !allowedFields.includes(key));

    if (extraFields.length > 0) {
      return next(
        new AppError('Extra fields not allowed', 400, {
          type: 'EXTRA_FIELDS',
          errors: extraFields.map((field) => ({
            field,
            message: `Field '${field}' is not allowed. Only 'imageUrl' is accepted.`,
          })),
        })
      );
    }

    const { imageUrl } = req.body;

    // Validate imageUrl is provided
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
      return next(
        new AppError('imageUrl is required and must be a non-empty string', 400, {
          type: 'MISSING_IMAGE_URL',
        })
      );
    }

    // Validate that ad has images array
    if (!ad.images || !Array.isArray(ad.images) || ad.images.length === 0) {
      return next(
        new AppError('Ad has no images', 400, {
          type: 'NO_IMAGES',
          message: 'This ad does not have any images',
        })
      );
    }

    // Check if imageUrl exists in ad.images array
    const imageIndex = ad.images.indexOf(imageUrl);
    if (imageIndex === -1) {
      return next(
        new AppError('Image not found in ad', 400, {
          type: 'IMAGE_NOT_FOUND',
          message: 'The specified image URL does not exist in this ad',
        })
      );
    }

    // Check if imageUrl is already the first image (cover)
    if (imageIndex === 0) {
      // Already the cover image, return success without modification
      return res.json({
        success: true,
        message: 'Cover image is already set',
        images: ad.images,
      });
    }

    // Reorder images array: move imageUrl to position 0
    // Remove imageUrl from current position
    const updatedImages = [...ad.images];
    updatedImages.splice(imageIndex, 1);
    
    // Insert imageUrl at the beginning
    updatedImages.unshift(imageUrl);

    // Update ad.images array
    ad.images = updatedImages;

    // Save ad with reordered images array
    await ad.save();

    // Return success response with updated images list
    res.json({
      success: true,
      message: 'Cover image updated successfully',
      images: ad.images,
    });
  } catch (error) {
    next(error);
  }
};

