// routes/sockets/index.js
// Sockets: hello / createRoom / joinRoom / leaveRoom / ready + timers

const path = require('path');

const { HINT_SECONDS, VOTE_SECONDS, LOBBY_READY_SECONDS } =
  require(path.join(__dirname, '..', '..', 'config', 'index.js'));

// ✅ chemin corrigé: state/room.js (singulier)
const { rooms, snapshot, broadcast, createRoom } =
  require(path.join(__dirname, 'state', 'room.js'));

// ✅ idem pour timer
const { clearRoomTimer, startPhaseTimer } =
  require(path.join(__dirname, 'timer.js'));

const { isHintAllowed } =
  require(path.join(__dirname, 'game', 'validate.js'));

// ✅ persistance via routes/utils/persistence.js (et fallback no-op)
let makePersistence = () => ({
  upsertRoundResult: async () => {},
  getTop50:          async () => [],
  getMyStats:        async () => null,
});
try {
  makePersistence = require(path.join(__dirname, '..', 'utils', 'persistence.js')).makePersistence;
} catch (e) {
  console.log('ℹ️ Persistence non branchée (utils/persistence.js introuvable).');
}

const { createController } =
  require(path.join(__dirname, 'game', 'controller.js'));

module.exports = function setupSockets(io, db){
  const { upsertRoundResult, getTop50, getMyStats } = makePersistence(db);
  const controller = createController({ io, upsertRoundResult, HINT_SECONDS, VOTE_SECONDS });

  io.on('connection',(socket)=>{
    let joined  = { code:null };
    let profile = { deviceId:null, lastPseudo:null };

    // Debug pratique
    if (socket.onAny) socket.onAny((ev, ...args) => console.debug('⟵', socket.id, ev, ...args));

    // Identité
    socket.on('hello', ({ deviceId, pseudo } = {})=>{
      if (deviceId) profile.deviceId  = String(deviceId).slice(0,64);
      if (pseudo)   profile.lastPseudo = String(pseudo).slice(0,16);
    });

    // Leaderboard
    socket.on('getLeaderboard', async ()=>{
      try{
        const top = await getTop50();
        const payload = top.map(x => ({
          deviceId: x.deviceId,
          pseudo:   x.lastPseudo || 'Joueur',
          wins:     Number(x.wins || 0),
        }));
        socket.emit('leaderboard', payload);
        socket.emit('leaderboardData', payload);
      }catch(e){
        socket.emit('errorMsg','Impossible de charger le Top 50');
      }
    });

    socket.on('getMyStats', async ({ deviceId })=>{
      const doc = await getMyStats(String(deviceId||''));
      socket.emit('myStats', doc ? {
        rp:Number(doc.rp||0), rounds:Number(doc.rounds||0), wins:Number(doc.wins||0),
        winsCrew:Number(doc.winsCrew||0), winsImpostor:Number(doc.winsImpostor||0)
      } : { rp:0, rounds:0, wins:0, winsCrew:0, winsImpostor:0 });
    });

    // Créer une salle
    socket.on('createRoom', ({ name, deviceId, pseudo } = {})=>{
      const displayName = String(name || pseudo || profile.lastPseudo || 'Joueur').slice(0,16);
      const code = createRoom(socket.id, displayName);

      socket.join(code);
      joined.code = code;
      profile.lastPseudo = displayName;
      profile.deviceId   = String(deviceId || profile.deviceId || '').slice(0,64) || null;

      const r = rooms.get(code);
      if (r && r.players.has(socket.id)) r.players.get(socket.id).deviceId = profile.deviceId;

      socket.emit('roomCreated', { code });
      broadcast(io, code);
    });

    // Rejoindre une salle
    socket.on('joinRoom', ({ code, name, deviceId, pseudo } = {})=>{
      code = String(code || '').trim();
      if (!/^\d{4}$/.test(code)) return socket.emit('errorMsg','Code invalide (4 chiffres)');
      const r = rooms.get(code); if (!r) return socket.emit('errorMsg','Salle introuvable');

      socket.join(code);
      joined.code = code;

      const displayName = String(name || pseudo || profile.lastPseudo || 'Joueur').slice(0,16);
      profile.lastPseudo = displayName;
      profile.deviceId   = String(deviceId || profile.deviceId || '').slice(0,64) || null;

      r.players.set(socket.id, {
        name: displayName, hint:null, vote:null, isImpostor:false, score:0,
        deviceId: profile.deviceId
      });

      socket.emit('roomJoined', { code });
      broadcast(io, code);

      r.lobbyReady ||= new Set();
      io.to(code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: r.players.size });
    });

    // Quitter la salle
    socket.on('leaveRoom', ()=>{
      const code = joined.code; if(!code) return;
      const r = rooms.get(code); if(!r) return;

      r.players.delete(socket.id);

      if (r.lobbyReady?.has(socket.id)){
        r.lobbyReady.delete(socket.id);
        io.to(code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: r.players.size });
        if (r.timer?.phase === 'lobby'){ clearRoomTimer(r); io.to(code).emit('lobbyCountdownCancelled'); }
      }
      if (r.readyNext?.has(socket.id)){
        r.readyNext.delete(socket.id);
        io.to(code).emit('readyProgress', { ready: r.readyNext.size, total: r.players.size });
      }

      if (r.hostId === socket.id){
        const first = r.players.keys().next().value;
        if (first) r.hostId = first; else rooms.delete(code);
      }

      socket.leave(code); joined.code = null;
      broadcast(io, code);
      socket.emit('leftRoom');
    });

    // Prêt lobby
    socket.on('playerReadyLobby', ({ ready })=>{
      const r = rooms.get(joined.code); if(!r) return; if (r.state !== 'lobby') return;

      r.lobbyReady ||= new Set();
      if (ready) r.lobbyReady.add(socket.id); else r.lobbyReady.delete(socket.id);

      io.to(joined.code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: r.players.size });

      if (r.lobbyReady.size === r.players.size && r.players.size >= 3){
        clearRoomTimer(r);
        startPhaseTimer(io, joined.code, LOBBY_READY_SECONDS, 'lobby', ()=> controller.startRound(joined.code));
        io.to(joined.code).emit('lobbyCountdownStarted', { seconds: LOBBY_READY_SECONDS });
      } else if (r.timer?.phase === 'lobby'){
        clearRoomTimer(r);
        io.to(joined.code).emit('lobbyCountdownCancelled');
      }
    });

    // Démarrage manuel (hôte)
    socket.on('startRound', ()=>{
      const r = rooms.get(joined.code); if(!r) return;
      if (r.hostId !== socket.id) return socket.emit('errorMsg',"Seul l'hôte peut démarrer");
      controller.startRound(joined.code);
      socket.emit('actionAck', { action:'startRound', status:'ok' });
    });

    // Indice
    socket.on('submitHint', ({ hint })=>{
      const r = rooms.get(joined.code); if(!r || r.state!=='hints') return;
      const p = r.players.get(socket.id); if(!p) return;
      if (typeof p.hint === 'string') return;

      const raw = String(hint||'').trim().slice(0,40);
      const mySecret = p.isImpostor ? r.words.impostor : r.words.common;
      const check = isHintAllowed(mySecret, raw, r.words.domain);
      if (!check.ok) return socket.emit('hintRejected', { reason: check.reason });

      p.hint = raw; socket.emit('hintAck');

      const submitted = Array.from(r.players.values()).filter(x => typeof x.hint === 'string').length;
      io.to(joined.code).emit('phaseProgress', { phase:'hints', submitted, total: r.players.size });

      controller.maybeStartVoting(joined.code);
      broadcast(io, joined.code);
    });

    // Vote (re-cliquable jusqu'à fin de timer)
    socket.on('submitVote', ({ targetId })=>{
      const r = rooms.get(joined.code); if(!r || r.state!=='voting') return;
      if (!r.players.has(targetId)) return;
      const p = r.players.get(socket.id); if(!p) return;

      // met à jour le vote (écrase l'ancien si besoin)
      p.vote = targetId;
      socket.emit('voteAck');

      const submitted = Array.from(r.players.values()).filter(x => !!x.vote).length;
      io.to(joined.code).emit('phaseProgress', { phase:'voting', submitted, total: r.players.size });

      // ❌ Ne PAS finaliser ici : on laisse les joueurs changer d'avis jusqu'à la fin du timer
      // controller.finishVoting(joined.code);

      broadcast(io, joined.code);
    });

    // Prêt pour la prochaine manche
    socket.on('playerReadyNext', ()=>{
      const r = rooms.get(joined.code); if(!r) return; if (r.state !== 'reveal') return;
      r.readyNext ||= new Set();
      r.readyNext.add(socket.id);
      io.to(joined.code).emit('readyProgress', { ready: r.readyNext.size, total: r.players.size });
      if (r.readyNext.size === r.players.size){
        startPhaseTimer(io, joined.code, 3, 'prestart', ()=> controller.startRound(joined.code));
      }
    });

    // Reset scores (hôte)
    socket.on('resetScores', ()=>{
      const r = rooms.get(joined.code); if(!r) return;
      if (r.hostId !== socket.id) return socket.emit('errorMsg',"Seul l'hôte peut réinitialiser");
      for (const p of r.players.values()) p.score = 0;
      r.round = 0; r.state='lobby'; r.used={}; r.lobbyReady = new Set(); r.readyNext = new Set();
      clearRoomTimer(r);
      io.to(joined.code).emit('lobbyCountdownCancelled');
      io.to(joined.code).emit('scoresReset');
      broadcast(io, joined.code);
    });

    // Déconnexion
    socket.on('disconnect', ()=>{
      const code = joined.code; if(!code) return;
      const r = rooms.get(code); if(!r) return;

      r.players.delete(socket.id);

      if (r.lobbyReady?.has(socket.id)){
        r.lobbyReady.delete(socket.id);
        io.to(code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: r.players.size });
        if (r.timer?.phase === 'lobby'){ clearRoomTimer(r); io.to(code).emit('lobbyCountdownCancelled'); }
      }
      if (r.readyNext?.has(socket.id)){
        r.readyNext.delete(socket.id);
        io.to(code).emit('readyProgress', { ready: r.readyNext.size, total: r.players.size });
      }

      if (r.hostId === socket.id){
        const first = r.players.keys().next().value;
        if (first) r.hostId = first; else rooms.delete(code);
      }

      broadcast(io, code);
    });
  });
};
