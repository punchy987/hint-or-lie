// config/firebase.js
const admin = require('firebase-admin');

let db = null;

try {
  // 1) En prod (Render, etc.) : on lit la clé depuis une VARIABLE D’ENV
  //    -> mets tout le JSON de la clé dans FIREBASE_SERVICE_ACCOUNT
  let creds = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    // les sauts de ligne arrivent souvent échappés dans les env vars
    if (typeof creds.private_key === 'string') {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
  } else {
    // 2) En local : on lit le fichier ignoré par git
    //    (ne JAMAIS le commiter)
    creds = require('./firebase-service-account.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(creds),
  });

  db = admin.firestore();
  console.log('✅ Firebase configuré');
} catch (e) {
  console.log('⚠️ Firebase non configuré —', e.message);
}

module.exports = { db };
