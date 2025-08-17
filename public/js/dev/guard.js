// public/js/dev/guard.js
(function () {
  // Activer/désactiver le mode debug
  const DEBUG = /[?&](dev|debug)=1/i.test(location.search) || window.HOL_DEBUG === true;

  function log(...a){ console.log('[GUARD]', ...a); }
  function warn(...a){ console.warn('[GUARD]', ...a); }

  function checkDOM() {
    const required = [
      'screen-home','screen-lobby','screen-hint','screen-vote','screen-result',
      'btn-create','btn-join','name-create','name-join','join-code',
      'hint-input','btn-send-hint','hint-status','impostor-tip','hint-instruction',
      'vote-buttons','hints',
      'scoreboard','score-list',
      'lobby-ready-pill','round-num','timer-hints','timer-vote','timer-reveal'
    ];
    const missing = required.filter(id => !document.getElementById(id));
    if (missing.length) warn('IDs manquants dans le DOM:', missing);
  }

  function checkHOL() {
    const ok = (p) => {
      try { return !!eval(p); } catch { return false; }
    };
    const reqFns = [
      'window.HOL', 'HOL.$', 'HOL.onEnter', 'HOL.show', 'HOL.fmt',
      'HOL.updateScoreboard',
      'HOL.features && HOL.features.home && HOL.features.home.init',
      'HOL.features && HOL.features.hints && HOL.features.hints.init',
      'HOL.features && HOL.features.vote && HOL.features.vote.init',
      'HOL.features && HOL.features.results && HOL.features.results.init',
    ];
    const miss = reqFns.filter(p => !ok(p));
    if (miss.length) warn('Fonctions/modules attendus non présents:', miss);
  }

  function wireSocketLogging() {
    const s = window.HOL && window.HOL.socket;
    if (!s) { warn('Socket HOL manquant'); return; }
    // Forcer l’affichage des emits et des événements entrants
    const origEmit = s.emit.bind(s);
    s.emit = (ev, ...args) => { console.log('[emit]', ev, ...args); return origEmit(ev, ...args); };
    if (s.onAny) s.onAny((ev, ...args) => console.log('⟵', ev, ...args));
    log('Socket logging activé');
  }

  function run() {
    checkDOM();
    checkHOL();
    wireSocketLogging();
    if (DEBUG) {
      window.addEventListener('error', (e) => warn('JS error:', e.message, e.filename+':'+e.lineno));
      log('Mode DEBUG actif');
    }
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
