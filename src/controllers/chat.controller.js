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
 */
export const startChat = async (req, res, next) => {
  try {
    // Ensure req.user exists and has _id
    if (!req.user || !req.user._id) {
      return next(
        new AppError('Authentication required', 401, {
          type: 'AUTH_REQUIRED',
        })
      );
    }

    // Extract and validate receiverId
    const receiverId = req.body.receiverId;
    
    // Extract adId with fallback and trim if string
    const adIdRaw = req.body.adId ?? req.body.ad;
    const adId = typeof adIdRaw === 'string' ? adIdRaw.trim() : adIdRaw;

    // Log for debugging
    console.log('[CHAT_START] user:', req.user._id, 'receiverId:', receiverId, 'adId:', adId);

    // Validate receiverId
    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'receiverId is required',
        details: {
          field: 'receiverId',
        },
      });
    }

    // Validate adId (check for null, undefined, or string "null"/"undefined")
    if (!adId || adId === 'null' || adId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'adId is required',
        details: {
          field: 'adId',
          value: adIdRaw,
        },
      });
    }

    // Validate receiverId is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid receiverId format',
        details: {
          type: 'INVALID_ID',
          field: 'receiverId',
        },
      });
    }

    // Validate adId is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid adId format',
        details: {
          type: 'INVALID_ID',
          field: 'adId',
        },
      });
    }

    // Check receiver is not current user
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start chat with yourself',
        details: {
          type: 'VALIDATION_ERROR',
        },
      });
    }

    // Verify ad exists and get sellerId
    const ad = await Ad.findById(adId).select('user seller owner createdBy');
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found',
        details: {
          type: 'NOT_FOUND',
          resource: 'Ad',
        },
      });
    }

    // Determine sellerId from ad (try multiple fields)
    const sellerId = ad.user || ad.seller || ad.owner || ad.createdBy;
    if (!sellerId) {
      return res.status(500).json({
        success: false,
        message: 'Ad seller not found',
        details: {
          type: 'SERVER_ERROR',
        },
      });
    }

    // Extra protection: verify receiverId matches ad owner
    if (receiverId !== sellerId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'receiverId must match ad owner',
        details: {
          type: 'RECEIVER_MISMATCH',
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
      // Populate participants (name, email)
      await chat.populate('participants', 'name email');

      return res.status(200).json({
        success: true,
        data: { chat },
      });
    }

    // Create new chat with adId
    chat = await Chat.create({
      ad: adObjectId,
      participants,
    });

    // Populate participants (name, email)
    await chat.populate('participants', 'name email');

    return res.status(201).json({
      success: true,
      data: { chat },
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
        const { receiverId } = req.body;

        if (currentUserId && receiverId && mongoose.Types.ObjectId.isValid(receiverId)) {
          const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
          const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

          const existingChat = await Chat.findOne({
            participants: { $all: [currentUserObjectId, receiverObjectId] },
            $expr: { $eq: [{ $size: '$participants' }, 2] },
          });

          if (existingChat) {
            await existingChat.populate('participants', 'name email');

            return res.status(200).json({
              success: true,
              chat: {
                _id: existingChat._id,
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
