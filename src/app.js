import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';

import authRoutes from './routes/auth.routes.js';
import adsRoutes from './routes/ads.routes.js';
import favoritesRoutes from './routes/favorites.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { requestLogger } from './middlewares/logger.middleware.js';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';
import corsOptions from './config/cors.js';

// Only load .env file in development (not required in production if env vars are provided)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();

// Trust proxy - Required for Railway/Vercel (must be first)
// Only enable in production to ensure proper IP detection behind reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ============================================
// CORS - FIRST middleware (before everything else)
// ============================================

// Apply CORS to all routes (must be first to ensure headers are always set)
app.use(cors(corsOptions));

// Handle CORS preflight for Express v5 without wildcard routes
// This must be BEFORE routes and BEFORE rate limiters
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return cors(corsOptions)(req, res, next);
  }
  next();
});

// ============================================
// SECURITY MIDDLEWARE (Order matters!)
// ============================================

// 1. Helmet - Set security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hidePoweredBy: true, // Remove X-Powered-By header
  })
);

// 3. Body parser with size limit (10KB for JSON)
// Note: File uploads are handled separately by multer with its own limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Note: Security protections:
// - NoSQL injection: Prevented by strict validators and body whitelisting
// - XSS: Handled by Helmet (contentSecurityPolicy)
// - Input validation: express-validator with strict field checking

// ============================================
// APPLICATION MIDDLEWARE
// ============================================

// Request logging (only important requests)
app.use(requestLogger);

// ============================================
// ROUTES
// ============================================

// Health check (no rate limiting)
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

// Authentication routes (rate limiting applied per route in auth.routes.js)
// POST /api/auth/register - Register new user (no rate limit)
// POST /api/auth/login - Login user (rate limited)
app.use('/api/auth', authRoutes);

// Ads routes
// GET /api/ads - List ads (with filters, pagination)
// GET /api/ads/:id - Get ad by ID
// POST /api/ads - Create ad (protected)
// PATCH /api/ads/:id/status - Update ad status (protected)
// DELETE /api/ads/:id - Delete ad (protected)
app.use('/api/ads', apiLimiter, adsRoutes);

// Favorites routes
// GET /api/favorites/my - Get current user's favorite ads (protected)
// GET /api/favorites - Get user's favorite ads (protected)
// POST /api/favorites/:adId - Add ad to favorites (protected)
// DELETE /api/favorites/:adId - Remove ad from favorites (protected)
app.use('/api/favorites', apiLimiter, favoritesRoutes);

// Chat routes
// POST /api/chats/start - Start or get existing conversation (protected)
// GET /api/chats - Get all conversations for current user (protected)
// GET /api/chats/:id/messages - Get messages for a conversation (protected)
// POST /api/chats/:id/messages - Send a message in a conversation (protected)
app.use('/api/chats', apiLimiter, chatRoutes);

// 404 handler - must be after all routes
app.use(notFound);

// Error handler - must be last
app.use(errorHandler);

export default app;

