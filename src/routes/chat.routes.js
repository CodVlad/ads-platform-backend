import express from 'express';
import {
  startConversation,
  getConversations,
  getMessages,
  sendMessage,
} from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { checkConversationAccess } from '../middlewares/chatAccess.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/chats/start
 * @desc    Start or get existing conversation for an ad
 * @access  Private
 * @middleware protect - JWT authentication required
 */
router.post('/start', startConversation);

/**
 * @route   GET /api/chats
 * @desc    Get all conversations for current user
 * @access  Private
 * @middleware protect - JWT authentication required
 */
router.get('/', getConversations);

/**
 * @route   GET /api/chats/:id/messages
 * @desc    Get messages for a conversation
 * @access  Private
 * @middleware protect - JWT authentication required
 * @middleware checkConversationAccess - Verify user is participant
 */
router.get('/:id/messages', checkConversationAccess, getMessages);

/**
 * @route   POST /api/chats/:id/messages
 * @desc    Send a message in a conversation
 * @access  Private
 * @middleware protect - JWT authentication required
 * @middleware checkConversationAccess - Verify user is participant
 */
router.post('/:id/messages', checkConversationAccess, sendMessage);

export default router;

