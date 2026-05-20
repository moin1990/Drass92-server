const admin = require('firebase-admin')

let initialized = false

const initFirebase = () => {
  if (initialized) return

  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = process.env

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.warn(
      '⚠️  Firebase Admin SDK credentials missing. ' +
      'Token verification will be skipped in development.'
    )
    return
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId  : FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        // The private key comes from env as a string with literal \n
        privateKey : FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
    initialized = true
    console.log('✅  Firebase Admin SDK initialized')
  } catch (err) {
    console.error('❌  Firebase Admin SDK init failed:', err.message)
  }
}

/**
 * Verify a Firebase ID token.
 * Returns the decoded token payload or null.
 * Falls back to trusting the email in dev if Admin SDK is not set up.
 */
const verifyFirebaseToken = async (idToken) => {
  if (!initialized) {
    // Dev fallback: warn but don't block
    console.warn('⚠️  Firebase Admin not initialized — skipping token verification (dev mode)')
    return null
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken)
    return decoded
  } catch (err) {
    return null
  }
}

module.exports = { initFirebase, verifyFirebaseToken }