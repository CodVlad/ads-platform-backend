import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
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
          // Must have exactly 2 participants
          if (!participants || participants.length !== 2) {
            return false;
          }
          // Prevent duplicate participants (same user twice)
          const ids = participants.map((p) => p.toString());
          return ids[0] !== ids[1];
        },
        message: 'Chat must have exactly 2 different participants',
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

// Pre-validate hook: Sort participants to ensure consistent order for uniqueness
chatSchema.pre('validate', function (next) {
  if (this.participants && this.participants.length === 2) {
    // Sort participants by string value to ensure consistent order
    const sorted = [
      this.participants[0].toString(),
      this.participants[1].toString(),
    ].sort();
    
    // Convert back to ObjectIds in sorted order
    this.participants = [
      new mongoose.Types.ObjectId(sorted[0]),
      new mongoose.Types.ObjectId(sorted[1]),
    ];
  }
  next();
});

// Pre-save hook: Ensure participants are sorted before saving
chatSchema.pre('save', function (next) {
  if (this.participants && this.participants.length === 2) {
    const sorted = [
      this.participants[0].toString(),
      this.participants[1].toString(),
    ].sort();
    
    this.participants = [
      new mongoose.Types.ObjectId(sorted[0]),
      new mongoose.Types.ObjectId(sorted[1]),
    ];
  }
  next();
});

// Indexes for efficient queries
chatSchema.index({ participants: 1 });
// Unique index: only ONE chat between the same two participants
// Migration script will ensure this index exists after removing ad field
chatSchema.index({ participants: 1 }, { unique: true });

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;

