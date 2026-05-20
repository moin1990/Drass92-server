const { getDB } = require('../config/db')

/* ─────────────────────────────────────────────
   POST /api/users
   Create user or update profile on register / OAuth
   Public — called right after Firebase creates the user
   Body: { name, email, photoURL, provider }
───────────────────────────────────────────── */
const createOrUpdateUser = async (req, res, next) => {
  try {
    const { name, email, photoURL, provider } = req.body

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required.' })
    }

    const db       = getDB()
    const existing = await db.collection('users').findOne({ email: email.toLowerCase().trim() })

    if (existing) {
      // Update mutable fields on every sign-in (display name / photo may change)
      await db.collection('users').updateOne(
        { email: email.toLowerCase().trim() },
        {
          $set: {
            name     : name?.trim()     || existing.name,
            photoURL : photoURL?.trim() || existing.photoURL,
            updatedAt: new Date(),
          },
        }
      )
      return res.json({ success: true, message: 'User profile synced.' })
    }

    await db.collection('users').insertOne({
      name     : name?.trim()     || 'Anonymous',
      email    : email.toLowerCase().trim(),
      photoURL : photoURL?.trim() || '',
      provider : provider         || 'email',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    res.status(201).json({ success: true, message: 'User created.' })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   GET /api/users/me
   Return the authenticated user's profile
   Private — requires token
───────────────────────────────────────────── */
const getMe = async (req, res, next) => {
  try {
    const db   = getDB()
    const user = await db.collection('users').findOne(
      { email: req.user.email },
      { projection: { _id: 1, name: 1, email: 1, photoURL: 1, provider: 1, createdAt: 1 } }
    )

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' })
    }

    res.json({ success: true, user })
  } catch (err) {
    next(err)
  }
}

/* ─────────────────────────────────────────────
   PATCH /api/users/me
   Update authenticated user's name and/or photoURL
   Private — requires token
   Body: { name, photoURL }
───────────────────────────────────────────── */
const updateMe = async (req, res, next) => {
  try {
    const { name, photoURL } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' })
    }

    const db = getDB()

    await db.collection('users').updateOne(
      { email: req.user.email },
      {
        $set: {
          name     : name.trim(),
          photoURL : photoURL?.trim() || '',
          updatedAt: new Date(),
        },
      }
    )

    // Also update denormalized author info on existing ideas
    await db.collection('ideas').updateMany(
      { authorEmail: req.user.email },
      {
        $set: {
          authorName : name.trim(),
          authorPhoto: photoURL?.trim() || '',
        },
      }
    )

    // Also update denormalized author info on existing comments
    await db.collection('comments').updateMany(
      { authorEmail: req.user.email },
      {
        $set: {
          authorName : name.trim(),
          authorPhoto: photoURL?.trim() || '',
        },
      }
    )

    res.json({ success: true, message: 'Profile updated successfully.' })
  } catch (err) {
    next(err)
  }
}

module.exports = { createOrUpdateUser, getMe, updateMe }