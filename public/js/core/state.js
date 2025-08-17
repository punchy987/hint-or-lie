// public/js/core/state.js
// État global + scoreboard + animations de phase
(function () {
  const HOL = window.HOL || (window.HOL = {});

  const state = {
    me: { id: null, code: null },
    room: { players: [], state: 'lobby', round: 0 },
    myIsImpostor: false,
    myLobbyReady: false,
    currentPhase: null,
    DUR: { hints: 45_000, voting: 40_000, prestart: 4_000 }, // valeurs par défaut (le serveur pilote le timer)
    phaseAnim: { phase: null, deadline: 0, total: 0, raf: null },
  };

  function tierFromWins(w) {
    if (w >= 120) return 'Diamond';
    if (w >= 60) return 'Platinum';
    if (w >= 25) return 'Gold';
    if (w >= 10) return 'Silver';
    return 'Bronze';
  }

  // ✅ Utilise HOL.el comme factory (et n’écrase rien d’existant)
  function updateScoreboard(players) {
    const ul = HOL.$('score-list'); if (!players || !ul) return;
    ul.innerHTML = '';
    players.slice().sort((a, b) => b.score - a.score).forEach(p => {
      const li = document.createElement('li');
      li.appendChild(HOL.el('span', p.name));
      li.appendChild(HOL.el('span', String(p.score)));
      ul.appendChild(li);
    });
  }

  function resetPhaseProgress() {
    document.querySelectorAll('.phase-progress .bar').forEach(el => el.style.width = '0%');
    document.querySelectorAll('.phase-bar').forEach(el => el.style.setProperty('--progress', '0'));
    stopPhaseAnim();
  }

  function phaseScope(phase) {
    if (phase === 'hints') return document.querySelector('#screen-hint .phase-bar');
    if (phase === 'voting') return document.querySelector('#screen-vote .phase-bar');
    if (phase === 'prestart') return document.querySelector('#screen-result .phase-bar');
    if (phase === 'lobby') return document.querySelector('#screen-lobby .phase-bar');
    return null;
  }

  function tickPhase() {
    const el = phaseScope(state.phaseAnim.phase);
    if (!el) return;
    const left = Math.max(0, state.phaseAnim.deadline - Date.now());
    const done = Math.min(1, (state.phaseAnim.total - left) / Math.max(1, state.phaseAnim.total));
    el.style.setProperty('--progress', String(done));
    const bar = el.querySelector('.phase-progress .bar');
    if (bar) bar.style.width = `${Math.round(done * 100)}%`;
    if (left > 0) {
      state.phaseAnim.raf = requestAnimationFrame(tickPhase);
    } else {
      state.phaseAnim.raf = null;
      document.body.classList.add('flash-now');
      setTimeout(() => document.body.classList.remove('flash-now'), 260);
    }
  }

  function stopPhaseAnim() { if (state.phaseAnim.raf) cancelAnimationFrame(state.phaseAnim.raf); state.phaseAnim.raf = null; }

  function startPhaseAnim(phase, totalMs, leftMs) {
    if (!phase || !totalMs) return;
    state.phaseAnim.phase = phase; state.phaseAnim.total = totalMs; state.phaseAnim.deadline = Date.now() + (leftMs ?? totalMs);
    stopPhaseAnim(); state.phaseAnim.raf = requestAnimationFrame(tickPhase);
  }

  // ⚠️ NE PAS réécrire HOL.getDeviceId ici.
  // helpers.js fournit déjà HOL.getDeviceId ; on le laisse tel quel.

  Object.assign(HOL, {
    state,
    tierFromWins,
    updateScoreboard,
    resetPhaseProgress,
    startPhaseAnim,
    stopPhaseAnim,
    // 👇 On n’ajoute PAS getDeviceId ici pour éviter d’écraser celui de helpers.js
  });
})();
