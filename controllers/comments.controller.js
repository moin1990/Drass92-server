const { ObjectId } = require('mongodb')
const { getDB }    = require('../config/db')

const isValidId  = (id) => ObjectId.isValid(id)
const toObjectId = (id) => new ObjectId(id)

/* ─────────────────────────────────────────────
   GET /api/comments/my
   All comments made by the authenticated user,
   enriched with the idea's title + category.
   Private — requires token
───────────────────────────────────────────── */
const getMyComments = async (req, res, next) => {
  try {
    const db       = getDB()
    const comments = await db
      .collection('comments')
      .find({ authorEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray()

    // Enrich each comment with basic idea info
    const enriched = await Promise.all(
      comments.map(async (comment) => {
        let ideaTitle    = 'Unknown Idea'
        let ideaCategory = ''

        if (isValidId(comment.ideaId)) {
          const idea = await db.collection('ideas').findOne(
            { _id: toObjectId(comment.ideaId) },
            { projection: { title: 1, category: 1 } }
          )
          if (idea) {
            ideaTitle    = idea.title
            ideaCategory = idea.category
          }
        }

        return { ...comment, ideaTitle, ideaCategory }
      })
    )

    res.json({ success: true, comments: enriched, total: enriched.length })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   GET /api/comments/:ideaId
   All comments for a specific idea
   Private — requires token
───────────────────────────────────────────── */
const getCommentsByIdea = async (req, res, next) => {
  try {
    const { ideaId } = req.params

    if (!ideaId || !ideaId.trim()) {
      return res.status(400).json({ success: false, message: 'Idea ID is required.' })
    }

    const db       = getDB()
    const comments = await db
      .collection('comments')
      .find({ ideaId })
      .sort({ createdAt: -1 })
      .toArray()

    res.json({ success: true, comments, total: comments.length })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   POST /api/comments
   Add a comment to an idea
   Private — requires token
   Body: { ideaId, text }
───────────────────────────────────────────── */
const addComment = async (req, res, next) => {
  try {
    const { ideaId, text } = req.body

    if (!ideaId || !ideaId.trim()) {
      return res.status(400).json({ success: false, message: 'ideaId is required.' })
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text cannot be empty.' })
    }
    if (text.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Comment must be 1000 characters or fewer.' })
    }

    const db = getDB()

    // Verify the idea exists before commenting
    if (isValidId(ideaId)) {
      const idea = await db.collection('ideas').findOne(
        { _id: toObjectId(ideaId) },
        { projection: { _id: 1 } }
      )
      if (!idea) {
        return res.status(404).json({ success: false, message: 'Idea not found.' })
      }
    }

    const author = await db.collection('users').findOne(
      { email: req.user.email },
      { projection: { name: 1, photoURL: 1 } }
    )

    const comment = {
      ideaId,
      text        : text.trim(),
      authorEmail : req.user.email,
      authorName  : author?.name     || 'Anonymous',
      authorPhoto : author?.photoURL || '',
      createdAt   : new Date(),
      updatedAt   : new Date(),
    }

    const [result] = await Promise.all([
      db.collection('comments').insertOne(comment),
      // Increment idea's comment counter
      isValidId(ideaId)
        ? db.collection('ideas').updateOne(
            { _id: toObjectId(ideaId) },
            { $inc: { commentCount: 1 } }
          )
        : Promise.resolve(),
    ])

    res.status(201).json({
      success : true,
      message : 'Comment added.',
      comment : { ...comment, _id: result.insertedId },
    })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   PATCH /api/comments/:id
   Edit own comment — only the author may edit
   Private — requires token
   Body: { text }
───────────────────────────────────────────── */
const updateComment = async (req, res, next) => {
  try {
    const { id }   = req.params
    const { text } = req.body

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID format.' })
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text cannot be empty.' })
    }
    if (text.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Comment must be 1000 characters or fewer.' })
    }

    const db      = getDB()
    const comment = await db.collection('comments').findOne({ _id: toObjectId(id) })

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' })
    }

    if (comment.authorEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit your own comments.',
      })
    }

    await db.collection('comments').updateOne(
      { _id: toObjectId(id) },
      { $set: { text: text.trim(), updatedAt: new Date() } }
    )

    res.json({ success: true, message: 'Comment updated.' })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   DELETE /api/comments/:id
   Delete own comment — only the author may delete
   Private — requires token
───────────────────────────────────────────── */
const deleteComment = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID format.' })
    }

    const db      = getDB()
    const comment = await db.collection('comments').findOne({ _id: toObjectId(id) })

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' })
    }

    if (comment.authorEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete your own comments.',
      })
    }

    await Promise.all([
      db.collection('comments').deleteOne({ _id: toObjectId(id) }),
      // Decrement idea's comment counter — floor at 0
      isValidId(comment.ideaId)
        ? db.collection('ideas').updateOne(
            { _id: toObjectId(comment.ideaId), commentCount: { $gt: 0 } },
            { $inc: { commentCount: -1 } }
          )
        : Promise.resolve(),
    ])

    res.json({ success: true, message: 'Comment deleted.' })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getMyComments,
  getCommentsByIdea,
  addComment,
  updateComment,
  deleteComment,
}