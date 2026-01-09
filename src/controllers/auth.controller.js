import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../middlewares/error.middleware.js';
import { sha256 } from '../utils/crypto.js';
import { sendPasswordResetEmail } from '../services/email.service.js';

/**
 * Generate JWT token for user
 * @param {string} userId - User ID to encode in token
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  // Validate JWT_SECRET exists
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  // Sign token with user ID
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
};

/**
 * Register a new user
 * - Validates email uniqueness
 * - Hashes password (automatically via User model)
 * - Creates user
 * - Returns JWT token + user data (without password)
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user with email already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return next(
        new AppError('User with this email already exists', 400, {
          field: 'email',
        })
      );
    }

    // Create new user (password is automatically hashed by User model pre-save hook)
    const user = await User.create({
      name,
      email,
      password, // Will be hashed automatically
    });

    // Generate JWT token
    const token = generateToken(user._id);

    // Return user data without password + token
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * - Validates email and password
 * - Returns JWT token + user data (without password)
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email and include password field for comparison
    const user = await User.findOne({ email }).select('+password');

    // Check if user exists and password matches
    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Verify password using model method
    const isPasswordValid = await user.matchPassword(password);

    if (!isPasswordValid) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Return user data without password + token
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password
 * - Validates email exists in body
 * - Finds user by email (case-insensitive)
 * - ALWAYS returns 200 with same message to avoid user enumeration
 * - If user exists: creates reset token and logs reset link
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validate email exists in body
    if (!email) {
      return next(
        new AppError('Email is required', 400, {
          field: 'email',
        })
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(
        new AppError('Invalid email format', 400, {
          field: 'email',
        })
      );
    }

    // Find user by email (case-insensitive)
    const user = await User.findOne({ email: email.toLowerCase() });

    // If user exists, create reset token
    if (user) {
      // Generate reset token (returns raw token)
      const resetToken = user.createPasswordResetToken();

      // Save user with validateBeforeSave:false to skip validation
      await user.save({ validateBeforeSave: false });

      // Build reset URL
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

      // Send password reset email
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
    }

    // ALWAYS return 200 with same message to avoid user enumeration
    res.status(200).json({
      success: true,
      message: 'If the email exists, a reset link was sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 * - Validates token and password
 * - Finds user by hashed token and checks expiration
 * - Updates password and clears reset token fields
 * - Returns JWT token + user data
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Validate password exists in body
    if (!password) {
      return next(
        new AppError('Password is required', 400, {
          field: 'password',
        })
      );
    }

    // Validate password rules (min length 6)
    if (password.length < 6) {
      return next(
        new AppError('Password must be at least 6 characters', 400, {
          field: 'password',
        })
      );
    }

    // Hash the token using sha256
    const hashedToken = sha256(token);

    // Find user where resetPasswordTokenHash matches AND resetPasswordExpiresAt > Date.now()
    // Remember fields are select:false, so we need to select them explicitly
    const user = await User.findOne({
      resetPasswordTokenHash: hashedToken,
      resetPasswordExpiresAt: { $gt: Date.now() },
    }).select('+resetPasswordTokenHash +resetPasswordExpiresAt +password');

    // If not found: invalid or expired token
    if (!user) {
      return next(
        new AppError('Invalid or expired reset token', 400, {
          type: 'INVALID_TOKEN',
        })
      );
    }

    // Update password (will be hashed via pre-save hook)
    user.password = password;

    // Clear reset token fields
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;

    // Save user
    await user.save();

    // Generate JWT token (same as login)
    const jwtToken = generateToken(user._id);

    // Return success with token and user data
    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: {
        token: jwtToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

