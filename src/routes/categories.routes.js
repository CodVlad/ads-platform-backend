import express from 'express';
import { getCategories } from '../controllers/ads.controller.js';

const router = express.Router();

/**
 * @route   GET /api/categories
 * @desc    Get all categories with subcategories
 * @access  Public
 */
router.get('/', getCategories);

export default router;

