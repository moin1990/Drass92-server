const express       = require('express')
const verifyToken   = require('../middleware/verifyToken')
const validateIdea  = require('../middleware/validateIdea')
const {
  getAllIdeas,
  getTrendingIdeas,
  getMyIdeas,
  getIdeaById,
  createIdea,
  updateIdea,
  deleteIdea,
} = require('../controllers/ideas.controller')

const router = express.Router()

/*
  Public
  ──────
  GET  /api/ideas              all ideas — search + filter + paginate
  GET  /api/ideas/trending     top 6 by engagement

  Private
  ───────
  GET    /api/ideas/my         ideas by logged-in user
  GET    /api/ideas/:id        single idea
  POST   /api/ideas            create idea
  PATCH  /api/ideas/:id        update idea (owner only)
  DELETE /api/ideas/:id        delete idea + cascade (owner only)

  NOTE: /trending and /my MUST come before /:id
*/

router.get('/',          getAllIdeas)
router.get('/trending',  getTrendingIdeas)
router.get('/my',        verifyToken, getMyIdeas)
router.get('/:id',       verifyToken, getIdeaById)
router.post('/',         verifyToken, validateIdea, createIdea)
router.patch('/:id',     verifyToken, validateIdea, updateIdea)
router.delete('/:id',    verifyToken, deleteIdea)

module.exports = router