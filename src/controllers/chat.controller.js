import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Ad from '../models/Ad.js';
import mongoose from 'mongoose';
import { AppError } from '../middlewares/error.middleware.js';
import logger from '../config/logger.js';

/**
 * Start or get existing chat
 * POST /api/chats/start
 * 
 * @contract
 * Request:
 *   Headers:
 *     Authorization: Bearer <JWT_TOKEN>
 *     Content-Type: application/json
 *   Body:
 *     {
 *       "receiverId": "string (ObjectId) - required",
 *       "ad": "string (ObjectId) - required" // or "adId" as fallback
 *     }
 * 
 * Response (200 - Chat already exists):
 *   {
 *     "success": true,
 *     "message": "Chat already exists",
 *     "chat": {
 *       "_id": "...",
 *       "ad": "...",
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
 *       "ad": "...",
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
 *     "receiverId": "507f1f77bcf86cd799439011",
 *     "ad": "507f191e810c19729de860ea"
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
 *     "receiverId": "507f1f77bcf86cd799439011",
 *     "ad": "507f191e810c19729de860ea"
 *   }'
 * 
 * # Expected response (200):
 * # {
 * #   "success": true,
 *   "message": "Chat already exists",
 *   "chat": { ... }
 * # }
 */
export const startChat = async (req, res, next) => {
  try {
    // Detailed logging for 400 errors
    const authHeader = req.headers.authorization;
    const authPreview = authHeader 
      ? `${authHeader.substring(0, 20)}... (length: ${authHeader.length})`
      : 'missing';
    
    console.log('[CHAT_START] Request details:', {
      origin: req.headers.origin || 'missing',
      authorization: authPreview,
      body: JSON.stringify(req.body),
      user: req.user ? { id: req.user.id, _id: req.user._id?.toString() } : 'missing',
    });

    // Ensure req.user exists and has id
    if (!req.user || !req.user.id) {
      console.log('[CHAT_START] 401: Authentication failed - req.user missing or invalid');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        details: { type: 'AUTH_REQUIRED' },
      });
    }

    // Extract and validate receiverId
    const receiverId = req.body.receiverId;
    
    // Extract ad/adId with fallback - prioritize 'ad' field as per user requirement
    const adRaw = req.body.ad ?? req.body.adId;
    
    // Log for debugging (dev only)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[CHAT_START] Processing:', {
        userId: req.user.id,
        receiverId,
        ad: adRaw,
        bodyKeys: Object.keys(req.body),
      });
    }

    // Validate receiverId
    if (!receiverId) {
      console.log('[CHAT_START] 400: receiverId is required');
      return res.status(400).json({
        success: false,
        message: 'receiverId is required',
        details: {
          field: 'receiverId',
        },
      });
    }

    // Validate ad field - must be present and not null/undefined
    if (adRaw === null || adRaw === undefined || adRaw === 'null' || adRaw === 'undefined') {
      console.log('[CHAT_START] 400: Field ad is required', { ad: adRaw });
      return res.status(400).json({
        success: false,
        message: "Field 'ad' is required",
        details: {
          field: 'ad',
          value: adRaw,
        },
      });
    }

    // Trim if string
    const adId = typeof adRaw === 'string' ? adRaw.trim() : adRaw;
    
    // Validate adId is not empty after trim
    if (!adId || adId === '') {
      console.log('[CHAT_START] 400: Field ad is required (empty)', { ad: adRaw });
      return res.status(400).json({
        success: false,
        message: "Field 'ad' is required",
        details: {
          field: 'ad',
          value: adRaw,
        },
      });
    }

    // Validate receiverId is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      console.log('[CHAT_START] 400: Invalid receiverId format', { receiverId });
      return res.status(400).json({
        success: false,
        message: 'Invalid receiverId format',
        details: {
          field: 'receiverId',
          value: receiverId,
        },
      });
    }

    // Validate adId is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      console.log('[CHAT_START] 400: Invalid ad id', { ad: adId });
      return res.status(400).json({
        success: false,
        message: 'Invalid ad id',
        details: {
          field: 'ad',
          value: adId,
        },
      });
    }

    // Check receiver is not current user
    if (receiverId === req.user.id) {
      console.log('[CHAT_START] 400: Cannot start chat with yourself');
      return res.status(400).json({
        success: false,
        message: 'Cannot start chat with yourself',
        details: {
          field: 'receiverId',
        },
      });
    }

    // Verify ad exists and get sellerId
    const ad = await Ad.findById(adId).select('user seller owner createdBy');
    if (!ad) {
      console.log('[CHAT_START] 404: Ad not found', { adId });
      return res.status(404).json({
        success: false,
        message: 'Ad not found',
        details: {
          resource: 'Ad',
          adId,
        },
      });
    }

    // Determine sellerId from ad (try multiple fields)
    const sellerId = ad.user || ad.seller || ad.owner || ad.createdBy;
    if (!sellerId) {
      console.log('[CHAT_START] 500: Ad seller not found', { adId, ad: ad.toObject() });
      return res.status(500).json({
        success: false,
        message: 'Ad seller not found',
        details: {
          adId,
        },
      });
    }

    // Extra protection: verify receiverId matches ad owner
    if (receiverId !== sellerId.toString()) {
      console.log('[CHAT_START] 400: receiverId mismatch', { receiverId, sellerId: sellerId.toString() });
      return res.status(400).json({
        success: false,
        message: 'receiverId must match ad owner',
        details: {
          receiverId,
          expectedSellerId: sellerId.toString(),
        },
      });
    }

    // Convert adId to ObjectId
    const adObjectId = new mongoose.Types.ObjectId(adId);

    // Prepare participants array (sorted for consistency)
    const me = req.user.id;
    const participants = [me, receiverId].sort();

    // Find existing chat for this ad and participants
    let chat = await Chat.findOne({
      ad: adObjectId,
      participants: { $all: participants, $size: 2 },
    });

    if (chat) {
      // Populate participants (name, email) and ad
      await chat.populate('participants', 'name email');
      
      // Log in dev mode
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CHAT_START] Found existing chat:', {
          chatId: chat._id.toString(),
          userId: req.user.id,
          ad: adId,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Chat already exists',
        chat: {
          _id: chat._id,
          ad: chat.ad,
          participants: chat.participants,
          lastMessage: chat.lastMessage,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      });
    }

    // Create new chat with adId
    chat = await Chat.create({
      ad: adObjectId,
      participants,
    });

    // Populate participants (name, email) and ad
    await chat.populate('participants', 'name email');
    
    // Log in dev mode
    if (process.env.NODE_ENV !== 'production') {
      console.log('[CHAT_START] Created new chat:', {
        chatId: chat._id.toString(),
        userId: req.user.id,
        ad: adId,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Chat created',
      chat: {
        _id: chat._id,
        ad: chat.ad,
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
        const currentUserId = req.user?._id;
        const receiverId = req.body.receiverId;
        const adRaw = req.body.ad ?? req.body.adId;

        if (currentUserId && receiverId && adRaw && 
            mongoose.Types.ObjectId.isValid(receiverId) && 
            mongoose.Types.ObjectId.isValid(adRaw)) {
          const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
          const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
          const adObjectId = new mongoose.Types.ObjectId(adRaw);
          const participants = [currentUserObjectId.toString(), receiverObjectId.toString()].sort();

          // Find existing chat with same ad and participants
          const existingChat = await Chat.findOne({
            ad: adObjectId,
            participants: { $all: participants, $size: 2 },
          });

          if (existingChat) {
            await existingChat.populate('participants', 'name email');
            
            // Log in dev mode
            if (process.env.NODE_ENV !== 'production') {
              console.log('[CHAT_START] Duplicate key - found existing chat:', {
                chatId: existingChat._id.toString(),
                userId: currentUserId.toString(),
                ad: adRaw,
              });
            }

            return res.status(200).json({
              success: true,
              message: 'Chat already exists',
              chat: {
                _id: existingChat._id,
                ad: existingChat.ad,
                participants: existingChat.participants,
                lastMessage: existingChat.lastMessage,
                createdAt: existingChat.createdAt,
                updatedAt: existingChat.updatedAt,
              },
            });
          }
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
    // Ensure req.user exists and has _id
    if (!req.user || !req.user._id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    const currentUserId = req.user._id;

    // Count unread messages for current user
    const count = await Message.countDocuments({
      receiver: currentUserId,
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
    // Ensure req.user exists and has _id
    if (!req.user || !req.user._id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    const currentUserId = req.user._id;

    // Find all chats where user is a participant
    const chats = await Chat.find({
      participants: currentUserId,
    })
      .populate('participants', 'name email')
      .populate('lastMessage')
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      chats,
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
    // Ensure req.user exists and has _id
    if (!req.user || !req.user._id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    const chatId = req.params.id;
    const currentUserId = req.user._id;

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
