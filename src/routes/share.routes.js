import express from 'express';
import { getAdSharePage } from '../controllers/share.controller.js';

const router = express.Router();

/**
 * @route   GET /share/ads/:id
 * @desc    Get share page with OpenGraph meta tags for an ad
 * @access  Public (no auth required for crawlers)
 */
router.get('/ads/:id', getAdSharePage);

export default router;

