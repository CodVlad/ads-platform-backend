import Conversation from '../models/Conversation.js';
import { AppError } from './error.middleware.js';
import mongoose from 'mongoose';

/**
 * Middleware to check if user is a participant in the conversation
 * Sets req.conversation for use in controllers
 */
export const checkConversationAccess = async (req, res, next) => {
  try {
    const conversationId = req.params.id;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return next(
        new AppError('Invalid conversation ID format', 400, {
          type: 'INVALID_ID',
        })
      );
    }

    // Find conversation
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return next(
        new AppError('Conversation not found', 404, {
          type: 'NOT_FOUND',
        })
      );
    }

    // Check if current user is a participant
    const userId = req.user._id || req.user.id;
    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === userId.toString()
    );

    if (!isParticipant) {
      return next(
        new AppError('Access denied. You are not a participant in this conversation', 403, {
          type: 'FORBIDDEN',
        })
      );
    }

    // Attach conversation to request for use in controllers
    req.conversation = conversation;
    next();
  } catch (error) {
    next(error);
  }
};

