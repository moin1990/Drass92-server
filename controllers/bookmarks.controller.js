const { ObjectId } = require('mongodb')
const { getDB }    = require('../config/db')

const isValidId  = (id) => ObjectId.isValid(id)
const toObjectId = (id) => new ObjectId(id)

/* ─────────────────────────────────────────────
   GET /api/bookmarks
   Get all bookmarks for the authenticated user,
   enriched with full idea details.
   Private — requires token
───────────────────────────────────────────── */
const getMyBookmarks = async (req, res, next) => {
  try {
    const db        = getDB()
    const bookmarks = await db
      .collection('bookmarks')
      .find({ userEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray()

    const enriched = await Promise.all(
      bookmarks.map(async (bm) => {
        let idea = null
        if (isValidId(bm.ideaId)) {
          idea = await db.collection('ideas').findOne({ _id: toObjectId(bm.ideaId) })
        }
        return { ...bm, idea }
      })
    )

    res.json({ success: true, bookmarks: enriched, total: enriched.length })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   POST /api/bookmarks
   Bookmark an idea
   Private — requires token
   Body: { ideaId }
───────────────────────────────────────────── */
const addBookmark = async (req, res, next) => {
  try {
    const { ideaId } = req.body

    if (!ideaId || !ideaId.trim()) {
      return res.status(400).json({ success: false, message: 'ideaId is required.' })
    }

    const db = getDB()

    // Verify idea exists
    if (isValidId(ideaId)) {
      const idea = await db.collection('ideas').findOne(
        { _id: toObjectId(ideaId) },
        { projection: { _id: 1 } }
      )
      if (!idea) {
        return res.status(404).json({ success: false, message: 'Idea not found.' })
      }
    }

    // Check duplicate
    const existing = await db.collection('bookmarks').findOne({
      ideaId,
      userEmail: req.user.email,
    })

    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already bookmarked this idea.' })
    }

    const [result] = await Promise.all([
      db.collection('bookmarks').insertOne({
        ideaId,
        userEmail: req.user.email,
        createdAt: new Date(),
      }),
      isValidId(ideaId)
        ? db.collection('ideas').updateOne(
            { _id: toObjectId(ideaId) },
            { $inc: { bookmarkCount: 1 } }
          )
        : Promise.resolve(),
    ])

    res.status(201).json({
      success   : true,
      message   : 'Idea bookmarked.',
      insertedId: result.insertedId,
    })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   DELETE /api/bookmarks/:ideaId
   Remove a bookmark
   Private — requires token
───────────────────────────────────────────── */
const removeBookmark = async (req, res, next) => {
  try {
    const { ideaId } = req.params

    if (!ideaId || !ideaId.trim()) {
      return res.status(400).json({ success: false, message: 'ideaId is required.' })
    }

    const db       = getDB()
    const bookmark = await db.collection('bookmarks').findOne({
      ideaId,
      userEmail: req.user.email,
    })

    if (!bookmark) {
      return res.status(404).json({ success: false, message: 'Bookmark not found.' })
    }

    await Promise.all([
      db.collection('bookmarks').deleteOne({ ideaId, userEmail: req.user.email }),
      isValidId(ideaId)
        ? db.collection('ideas').updateOne(
            { _id: toObjectId(ideaId), bookmarkCount: { $gt: 0 } },
            { $inc: { bookmarkCount: -1 } }
          )
        : Promise.resolve(),
    ])

    res.json({ success: true, message: 'Bookmark removed.' })
  } catch (err) {
    next(err)
  }
}

module.exports = { getMyBookmarks, addBookmark, removeBookmark }