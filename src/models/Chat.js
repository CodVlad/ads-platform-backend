import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    ad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ad',
      default: null,
    },
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
      ],
      required: [true, 'Participants are required'],
      validate: {
        validator: function (participants) {
          return participants && participants.length === 2;
        },
        message: 'Chat must have exactly 2 participants',
      },
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Indexes for efficient queries
chatSchema.index({ participants: 1 });
chatSchema.index({ ad: 1 });
// Compound unique index: one chat per ad + participants combination
// This prevents duplicate chats for the same ad and participants
chatSchema.index({ ad: 1, participants: 1 }, { unique: true });

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;

