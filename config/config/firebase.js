// Initialisation Firestore (optionnelle)
let db = null;
let adminRef = null;

try {
  const admin = require('firebase-admin');
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      });
    }
    db = admin.firestore();
    adminRef = admin;
    console.log('[firebase] enabled');
  } else {
    console.log('[firebase] disabled (no FIREBASE_SERVICE_ACCOUNT)');
  }
} catch (e) {
  console.log('[firebase] sdk not installed (optional)');
}

module.exports = { db, adminRef };