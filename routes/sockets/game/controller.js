// routes/sockets/game/controller.js
const path = require('path');

const { rooms, broadcast } =
  require(path.join(__dirname, '..', 'state', 'room.js'));
const { labelWordByDomain } =
  require(path.join(__dirname, 'words.js'));
const { pickPair } =
  require(path.join(__dirname, 'picker.js'));
const { clearRoomTimer, startPhaseTimer } =
  require(path.join(__dirname, '..', 'timer.js'));

function createController({ io, upsertRoundResult, applyPenaltyIfNotWinner, HINT_SECONDS, VOTE_SECONDS }) {

  function startRound(code) {
    const r = rooms.get(code); if (!r) return;

    clearRoomTimer(r);
    r.lobbyReady = new Set();
    r.readyNext  = new Set();

    // Fige les joueurs actifs pour TOUT le round
    r.active = new Set(Array.from(r.players.keys()));

    if (r.active.size < 3) {
      io.to(code).emit('errorMsg', 'Minimum 3 joueurs');
      r.state = 'lobby';
      return broadcast(io, code);
    }

    // Reset des états de round (par joueur)
    for (const p of r.players.values()) {
      p.hint = null;
      p.vote = null;
      p.isImpostor = false;
    }

    // === NEW: structures pour vote par indice anonyme ===
    r.hints = [];                 // [{ id, playerId, text, ts }]
    r.hintAuthor = new Map();     // hintId -> playerId

    // Tirage des mots (imposteur n'a PAS de mot)
    const pair = pickPair(r);
    r.words = { common: pair.common, impostor: null, domain: pair.domain };
    r.lastDomain = pair.domain;
    r.lastCommon = pair.common;

    // Choix de l’imposteur parmi les actifs
    const activeIds = Array.from(r.active);
    const impId = activeIds[Math.floor(Math.random() * activeIds.length)];
    r.impostor = impId;
    const imp = r.players.get(impId);
    if (imp) imp.isImpostor = true;

    r.usedHints = new Set();
    r.liveCrewHints = [];

    r.round = (r.round || 0) + 1;
    r.state = 'hints';

    // Envoi des infos de manche aux ACTIFS
    for (const id of r.active) {
      const p = r.players.get(id);
      if (!p) continue;

      if (p.isImpostor) {
        io.to(id).emit('roundInfo', {
          word: null,
          wordDisplay: 'Aucun mot — observe les indices',
          isImpostor: true,
          domain: r.words.domain,
          round: r.round,
        });
      } else {
        const myword = r.words.common;
        io.to(id).emit('roundInfo', {
          word: myword,
          wordDisplay: labelWordByDomain(myword, r.words.domain),
          isImpostor: false,
          domain: r.words.domain,
          round: r.round,
        });
      }
    }

    // L'imposteur reçoit le flux live des indices d'équipiers
    if (r.impostor) io.to(r.impostor).emit('crewHintsLive', { hints: r.liveCrewHints });

    // Progress initial
    io.to(code).emit('phaseProgress', { phase: 'hints', submitted: 0, total: r.active.size, round: r.round });

    // Timer phase indices
    startPhaseTimer(io, code, HINT_SECONDS, 'hints', () => {
      const room = rooms.get(code); if (!room) return;
      // Hints vides pour les ACTIFS qui n’ont rien envoyé
      for (const id of room.active) {
        const p = room.players.get(id);
        if (p && typeof p.hint !== 'string') p.hint = '';
      }
      maybeStartVoting(code);
    });

    broadcast(io, code);
  }

  function maybeStartVoting(code) {
    const r = rooms.get(code); if (!r) return;
    if (r.state !== 'hints') return;

    const submitted = Array.from(r.active).filter(id => typeof r.players.get(id)?.hint === 'string').length;
    const total = r.active.size;

    if (submitted === total) {
      clearRoomTimer(r);
      r.state = 'voting';

      // === NEW: reconstruire la liste d'indices anonymes + mapping auteur ===
      r.hints = [];
      r.hintAuthor = new Map();
      const now = Date.now();

      for (const id of r.active) {
        const p = r.players.get(id);
        const text = ((p?.hint || '').trim());
        const hid  = `H_${r.round || 1}_${id}`; // id stable pour ce round
        r.hints.push({ id: hid, playerId: id, text, ts: now });
        r.hintAuthor.set(hid, id);
      }

      // === NEW: payload anonyme (tableau) pour compat client ===
      const hintsPayload = r.hints.map(h => ({ id: h.id, hint: h.text }));
      io.to(code).emit('hintsList', hintsPayload);

      startPhaseTimer(io, code, VOTE_SECONDS, 'voting', () => finishVoting(code));
      broadcast(io, code);
    } else {
      // Mise à jour de la progression si tout le monde n'a pas encore soumis
      io.to(code).emit('phaseProgress', { phase: 'hints', submitted, total, round: r.round });
    }
  }

  function finishVoting(code) {
    const r = rooms.get(code); if (!r) return;
    if (r.state !== 'voting') return;

    clearRoomTimer(r);

    let impId = null;
    for (const id of r.active) { if (r.players.get(id)?.isImpostor) { impId = id; break; } }

    // === NEW: conversion éventuelle des votes "hintId" -> "playerId"
    if (r.hintAuthor && typeof r.hintAuthor.get === 'function') {
      for (const id of r.active) {
        const p = r.players.get(id);
        if (p?.vote && r.hintAuthor.has(p.vote)) {
          p.vote = r.hintAuthor.get(p.vote);
        }
      }
    }

    // Tally des votes (sur playerId)
    const tally = {};
    for (const id of r.active) {
      const p = r.players.get(id);
      if (p?.vote) tally[p.vote] = (tally[p.vote] || 0) + 1;
    }

    // 👉 Démasqué SEULEMENT si top unique ET que c'est l'imposteur
    let max = -1;
    let leaders = [];
    for (const [candidate, v] of Object.entries(tally)) {
      if (v > max) { max = v; leaders = [candidate]; }
      else if (v === max) { leaders.push(candidate); }
    }
    const caught = (leaders.length === 1 && leaders[0] === impId);

    // Attribution des points
    if (caught) {
      for (const id of r.active) {
        const p = r.players.get(id);
        if (p && !p.isImpostor) p.score = (p.score || 0) + 1;
      }
    } else {
      const imp = r.players.get(impId);
      if (imp) imp.score = (imp.score || 0) + 2;
    }

    // Détermination des vainqueurs de la manche
    const winners = new Set();
    if (caught) for (const id of r.active) if (!r.players.get(id)?.isImpostor) winners.add(id);
    else if (impId) winners.add(impId);

    // Persistance (si Firestore branché)
    for (const [id, p] of r.players.entries()) {
      const didWin = winners.has(id);
      if (p?.deviceId) {
        upsertRoundResult?.({ deviceId: p.deviceId, pseudo: p.name, didWin, isImpostor: !!p.isImpostor });
      }
    }
// ... (après calcul de `caught`, attribution des points, winners, etc.)

// 👉 Récupère l'indice (mensonge) tapé par l'imposteur pour l'afficher dans le résumé
const impostorHint =
  (Array.isArray(r.hints) ? r.hints.find(h => h.playerId === impId)?.text : '') || '—';

// Résultat de manche — version officielle
io.to(code).emit('roundResult', {
  round: r.round,
  impostorId: impId,
  impostorName: r.players.get(impId)?.name,
  common: r.words.common,
  impostor: null,                        // l’imposteur n’a pas de mot dans ta V2
  impostorHint,                          // ✅ NOUVEAU
  commonDisplay: labelWordByDomain(r.words.common, r.words.domain),
  impostorDisplay: '—',
  votes: tally,
  impostorCaught: caught,
  domain: r.words.domain,
});

    r.state = 'reveal';
    r.readyNext = new Set();
    io.to(code).emit('readyProgress', { ready: 0, total: r.players.size });
    broadcast(io, code);

    // Fin de partie (10 pts)
    const arr = Array.from(r.players.values());
    const maxScore = Math.max(0, ...arr.map(p => p.score || 0));

    if (maxScore >= 10) {
      const winnersArr = Array.from(r.players.entries())
        .filter(([_, p]) => (p.score || 0) === maxScore)
        .map(([id, p]) => ({ id, name: p.name, score: p.score || 0 }));

      io.to(code).emit('gameOver', { winners: winnersArr, round: r.round, autoReset: true });

      if (typeof applyPenaltyIfNotWinner === 'function') {
        const winnerIds = new Set(winnersArr.map(w => w.id));
        for (const [id, p] of r.players.entries()) {
          if (!winnerIds.has(id) && p?.deviceId) {
            applyPenaltyIfNotWinner({ deviceId: p.deviceId, pseudo: p.name }).catch(() => {});
          }
        }
      }

      // reset complet
      for (const p of r.players.values()) {
        p.score = 0; p.hint = null; p.vote = null; p.isImpostor = false;
      }
      r.round = 0;
      r.state = 'lobby';
      r.lobbyReady = new Set();
      r.readyNext  = new Set();
      r.used = {};
      clearRoomTimer(r);
      broadcast(io, code);
    }
  }

  return { startRound, maybeStartVoting, finishVoting };
}

module.exports = { createController };
