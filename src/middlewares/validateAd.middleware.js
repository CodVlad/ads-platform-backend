import { body, validationResult } from 'express-validator';
import { AppError } from './error.middleware.js';
import { isValidCategorySlug, isValidSubcategorySlug } from '../constants/categories.js';
import { validateAttributes } from '../utils/attributeValidator.js';

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
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

// Check for extra fields (not allowed)
const checkExtraFields = (allowedFields) => {
  return (req, res, next) => {
    const bodyKeys = Object.keys(req.body || {});
    const extraFields = bodyKeys.filter((key) => !allowedFields.includes(key));

    if (extraFields.length > 0) {
      return next(
        new AppError('Extra fields not allowed', 400, {
          errors: extraFields.map((field) => ({
            field,
            message: `Field '${field}' is not allowed`,
          })),
        })
      );
    }

    next();
  };
};

// Validation rules for create ad
export const validateCreateAd = [
  // Check for extra fields first - status is NOT allowed at creation
  // Only categorySlug and subCategorySlug are accepted (not category/subcategory)
  checkExtraFields(['title', 'description', 'price', 'currency', 'images', 'categorySlug', 'subCategorySlug', 'attributes']),
  
  // Validate title
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 120 })
    .withMessage('Title must be between 3 and 120 characters'),
  
  // Validate description
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 20 })
    .withMessage('Description must be at least 20 characters'),
  
  // Validate price
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  // Validate currency (optional, defaults to EUR)
  body('currency')
    .optional()
    .isIn(['EUR', 'USD', 'MDL'])
    .withMessage('Currency must be one of: EUR, USD, MDL'),
  
  // Validate images (optional, handled by upload middleware)
  body('images')
    .optional()
    .isArray()
    .withMessage('Images must be an array'),
  
  // Validate categorySlug (required)
  body('categorySlug')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .custom((value) => {
      if (!isValidCategorySlug(value)) {
        throw new Error('Invalid category');
      }
      return true;
    }),
  
  // Validate subCategorySlug (optional for create, but if provided must be valid)
  body('subCategorySlug')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Subcategory cannot be empty')
    .custom((value, { req }) => {
      const categorySlug = req.body.categorySlug;
      if (!categorySlug) {
        throw new Error('Category must be provided before subcategory');
      }
      if (!isValidSubcategorySlug(categorySlug, value)) {
        throw new Error('Invalid subcategory for the selected category');
      }
      return true;
    }),
  
  // Validate attributes (optional)
  body('attributes')
    .optional()
    .isObject()
    .withMessage('Attributes must be an object')
    .custom((attributes, { req }) => {
      const categorySlug = req.body.categorySlug;
      if (!categorySlug) {
        // Category validation will catch this, but we need categorySlug to validate attributes
        return true;
      }
      const validation = validateAttributes(categorySlug, attributes);
      if (!validation.valid) {
        throw new Error(`Invalid attributes for category '${categorySlug}': ${validation.invalidKeys.join(', ')}. Allowed: ${validation.invalidKeys.length > 0 ? 'none' : 'see category rules'}`);
      }
      return true;
    }),
  
  handleValidationErrors,
];

// Validation rules for update ad
export const validateUpdateAd = [
  // Check for extra fields first
  // Only categorySlug and subCategorySlug are accepted (not category/subcategory)
  checkExtraFields(['title', 'description', 'price', 'currency', 'images', 'status', 'categorySlug', 'subCategorySlug', 'attributes']),
  
  // Validate title (optional for update)
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ min: 3, max: 120 })
    .withMessage('Title must be between 3 and 120 characters'),
  
  // Validate description (optional for update)
  body('description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Description cannot be empty')
    .isLength({ min: 20 })
    .withMessage('Description must be at least 20 characters'),
  
  // Validate price (optional for update)
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  // Validate currency (optional for update)
  body('currency')
    .optional()
    .isIn(['EUR', 'USD', 'MDL'])
    .withMessage('Currency must be one of: EUR, USD, MDL'),
  
  // Validate images (optional for update)
  body('images')
    .optional()
    .isArray()
    .withMessage('Images must be an array')
    .custom((images) => {
      if (images && (images.length < 1 || images.length > 5)) {
        throw new Error('You must provide between 1 and 5 images');
      }
      return true;
    }),
  
  // Validate status (optional for update)
  body('status')
    .optional()
    .isIn(['draft', 'active', 'sold'])
    .withMessage('Status must be one of: draft, active, sold'),
  
  // Validate categorySlug (optional for update)
  body('categorySlug')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category cannot be empty')
    .custom((value) => {
      if (!isValidCategorySlug(value)) {
        throw new Error('Invalid category');
      }
      return true;
    }),
  
  // Validate subCategorySlug (optional for update, but must match category if provided)
  body('subCategorySlug')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Subcategory cannot be empty')
    .custom((value, { req }) => {
      const categorySlug = req.body.categorySlug;
      if (categorySlug && !isValidSubcategorySlug(categorySlug, value)) {
        throw new Error('Invalid subcategory for the selected category');
      }
      return true;
    }),
  
  // Validate attributes (optional for update)
  body('attributes')
    .optional()
    .isObject()
    .withMessage('Attributes must be an object')
    .custom((attributes, { req }) => {
      // Use categorySlug from body if provided, otherwise we can't validate
      const categorySlug = req.body.categorySlug;
      if (!categorySlug) {
        // If categorySlug is not being updated, we'd need to get it from the existing ad
        // For now, skip validation if categorySlug is not in the update
        return true;
      }
      const validation = validateAttributes(categorySlug, attributes);
      if (!validation.valid) {
        throw new Error(`Invalid attributes for category '${categorySlug}': ${validation.invalidKeys.join(', ')}`);
      }
      return true;
    }),
  
  handleValidationErrors,
];

