import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { AppError } from '../middlewares/error.middleware.js';
import logger from '../config/logger.js';
import { getReqUserId } from '../utils/getReqUserId.js';

/**
 * Start or get existing direct message chat between two users
 * POST /api/chats/start
 * 
 * @contract
 * Request:
 *   Headers:
 *     Authorization: Bearer <JWT_TOKEN>
 *     Content-Type: application/json
 *   Body:
 *     {
 *       "receiverId": "string (ObjectId) - required"
 *     }
 * 
 * Response (200 - Chat already exists):
 *   {
 *     "success": true,
 *     "message": "Chat already exists",
 *     "chat": {
 *       "_id": "...",
 *       "participants": [...],
 *       "lastMessage": null,
 *       "createdAt": "...",
 *       "updatedAt": "..."
 *     }
 *   }
 * 
 * Response (201 - Chat created):
 *   {
 *     "success": true,
 *     "message": "Chat created",
 *     "chat": {
 *       "_id": "...",
 *       "participants": [...],
 *       "lastMessage": null,
 *       "createdAt": "...",
 *       "updatedAt": "..."
 *     }
 *   }
 * 
 * Response (400):
 *   {
 *     "success": false,
 *     "message": "...",
 *     "details": { "field": "...", "value": "..." }
 *   }
 * 
 * @example
 * # Get JWT token first (from login endpoint)
 * TOKEN=$(curl -X POST http://localhost:5001/api/auth/login \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"user@example.com","password":"password123"}' \
 *   | jq -r '.data.token')
 * 
 * # Start chat (first request - creates new chat)
 * curl -X POST http://localhost:5001/api/chats/start \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer $TOKEN" \
 *   -d '{
 *     "receiverId": "507f1f77bcf86cd799439011"
 *   }'
 * 
 * # Expected response (201):
 * # {
 * #   "success": true,
 * #   "message": "Chat created",
 * #   "chat": { ... }
 * # }
 * 
 * # Repeat same request (returns existing chat)
 * curl -X POST http://localhost:5001/api/chats/start \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer $TOKEN" \
 *   -d '{
 *     "receiverId": "507f1f77bcf86cd799439011"
 *   }'
 * 
 * # Expected response (200):
 * # {
 * #   "success": true,
 * #   "message": "Chat already exists",
 * #   "chat": { ... }
 * # }
 */
