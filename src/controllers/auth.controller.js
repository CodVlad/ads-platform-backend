import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { AppError } from '../middlewares/error.middleware.js';
import { sendPasswordResetEmail } from '../services/email.service.js';
import { sendToMakeWebhook } from '../services/makeWebhook.service.js';

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
 * - Validates email exists in body (400 if missing)
 * - Validates email format (400 if invalid)
 * - Finds user by email (case-insensitive)
 * - Returns 404 if user not found: { success:false, message:"No account found with this email", details:{type:"EMAIL_NOT_FOUND"} }
 * - If user exists: creates reset token, sends email + Make webhook, returns 200 success
 * 
 * Postman example:
 * POST /api/auth/forgot-password
 * Body (JSON):
 * {
 *   "email": "user@example.com"
 * }
 * 
 * Success (200): { success:true, message:"If the email exists, a reset link was sent.", meta:{...} }
 * Not Found (404): { success:false, message:"No account found with this email", details:{type:"EMAIL_NOT_FOUND"} }
 */
export const forgotPassword = async (req, res, next) => {
  try {
    console.log('[FORGOT] hit');
    
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

    // Read strict flag to control behavior
    const strict = process.env.FORGOT_PASSWORD_STRICT === 'true';
    console.log('[FORGOT] strict:', strict);

    // Find user by email (case-insensitive)
    const user = await User.findOne({ email: email.toLowerCase() });

    console.log('[FORGOT] email exists:', !!user);

    // If user not found, handle based on strict flag
    if (!user) {
      if (strict) {
        // Strict mode: return 404 immediately
        // DO NOT send email, DO NOT send Make webhook, DO NOT generate token
        console.log('[FORGOT] email not found -> returning 404 (strict mode)');
        return res.status(404).json({
          success: false,
          message: 'Cont cu emailul dat nu există',
          details: {
            type: 'EMAIL_NOT_FOUND',
            field: 'email',
          },
        });
      } else {
        // Anti-enumeration mode: always return 200 with generic message
        console.log('[FORGOT] email not found -> returning 200 (anti-enumeration mode)');
        return res.status(200).json({
          success: true,
          message: 'If the email exists, a reset link was sent.',
          meta: {
            delivered: false,
            provider: 'unknown',
          },
        });
      }
    }

    // User exists - create reset token and send email
    console.log('[FORGOT] sending to:', user.email);

    // Generate reset token (returns raw token)
    const resetToken = user.createPasswordResetToken();

    // Save user with validateBeforeSave:false to skip validation
    await user.save({ validateBeforeSave: false });

    // Build reset URL (HashRouter compatible)
    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const resetUrl = `${base}/#/reset-password/${resetToken}`;
    
    console.log('[FORGOT] resetUrl:', resetUrl);

    // Send password reset email
    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });

    console.log('[FORGOT] emailResult:', emailResult);

    // Send to Make webhook (awaited to guarantee delivery attempt)
    // Payload: { event, email, resetUrl, timestamp, env }
    try {
      const makePayload = {
        event: 'forgot_password',
        email: user.email,
        resetUrl,
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
      };
      
      const makeResult = await sendToMakeWebhook(makePayload);
      console.log('[FORGOT] makeResult:', makeResult);
      console.log('[MAKE] delivered:', makeResult);
    } catch (error) {
      // Additional error handling (though service already handles it)
      console.error('[FORGOT] Make webhook error:', error.message);
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Link de reset a fost trimis',
      meta: {
        delivered: emailResult?.delivered ?? false,
        provider: emailResult?.provider ?? 'unknown',
      },
      // IMPORTANT: only include debugUrl if EMAIL_DEBUG is exactly "true"
      ...(process.env.EMAIL_DEBUG === 'true' ? { debugUrl: resetUrl || null } : {}),
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

    // Hash the incoming token using sha256
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user where passwordResetToken matches AND passwordResetExpires > now
    // Remember fields are select:false, so we need to select them explicitly
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires +password');

    // If not found, check if token exists but expired, or if it's invalid/already used
    if (!user) {
      // Check if token exists but expired (for better error message)
      const expiredUser = await User.findOne({
        passwordResetToken: hashedToken,
      }).select('+passwordResetToken +passwordResetExpires');

      if (expiredUser) {
        // Token exists but expired
        return next(
          new AppError('Reset token has expired. Please request a new one.', 400, {
            type: 'TOKEN_EXPIRED',
          })
        );
      }

      // Token doesn't exist or was already used (single-use enforcement)
      return next(
        new AppError('Reset token is invalid or has already been used.', 400, {
          type: 'INVALID_TOKEN',
        })
      );
    }

    // SECURITY: Clear reset token fields IMMEDIATELY to enforce single-use
    // This prevents race conditions where the same token could be used twice
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Update password (will be hashed via pre-save hook, which also sets passwordChangedAt)
    user.password = password;

    // Save user (token is already cleared, so even if save fails, token is invalidated)
    await user.save();

    // Return success
    res.status(200).json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    next(error);
  }
};

