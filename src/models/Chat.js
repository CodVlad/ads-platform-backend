import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    ad: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ad',
      default: null,
    },
    userA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userA is required'],
    },
    userB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userB is required'],
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Ensure userA and userB are always sorted lexicographically
chatSchema.pre('save', function (next) {
  if (this.isModified('userA') || this.isModified('userB') || this.isNew) {
    // Only sort if both userA and userB exist
    if (this.userA && this.userB) {
      const [a, b] = [this.userA.toString(), this.userB.toString()].sort((x, y) =>
        x.localeCompare(y)
      );
      this.userA = new mongoose.Types.ObjectId(a);
      this.userB = new mongoose.Types.ObjectId(b);
    }
  }
  next();
});

// Unique compound index: one chat per ad + user pair
chatSchema.index({ ad: 1, userA: 1, userB: 1 }, { unique: true });

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;

