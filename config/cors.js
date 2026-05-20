/**
 * CORS Configuration
 * ─────────────────
 * Handles both development and production origins.
 * credentials: true is REQUIRED for httpOnly cookie to be
 * sent by the browser on cross-origin requests.
 *
 * In production, only the Vercel client URL is whitelisted.
 * In development, localhost:5173 (Vite) is allowed.
 */

const ALLOWED_ORIGINS_PROD = [
    process.env.CLIENT_URL,              // primary — set via env
  ].filter(Boolean)
  
  const ALLOWED_ORIGINS_DEV = [
    'http://localhost:5173',
    'http://localhost:4173',             // vite preview
    'http://127.0.0.1:5173',
  ]
  
  const getAllowedOrigins = () => {
    if (process.env.NODE_ENV === 'production') {
      return ALLOWED_ORIGINS_PROD
    }
    return [...ALLOWED_ORIGINS_DEV, ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : [])]
  }
  
  const corsOptions = {
    origin: (origin, callback) => {
      const allowed = getAllowedOrigins()
  
      // Allow requests with no origin (Render health checks, curl, Postman)
      if (!origin) return callback(null, true)
  
      if (allowed.includes(origin)) {
        callback(null, true)
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}`)
        callback(new Error(`CORS: Origin '${origin}' is not allowed.`))
      }
    },
  
    credentials   : true,     // REQUIRED — allows cookies to be sent
    methods       : ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Set-Cookie'],
    maxAge        : 86400,    // preflight cache: 24 hours
    optionsSuccessStatus: 200,
  }
  
  module.exports = corsOptions