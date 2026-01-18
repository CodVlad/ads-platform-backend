import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      required: [true, 'Participants are required'],
      validate: {
        validator: function (participants) {
          return participants.length === 2;
        },
        message: 'Conversation must have exactly 2 participants',
      },
    },
    ad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ad',
      required: [true, 'Ad is required'],
    },
    lastMessage: {
      type: String,
      trim: true,
    },
    lastMessageAt: {
      type: Date,
    },
    participantsKey: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Create participantsKey before saving (sorted participants joined by ":")
conversationSchema.pre('save', function (next) {
  if (this.isModified('participants') || this.isNew) {
    // Sort participant IDs and join with ":"
    const sortedParticipants = [...this.participants]
      .map((id) => id.toString())
      .sort()
      .join(':');
    this.participantsKey = sortedParticipants;
  }
  next();
});

// Unique compound index: one conversation per ad + participants combination
conversationSchema.index({ ad: 1, participantsKey: 1 }, { unique: true });

// Index for querying user conversations
conversationSchema.index({ participants: 1, updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;

