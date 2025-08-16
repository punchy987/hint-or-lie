// --- sockets/persistence.js ---
function makePersistence(db){
  if (!db) return { upsertRoundResult: async()=>{}, getTop50: async()=>[], getMyStats: async()=>null };
  const admin = require('firebase-admin');
  async function upsertRoundResult({ deviceId, pseudo, didWin, isImpostor }){
    try{
      if (!db || !deviceId) return;
      const ref = db.collection('players').doc(String(deviceId));
      await db.runTransaction(async (tx)=>{
        const snap = await tx.get(ref);
        const prev = snap.exists ? (snap.data() || {}) : {};
        const prevRP = Number(prev.rp || 0);
        const rpDelta = didWin ? (isImpostor ? 3 : 1) : -1;
        let newRP = prevRP + rpDelta; if (prevRP < 10 && newRP < 0) newRP = 0;
        tx.set(ref, {
          deviceId: String(deviceId),
          lastPseudo: String(pseudo || prev.lastPseudo || 'Joueur').slice(0,16),
          rounds: Number(prev.rounds || 0) + 1,
          wins: Number(prev.wins || 0) + (didWin ? 1 : 0),
          winsCrew: Number(prev.winsCrew || 0) + (didWin && !isImpostor ? 1 : 0),
          winsImpostor: Number(prev.winsImpostor || 0) + (didWin && isImpostor ? 1 : 0),
          rp: newRP,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge:true });
      });
    }catch(e){ console.error('upsertRoundResult error', e.message); }
  }
  async function getTop50(){
    try{
      const qs = await db.collection('players').orderBy('rp','desc').orderBy('wins','desc').limit(50).get();
      return qs.docs.map(d => ({ deviceId:d.id, ...(d.data()||{}) }));
    }catch(e){ console.error('getTop50 error', e.message); return []; }
  }
  async function getMyStats(deviceId){ if (!db || !deviceId) return null; const snap = await db.collection('players').doc(String(deviceId)).get(); return snap.exists ? (snap.data() || {}) : null; }
  return { upsertRoundResult, getTop50, getMyStats };
}
module.exports.makePersistence = makePersistence;