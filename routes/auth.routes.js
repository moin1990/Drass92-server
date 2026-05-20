const express           = require('express')
const { login, logout } = require('../controllers/auth.controller')

const router = express.Router()

/**
 * POST /api/auth/login   → issue JWT cookie (called after Firebase auth)
 * POST /api/auth/logout  → clear JWT cookie
 */
router.post('/login',  login)
router.post('/logout', logout)

module.exports = router