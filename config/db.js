const { MongoClient } = require('mongodb')

let db = null

const connectDB = async () => {
  try {
    const client = new MongoClient(process.env.MONGODB_URI)
    await client.connect()

    db = client.db('ideavault')
    console.log('✅  MongoDB Atlas connected — database: ideavault')

    await createIndexes()
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message)
    process.exit(1)
  }
}

const createIndexes = async () => {
  try {
    /* ── users ─────────────────────────────────── */
    await db.collection('users').createIndex(
      { email: 1 },
      { unique: true, name: 'users_email_unique' }
    )

    /* ── ideas ─────────────────────────────────── */
    await db.collection('ideas').createIndex(
      { title: 'text', shortDescription: 'text' },
      { name: 'ideas_text_search' }
    )
    await db.collection('ideas').createIndex({ category   : 1  }, { name: 'ideas_category'    })
    await db.collection('ideas').createIndex({ authorEmail: 1  }, { name: 'ideas_author'      })
    await db.collection('ideas').createIndex({ createdAt  : -1 }, { name: 'ideas_created_desc'})
    await db.collection('ideas').createIndex({ commentCount: -1}, { name: 'ideas_comments_desc'})

    /* ── comments ──────────────────────────────── */
    await db.collection('comments').createIndex({ ideaId     : 1  }, { name: 'comments_ideaId'      })
    await db.collection('comments').createIndex({ authorEmail: 1  }, { name: 'comments_author'      })
    await db.collection('comments').createIndex({ createdAt  : -1 }, { name: 'comments_created_desc'})

    /* ── bookmarks ─────────────────────────────── */
    await db.collection('bookmarks').createIndex(
      { userEmail: 1, ideaId: 1 },
      { unique: true, name: 'bookmarks_user_idea_unique' }
    )

    console.log('✅  Database indexes created')
  } catch (err) {
    // Non-fatal — indexes may already exist
    console.warn('⚠️   Index creation warning:', err.message)
  }
}

const getDB = () => {
  if (!db) throw new Error('Database not initialized — call connectDB() first')
  return db
}

module.exports = { connectDB, getDB }