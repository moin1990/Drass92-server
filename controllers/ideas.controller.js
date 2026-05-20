const { ObjectId } = require('mongodb')
const { getDB }    = require('../config/db')

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const isValidId = (id) => ObjectId.isValid(id)

const toObjectId = (id) => new ObjectId(id)

/** Build MongoDB query from request query params */
const buildQuery = ({ search, category, from, to }) => {
  const query = {}

  // ── Full-text / partial title search (case-insensitive regex) ──
  if (search && search.trim()) {
    query.title = { $regex: search.trim(), $options: 'i' }
  }

  // ── Category filter ────────────────────────────────────────────
  if (category && category.trim() && category.trim() !== 'All') {
    query.category = category.trim()
  }

  // ── Date range filter (optional) ───────────────────────────────
  if (from || to) {
    query.createdAt = {}
    if (from) {
      const fromDate = new Date(from)
      if (!isNaN(fromDate)) query.createdAt.$gte = fromDate
    }
    if (to) {
      const toDate = new Date(to)
      // Include entire end day
      if (!isNaN(toDate)) {
        toDate.setHours(23, 59, 59, 999)
        query.createdAt.$lte = toDate
      }
    }
    // Clean up empty object if neither date was valid
    if (Object.keys(query.createdAt).length === 0) delete query.createdAt
  }

  return query
}

