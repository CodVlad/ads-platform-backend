import express from 'express';
import { register, login } from '../controllers/auth.controller.js';
import { validateRegister, validateLogin } from '../middlewares/validate.middleware.js';

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @middleware validateRegister - Validate input data (name, email, password)
 */
router.post('/register', validateRegister, register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get JWT token
 * @access  Public
 * @middleware validateLogin - Validate input data (email, password format)
 */
router.post('/login', validateLogin, login);

export default router;

