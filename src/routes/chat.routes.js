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

/**
 * @route   POST /api/chats/start
 * @desc    Start or get existing chat for an ad
 * @access  Private
 * @middleware protect - JWT authentication required
 */
router.post('/start', startChat);

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
