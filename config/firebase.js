// config/firebase.js
const admin = require('firebase-admin');
let db = null;

try {
  // ici tu mets la clé que Firebase t’a donnée (un fichier .json)
  const serviceAccount = require('./firebase-service-account.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  console.log('✅ Firebase configuré');
} catch (e) {
  console.log('⚠️ Firebase non configuré —', e.message);
}

module.exports = { db };
