// --- sockets/state/room.js ---
const { genCode } = require('../utils/random');

// code -> room
const rooms = new Map();

/**
 * Crée une salle et initialise tous les états.
 * - players: Map<socketId, { name, hint, vote, isImpostor, score, deviceId? }>
 * - active:  Set<socketId> (joueurs comptabilisés pour la manche en cours)
 * - lobbies & timers gérés par index.js / timer.js
 */
function createRoom(hostId, hostName) {
  let code;
  do { code = genCode(); } while (rooms.has(code));

  const r = {
    hostId,
    state: 'lobby',
    round: 0,
    words: null,

    players: new Map(),      // tous les connectés dans la salle
    active:  new Set(),      // sous-ensemble compté pour la manche courante

    lastDomain: null,
    lastCommon: null,

    timer: { interval: null, deadline: 0, phase: null },

    lobbyReady: new Set(),
    readyNext:  new Set(),
    used:       {},

    impostor: null,
  };

  r.players.set(hostId, {
    name: hostName,
    hint: null,
    vote: null,
    isImpostor: false,
    score: 0,
  });

  rooms.set(code, r);
  return code;
}

/**
 * Snapshot minimal envoyé aux clients pour l’UI de base.
 */
function snapshot(code) {
  const r = rooms.get(code);
  if (!r) return null;

  const players = Array.from(r.players.entries()).map(([id, p]) => ({
    id,
    name:  p.name,
    score: p.score,
  }));

  return {
    code,
    state: r.state,
    round: r.round,
    players,
  };
}

/**
 * Broadcast un snapshot standard à toute la salle.
 */
function broadcast(io, code) {
  const s = snapshot(code);
  if (s) io.to(code).emit('roomUpdate', s);
}

module.exports = { rooms, createRoom, snapshot, broadcast };
