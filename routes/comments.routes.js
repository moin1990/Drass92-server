const express      = require('express')
const verifyToken  = require('../middleware/verifyToken')
const {
  getMyComments,
  getCommentsByIdea,
  addComment,
  updateComment,
  deleteComment,
} = require('../controllers/comments.controller')

const router = express.Router()

/*
  All comment routes are private.

  GET    /api/comments/my         → all comments by current user (My Interactions)
  GET    /api/comments/:ideaId    → all comments for an idea
  POST   /api/comments            → add comment
  PATCH  /api/comments/:id        → edit own comment
  DELETE /api/comments/:id        → delete own comment

  NOTE: /my must be before /:ideaId.
*/

router.get('/my',         verifyToken, getMyComments)
router.get('/:ideaId',    verifyToken, getCommentsByIdea)
router.post('/',          verifyToken, addComment)
router.patch('/:id',      verifyToken, updateComment)
router.delete('/:id',     verifyToken, deleteComment)

module.exports = router