/* ─────────────────────────────────────────────
   GET /api/ideas
   Query params:
     search   — title substring (case-insensitive)
     category — exact category match
     from     — ISO date string (start)
     to       — ISO date string (end)
     page     — page number (default 1)
     limit    — results per page (default 9)
───────────────────────────────────────────── */
const getAllIdeas = async (req, res, next) => {
  try {
    const db    = getDB()
    const page  = Math.max(1, parseInt(req.query.page)  || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 9))
    const skip  = (page - 1) * limit

    const query = buildQuery(req.query)

    const [ideas, total] = await Promise.all([
      db.collection('ideas')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('ideas').countDocuments(query),
    ])

    res.json({
      success   : true,
      ideas,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   GET /api/ideas/trending
   Top 6 ideas by commentCount + recency
   (Public — no token required)
───────────────────────────────────────────── */
const getTrendingIdeas = async (req, res, next) => {
  try {
    const db    = getDB()
    const ideas = await db
      .collection('ideas')
      .find({})
      .sort({ commentCount: -1, createdAt: -1 })
      .limit(6)
      .toArray()

    res.json({ success: true, ideas })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   GET /api/ideas/my
   All ideas by the authenticated user
   Private — requires token
───────────────────────────────────────────── */
const getMyIdeas = async (req, res, next) => {
  try {
    const db    = getDB()
    const ideas = await db
      .collection('ideas')
      .find({ authorEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray()

    res.json({ success: true, ideas, total: ideas.length })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   GET /api/ideas/:id
   Single idea by ID
   Private — requires token
───────────────────────────────────────────── */
const getIdeaById = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid idea ID format.' })
    }

    const db   = getDB()
    const idea = await db.collection('ideas').findOne({ _id: toObjectId(id) })

    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found.' })
    }

    res.json({ success: true, idea })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   POST /api/ideas
   Create a new idea
   Private — requires token
   Required body fields:
     title, shortDescription, category,
     targetAudience, problemStatement, proposedSolution
───────────────────────────────────────────── */
const createIdea = async (req, res, next) => {
  try {
    const {
      title,
      shortDescription,
      detailedDescription,
      category,
      tags,
      imageURL,
      estimatedBudget,
      targetAudience,
      problemStatement,
      proposedSolution,
    } = req.body

    // ── Required field validation ──────────────────────────────
    const required = { title, shortDescription, category, targetAudience, problemStatement, proposedSolution }
    const missing  = Object.entries(required)
      .filter(([, v]) => !v || !String(v).trim())
      .map(([k]) => k)

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}.`,
      })
    }

    const db     = getDB()
    const author = await db.collection('users').findOne({ email: req.user.email })

    // ── Normalize tags ─────────────────────────────────────────
    let normalizedTags = []
    if (Array.isArray(tags)) {
      normalizedTags = tags.map((t) => String(t).trim()).filter(Boolean)
    } else if (typeof tags === 'string' && tags.trim()) {
      normalizedTags = tags.split(',').map((t) => t.trim()).filter(Boolean)
    }

    const newIdea = {
      title             : title.trim(),
      shortDescription  : shortDescription.trim(),
      detailedDescription: detailedDescription?.trim() || '',
      category          : category.trim(),
      tags              : normalizedTags,
      imageURL          : imageURL?.trim()        || '',
      estimatedBudget   : estimatedBudget?.trim() || '',
      targetAudience    : targetAudience.trim(),
      problemStatement  : problemStatement.trim(),
      proposedSolution  : proposedSolution.trim(),
      authorEmail       : req.user.email,
      authorName        : author?.name     || 'Anonymous',
      authorPhoto       : author?.photoURL || '',
      commentCount      : 0,
      bookmarkCount     : 0,
      createdAt         : new Date(),
      updatedAt         : new Date(),
    }

    const result = await db.collection('ideas').insertOne(newIdea)

    res.status(201).json({
      success   : true,
      message   : 'Idea created successfully.',
      insertedId: result.insertedId,
      idea      : { ...newIdea, _id: result.insertedId },
    })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   PATCH /api/ideas/:id
   Update an idea — owner only
   Private — requires token
───────────────────────────────────────────── */
const updateIdea = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid idea ID format.' })
    }

    const db   = getDB()
    const idea = await db.collection('ideas').findOne({ _id: toObjectId(id) })

    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found.' })
    }

    if (idea.authorEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit your own ideas.',
      })
    }

    // ── Build safe update payload (strip protected fields) ─────
    const {
      _id, authorEmail, authorName, authorPhoto,
      commentCount, bookmarkCount, createdAt,
      ...allowedUpdates
    } = req.body   // eslint-disable-line no-unused-vars

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided.' })
    }

    // Normalize tags if present
    if (allowedUpdates.tags !== undefined) {
      if (Array.isArray(allowedUpdates.tags)) {
        allowedUpdates.tags = allowedUpdates.tags.map((t) => String(t).trim()).filter(Boolean)
      } else if (typeof allowedUpdates.tags === 'string') {
        allowedUpdates.tags = allowedUpdates.tags.split(',').map((t) => t.trim()).filter(Boolean)
      }
    }

    const updateDoc = { $set: { ...allowedUpdates, updatedAt: new Date() } }

    await db.collection('ideas').updateOne({ _id: toObjectId(id) }, updateDoc)

    res.json({ success: true, message: 'Idea updated successfully.' })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   DELETE /api/ideas/:id
   Delete an idea + its comments + its bookmarks
   Owner only — Private
───────────────────────────────────────────── */
const deleteIdea = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid idea ID format.' })
    }

    const db   = getDB()
    const idea = await db.collection('ideas').findOne({ _id: toObjectId(id) })

    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found.' })
    }

    if (idea.authorEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete your own ideas.',
      })
    }

    // ── Cascade delete ─────────────────────────────────────────
    const [ideaResult, commentsResult, bookmarksResult] = await Promise.all([
      db.collection('ideas')    .deleteOne({ _id: toObjectId(id) }),
      db.collection('comments') .deleteMany({ ideaId: id }),
      db.collection('bookmarks').deleteMany({ ideaId: id }),
    ])

    res.json({
      success         : true,
      message         : 'Idea and all related data deleted.',
      deletedIdea     : ideaResult.deletedCount,
      deletedComments : commentsResult.deletedCount,
      deletedBookmarks: bookmarksResult.deletedCount,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getAllIdeas,
  getTrendingIdeas,
  getMyIdeas,
  getIdeaById,
  createIdea,
  updateIdea,
  deleteIdea,
}