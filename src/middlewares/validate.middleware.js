import { body, validationResult } from 'express-validator';
import { AppError } from './error.middleware.js';

// Middleware to handle validation errors
// Returns 400 (Bad Request) for validation errors, NOT 401 or 403
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));

    return next(
      new AppError('Validation failed', 400, {
        errors: errorDetails,
      })
    );
  }
  next();
};

// Validation rules for register
export const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  handleValidationErrors,
];

// Validation rules for login
// Only validates format - does NOT check user existence or password correctness
// Authentication logic is handled by login controller
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors, // Returns 400 (Bad Request) for invalid format
];

// Validation rules for create ad
export const validateCreateAd = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters'),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  // Note: images validation is handled by upload middleware
  handleValidationErrors,
];

// Validation rules for update ad status
// Only accepts 'status' field, rejects all other fields
export const validateUpdateStatus = [
  // Check for extra fields first - only 'status' is allowed
  (req, res, next) => {
    const bodyKeys = Object.keys(req.body || {});
    const allowedFields = ['status'];
    const extraFields = bodyKeys.filter((key) => !allowedFields.includes(key));

    if (extraFields.length > 0) {
      return next(
        new AppError('Extra fields not allowed', 400, {
          errors: extraFields.map((field) => ({
            field,
            message: `Field '${field}' is not allowed. Only 'status' field is accepted.`,
          })),
        })
      );
    }
    next();
  },
  // Validate status field
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['draft', 'active', 'sold'])
    .withMessage('Status must be one of: draft, active, sold'),
  handleValidationErrors,
];

