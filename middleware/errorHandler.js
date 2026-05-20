/**
 * Global Express error handler
 * ─────────────────────────────
 * In production:  return generic message — never expose stack traces
 * In development: return full stack for debugging
 *
 * Must be registered LAST in server.js (after all routes).
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const isProd     = process.env.NODE_ENV === 'production'
  const statusCode = err.statusCode || err.status || 500

  // Always log the full error server-side
  console.error(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`,
    `→ ${statusCode}:`,
    err.message
  )
  if (!isProd) console.error(err.stack)

  // CORS error — set headers before sending
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({
      success: false,
      message: isProd ? 'Forbidden.' : err.message,
    })
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
    })
  }

  // Payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request payload is too large. Maximum size is 2MB.',
    })
  }

  // Malformed JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
    })
  }

  res.status(statusCode).json({
    success: false,
    message: isProd
      ? (statusCode < 500 ? err.message : 'Internal Server Error.')
      : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  })
}

module.exports = errorHandler