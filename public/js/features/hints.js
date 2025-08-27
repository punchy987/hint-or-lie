// public/js/features/hints.js
// Phase INDICES : affiche mot/rôle + Enter pour envoyer + messages d'erreur + progression
// ➕ Si imposteur : affiche en LIVE les indices des équipiers (crewHintsLive / crewHintAdded)
//     et place le bloc "indices live" ENTRE l'instruction et la zone de saisie.

(function () {
  const { $, $$, toast, show, state, socket, resetPhaseProgress, onEnter } = window.HOL;

  let sending = false;   // envoi en cours
  let locked  = false;   // verrouillé après ack ou fin de timer
  let liveBox = null;    // conteneur live pour l’imposteur
  let liveList = null;

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

  // Écran actuel = "Indices" ?
  function onHintScreen() {
    return document.body.getAttribute('data-screen') === 'screen-hint';
  }

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

  // ————— Live hints (imposteur) —————
  function ensureLiveUI() {
    if (liveBox && liveList) return;
    liveBox = document.createElement('div');
    liveBox.id = 'crew-live-box';
    liveBox.className = 'tip';
    liveBox.style.marginTop = '8px';
    liveBox.innerHTML = `<strong>Indices des équipiers (live)</strong>
      <ul id="crew-live-list" style="margin:6px 0 0 18px"></ul>`;
    liveList = liveBox.querySelector('#crew-live-list');
  }

  // Place le bloc live ENTRE l'instruction et la zone de saisie (uniquement sur l'écran Indices)
  function placeLiveBoxBetweenInstructionAndInput() {
    if (!liveBox || !onHintScreen()) return;
    const parent = document.getElementById('screen-hint') || document.body;

    // B) bloc saisie
    const inputEl =
      (ui.input && ui.input()) ||
      document.getElementById('hint') ||
      parent.querySelector('#hint-form, #hint-box') ||
      parent.querySelector('input[type="text"], textarea');

    const inputBox = inputEl ? (inputEl.closest('.row, .card, div') || inputEl.parentElement) : null;

    // Insérer juste AVANT le bloc de saisie, dans le même parent
    if (inputBox && inputBox.parentElement) {
      inputBox.parentElement.insertBefore(liveBox, inputBox);
      liveBox.style.marginTop = '10px';
      liveBox.style.marginBottom = '10px';
    }
  }

  function liveClear() { if (liveList) liveList.innerHTML = ''; }
  function liveAdd({ name, hint }) {
    if (!liveList) return;
    const li = document.createElement('li');
    li.textContent = `${name || 'Joueur'} — ${hint || ''}`;
    liveList.appendChild(li);
  }
  function liveSet(list) { liveClear(); (list || []).forEach(liveAdd); }

  // ————— Envoi indice —————
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

  // ————— UI de base —————
  function initUI() {
    ui.send()?.addEventListener('click', sendHint);
    onEnter('hint-input', sendHint);
  }

  // ————— Socket / cycle de vie —————
  function initSocket() {
    socket.on('roundInfo', ({ word, wordDisplay, isImpostor, domain, round }) => {
  // Reset affichage & état
  state.myIsImpostor = !!isImpostor;
  sending = false; locked = false;

  show('screen-hint');
  resetPhaseProgress();

// Thème / rôle / astuce
if (ui.theme()) ui.theme().textContent = domain || '—';
  state.roundDomain = domain || '';
if (ui.role()) {
  ui.role().textContent = isImpostor ? 'Imposteur' : 'Équipier';
  ui.role().className = 'role ' + (isImpostor ? 'imp' : 'crew');
}

// Tip imposteur
if (ui.tip()) {
  if (isImpostor) {
    ui.tip().style.display = 'block';
    ui.tip().textContent = "🤫 Tu n’as pas de mot. Observe les indices et invente un indice crédible.";
  } else {
    ui.tip().style.display = 'none';
  }
}

// Mot + instruction (équipiers seulement)
if (ui.word()) {
  if (isImpostor) {
    ui.word().style.display = 'none';
  } else {
    ui.word().style.display = 'block';
    ui.word().textContent = wordDisplay || word || '—';
  }
}
if (ui.instr()) {
  if (isImpostor) {
    ui.instr().style.display = 'none';
  } else {
    ui.instr().style.display = 'block';
    ui.instr().textContent = "Donne 1 indice lié au mot sans le révéler. 📌";
  }
}
function setDisplay(el, value) { if (el) el.style.display = value; }

// Affiche/masque les textes "Ton mot" et l'instruction
function toggleHintTexts(show) {
  setDisplay(ui.word(),  show ? '' : 'none');
  setDisplay(ui.instr(), show ? '' : 'none');
}

  // 👉 Masquer totalement ces deux textes si imposteur, sinon les montrer
  toggleHintTexts(!isImpostor);

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

  // Live imposteur : insérer juste au-dessus du champ "Ton indice"
  if (isImpostor) {
    ensureLiveUI();
    liveBox.style.display = 'block';
    liveClear();
    ui.input()?.insertAdjacentElement('beforebegin', liveBox); // => avant le bloc de saisie
  } else {
    if (liveBox) { liveBox.style.display = 'none'; liveClear(); }
  }
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
      // Rejet serveur (mot/thème identique, interdit, doublon, etc.)
      sending = false; locked = false;
      disableInputs(false);
      showError(reason);
    });

    // Live pour l’imposteur (réception & ajout)
    socket.on('crewHintsLive', ({ hints }) => {
      if (!state.myIsImpostor) return;
      ensureLiveUI();
      liveBox.style.display = 'block';
      liveSet(hints || []);
      ui.input()?.insertAdjacentElement('beforebegin', liveBox);
    });
    socket.on('crewHintAdded', (item) => {
      if (!state.myIsImpostor) return;
      ensureLiveUI();
      liveBox.style.display = 'block';
      liveAdd(item);
      ui.input()?.insertAdjacentElement('beforebegin', liveBox);
    });

    // Filets de sécurité : sortie de la phase Indices
    socket.on('timer', ({ phase, leftMs }) => {
      if (phase === 'hints' && leftMs <= 0) {
        locked = true; sending = false;
        disableInputs(true);
      }
      // Dès que la phase vote démarre → on cache le live
      if (phase === 'voting' && liveBox) {
        liveBox.style.display = 'none';
      }
    });

    // Quand la liste des indices de vote arrive (début du vote) → cache aussi
    socket.on('hintsList', () => {
      if (liveBox) liveBox.style.display = 'none';
    });
  }

  function init() { initUI(); initSocket(); }

  window.HOL.features = window.HOL.features || {};
  window.HOL.features.hints = { init };
})();
