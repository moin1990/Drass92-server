const jwt = require('jsonwebtoken')

/**
 * verifyToken middleware
 * ─────────────────────
 * Reads the JWT from the signed httpOnly cookie named 'token'.
 * On success  → attaches decoded payload to req.user and calls next().
 * On failure  → returns 401 with a descriptive message.
 *
 * Usage:
 *   router.get('/protected', verifyToken, controller)
 */
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: No access token provided.',
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded   // { email, iat, exp }
    next()
  } catch (err) {
    let message = 'Unauthorized: Invalid token.'

    if (err.name === 'TokenExpiredError') {
      message = 'Unauthorized: Token has expired. Please log in again.'
    } else if (err.name === 'JsonWebTokenError') {
      message = 'Unauthorized: Malformed token.'
    } else if (err.name === 'NotBeforeError') {
      message = 'Unauthorized: Token not yet active.'
    }

    return res.status(401).json({ success: false, message })
  }
}

module.exports = verifyToken