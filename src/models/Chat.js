import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    ad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ad',
      required: [true, 'Ad is required'],
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
    participantsKey: {
      type: String,
      required: true,
      index: true,
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

// Pre-save hook: Generate participantsKey from sorted participant IDs
chatSchema.pre('save', function (next) {
  if (this.participants && this.participants.length === 2) {
    // Convert to strings, sort, and join with underscore
    const sortedIds = [
      this.participants[0].toString(),
      this.participants[1].toString(),
    ].sort();
    this.participantsKey = sortedIds.join('_');
  }
  next();
});

// Pre-validate hook: Also set participantsKey before validation
chatSchema.pre('validate', function (next) {
  if (this.participants && this.participants.length === 2) {
    const sortedIds = [
      this.participants[0].toString(),
      this.participants[1].toString(),
    ].sort();
    this.participantsKey = sortedIds.join('_');
  }
  next();
});

// Indexes for efficient queries
chatSchema.index({ participants: 1 });
chatSchema.index({ ad: 1 });
chatSchema.index({ participantsKey: 1 });
// Compound unique index: one chat per ad + participantsKey combination
// This ensures uniqueness regardless of participants array order
chatSchema.index({ ad: 1, participantsKey: 1 }, { unique: true });

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;

