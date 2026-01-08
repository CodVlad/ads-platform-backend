import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';

import authRoutes from './routes/auth.routes.js';
import adsRoutes from './routes/ads.routes.js';
import favoritesRoutes from './routes/favorites.routes.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { requestLogger } from './middlewares/logger.middleware.js';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';
import corsOptions from './config/cors.js';

// Only load .env file in development (not required in production if env vars are provided)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();

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

// 2. CORS - Strict origin whitelist
app.use(cors(corsOptions));

// Handle OPTIONS preflight requests early (before routes, auth, rate limiting)
app.options(/^\/api\/.*/, cors(corsOptions));

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
// POST /api/favorites/:adId - Add ad to favorites (protected)
// DELETE /api/favorites/:adId - Remove ad from favorites (protected)
// GET /api/favorites - Get user's favorite ads (protected)
app.use('/api/favorites', apiLimiter, favoritesRoutes);


// 404 handler - must be after all routes
app.use(notFound);

// Error handler - must be last
app.use(errorHandler);

export default app;

