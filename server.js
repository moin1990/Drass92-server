require('dotenv').config()

const express      = require('express')
const cors         = require('cors')
const cookieParser = require('cookie-parser')
const helmet       = require('helmet')
const rateLimit    = require('express-rate-limit')

const { connectDB }    = require('./config/db')
const { initFirebase } = require('./config/firebase')
const corsOptions      = require('./config/cors')
const authRoutes       = require('./routes/auth.routes')
const ideasRoutes      = require('./routes/ideas.routes')
const commentsRoutes   = require('./routes/comments.routes')
const bookmarksRoutes  = require('./routes/bookmarks.routes')
const usersRoutes      = require('./routes/users.routes')
const errorHandler     = require('./middleware/errorHandler')

const app  = express()
const PORT = process.env.PORT || 5000
const isProd = process.env.NODE_ENV === 'production'

/* ─────────────────────────────────────────────
   Startup
───────────────────────────────────────────── */
connectDB()
initFirebase()

/* ─────────────────────────────────────────────
   Trust proxy
   ─────────────
   Required when behind Render's load balancer
   so that req.ip reflects the real client IP
   (used by rate limiter) and HTTPS is detected.
───────────────────────────────────────────── */
if (isProd) {
  app.set('trust proxy', 1)
}

/* ─────────────────────────────────────────────
   Security headers
───────────────────────────────────────────── */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy  : { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy    : false, // managed by Vercel headers
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
)

/* ─────────────────────────────────────────────
   CORS — must come before routes
───────────────────────────────────────────── */
app.use(cors(corsOptions))
app.options('*', cors(corsOptions)) // handle preflight for all routes

/* ─────────────────────────────────────────────
   Rate limiting
───────────────────────────────────────────── */

// Global — 300 requests per 15 min per IP
const globalLimiter = rateLimit({
  windowMs              : 15 * 60 * 1000,
  max                   : 300,
  standardHeaders       : true,
  legacyHeaders         : false,
  skipSuccessfulRequests: false,
  message               : {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
})

// Auth routes — 20 attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs       : 15 * 60 * 1000,
  max            : 20,
  standardHeaders: true,
  legacyHeaders  : false,
  message        : {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes.',
  },
})

// Write operations — 60 per 15 min per IP
const writeLimiter = rateLimit({
  windowMs       : 15 * 60 * 1000,
  max            : 60,
  standardHeaders: true,
  legacyHeaders  : false,
  message        : {
    success: false,
    message: 'Write rate limit exceeded. Please slow down.',
  },
})

app.use(globalLimiter)

/* ─────────────────────────────────────────────
   Body parsing
───────────────────────────────────────────── */
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))
app.use(cookieParser())

/* ─────────────────────────────────────────────
   Request logger (development only)
───────────────────────────────────────────── */
if (!isProd) {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.originalUrl}`)
    next()
  })
}

/* ─────────────────────────────────────────────
   Routes
───────────────────────────────────────────── */
app.use('/api/auth',      authLimiter,  authRoutes)
app.use('/api/users',     writeLimiter, usersRoutes)
app.use('/api/ideas',     ideasRoutes)
app.use('/api/comments',  writeLimiter, commentsRoutes)
app.use('/api/bookmarks', writeLimiter, bookmarksRoutes)

/* ─────────────────────────────────────────────
   Health check
   ─────────────
   Render pings this endpoint every 30s to
   confirm the service is alive.
───────────────────────────────────────────── */
app.get('/', (_req, res) => {
  res.json({
    success    : true,
    service    : 'IdeaVault API',
    version    : '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp  : new Date().toISOString(),
    uptime     : `${Math.floor(process.uptime())}s`,
  })
})

/* ─────────────────────────────────────────────
   404 — unknown routes
───────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found → ${req.method} ${req.originalUrl}`,
  })
})

/* ─────────────────────────────────────────────
   Global error handler — must be last
───────────────────────────────────────────── */
app.use(errorHandler)

/* ─────────────────────────────────────────────
   Start server
───────────────────────────────────────────── */
const server = app.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`🚀  IdeaVault API`)
  console.log(`🌐  http://localhost:${PORT}`)
  console.log(`🔧  Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`📦  Client URL:  ${process.env.CLIENT_URL || 'not set'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
})

/* ─────────────────────────────────────────────
   Graceful shutdown
   ─────────────────
   Render sends SIGTERM before stopping the
   container. Close the server cleanly.
───────────────────────────────────────────── */
const shutdown = (signal) => {
  console.log(`\n[${signal}] Graceful shutdown initiated…`)
  server.close(() => {
    console.log('✅  HTTP server closed.')
    process.exit(0)
  })

  // Force-kill after 10s if server hasn't closed
  setTimeout(() => {
    console.error('❌  Forced shutdown after timeout.')
    process.exit(1)
  }, 10_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

/* ─────────────────────────────────────────────
   Unhandled rejection safety net
───────────────────────────────────────────── */
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err)
  process.exit(1)
})