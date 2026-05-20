require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')

const { connectDB } = require('./config/db')
const authRoutes = require('./routes/auth.routes')
const ideasRoutes = require('./routes/ideas.routes')
const commentsRoutes = require('./routes/comments.routes')
const usersRoutes = require('./routes/users.routes')
const bookmarksRoutes = require('./routes/bookmarks.routes')
const errorHandler = require('./middlewares/errorHandler')

const app = express()
const PORT = process.env.PORT || 5000

// ── Database ────────────────────────────────────────────────────────────────
connectDB()

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/ideas', ideasRoutes)
app.use('/api/comments', commentsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/bookmarks', bookmarksRoutes)

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: '🚀 IdeaVault API is running',
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
})

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
})

// ── Error Handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 IdeaVault server running on port ${PORT}`)
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`)
})