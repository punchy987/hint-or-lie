// --- sockets/game/controller.js ---
const path = require('path');

const { rooms, broadcast } =
  require(path.join(__dirname, '..', 'state', 'rooms.js'));
const { labelWordByDomain } =
  require(path.join(__dirname, 'words.js'));
const { pickPairSmart } =
  require(path.join(__dirname, 'picker.js'));
const { clearRoomTimer, startPhaseTimer } =
  require(path.join(__dirname, '..', 'timer.js'));

function createController({ io, upsertRoundResult, HINT_SECONDS, VOTE_SECONDS }){
  function startRound(code){
    const r = rooms.get(code); if(!r) return;
    clearRoomTimer(r); r.lobbyReady = new Set(); r.readyNext = new Set();
    const ids = Array.from(r.players.keys()); if (ids.length < 3){ io.to(code).emit('errorMsg','Minimum 3 joueurs'); r.state = 'lobby'; return broadcast(io, code); }
    for (const p of r.players.values()){ p.hint=null; p.vote=null; p.isImpostor=false; }
    const pair = pickPairSmart(r); r.words = { common:pair.common, impostor:pair.impostor, domain:pair.domain };
    r.lastDomain = pair.domain; r.lastCommon = pair.common;
    const impId = ids[Math.floor(Math.random()*ids.length)]; r.impostor = impId; const imp = r.players.get(impId); if (imp) imp.isImpostor = true;
    r.round += 1; r.state = 'hints';
    for (const [id,p] of r.players.entries()){
      const myword = p.isImpostor ? r.words.impostor : r.words.common;
      io.to(id).emit('roundInfo', { word: myword, wordDisplay: labelWordByDomain(myword, r.words.domain), isImpostor: p.isImpostor, domain: r.words.domain });
    }
    io.to(code).emit('phaseProgress', { phase:'hints', submitted:0, total:ids.length });
    startPhaseTimer(io, code, HINT_SECONDS, 'hints', ()=>{ const room = rooms.get(code); if(!room) return; for (const p of room.players.values()) if (typeof p.hint !== 'string') p.hint = ''; maybeStartVoting(code); });
    broadcast(io, code);
  }

  function maybeStartVoting(code){
    const r = rooms.get(code); if(!r || r.state!=='hints') return;
    const ok = Array.from(r.players.values()).every(p => typeof p.hint === 'string'); if (!ok) return;
    r.state='voting';
    const hints = Array.from(r.players.entries()).map(([id,p])=>({id,name:p.name,hint:p.hint||''}));
    io.to(code).emit('allHints', { hints, domain:r.words?.domain || null });
    io.to(code).emit('phaseProgress', { phase:'voting', submitted:0, total: r.players.size });
    startPhaseTimer(io, code, VOTE_SECONDS, 'voting', ()=>{ const room = rooms.get(code); if (!room) return; for (const [id,p] of room.players.entries()) if (!p.vote) p.vote = id; finishVoting(code); });
    broadcast(io, code);
  }

  function finishVoting(code){
    const r = rooms.get(code); if (!r || r.state !== 'voting') return;
    const allVoted = Array.from(r.players.values()).every(p => p.vote); if (!allVoted) return;
    clearRoomTimer(r);
    let impId = null; for (const [id,p] of r.players.entries()) if (p.isImpostor) impId = id;
    const tally = {}; for (const p of r.players.values()) tally[p.vote] = (tally[p.vote] || 0) + 1;
    let top = null, max = -1; for (const [c,v] of Object.entries(tally)) if (v > max) { max = v; top = c; }
    const caught = (top === impId);
    if (caught) { for (const p of r.players.values()) if (!p.isImpostor) p.score += 1; } else { const imp = r.players.get(impId); if (imp) imp.score += 2; }
    const winners = new Set(); if (caught){ for (const [id,p] of r.players.entries()) if (!p.isImpostor) winners.add(id); } else if (impId) { winners.add(impId); }
    for (const [id,p] of r.players.entries()){
      const didWin = winners.has(id);
      if (p?.deviceId){ upsertRoundResult({ deviceId: p.deviceId, pseudo: p.name, didWin, isImpostor: !!p.isImpostor }); }
    }
    r.state = 'reveal';
    io.to(code).emit('roundResult', {
      impostorId: impId,
      impostorName: r.players.get(impId)?.name,
      common: r.words.common,
      impostor: r.words.impostor,
      commonDisplay: labelWordByDomain(r.words.common, r.words.domain),
      impostorDisplay: labelWordByDomain(r.words.impostor, r.words.domain),
      votes: tally,
      impostorCaught: caught,
      domain: r.words.domain
    });
    r.readyNext = new Set(); io.to(code).emit('readyProgress', { ready: 0, total: r.players.size });
    broadcast(io, code);
    const arr = Array.from(r.players.values()); const maxScore = Math.max(...arr.map(p => p.score));
    if (maxScore >= 10){
      const winnersArr = Array.from(r.players.entries()).filter(([_,p]) => p.score === maxScore).map(([id,p]) => ({ id, name:p.name, score:p.score }));
      for (const p of r.players.values()) p.score = 0; r.round = 0; r.state = 'lobby';
      io.to(code).emit('gameOver', { winners: winnersArr, autoReset: true }); broadcast(io, code);
    }
  }

  return { startRound, maybeStartVoting, finishVoting };
}
module.exports = { createController };