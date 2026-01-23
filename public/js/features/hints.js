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
    word:   () => $('my-word'),
    tip:    () => $('impostor-tip'),
    input:  () => $('hint-input'),
    send:   () => $('btn-send-hint'),
    status: () => $('hint-status'),
    instr:  () => $('hint-instruction'),
    wordChip:     () => $('crew-word-chip'),
    wordChipText: () => $('crew-word'),
  };

  function onHintScreen() {
    return document.body.getAttribute('data-screen') === 'screen-hint';
  }

  // --- NOUVEAU : Ambiance Visuelle par Rôle ---
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

  // --- NOUVEAU : Fonction pour jouer la cinématique ---
  function playRoleCinematic(isImpostor, callback) {
    const overlay = $('role-reveal-overlay');
    const roleText = $('reveal-role-text');
    
    // Si l'overlay n'existe pas dans le HTML, on passe direct
    if (!overlay || !roleText) { 
      callback(); 
      return; 
    } 

    // 1. Configurer le texte et la couleur
    roleText.textContent = isImpostor ? 'IMPOSTEUR' : 'ÉQUIPIER';
    roleText.className = isImpostor ? 'impostor' : 'crew';

    // 2. Lancer l'animation
    overlay.classList.add('playing');

    // (Optionnel: Son si on l'avait) window.HOL.audio?.play('swoosh');

    // 3. Attendre 3 secondes, puis tout cacher et lancer le jeu
    setTimeout(() => {
      overlay.classList.remove('playing');
      callback(); // On exécute la suite
    }, 3000); 
  }
  // ----------------------------------------------------

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
  function liveAdd({ name, hint }) {
    if (!liveList) return;
    const li = document.createElement('li');
    li.textContent = `${name || 'Joueur'} : "${hint || ''}"`;
    li.style.animation = 'fadeIn 0.5s';
    liveList.appendChild(li);
  }
  function liveSet(list) { liveClear(); (list || []).forEach(liveAdd); }

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

  // ————— Socket / cycle de vie —————
  function initSocket() {
    socket.on('roundInfo', ({ word, wordDisplay, isImpostor, domain, round }) => {
      
      // === DÉBUT CINÉMATIQUE ===
      playRoleCinematic(isImpostor, () => {
        // CE CODE S'EXECUTE APRES L'ANIMATION
        
        state.myIsImpostor = !!isImpostor;
        sending = false; locked = false;

        show('screen-hint');
        resetPhaseProgress();
        applyRoleTheme(isImpostor); // Juice Rouge/Bleu

        // Mise à jour textes
        if (ui.theme()) ui.theme().textContent = domain || '—';
        state.roundDomain = domain || '';
        if (ui.role()) {
          ui.role().textContent = isImpostor ? 'IMPOSTEUR' : 'ÉQUIPIER';
          ui.role().style.color = isImpostor ? '#ef4444' : '#a78bfa';
          ui.role().style.fontWeight = '900';
          ui.role().style.textTransform = 'uppercase';
        }

        const tipEl  = ui.tip();
        const wordEl = ui.word();          
        const instr  = ui.instr();
        const chip   = ui.wordChip();
        const chipTxt= ui.wordChipText();

        if (isImpostor) {
          if (tipEl) { 
            tipEl.style.display = 'block';
            tipEl.innerHTML = "🤫 <strong>CHUT !</strong> Tu n’as pas de mot.<br>Espionne les autres et bluffe !"; 
            tipEl.style.background = 'rgba(239, 68, 68, 0.2)';
            tipEl.style.borderColor = '#ef4444';
            tipEl.style.color = '#fca5a5';
          }
          if (wordEl) { wordEl.style.display = 'none'; wordEl.textContent = ''; }
          if (instr)  { instr.style.display = 'none'; }
          if (chip)   { chip.style.display = 'none'; if (chipTxt) chipTxt.textContent = ''; }
        } else {
          if (tipEl)  tipEl.style.display = 'none';
          if (wordEl) { wordEl.style.display = 'none'; }
          if (instr)  { instr.style.display = ''; instr.textContent = "Trouve un indice malin, sans trahir ton mot !"; }
          if (chip)   { chip.style.display = ''; if (chipTxt) chipTxt.textContent = wordDisplay || word || '—'; }
        }

        clearStatus();
        if (ui.input()) { ui.input().value = ''; ui.input().disabled = false; ui.input().focus(); }
        if (ui.send())  ui.send().disabled = false;

        setRound(round);
        $('progress-hints') && ( $('progress-hints').textContent = '0/0' );
        $('progress-vote')  && ( $('progress-vote').textContent  = '0/0' );
        $('timer-vote')     && ( $('timer-vote').textContent     = '00:40' );
        $('timer-reveal')   && ( $('timer-reveal').textContent   = '--:--' );

        if (isImpostor) {
          ensureLiveUI();
          liveBox.style.display = 'block';
          liveClear();
          ui.input()?.insertAdjacentElement('beforebegin', liveBox);
        } else {
          if (liveBox) { liveBox.style.display = 'none'; liveClear(); }
        }
      }); 
      // === FIN DU CALLBACK CINÉMATIQUE ===
    }); // <--- C'EST ICI QU'IL MANQUAIT LA FERMETURE DANS TON TEXTE !

    socket.on('phaseProgress', ({ phase, submitted, total, round }) => {
      if (phase === 'hints') {
        setProgressHints(submitted, total);
        if (typeof round === 'number') setRound(round);
      }
    });

    socket.on('hintAck', () => {
      locked = true; sending = false;
      disableInputs(true);
      const s = ui.status(); if (s) s.textContent = 'Indice envoyé ✅';
    });

    socket.on('hintRejected', ({ reason } = {}) => {
      sending = false; locked = false;
      disableInputs(false);
      showError(reason);
    });

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

    socket.on('timer', ({ phase, leftMs }) => {
      if (phase === 'hints' && leftMs <= 0) {
        locked = true; sending = false;
        disableInputs(true);
      }
      if (phase === 'voting' && liveBox) liveBox.style.display = 'none';
      
      if (phase !== 'hints' && phase !== 'prestart') {
         resetTheme();
      }
    });

    socket.on('hintsList', () => { 
      if (liveBox) liveBox.style.display = 'none'; 
      resetTheme();
    });
  }

  function init() { initUI(); initSocket(); }

  window.HOL.features = window.HOL.features || {};
  window.HOL.features.hints = { init };
})();