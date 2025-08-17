// public/js/features/hints.js
// Phase INDICES : affiche mot/rôle + Enter pour envoyer + messages d'erreur + progression
(function () {
  const { $, $$, toast, show, state, socket, resetPhaseProgress, onEnter } = window.HOL;

  let sending = false;   // envoi en cours
  let locked  = false;   // verrouillé après ack ou fin de timer

  const ui = {
    role:   () => $('my-role'),
    theme:  () => $('theme-hint-name'),
    word:   () => $('my-word'),
    tip:    () => $('impostor-tip'),
    input:  () => $('hint-input'),
    send:   () => $('btn-send-hint'),
    status: () => $('hint-status'),
    instr:  () => $('hint-instruction'),
  };

  function setRound(num) {
    $$('.round-live').forEach(el => el.textContent = String(num || 0));
  }
  function setProgressHints(sub, total) {
    const el = $('progress-hints');
    if (el) el.textContent = `${sub}/${total}`;
  }
  function clearStatus() {
    const s = ui.status(); if (s) s.textContent = '';
    const i = ui.input(); if (i) i.classList.remove('error');
  }
  function showError(msg) {
    const s = ui.status(); if (s) s.textContent = msg || 'Indice refusé.';
    const i = ui.input(); if (i) { i.classList.add('error'); i.focus(); }
    toast(msg || 'Indice refusé.');
  }
  function disableInputs(disabled) {
    const i = ui.input(); const b = ui.send();
    if (i) i.disabled = !!disabled;
    if (b) b.disabled = !!disabled;
  }

  function sendHint() {
    if (locked || sending) return;
    const val = (ui.input()?.value || '').trim();

    if (!val) { showError("Écris un indice 😉"); return; }
    if (val.length > 40) { showError("Indice trop long (40 car. max)."); return; }

    sending = true;
    clearStatus();
    disableInputs(true);
    const s = ui.status(); if (s) s.textContent = 'Envoi…';
    socket.emit('submitHint', { hint: val });
  }

  function initUI() {
    ui.send()?.addEventListener('click', sendHint);
    onEnter('hint-input', sendHint);
  }

  function initSocket() {
    socket.on('roundInfo', ({ word, wordDisplay, isImpostor, domain, round }) => {
      // Reset affichage & état
      state.myIsImpostor = !!isImpostor;
      sending = false; locked = false;

      show('screen-hint');
      resetPhaseProgress();

      // Thème / rôle / astuce
      if (ui.theme()) ui.theme().textContent = domain || '—';
      if (ui.role()) {
        ui.role().textContent = isImpostor ? 'Imposteur' : 'Équipier';
        ui.role().className = 'role ' + (isImpostor ? 'imp' : 'crew');
      }
      // ✅ pastille imposteur visible/masquée
      if (ui.tip()) ui.tip().style.display = isImpostor ? 'block' : 'none';
      // ✅ texte d’instruction (ta logique)
      if (ui.instr()) {
        ui.instr().textContent = isImpostor
          ? "Donne 1 indice lié à ceux des équipiers sans te faire griller. 📌"
          : "Donne 1 indice lié au mot sans le révéler. 📌";
      }

      // Mot personnel
      if (ui.word()) ui.word().textContent = (wordDisplay || word || '—');

      // Champ & boutons
      clearStatus();
      if (ui.input()) { ui.input().value = ''; ui.input().disabled = false; }
      if (ui.send())  ui.send().disabled = false;

      // UI annexes
      setRound(round);
      $('progress-hints') && ( $('progress-hints').textContent = '0/0' );
      $('progress-vote')  && ( $('progress-vote').textContent  = '0/0' );
      $('timer-vote')     && ( $('timer-vote').textContent     = '00:40' );
      $('timer-reveal')   && ( $('timer-reveal').textContent   = '--:--' );
    });

    // Progression (serveur envoie submitted/total)
    socket.on('phaseProgress', ({ phase, submitted, total, round }) => {
      if (phase === 'hints') {
        setProgressHints(submitted, total);
        if (typeof round === 'number') setRound(round);
      }
    });

    // Accusés de réception
    socket.on('hintAck', () => {
      locked = true; sending = false;
      disableInputs(true);
      const s = ui.status(); if (s) s.textContent = 'Indice envoyé ✅';
    });

    socket.on('hintRejected', ({ reason } = {}) => {
      // Rejet serveur (mot/thème identique, interdit, etc.)
      sending = false; locked = false;
      disableInputs(false);
      showError(reason);
    });

    // Timer coupe → verrouille
    socket.on('timer', ({ phase, leftMs }) => {
      if (phase === 'hints' && leftMs <= 0) {
        locked = true; sending = false;
        disableInputs(true);
      }
    });
  }

  function init() { initUI(); initSocket(); }

  window.HOL.features = window.HOL.features || {};
  window.HOL.features.hints = { init };
})();
