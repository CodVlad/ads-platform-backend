import multer from 'multer';
import { AppError } from './error.middleware.js';
import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';
import logger from '../config/logger.js';

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter - only allow jpg, jpeg, png, webp
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  // Check MIME type
  if (allowedTypes.includes(file.mimetype)) {
    // Also check file extension as additional validation
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          'Invalid file extension. Only JPG, JPEG, PNG and WEBP images are allowed',
          400
        ),
        false
      );
    }
  } else {
    cb(
      new AppError(
        'Invalid file type. Only JPG, JPEG, PNG and WEBP images are allowed',
        400
      ),
      false
    );
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5, // Maximum 5 files
  },
});

/**
 * Middleware to handle multiple image uploads
 * Validates file count and size
 */
export const uploadImages = (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError('File size too large. Maximum 5MB per file', 400, {
              type: 'FILE_SIZE_ERROR',
            })
          );
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(
            new AppError('Too many files. Maximum 5 images allowed', 400, {
              type: 'FILE_COUNT_ERROR',
            })
          );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(
            new AppError('Unexpected file field. Use "images" as field name', 400, {
              type: 'FILE_FIELD_ERROR',
            })
          );
        }
        return next(
          new AppError(`Upload error: ${err.message}`, 400, {
            type: 'UPLOAD_ERROR',
          })
        );
      }
      // Handle other errors (e.g., from fileFilter - AppError instances)
      return next(err);
    }
    next();
  });
};

/**
 * Middleware to upload images to Cloudinary
 * Handles both required (create) and optional (update) image uploads
 * @param {boolean} required - Whether images are required (default: true)
 */
export const uploadToCloudinary = (required = true) => {
  return async (req, res, next) => {
    try {
      // Check if files were uploaded
      if (!req.files || req.files.length === 0) {
        if (required) {
          return next(
            new AppError('At least one image is required', 400, {
              type: 'IMAGES_REQUIRED',
            })
          );
        }
        // If not required, skip upload and continue
        return next();
      }

      // Validate image count (1-5)
      if (req.files.length < 1 || req.files.length > 5) {
        return next(
          new AppError('You must upload between 1 and 5 images', 400, {
            type: 'INVALID_IMAGE_COUNT',
          })
        );
      }

      // Validate Cloudinary configuration
      if (!cloudinary.config().cloud_name) {
        logger.error('Cloudinary not configured', {
          message: 'Cloudinary credentials are missing',
        });
        return next(
          new AppError('Image upload service is not configured', 500, {
            type: 'CLOUDINARY_CONFIG_ERROR',
          })
        );
      }

      // Upload all images to Cloudinary
      const uploadPromises = req.files.map((file, index) => {
        return new Promise((resolve, reject) => {
          // Create upload stream
          // Note: Don't use 'format: auto' - it causes "Invalid extension in transformation: auto" error
          // Cloudinary will preserve the original format (png, jpg, jpeg, webp)
          // Optimizations can be applied at delivery time using URL transformations
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'ads',
              resource_type: 'image',
              // No format specified - Cloudinary preserves original format
              // Optimizations (quality, fetch_format) are applied at delivery via URL transformations
            },
            (error, result) => {
              if (error) {
                logger.error('Cloudinary upload error', {
                  message: error.message,
                  fileIndex: index,
                  fileName: file.originalname,
                });
                reject(
                  new AppError(
                    `Failed to upload image "${file.originalname}" to Cloudinary: ${error.message}`,
                    500,
                    {
                      type: 'CLOUDINARY_UPLOAD_ERROR',
                      fileName: file.originalname,
                    }
                  )
                );
              } else if (!result || !result.secure_url) {
                logger.error('Cloudinary upload incomplete', {
                  fileIndex: index,
                  fileName: file.originalname,
                });
                reject(
                  new AppError(
                    `Failed to upload image "${file.originalname}": No URL returned`,
                    500,
                    {
                      type: 'CLOUDINARY_UPLOAD_ERROR',
                      fileName: file.originalname,
                    }
                  )
                );
              } else {
                resolve(result.secure_url);
              }
            }
          );

          // Convert buffer to stream and pipe to Cloudinary
          const bufferStream = new Readable();
          bufferStream.push(file.buffer);
          bufferStream.push(null);
          bufferStream.pipe(uploadStream);
        });
      });

      // Upload all images in parallel
      const imageUrls = await Promise.all(uploadPromises);

      // Validate that we got URLs for all images
      if (imageUrls.length !== req.files.length) {
        logger.error('Image upload count mismatch', {
          uploaded: imageUrls.length,
          expected: req.files.length,
        });
        return next(
          new AppError('Some images failed to upload', 500, {
            type: 'UPLOAD_PARTIAL_FAILURE',
          })
        );
      }

      // Attach image URLs to request body
      req.body.images = imageUrls;

      logger.info('Images uploaded successfully', {
        count: imageUrls.length,
        userId: req.user?.id,
      });

      next();
    } catch (error) {
      // If error is already an AppError, pass it through
      if (error instanceof AppError) {
        return next(error);
      }

      // Log unexpected errors
      logger.error('Unexpected upload error', {
        message: error.message,
        stack: error.stack,
      });

      // Return generic error (don't expose internal details)
      next(
        new AppError('Failed to upload images', 500, {
          type: 'UPLOAD_ERROR',
        })
      );
    }
  };
};

