import express from 'express';
import {
  startChat,
  getChats,
  getMessages,
  sendMessage,
} from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Debug: Log route registration (development only)
if (process.env.NODE_ENV !== 'production') {
  console.log('[CHAT ROUTES] Registering chat routes...');
}

/**
 * @route   POST /api/chats/start
 * @desc    Start or get existing chat for an ad
 * @access  Private
 * @middleware protect - JWT authentication required
 * 
 * IMPORTANT: This route MUST be defined before /:id routes to avoid route conflicts
 */
router.post('/start', startChat);

// Debug: Log route registration (development only)
if (process.env.NODE_ENV !== 'production') {
  console.log('[CHAT ROUTES] POST /api/chats/start registered');
}

/**
 * @route   GET /api/chats
 * @desc    Get all chats for current user
 * @access  Private
 * @middleware protect - JWT authentication required
 */
router.get('/', getChats);

/**
 * @route   GET /api/chats/:id/messages
 * @desc    Get messages for a chat
 * @access  Private
 * @middleware protect - JWT authentication required
 */
router.get('/:id/messages', getMessages);

/**
 * @route   POST /api/chats/:id/messages
 * @desc    Send a message in a chat
 * @access  Private
 * @middleware protect - JWT authentication required
 */
router.post('/:id/messages', sendMessage);

export default router;
