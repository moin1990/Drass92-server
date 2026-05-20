const jwt = require('jsonwebtoken')

/* ─────────────────────────────────────────────
   generateToken
   ─────────────
   Signs a JWT with the application secret.
   Payload should be minimal — only what is
   needed to identify the user server-side.
───────────────────────────────────────────── */
const generateToken = (payload, expiresIn = '7d') => {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not defined. ' +
      'Set it in your .env file or deployment environment variables.'
    )
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.warn(
      '[JWT] WARNING: JWT_SECRET is shorter than 32 characters. ' +
      'Use at least 64 random characters in production.'
    )
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256',
  })
}

/* ─────────────────────────────────────────────
   cookieOptions
   ─────────────
   Production:
     secure: true    — HTTPS only (Render + Vercel both use HTTPS)
     sameSite: none  — required for cross-origin cookie to be sent
                       (client on vercel.app, server on onrender.com)

   Development:
     secure: false   — HTTP allowed on localhost
     sameSite: strict — tighter security in dev
───────────────────────────────────────────── */
const isProd = process.env.NODE_ENV === 'production'

const cookieOptions = {
  httpOnly: true,
  secure  : isProd,
  sameSite: isProd ? 'none' : 'strict',
  maxAge  : 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path    : '/',
}

/* ─────────────────────────────────────────────
   clearCookieOptions
   ───────────────────
   Must match the flags used when setting the
   cookie — otherwise the browser won't clear it.
───────────────────────────────────────────── */
const clearCookieOptions = {
  httpOnly: true,
  secure  : isProd,
  sameSite: isProd ? 'none' : 'strict',
  path    : '/',
}

module.exports = { generateToken, cookieOptions, clearCookieOptions }