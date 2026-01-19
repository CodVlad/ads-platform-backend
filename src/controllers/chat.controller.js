import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import Ad from '../models/Ad.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { AppError } from '../middlewares/error.middleware.js';

/**
 * Start or get existing chat
 * POST /api/chats/start
 */
export const startChat = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { adId, receiverId } = req.body;

    // Validate required fields - receiverId is required, adId is optional
    if (!receiverId) {
      return next(
        new AppError('receiverId is required', 400, {
          type: 'VALIDATION_ERROR',
          field: 'receiverId',
        })
      );
    }

    // Validate ObjectId formats
    if (adId && !mongoose.Types.ObjectId.isValid(adId)) {
      return next(
        new AppError('Invalid adId format', 400, {
          type: 'INVALID_ID',
          field: 'adId',
        })
      );
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return next(
        new AppError('Invalid receiverId format', 400, {
          type: 'INVALID_ID',
          field: 'receiverId',
        })
      );
    }

    // Check receiver is not current user
    if (receiverId === currentUserId.toString()) {
      return next(
        new AppError('Cannot start chat with yourself', 400, {
          type: 'INVALID_RECEIVER',
        })
      );
    }

    // Ensure receiver user exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return next(
        new AppError('Receiver user not found', 404, {
          type: 'NOT_FOUND',
          resource: 'User',
        })
      );
    }

    // Ensure ad exists if adId is provided
    if (adId) {
      const ad = await Ad.findById(adId);
      if (!ad) {
        return next(
          new AppError('Ad not found', 404, {
            type: 'NOT_FOUND',
            resource: 'Ad',
          })
        );
      }
    }

    // Compute sorted pair (userA < userB lexicographically)
    const [userA, userB] = [currentUserId.toString(), receiverId]
      .sort((a, b) => a.localeCompare(b))
      .map((id) => new mongoose.Types.ObjectId(id));

    // Build query - if adId is provided, include it; otherwise find chat without ad (null or undefined)
    const query = adId
      ? { ad: adId, userA, userB }
      : { userA, userB, $or: [{ ad: null }, { ad: { $exists: false } }] };

    // Find existing chat
    let chat = await Chat.findOne(query)
      .populate('ad', 'title price currency images status')
      .populate('userA', 'name email')
      .populate('userB', 'name email');

    if (chat) {
      // Return existing chat
      return res.status(200).json({
        success: true,
        chat: {
          _id: chat._id,
          ad: chat.ad,
          userA: chat.userA,
          userB: chat.userB,
          lastMessage: chat.lastMessage,
          lastMessageAt: chat.lastMessageAt,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      });
    }

    // Create new chat (adId can be null/undefined if not provided)
    chat = await Chat.create({
      ad: adId || null,
      userA,
      userB,
    });

    // Populate after creation
    await chat.populate([
      { path: 'ad', select: 'title price currency images status' },
      { path: 'userA', select: 'name email' },
      { path: 'userB', select: 'name email' },
    ]);

    // Return new chat
    res.status(201).json({
      success: true,
      chat: {
        _id: chat._id,
        ad: chat.ad,
        userA: chat.userA,
        userB: chat.userB,
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    });
  } catch (error) {
    // Handle duplicate key error (shouldn't happen with proper logic, but just in case)
    if (error.code === 11000) {
      const { adId, receiverId } = req.body;
      const currentUserId = req.user._id;
      const [userA, userB] = [currentUserId.toString(), receiverId]
        .sort((a, b) => a.localeCompare(b))
        .map((id) => new mongoose.Types.ObjectId(id));

      const query = adId
        ? { ad: adId, userA, userB }
        : { userA, userB, $or: [{ ad: null }, { ad: { $exists: false } }] };

      const existingChat = await Chat.findOne(query)
        .populate('ad', 'title price currency images status')
        .populate('userA', 'name email')
        .populate('userB', 'name email');

      if (existingChat) {
        return res.status(200).json({
          success: true,
          chat: {
            _id: existingChat._id,
            ad: existingChat.ad,
            userA: existingChat.userA,
            userB: existingChat.userB,
            lastMessage: existingChat.lastMessage,
            lastMessageAt: existingChat.lastMessageAt,
            createdAt: existingChat.createdAt,
            updatedAt: existingChat.updatedAt,
          },
        });
      }
    }

    next(error);
  }
};

/**
 * Get all chats for current user
 * GET /api/chats
 */
export const getChats = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    // Find all chats where user is either userA or userB
    const chats = await Chat.find({
      $or: [{ userA: currentUserId }, { userB: currentUserId }],
    })
      .populate('ad', 'title price currency images status')
      .populate('userA', 'name email')
      .populate('userB', 'name email')
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
    const isParticipant =
      chat.userA.toString() === currentUserId.toString() ||
      chat.userB.toString() === currentUserId.toString();

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
    const isParticipant =
      chat.userA.toString() === currentUserId.toString() ||
      chat.userB.toString() === currentUserId.toString();

    if (!isParticipant) {
      return next(
        new AppError('Access denied. You are not a participant in this chat', 403, {
          type: 'FORBIDDEN',
        })
      );
    }

    // Create message
    const message = await Message.create({
      chat: chatId,
      sender: currentUserId,
      text: text.trim(),
    });

    // Populate sender
    await message.populate('sender', 'name email');

    // Update chat lastMessage and lastMessageAt
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: text.trim(),
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: {
        _id: message._id,
        chat: message.chat,
        sender: message.sender,
        text: message.text,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Postman test instructions:
 * 
 * POST {{BASE_URL}}/api/chats/start
 * Headers:
 *   Content-Type: application/json
 *   Authorization: Bearer <token>
 * Body:
 * {
 *   "adId": "<ad_id>",
 *   "receiverId": "<user_id>"
 * }
 */
