// public/js/features/hints.js
// Phase INDICES : affiche mot/rôle + Ambiance Visuelle + CINÉMATIQUE 🎬

(function () {
  const { $, $$, toast, show, state, socket, resetPhaseProgress, onEnter } = window.HOL;

  let sending = false;   // envoi en cours
  let locked  = false;   // verrouillé après ack ou fin de timer
  let liveBox = null;    // conteneur live pour l’imposteur
  let liveList = null;

  const ui = {
    role:   () => $('my-role'),
    theme:  () => $('theme-hint-name'),
    tip:    () => $('impostor-tip'),
    input:  () => $('hint-input'),
    send:   () => $('btn-send-hint'),
    status: () => $('hint-status'),
    instr:  () => $('hint-instruction'),
    wordChip:     () => $('crew-word-chip'),
    wordChipText: () => $('crew-word'),
  };

  // --- Ambiance Visuelle par Rôle ---
  function applyRoleTheme(isImpostor) {
    const body = document.body;
    body.classList.remove('theme-impostor', 'theme-crew');
    
    if (isImpostor) {
      body.classList.add('theme-impostor');
      body.style.animation = 'flash-red 0.5s ease-out';
      setTimeout(() => body.style.animation = '', 500);
    } else {
      body.classList.add('theme-crew');
    }
  }

  function resetTheme() {
    document.body.classList.remove('theme-impostor', 'theme-crew');
  }

  // --- Cinématique de révélation ---
  function playRoleCinematic(isImpostor, callback) {
    const overlay = $('role-reveal-overlay');
    const roleText = $('reveal-role-text');
    
    if (!overlay || !roleText) { 
      callback(); 
      return; 
    } 

    roleText.textContent = isImpostor ? 'IMPOSTEUR' : 'ÉQUIPIER';
    roleText.className = isImpostor ? 'impostor' : 'crew';
    overlay.classList.add('playing');

    setTimeout(() => {
      overlay.classList.remove('playing');
      callback(); 
    }, 3000); 
  }

  function setRound(num) { $$('.round-live').forEach(el => el.textContent = String(num || 0)); }
  
  function setProgressHints(sub, total) {
    const el = $('progress-hints'); if (el) el.textContent = `${sub}/${total}`;
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
    liveBox.style.background = 'rgba(0,0,0,0.3)';
    liveBox.style.border = '1px dashed rgba(255,255,255,0.2)';
    liveBox.style.color = '#fff';
    liveBox.innerHTML = `<strong>📡 Indices interceptés (live)</strong>
      <ul id="crew-live-list" style="margin:6px 0 0 18px; font-size:0.9rem; color:#ccc;"></ul>`;
    liveList = liveBox.querySelector('#crew-live-list');
  }

  function liveClear() { if (liveList) liveList.innerHTML = ''; }
  
  function liveAdd(item) {
    if (!liveList || !item) return;
    const li = document.createElement('li');
    li.textContent = `${item.name || 'Joueur'} : "${item.hint || ''}"`;
    li.style.animation = 'fadeIn 0.5s';
    liveList.appendChild(li);
  }

  function sendHint() {
    if (locked || sending) return;
    const val = (ui.input()?.value || '').trim();
    if (!val) { showError("Écris un indice 😉"); return; }
    sending = true;
    clearStatus();
    disableInputs(true);
    socket.emit('submitHint', { hint: val });
  }

  function initUI() {
    ui.send()?.addEventListener('click', sendHint);
    onEnter('hint-input', sendHint);
  }

  function initSocket() {
    // RECEPTION DES INFOS DE MANCHE
    socket.on('roundInfo', ({ word, wordDisplay, isImpostor, domain, round }) => {
      playRoleCinematic(isImpostor, () => {
        state.myIsImpostor = !!isImpostor;
        sending = false; locked = false;

        show('screen-hint'); // CHANGEMENT D'ECRAN ICI
        resetPhaseProgress();
        applyRoleTheme(isImpostor);

        if (ui.theme()) ui.theme().textContent = domain || '—';
        if (ui.role()) {
          ui.role().textContent = isImpostor ? 'IMPOSTEUR' : 'ÉQUIPIER';
          ui.role().style.color = isImpostor ? '#ef4444' : '#a78bfa';
        }

        const tipEl  = ui.tip();
        const chip   = ui.wordChip();
        const chipTxt= ui.wordChipText();

        if (isImpostor) {
          if (tipEl) { 
            tipEl.style.display = 'block';
            tipEl.innerHTML = "🤫 <strong>CHUT !</strong> Tu n’as pas de mot.<br>Espionne les autres et bluffe !"; 
          }
          if (chip) chip.style.display = 'none';
          
          ensureLiveUI();
          liveBox.style.display = 'block';
          liveClear();
          ui.input()?.insertAdjacentElement('beforebegin', liveBox);
        } else {
          if (tipEl) tipEl.style.display = 'none';
          if (chip) {
            chip.style.display = 'inline-flex';
            if (chipTxt) chipTxt.textContent = wordDisplay || word || '—';
          }
          if (liveBox) liveBox.style.display = 'none';
        }

        clearStatus();
        if (ui.input()) { ui.input().value = ''; ui.input().disabled = false; ui.input().focus(); }
        if (ui.send())  ui.send().disabled = false;
        setRound(round);
      }); 
    });

    socket.on('phaseProgress', ({ phase, submitted, total }) => {
      if (phase === 'hints') setProgressHints(submitted, total);
    });

    socket.on('hintAck', () => {
      locked = true; sending = false;
      disableInputs(true);
      const s = ui.status(); if (s) s.textContent = 'Indice envoyé ✅';
    });

    socket.on('hintRejected', ({ reason }) => {
      sending = false; locked = false;
      disableInputs(false);
      showError(reason);
    });

    // TRANSMISSION DES INDICES POUR L'IMPOSTEUR
    socket.on('crewHintAdded', (item) => {
      if (!state.myIsImpostor) return;
      ensureLiveUI();
      liveAdd(item);
    });

    socket.on('timer', ({ phase }) => {
      if (phase !== 'hints' && phase !== 'prestart') resetTheme();
      if (phase === 'voting' && liveBox) liveBox.style.display = 'none';
    });
  }

  function init() { initUI(); initSocket(); }
  window.HOL.features.hints = { init };
})();