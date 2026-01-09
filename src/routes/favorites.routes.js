import express from 'express';
import {
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  getMyFavorites,
} from '../controllers/favorites.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/favorites/my
 * @desc    Get current user's favorite ads
 * @access  Private
 * @middleware protect - JWT authentication required
 * 
 * NOTE: This route MUST be before /:adId to be matched correctly
 */
router.get('/my', getMyFavorites);

/**
 * @route   GET /api/favorites
 * @desc    Get user's favorite ads
 * @access  Private
 * @middleware protect - JWT authentication required
 * 
 * NOTE: This route MUST be before /:adId to be matched correctly
 */
router.get('/', getFavorites);

/**
 * @route   POST /api/favorites/:adId
 * @desc    Add ad to user's favorites
 * @access  Private
 * @middleware protect - JWT authentication required
 */
router.post('/:adId', addToFavorites);

/**
 * @route   DELETE /api/favorites/:adId
 * @desc    Remove ad from user's favorites
 * @access  Private
 * @middleware protect - JWT authentication required
 */
router.delete('/:adId', removeFromFavorites);

export default router;

