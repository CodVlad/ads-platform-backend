import mongoose from 'mongoose';

const adSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title must not exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be positive'],
    },
    currency: {
      type: String,
      default: 'EUR',
      enum: ['EUR', 'USD', 'MDL'],
    },
    images: {
      type: [String],
      default: [],
    },
    categorySlug: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    subCategorySlug: {
      type: String,
      required: false, // Optional
      trim: true,
    },
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'sold'],
      default: 'draft',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
  },
  {
    timestamps: true,
    strict: true, // Reject unknown fields
  }
);

// Indexes for performance
adSchema.index({ price: 1 });
adSchema.index({ createdAt: -1 });
adSchema.index({ status: 1 });
adSchema.index({ user: 1 }); // Index for user queries
adSchema.index({ isDeleted: 1 }); // Index for soft delete queries
// Compound index for category filtering
adSchema.index({ categorySlug: 1, subCategorySlug: 1, status: 1, createdAt: -1 });

// Prevent modification of protected fields
adSchema.pre('save', function () {
  // Prevent overriding _id, createdAt, updatedAt
  if (this.isModified('_id')) {
    throw new Error('Cannot modify protected fields');
  }
  
  // Prevent modifying 'user' field AFTER creation (allow initial setting for new documents)
  // For new documents, isNew is true and isModified('user') is also true (first time setting)
  // For existing documents, isNew is false and isModified('user') means it was changed
  if (!this.isNew && this.isModified('user')) {
    throw new Error('Cannot modify protected fields');
  }
});

// Prevent setting unknown fields in update operations
adSchema.pre(['updateOne', 'findOneAndUpdate'], function () {
  const allowedFields = ['title', 'description', 'price', 'currency', 'images', 'status', 'isDeleted', 'categorySlug', 'subCategorySlug', 'attributes'];
  const update = this.getUpdate();
  
  if (update.$set) {
    const fields = Object.keys(update.$set);
    const invalidFields = fields.filter((field) => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      throw new Error(`Cannot update protected fields: ${invalidFields.join(', ')}`);
    }
  }
});

const Ad = mongoose.model('Ad', adSchema);

export default Ad;

