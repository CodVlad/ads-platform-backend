import Chat from '../models/Chat.js';
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
