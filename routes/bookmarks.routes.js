const express     = require('express')
const verifyToken = require('../middleware/verifyToken')
const {
  getMyBookmarks,
  addBookmark,
  removeBookmark,
} = require('../controllers/bookmarks.controller')

const router = express.Router()

/*
  All bookmark routes are private.

  GET    /api/bookmarks           → get own bookmarks (enriched)
  POST   /api/bookmarks           → bookmark an idea
  DELETE /api/bookmarks/:ideaId   → remove a bookmark
*/

router.get('/',          verifyToken, getMyBookmarks)
router.post('/',         verifyToken, addBookmark)
router.delete('/:ideaId',verifyToken, removeBookmark)

module.exports = router