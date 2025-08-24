// public/js/features/home.js
// Accueil / Lobby / Navigation de base
(function () {
  const { $, el, onEnter, show, toast, getDeviceId, state, updateScoreboard, socket } = window.HOL;

  // Onglets Rejoindre / Créer
  function initTabs() {
    const tabs = { join: $('tab-join'), create: $('tab-create') };
    const panes = { join: $('pane-join'), create: $('pane-create') };

    function activateTab(which) {
      const isJoin = which === 'join';
      tabs.join?.setAttribute('aria-selected', isJoin ? 'true' : 'false');
      tabs.create?.setAttribute('aria-selected', isJoin ? 'false' : 'true');
      panes.join?.classList.toggle('active', isJoin);
      panes.create?.classList.toggle('active', !isJoin);
      (isJoin ? $('name-join') : $('name-create'))?.focus();
    }

    tabs.join?.addEventListener('click', () => activateTab('join'));
    tabs.create?.addEventListener('click', () => activateTab('create'));
    // filtre du code (4 chiffres)
    $('join-code')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
  }

  function initHomeActions() {
    $('btn-join').onclick = () => {
      const name = $('name-join')?.value.trim() || 'Joueur';
      const code = ($('join-code')?.value.trim() || '').replace(/\D/g, '').slice(0, 4);
      if (code.length !== 4) { toast('Code à 4 chiffres requis.'); return; }
      const deviceId = getDeviceId();

      console.log('[emit] hello', { deviceId, pseudo: name });
      socket.emit('hello', { deviceId, pseudo: name, name });

      console.log('[emit] joinRoom', { code, pseudo: name, deviceId });
      socket.emit('joinRoom', { code, pseudo: name, name, deviceId });

      setTimeout(() => {
        if (!window.HOL?.state?.me?.code) toast('Pas de réponse du serveur pour “Rejoindre”. Vérifie la connexion.');
      }, 2000);
    };

    $('btn-create').onclick = () => {
      const name = $('name-create')?.value.trim() || 'Joueur';
      const deviceId = getDeviceId();

      console.log('[emit] hello', { deviceId, pseudo: name });
      socket.emit('hello', { deviceId, pseudo: name, name });

      console.log('[emit] createRoom', { pseudo: name, name, deviceId });
      socket.emit('createRoom', { pseudo: name, name, deviceId });

      setTimeout(() => {
        if (!window.HOL?.state?.me?.code) toast('Pas de réponse du serveur pour “Créer une salle”.');
      }, 2000);
    };

    // Règles
    $('btn-how')?.addEventListener('click', () => {
      const panel = $('how');
      const visible = panel.style.display !== 'none';
      panel.style.display = visible ? 'none' : 'block';
      $('btn-how').textContent = visible ? 'Règles rapides' : 'Masquer les règles';
    });
$('btn-ready')?.addEventListener('click', () => {
  const roomState = window.HOL?.state?.room?.state;

  // Si on est en RÉSULTATS, on branche sur le même flux que "Manche suivante"
  if (roomState === 'reveal') {
    socket.emit('playerReadyNext');
    const br = $('btn-ready');
    if (br) { br.textContent = 'Prêt ✓'; br.disabled = true; }
    return;
  }

  // Sinon, comportement normal du lobby
  state.myLobbyReady = !state.myLobbyReady;
  $('btn-ready').textContent = state.myLobbyReady ? 'Annuler prêt' : 'Je suis prêt';
  socket.emit('playerReadyLobby', { ready: state.myLobbyReady });
});

    $('btn-back-home')?.addEventListener('click', () => {
      socket.emit('leaveRoom');
      state.myLobbyReady = false;
      const br = $('btn-ready'); if (br) br.textContent = 'Je suis prêt';
      show('screen-home');
    });

    onEnter('name-join', () => $('btn-join')?.click());
    onEnter('join-code', () => $('btn-join')?.click());
    onEnter('name-create', () => $('btn-create')?.click());
  }

  function initSocketRoom() {
    const s = socket;
    // message système (toast)
    s.on('system', ({ text }) => toast(text));
    s.on('host-changed', ({ hostId }) => {
  // Si tu as un badge "👑", l’afficher seulement si c’est moi le nouvel hôte
  const hb = $('host-badge');
  if (hb) hb.style.display = (window.HOL.state.me.id === hostId) ? 'inline-block' : 'none';});
    s.on('connect', () => {
      s.emit('getLeaderboard');
      state.me.id = s.id;
      console.log('socket connected', s.id);
    });
    const codeSpan = HOL.$('lobby-code');
    if (codeSpan && !codeSpan._wired) {
    codeSpan._wired = true;
    const pill = codeSpan.parentElement;
    if (pill) {
    pill.style.cursor = 'pointer';
    pill.title = 'Copier le code';
    pill.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText((codeSpan.textContent||'').trim()); HOL.toast('Code copié 📋'); }
      catch { HOL.toast('Copie impossible'); }
    });
  }
}

    // Debug global des events reçus (fix: plus de ".args")
    if (s.onAny) {
      s.onAny((event, ...args) => console.log('⟵', event, ...args));
    }

    const onCreated = ({ code }) => {
      state.me.code = code;
      $('lobby-code').textContent = code;
      show('screen-lobby');
      const hb = $('host-badge'); if (hb) hb.style.display = 'inline-block';
      state.myLobbyReady = false;
      const br = $('btn-ready'); if (br) br.textContent = 'Je suis prêt';
      const tl = $('timer-lobby'); if (tl) tl.style.display = 'none';
      console.log('[ui] entered lobby as host', { code });
    };
    s.on('roomCreated', onCreated);
    s.on('createdRoom', onCreated);
    s.on('room:create:ok', onCreated);

    const onJoined = ({ code }) => {
      state.me.code = code;
      $('lobby-code').textContent = code;
      show('screen-lobby');
      state.myLobbyReady = false;
      const br = $('btn-ready'); if (br) br.textContent = 'Je suis prêt';
      const tl = $('timer-lobby'); if (tl) tl.style.display = 'none';
      console.log('[ui] entered lobby as guest', { code });
    };
    s.on('roomJoined', onJoined);
    s.on('joinedRoom', onJoined);
    s.on('room:join:ok', onJoined);

    s.on('roomError', ({ message }) => toast(message || 'Erreur de salle.'));
    s.on('errorMsg', (m) => toast(m));

    s.on('roomUpdate', (snap) => {
      state.room = snap;
      $('round-num').textContent = snap.round;
      const list = $('players'); if (list) { list.innerHTML = ''; }
      snap.players.forEach(p => {
        const a = document.createElement('div');
        a.textContent = p.name;
        list.appendChild(a);
      });
      updateScoreboard(snap.players);
    });

    s.on('lobbyReadyProgress', ({ ready, total }) => {
      const pillLobby = $('lobby-ready-pill');
      if (pillLobby) pillLobby.textContent = `${ready}/${total} prêts`;
      const pillResult = $('progress-ready');
      if (pillResult) pillResult.textContent = `${ready}/${total} prêts`;
    });

    s.on('lobbyCountdownStarted', ({ seconds }) => {
      const el = $('timer-lobby');
      if (el) { el.style.display = 'inline-block'; el.textContent = `00:${String(seconds).padStart(2, '0')}`; }
    });

    s.on('lobbyCountdownCancelled', () => {
      const el = $('timer-lobby'); if (el) el.style.display = 'none';
    });
  }

  function initGlobalEnter() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const ae = document.activeElement;
      const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
      if (typing) return;

      const screen = document.body.getAttribute('data-screen');
      if (screen === 'screen-lobby') $('btn-ready')?.click();
      else if (screen === 'screen-result') { const b = $('btn-next'); if (b && b.style.display !== 'none' && !b.disabled) b.click(); }
      else if (screen === 'screen-home') {
        const joinPaneActive = $('pane-join')?.classList.contains('active');
        const primary = joinPaneActive ? $('btn-join') : $('btn-create'); primary?.click();
      } else if (screen === 'screen-vote') {
        const btn = document.querySelector('#vote-buttons button:not(:disabled)');
        if (btn) btn.click();
      }
    });
  }

  function init() {
    initTabs();
    initHomeActions();
    initSocketRoom();
    initGlobalEnter();
  }

  window.HOL.features = window.HOL.features || {};
  window.HOL.features.home = { init };
  
  (function () {
  const { $, socket, state } = window.HOL;

  function wireInviteButton() {
    const btn = $('btn-invite');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const code = state.room?.code || ($('#lobby-code')?.textContent || '').trim();
      const name = state.me?.name || ($('#name-create')?.value || $('#name-join')?.value || '');
      if (!code) return window.HOL.toast('Code de salle introuvable');
      window.HOL.shareInviteLink({ code, name });
    });
  }

  function autoJoinFromURL() {
    const q = new URLSearchParams(location.search);
    const code = q.get('code');
    const n = q.get('n');
    if (!code) return;

    // Bascule onglet "Rejoindre"
    $('#tab-join')?.click();

    const codeInput = $('join-code');
    const nameInput = $('name-join');
    if (codeInput) codeInput.value = code;
    if (nameInput && n) nameInput.value = n.slice(0, 16);

    // Rejoindre direct si pseudo présent
    if (codeInput?.value && (nameInput?.value || $('#name-create')?.value)) {
      socket.emit('joinRoom', { code: codeInput.value, name: nameInput?.value });
    }
  }

  // Décorer l'init existant
  const origInit = window.HOL.features.home.init;
  window.HOL.features.home.init = function () {
    origInit();
    wireInviteButton();
    autoJoinFromURL();
  };
})();

})();
