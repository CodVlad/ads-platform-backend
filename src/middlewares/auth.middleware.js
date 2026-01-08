import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from './error.middleware.js';

/**
 * Middleware to protect routes with JWT authentication
 * 
 * Reads token from Authorization: Bearer TOKEN header
 * Verifies JWT token and attaches user to request
 * 
 * @returns {Function} Express middleware
 */
export const protect = async (req, res, next) => {
  let token;

  // Extract token from Authorization header
  // Format: Authorization: Bearer <token>
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Case 1: No token provided
  if (!token) {
    return next(
      new AppError('Authentication required', 401, {
        type: 'NO_TOKEN',
      })
    );
  }

  try {
    // Validate JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      return next(
        new AppError('JWT configuration error', 500, {
          type: 'JWT_CONFIG_ERROR',
        })
      );
    }

    // Verify JWT token (signature + expiration)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists in database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(
        new AppError('User no longer exists', 401, {
          type: 'USER_NOT_FOUND',
        })
      );
    }

    // Attach user to request object with STRICT structure
    // req.user must contain: { id: userId }
    // Convert _id to string for consistent comparison
    req.user = {
      id: user._id.toString(), // Always use string for comparison
      _id: user._id, // Keep _id for Mongoose operations
      name: user.name,
      email: user.email,
    };
    
    next();
  } catch (error) {
    // Case 2: Token expired
    if (error instanceof jwt.TokenExpiredError) {
      return next(
        new AppError('Token expired. Please login again', 401, {
          type: 'TOKEN_EXPIRED',
        })
      );
    }

    // Case 3: Invalid token (malformed, wrong signature, etc.)
    if (error instanceof jwt.JsonWebTokenError) {
      return next(
        new AppError('Invalid token. Please login again', 401, {
          type: 'INVALID_TOKEN',
        })
      );
    }

    // Other unexpected errors
    return next(
      new AppError('Authentication failed', 401, {
        type: 'AUTH_ERROR',
      })
    );
  }
};

