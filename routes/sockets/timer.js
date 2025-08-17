// routes/sockets/timer.js
const path = require('path');

// ✅ chemin corrigé: state/room.js
const { rooms: _rooms } =
  require(path.join(__dirname, 'state', 'room.js'));

function clearRoomTimer(room){
  if (room?.timer?.interval) clearInterval(room.timer.interval);
  if (room) room.timer = { interval:null, deadline:0, phase:null };
}

function startPhaseTimer(io, code, seconds, phase, onExpire){
  const room = _rooms.get(code); if(!room) return;
  clearRoomTimer(room);
  const deadline = Date.now() + seconds*1000;
  room.timer = { interval:null, deadline, phase };
  room.timer.interval = setInterval(()=>{
    const leftMs = Math.max(0, deadline - Date.now());
    io.to(code).emit('timer', { phase, leftMs });
    if (leftMs <= 0){ clearRoomTimer(room); onExpire?.(); }
  }, 500);
}

module.exports = { clearRoomTimer, startPhaseTimer };
