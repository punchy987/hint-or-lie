// routes/utils/persistence.js
function makePersistence(db) {
  // Fallback si pas de DB (no-op sûr)
  if (!db) {
    return {
      upsertRoundResult:        async () => {},
      applyPenaltyIfNotWinner:  async () => ({ ok:false, reason:'no-db' }),
      getTop50:                 async () => [],
      getMyStats:               async () => null,
    };
  }

  const admin = require('firebase-admin');
  const { getHlRank, getPenaltyByRank } = require('./hlrank');

  // Enregistre les points gagnés sur la MANCHE (tes règles actuelles)
  async function upsertRoundResult({ deviceId, pseudo, didWin, isImpostor }) {
    try {
      const ref = db.collection('players').doc(String(deviceId));
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const prev = snap.exists ? (snap.data() || {}) : {};

        const prevRP = Number(prev.rp || 0);
        const delta = didWin ? (isImpostor ? 3 : 1) : 0; // (tu ne mettais pas de malus par manche)
        let newRP = prevRP + delta;

        tx.set(ref, {
          deviceId: String(deviceId),
          lastPseudo: String(pseudo || prev.lastPseudo || 'Joueur').slice(0, 16),
          rounds: Number(prev.rounds || 0) + 1,
          wins: Number(prev.wins || 0) + (didWin ? 1 : 0),
          winsCrew: Number(prev.winsCrew || 0) + (didWin && !isImpostor ? 1 : 0),
          winsImpostor: Number(prev.winsImpostor || 0) + (didWin && isImpostor ? 1 : 0),
          rp: newRP,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
    } catch (e) {
      console.error('upsertRoundResult error', e);
    }
  }

  // Pénalité de FIN DE PARTIE (non-vainqueurs), basée sur le rang AVANT pénalité
  async function applyPenaltyIfNotWinner({ deviceId, pseudo }) {
    try {
      const ref = db.collection('players').doc(String(deviceId));
      let result = null;

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const prev = snap.exists ? (snap.data() || {}) : {};
        const rpBefore = Number(prev.rp || 0);
        const rankBefore = getHlRank(rpBefore);
        const penalty = getPenaltyByRank(rankBefore);
        const rpAfter = Math.max(0, rpBefore - penalty);

        tx.set(ref, {
          deviceId: String(deviceId),
          lastPseudo: String(pseudo || prev.lastPseudo || 'Joueur').slice(0, 16),
          rp: rpAfter,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        result = { ok: true, rpBefore, rankBefore, penalty, rpAfter };
      });

      return result || { ok:false, reason:'txn' };
    } catch (e) {
      console.error('applyPenaltyIfNotWinner error', e);
      return { ok:false, reason: e.message };
    }
  }

  async function getTop50() {
    try {
      const qs = await db.collection('players')
        .orderBy('rp', 'desc')
        .orderBy('wins', 'desc')
        .limit(50)
        .get();
      return qs.docs.map(d => ({ deviceId: d.id, ...(d.data() || {}) }));
    } catch (e) {
      console.error('getTop50 error', e);
      return [];
    }
  }

  async function getMyStats(deviceId) {
    try {
      const snap = await db.collection('players').doc(String(deviceId)).get();
      return snap.exists ? (snap.data() || {}) : null;
    } catch (e) {
      console.error('getMyStats error', e);
      return null;
    }
  }

  return { upsertRoundResult, applyPenaltyIfNotWinner, getTop50, getMyStats };
}

module.exports = { makePersistence };
