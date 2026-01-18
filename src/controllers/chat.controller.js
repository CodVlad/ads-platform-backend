import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Ad from '../models/Ad.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { AppError } from '../middlewares/error.middleware.js';

/**
 * Helper to validate ObjectId format
 */
const validateObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName} format`, 400, {
      type: 'INVALID_ID',
      field: fieldName,
    });
  }
};

/**
 * Start or get existing conversation
 * POST /api/chats/start
 */
export const startConversation = async (req, res, next) => {
  try {
    const { adId, receiverId } = req.body;
    const currentUserId = req.user._id || req.user.id;

    // Validate required fields
    if (!adId || !receiverId) {
      return next(
        new AppError('adId and receiverId are required', 400, {
          type: 'VALIDATION_ERROR',
          field: !adId ? 'adId' : 'receiverId',
        })
      );
    }

    // Validate ObjectId formats
    validateObjectId(adId, 'adId');
    validateObjectId(receiverId, 'receiverId');

    // Check receiver is not current user
    if (receiverId === currentUserId.toString()) {
      return next(
        new AppError('Cannot start conversation with yourself', 400, {
          type: 'INVALID_RECEIVER',
        })
      );
    }

    // Verify Ad exists
    const ad = await Ad.findById(adId);
    if (!ad) {
      return next(
        new AppError('Ad not found', 404, {
          type: 'NOT_FOUND',
          resource: 'Ad',
        })
      );
    }

    // Verify receiver user exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return next(
        new AppError('Receiver user not found', 404, {
          type: 'NOT_FOUND',
          resource: 'User',
        })
      );
    }

    // Create participants array (sorted for consistent participantsKey)
    const participants = [currentUserId, receiverId]
      .map((id) => id.toString())
      .sort()
      .map((id) => new mongoose.Types.ObjectId(id));

    // Compute participantsKey for query (same logic as pre-save hook)
    const participantsKey = participants.map((id) => id.toString()).sort().join(':');

    // Find or create conversation
    let conversation = await Conversation.findOne({
      ad: adId,
      participantsKey,
    })
      .populate('ad', '_id title images price currency status')
      .populate('participants', '_id name email');

    if (!conversation) {
      // Create new conversation (participantsKey will be set by pre-save hook)
      conversation = await Conversation.create({
        participants,
        ad: adId,
      });

      // Populate after creation
      await conversation.populate([
        { path: 'ad', select: '_id title images price currency status' },
        { path: 'participants', select: '_id name email' },
      ]);
    } else {
      // Populate if not already populated
      if (!conversation.ad || typeof conversation.ad === 'string') {
        await conversation.populate([
          { path: 'ad', select: '_id title images price currency status' },
          { path: 'participants', select: '_id name email' },
        ]);
      }
    }

    // Return conversation data
    res.status(200).json({
      success: true,
      conversation: {
        _id: conversation._id,
        ad: conversation.ad,
        participants: conversation.participants,
        lastMessage: conversation.lastMessage,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    // Handle duplicate key error (shouldn't happen with proper logic, but just in case)
    if (error.code === 11000) {
      // Try to find existing conversation
      const { adId, receiverId } = req.body;
      const currentUserId = req.user._id || req.user.id;
      const participants = [currentUserId, receiverId]
        .map((id) => id.toString())
        .sort()
        .map((id) => new mongoose.Types.ObjectId(id));

      const participantsKey = participants.map((id) => id.toString()).sort().join(':');

      const existingConversation = await Conversation.findOne({
        ad: adId,
        participantsKey,
      })
        .populate('ad', '_id title images price currency status')
        .populate('participants', '_id name email');

      if (existingConversation) {
        return res.status(200).json({
          success: true,
          conversation: {
            _id: existingConversation._id,
            ad: existingConversation.ad,
            participants: existingConversation.participants,
            lastMessage: existingConversation.lastMessage,
            updatedAt: existingConversation.updatedAt,
          },
        });
      }
    }

    next(error);
  }
};

/**
 * Get all conversations for current user
 * GET /api/chats
 */
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;

    // Find all conversations where user is a participant
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate('ad', '_id title images price currency status')
      .populate('participants', '_id name email')
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages for a conversation
 * GET /api/chats/:id/messages
 */
export const getMessages = async (req, res, next) => {
  try {
    const conversationId = req.conversation._id;

    // Get messages sorted by createdAt ascending
    const messages = await Message.find({
      conversation: conversationId,
    })
      .populate('sender', '_id name email')
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
 * Send a message in a conversation
 * POST /api/chats/:id/messages
 */
export const sendMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    const conversationId = req.conversation._id;
    const senderId = req.user._id || req.user.id;

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

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      text: text.trim(),
    });

    // Populate sender
    await message.populate('sender', '_id name email');

    // Update conversation lastMessage and lastMessageAt
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: text.trim(),
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: {
        _id: message._id,
        conversation: message.conversation,
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

