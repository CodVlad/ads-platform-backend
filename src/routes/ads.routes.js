import express from 'express';
import {
  getAds,
  getAdById,
  getMyAds,
  createAd,
  updateAd,
  updateAdStatus,
  deleteAd,
  deleteAdImage,
  setAdCover,
} from '../controllers/ads.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { validateUpdateStatus } from '../middlewares/validate.middleware.js';
import { validateCreateAd } from '../middlewares/validateAd.middleware.js';
import { validateAdUpdate } from '../middlewares/validateAdUpdate.middleware.js';
import { checkAdOwnership } from '../middlewares/adOwnership.middleware.js';
import { uploadImages, uploadToCloudinary } from '../middlewares/upload.middleware.js';

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * @route   GET /api/ads
 * @desc    Get all active ads with filters, search, pagination
 * @access  Public
 */
router.get('/', getAds);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

/**
 * @route   GET /api/ads/my
 * @desc    Get current user's ads (all statuses: draft/active/sold)
 * @access  Private
 * @middleware protect - JWT authentication required
 * 
 * NOTE: This route MUST be before /:id to be matched correctly
 */
router.get('/my', protect, getMyAds);

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * @route   GET /api/ads/:id
 * @desc    Get ad by ID (only active, non-deleted)
 * @access  Public
 */
router.get('/:id', getAdById);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

/**
 * @route   POST /api/ads
 * @desc    Create new ad (status: draft)
 * @access  Private
 * @middleware protect - JWT authentication required
 * @middleware uploadImages - Handle multipart/form-data
 * @middleware uploadToCloudinary - Upload to Cloudinary (required)
 * @middleware validateCreateAd - Validate ad data
 */
router.post(
  '/',
  protect,
  uploadImages,
  uploadToCloudinary(true), // Images required for creation
  validateCreateAd,
  createAd
);

/**
 * @route   PATCH /api/ads/:id/status
 * @desc    Update ad status only (draft → active → sold)
 * @access  Private (Owner only)
 * @middleware protect - JWT authentication required
 * @middleware checkAdOwnership - Only ad owner can update
 * @middleware validateUpdateStatus - Validate status field
 * 
 * NOTE: This route MUST be before /:id to be matched correctly
 */
router.patch('/:id/status', protect, checkAdOwnership, validateUpdateStatus, updateAdStatus);

/**
 * @route   PATCH /api/ads/:id/cover
 * @desc    Set cover image (first image in array)
 * @access  Private (Owner only)
 * @middleware protect - JWT authentication required
 * @middleware checkAdOwnership - Only ad owner can set cover
 * 
 * Body: { "imageUrl": "https://res.cloudinary.com/..." }
 * 
 * NOTE: This route MUST be before /:id to be matched correctly
 */
router.patch('/:id/cover', protect, checkAdOwnership, setAdCover);

/**
 * @route   PATCH /api/ads/:id
 * @desc    Update ad (title, description, price, currency)
 * @access  Private (Owner only)
 * @middleware protect - JWT authentication required
 * @middleware checkAdOwnership - Only ad owner can update
 * @middleware validateAdUpdate - Validate update fields
 * 
 * NOTE: This route does NOT handle images or status updates
 * - Images: handled separately (if needed in future)
 * - Status: use PATCH /api/ads/:id/status
 */
router.patch(
  '/:id',
  protect,
  checkAdOwnership,
  validateAdUpdate,
  updateAd
);

/**
 * @route   DELETE /api/ads/:id/images
 * @desc    Delete an image from an ad
 * @access  Private (Owner only)
 * @middleware protect - JWT authentication required
 * @middleware checkAdOwnership - Only ad owner can delete images
 * 
 * Body: { "imageUrl": "https://res.cloudinary.com/..." }
 * 
 * NOTE: This route MUST be before /:id to be matched correctly
 */
router.delete('/:id/images', protect, checkAdOwnership, deleteAdImage);

/**
 * @route   DELETE /api/ads/:id
 * @desc    Delete ad (soft delete: isDeleted = true)
 * @access  Private (Owner only)
 * @middleware protect - JWT authentication required
 * @middleware checkAdOwnership - Only ad owner can delete
 */
router.delete('/:id', protect, checkAdOwnership, deleteAd);

export default router;

