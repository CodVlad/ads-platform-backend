import dotenv from 'dotenv';

// Only load .env file in development (not required in production if env vars are provided)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// CORS whitelist - strict origins only
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [];

// Regex pattern for Vite dev server ports: localhost:5174, and 5175-5180
const viteDevPortPattern = /^http:\/\/localhost:517[4-9]$|^http:\/\/localhost:5180$/;

// Production frontend URL from environment
const frontendUrl = process.env.FRONTEND_URL;

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, mobile apps, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Production: allow FRONTEND_URL if set
    if (process.env.NODE_ENV === 'production' && frontendUrl && origin === frontendUrl) {
      return callback(null, true);
    }

    // Development: check explicit whitelist (from env var)
    if (allowedOrigins.length > 0 && allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // Development: check if origin matches Vite dev server pattern (localhost only)
    if (process.env.NODE_ENV !== 'production' && viteDevPortPattern.test(origin)) {
      return callback(null, true);
    }

    // Return clean CORS decision (false) instead of throwing error
    callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204, // Respond to preflight with 204
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export default corsOptions;

