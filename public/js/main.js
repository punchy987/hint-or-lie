// public/js/main.js
// Boot : initialise toutes les features + timers pilotés par le serveur
(function () {
  const { $, fmt, state, socket, startPhaseAnim } = window.HOL;

  function initTimersFromServer() {
    socket.on('timer', ({ phase, leftMs }) => {
      if (phase !== state.currentPhase) state.currentPhase = phase;

      // Durée totale par phase (fallback = state.DUR)
      const totalFor = (ph) => ph === 'hints' ? state.DUR.hints :
        ph === 'voting' ? state.DUR.voting :
        ph === 'prestart' ? state.DUR.prestart :
        ph === 'lobby' ? (leftMs > 0 ? leftMs : 0) : 0;

      startPhaseAnim(phase, totalFor(phase), leftMs);

      const left = Math.floor((leftMs + 20) / 1000);
      if (phase === 'hints') {
        const el = $('timer-hints'); if (el) el.textContent = fmt(leftMs);
        if (left <= 0) { $('btn-send-hint')?.setAttribute('disabled', 'true'); $('hint-input')?.setAttribute('disabled', 'true'); }
      } else if (phase === 'voting') {
        const el = $('timer-vote'); if (el) el.textContent = fmt(leftMs);
        if (left <= 0) { document.querySelectorAll('#vote-buttons button').forEach(b => b.disabled = true); }
      } else if (phase === 'prestart') {
        const el = $('timer-reveal'); if (el) el.textContent = fmt(leftMs);
      } else if (phase === 'lobby') {
        const el = $('timer-lobby'); if (el) { el.textContent = fmt(leftMs); if (left <= 0) el.style.display = 'none'; }
      }
        // 🔒 Filet de sécurité d’écran :
  // si le serveur dit "voting" et qu'on est encore sur l'écran "hint",
  // on bascule de force sur l'écran Vote.
  if (phase === 'voting' && document.body.getAttribute('data-screen') === 'screen-hint') {
    // show() est ton utilitaire qui change d'écran
    window.HOL.show('screen-vote');
  }
    });
  }

  function init() {
    window.HOL.features.home.init();
    window.HOL.features.hints.init();
    window.HOL.features.vote.init();
    window.HOL.features.results.init();
    window.HOL.features.leaderboard.init();
    initTimersFromServer();
    // Écran initial
    document.body.setAttribute('data-screen', 'screen-home');
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