export const startChat = async (req, res, next) => {
  try {
    // Ensure req.user exists and has id
    if (!req.user || !req.user.id) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CHAT_START] 401: Authentication failed - req.user missing or invalid');
      }
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        details: { type: 'AUTH_REQUIRED' },
      });
    }

    // Extract receiverId - ONLY field required
    const receiverIdRaw = req.body.receiverId;
    
    // Log for debugging (dev only)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[CHAT_START] Processing:', {
        userId: req.user.id,
        receiverId: receiverIdRaw,
      });
    }

    // STRICT VALIDATION - BEFORE ANY DB OPERATIONS
    
    // Validate receiverId: required, non-empty string, not "null"/"undefined"
    if (!receiverIdRaw || 
        receiverIdRaw === null || 
        receiverIdRaw === undefined ||
        (typeof receiverIdRaw === 'string' && receiverIdRaw.trim() === '') ||
        receiverIdRaw === 'null' || 
        receiverIdRaw === 'undefined') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CHAT_START] 400: receiverId is required', { receiverId: receiverIdRaw });
      }
      return res.status(400).json({
        success: false,
        message: 'receiverId is required and must be a non-empty string',
        details: {
          type: 'VALIDATION_ERROR',
          field: 'receiverId',
          value: receiverIdRaw,
        },
      });
    }

    // Trim if string
    const receiverId = typeof receiverIdRaw === 'string' ? receiverIdRaw.trim() : receiverIdRaw;
    
    // Validate ObjectId format for receiverId
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CHAT_START] 400: Invalid receiverId format', { receiverId });
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid receiverId format',
        details: {
          type: 'INVALID_ID',
          field: 'receiverId',
          value: receiverIdRaw,
        },
      });
    }

    // Convert to ObjectIds
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
    const meObjectId = new mongoose.Types.ObjectId(req.user.id);

    // Check receiver is not current user
    if (receiverObjectId.toString() === meObjectId.toString()) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CHAT_START] 400: Cannot start chat with yourself');
      }
      return res.status(400).json({
        success: false,
        message: 'Cannot start chat with yourself',
        details: {
          type: 'VALIDATION_ERROR',
          field: 'receiverId',
        },
      });
    }

    // Prepare participants array (sorted for consistency)
    // Model pre-validate hook will ensure they're sorted
    const participants = [meObjectId, receiverObjectId].sort((a, b) => 
      a.toString().localeCompare(b.toString())
    );

    // Find existing chat by participants (exactly 2, both must match)
    let chat = await Chat.findOne({
      participants: { $all: participants, $size: 2 },
    });

    if (chat) {
      // Populate participants (name, email)
      await chat.populate('participants', 'name email');
      
      // Log in dev mode
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CHAT_START] Found existing chat:', {
          chatId: chat._id.toString(),
          userId: req.user.id,
          receiverId,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Chat already exists',
        chat: {
          _id: chat._id,
          participants: chat.participants,
          lastMessage: chat.lastMessage,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      });
    }

    // Create new chat (participants will be sorted by pre-validate hook)
    chat = await Chat.create({
      participants,
    });

    // Populate participants (name, email)
    await chat.populate('participants', 'name email');
    
    // Log in dev mode
    if (process.env.NODE_ENV !== 'production') {
      console.log('[CHAT_START] Created new chat:', {
        chatId: chat._id.toString(),
        userId: req.user.id,
        receiverId,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Chat created',
      chat: {
        _id: chat._id,
        participants: chat.participants,
        lastMessage: chat.lastMessage,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    });
  } catch (error) {
    // Log error for debugging (500 errors)
    logger.error('[CHAT_START_ERROR]', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
      userId: req.user?._id?.toString(),
      receiverId: req.body?.receiverId,
    });

    // If it's a validation error from Mongoose, convert to 400
    if (error instanceof mongoose.Error.ValidationError) {
      return next(
        new AppError('Validation failed', 400, {
          type: 'VALIDATION_ERROR',
          errors: Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.message,
          })),
        })
      );
    }

    // If it's a duplicate key error, try to find existing chat
    if (error.code === 11000) {
      try {
        const receiverIdRaw = req.body.receiverId;
        const currentUserId = req.user?.id || req.user?._id;

        // SAFE: Validate receiverId and currentUserId
        if (!receiverIdRaw || !currentUserId ||
            !mongoose.Types.ObjectId.isValid(receiverIdRaw) ||
            !mongoose.Types.ObjectId.isValid(currentUserId)) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[CHAT_START] 400: Duplicate key error but IDs invalid', {
              hasReceiverId: !!receiverIdRaw,
              hasCurrentUserId: !!currentUserId,
            });
          }
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            details: {
              type: 'VALIDATION_ERROR',
              error: 'Duplicate key error with invalid input',
            },
          });
        }

        // All IDs are valid, convert to ObjectIds
        const receiverObjectId = new mongoose.Types.ObjectId(receiverIdRaw);
        const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
        
        // Build participants array (sorted)
        const participants = [currentUserObjectId, receiverObjectId].sort((a, b) => 
          a.toString().localeCompare(b.toString())
        );

        // Find existing chat by participants
        const existingChat = await Chat.findOne({
          participants: { $all: participants, $size: 2 },
        });

        if (existingChat) {
          await existingChat.populate('participants', 'name email');
          
          // Log in dev mode
          if (process.env.NODE_ENV !== 'production') {
            console.log('[CHAT_START] Duplicate key - found existing chat:', {
              chatId: existingChat._id.toString(),
              userId: currentUserId.toString(),
              receiverId: receiverIdRaw,
            });
          }

          return res.status(200).json({
            success: true,
            message: 'Chat already exists',
            chat: {
              _id: existingChat._id,
              participants: existingChat.participants,
              lastMessage: existingChat.lastMessage,
              createdAt: existingChat.createdAt,
              updatedAt: existingChat.updatedAt,
            },
          });
        }
      } catch (retryError) {
        // If retry fails, pass original error
        logger.error('[CHAT_START_RETRY_ERROR]', {
          message: retryError.message,
          originalError: error.message,
        });
      }
    }

    // Pass error to error handler middleware
    return next(error);
  }
};

/**
 * Get unread messages count for current user
 * GET /api/chats/unread-count
 */
