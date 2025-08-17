// --- sockets/state/rooms.js ---
const { genCode } = require('../utils/random');
const rooms = new Map(); // code -> room
function createRoom(hostId, hostName){
  let code; do { code = genCode(); } while (rooms.has(code));
  const r = {
    hostId, state:'lobby', round:0, words:null,
    players:new Map(), lastDomain:null, lastCommon:null,
    timer:{ interval:null, deadline:0, phase:null },
    lobbyReady: new Set(), readyNext: new Set(), used: {}
  };
  r.players.set(hostId, { name:hostName, hint:null, vote:null, isImpostor:false, score:0 });
  rooms.set(code, r);
  return code;
}
function snapshot(code){ const r = rooms.get(code); if(!r) return null; const players = Array.from(r.players.entries()).map(([id,p])=>({id,name:p.name,score:p.score})); return { code, state:r.state, round:r.round, players }; }
function broadcast(io, code){ const s = snapshot(code); if (s) io.to(code).emit('roomUpdate', s); }
module.exports = { rooms, createRoom, snapshot, broadcast };