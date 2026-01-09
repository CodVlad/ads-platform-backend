import dotenv from 'dotenv';

// Only load .env file in development (not required in production if env vars are provided)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Build allowed origins array
const allowedOriginsList = [
  'http://localhost:5173',
  'http://localhost:5174',
];

// Add FRONTEND_URL if it exists (for Vercel production)
if (process.env.FRONTEND_URL) {
  allowedOriginsList.push(process.env.FRONTEND_URL);
}

// Add ALLOWED_ORIGINS if they exist (comma separated)
if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  allowedOriginsList.push(...additionalOrigins);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOriginsList.includes(origin)) {
      return callback(null, true);
    }

    // Return CORS error for disallowed origins (browser will reject the request)
    callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export default corsOptions;

