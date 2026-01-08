import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../middlewares/error.middleware.js';

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

