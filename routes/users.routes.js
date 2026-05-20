const express     = require('express')
const verifyToken = require('../middleware/verifyToken')
const {
  createOrUpdateUser,
  getMe,
  updateMe,
} = require('../controllers/users.controller')

const router = express.Router()

/*
  POST  /api/users     → create or upsert user (called on register/OAuth — public)
  GET   /api/users/me  → get own profile (private)
  PATCH /api/users/me  → update own profile (private)
*/

router.post('/',     createOrUpdateUser)
router.get('/me',    verifyToken, getMe)
router.patch('/me',  verifyToken, updateMe)

module.exports = router