export const unreadCount = async (req, res, next) => {
  try {
    // Get userId using helper (production-safe)
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        details: { type: 'AUTH_REQUIRED' },
      });
    }

    // Convert to ObjectId for query
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Count unread messages for current user
    const count = await Message.countDocuments({
      receiver: userObjectId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all chats for current user
 * GET /api/chats
 */
export const getChats = async (req, res, next) => {
  try {
    // Get userId using helper (production-safe)
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        details: { type: 'AUTH_REQUIRED' },
      });
    }

    // Convert to ObjectId for queries
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Find all chats where user is a participant
    const chats = await Chat.find({
      participants: userObjectId,
    })
      .populate('participants', 'name email')
      .populate('lastMessage')
      .sort({ updatedAt: -1 })
      .lean();

    // Get unread counts via ONE aggregation (fast, not N queries)
    const unreadAgg = await Message.aggregate([
      { $match: { receiver: userObjectId, isRead: false } },
      { $group: { _id: '$chat', count: { $sum: 1 } } },
    ]);

    // Build map: chatId -> unreadCount
    const unreadMap = new Map(
      unreadAgg.map((x) => [String(x._id), x.count])
    );

    // Calculate total unread (optional, for convenience)
    const totalUnread = unreadAgg.reduce((sum, x) => sum + x.count, 0);

    // Add unreadCount to each chat
    const chatsWithUnread = chats.map((chat) => ({
      ...chat,
      unreadCount: unreadMap.get(String(chat._id)) || 0,
    }));

    res.status(200).json({
      success: true,
      chats: chatsWithUnread,
      totalUnread,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages for a chat
 * GET /api/chats/:id/messages
 */
export const getMessages = async (req, res, next) => {
  try {
    // Get userId using helper (production-safe)
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        details: { type: 'AUTH_REQUIRED' },
      });
    }

    const chatId = req.params.id;
    const currentUserId = new mongoose.Types.ObjectId(userId);

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return next(
        new AppError('Invalid chat ID format', 400, {
          type: 'INVALID_ID',
          field: 'id',
        })
      );
    }

    // Find chat and verify user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return next(
        new AppError('Chat not found', 404, {
          type: 'NOT_FOUND',
          resource: 'Chat',
        })
      );
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      (participantId) => participantId.toString() === currentUserId.toString()
    );

    if (!isParticipant) {
      return next(
        new AppError('Access denied. You are not a participant in this chat', 403, {
          type: 'FORBIDDEN',
        })
      );
    }

    // Get messages sorted by createdAt ascending
    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'name email')
      .sort({ createdAt: 1 })
      .lean();

    // Mark messages as read for current user (only messages received by user)
    await Message.updateMany(
      { chat: chatId, receiver: currentUserId, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message in a chat
 * POST /api/chats/:id/messages
 */
export const sendMessage = async (req, res, next) => {
  try {
    // Ensure req.user exists and has _id
    if (!req.user || !req.user._id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    const chatId = req.params.id;
    const { text } = req.body;
    const currentUserId = req.user._id;

    // Validate chat ID format
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return next(
        new AppError('Invalid chat ID format', 400, {
          type: 'INVALID_ID',
          field: 'id',
        })
      );
    }

    // Validate text
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return next(
        new AppError('Message text is required', 400, {
          type: 'VALIDATION_ERROR',
          field: 'text',
        })
      );
    }

    if (text.trim().length > 2000) {
      return next(
        new AppError('Message text cannot exceed 2000 characters', 400, {
          type: 'VALIDATION_ERROR',
          field: 'text',
        })
      );
    }

    // Find chat and verify user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return next(
        new AppError('Chat not found', 404, {
          type: 'NOT_FOUND',
          resource: 'Chat',
        })
      );
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      (participantId) => participantId.toString() === currentUserId.toString()
    );

    if (!isParticipant) {
      return next(
        new AppError('Access denied. You are not a participant in this chat', 403, {
          type: 'FORBIDDEN',
        })
      );
    }

    // Determine receiver (the other participant in the chat)
    const receiverId = chat.participants.find(
      (participantId) => participantId.toString() !== currentUserId.toString()
    );

    if (!receiverId) {
      return next(
        new AppError('Cannot determine receiver', 400, {
          type: 'INVALID_CHAT',
        })
      );
    }

    // Create message with receiver
    const message = await Message.create({
      chat: chatId,
      sender: currentUserId,
      receiver: receiverId,
      text: text.trim(),
      isRead: false, // New message is unread by default
    });

    // Populate sender
    await message.populate('sender', 'name email');

    // Update chat lastMessage and lastMessageAt
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: {
        _id: message._id,
        chat: message.chat,
        sender: message.sender,
        receiver: message.receiver,
        text: message.text,
        isRead: message.isRead,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
