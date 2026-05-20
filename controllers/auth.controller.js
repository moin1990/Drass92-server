const { generateToken, cookieOptions, clearCookieOptions } = require('../utils/generateToken')
const { verifyFirebaseToken }                               = require('../config/firebase')

/* ─────────────────────────────────────────────
   POST /api/auth/login
   ─────────────────────
   Body: { idToken }   ← Firebase ID token from client

   Flow:
   1. Client calls Firebase auth (email/password or Google popup)
   2. Client gets Firebase ID token via user.getIdToken()
   3. Client sends that token here
   4. Server verifies it with Firebase Admin SDK
   5. Server extracts email from verified token
   6. Server issues its own JWT in an httpOnly cookie

   This prevents any attacker from forging a JWT for an
   arbitrary email — they would need a valid Firebase account.
───────────────────────────────────────────── */
const login = async (req, res, next) => {
  try {
    const { idToken } = req.body

    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required.',
      })
    }

    /* ── Verify the Firebase ID token ─────────────────────── */
    const decoded = await verifyFirebaseToken(idToken)

    if (!decoded) {
      // In production this is always a hard reject.
      // In dev (no Admin SDK configured) we fall back gracefully
      // by reading the email from the request body as a backup.
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Invalid or expired Firebase token.',
        })
      }

      // Dev-only fallback ─ accept { idToken, email } from client
      const { email } = req.body
      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Dev mode: email is required when Firebase Admin is not configured.',
        })
      }

      const token = generateToken({ email: email.toLowerCase().trim() })
      res.cookie('token', token, cookieOptions)
      return res.json({ success: true, message: 'Authenticated (dev fallback).' })
    }

    /* ── Issue our own JWT ────────────────────────────────── */
    const email = decoded.email?.toLowerCase().trim()
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'No email associated with this Firebase account.',
      })
    }

    const token = generateToken({ email })
    res.cookie('token', token, cookieOptions)

    res.json({ success: true, message: 'Authenticated successfully.' })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   POST /api/auth/logout
───────────────────────────────────────────── */
const logout = (req, res) => {
  try {
    res.clearCookie('token', clearCookieOptions)
    res.json({ success: true, message: 'Logged out successfully.' })
  } catch {
    res.json({ success: true, message: 'Logged out.' })
  }
}

module.exports = { login, logout }