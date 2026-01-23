// public/js/features/home.js
// Accueil / Lobby / Navigation de base + AVATARS
(function () {
  const { $, el, onEnter, show, toast, getDeviceId, state, updateScoreboard, socket } = window.HOL;

  // --- NOUVEAU : Gestion des Avatars ---
  function updateAvatarPreview(name) {
    const seed = (name || '').trim() || 'default';
    // On utilise l'API DiceBear "Bottts" (Robots)
    const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
    
    // On met à jour l'image d'avatar sur l'accueil
    const img = $('avatar-preview-img');
    if (img) img.src = url;
  }

  // --- FIN NOUVEAU ---

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
      
      const input = isJoin ? $('name-join') : $('name-create');
      input?.focus();
      updateAvatarPreview(input?.value); // Met à jour l'avatar quand on change d'onglet
    }

    tabs.join?.addEventListener('click', () => activateTab('join'));
    tabs.create?.addEventListener('click', () => activateTab('create'));
    // filtre du code (4 chiffres)
    $('join-code')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });

    // --- NOUVEAU : Écouteur de frappe pour l'avatar ---
    ['name-join', 'name-create'].forEach(id => {
      const input = $(id);
      if (input) {
        input.addEventListener('input', (e) => updateAvatarPreview(e.target.value));
      }
    });
  }

  function initHomeActions() {
    // --- Injection de l'élément HTML Avatar ---
    // On ajoute l'image juste au-dessus des onglets si elle n'existe pas
    if (!$('avatar-preview-box')) {
      const hero = document.querySelector('.hero');
      if (hero) {
        const box = document.createElement('div');
        box.id = 'avatar-preview-box';
        box.style.cssText = 'display:flex;justify-content:center;margin-bottom:15px;';
        box.innerHTML = `<img id="avatar-preview-img" src="https://api.dicebear.com/7.x/bottts/svg?seed=Joueur" style="width:80px;height:80px;border-radius:50%;background:#2a2535;border:3px solid #8b5cf6;padding:5px;transition:transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);" />`;
        hero.parentNode.insertBefore(box, hero.nextSibling); // Insère après le titre
      }
    }
    // ------------------------------------------

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
      if (hb) hb.style.display = (window.HOL.state.me.id === hostId) ? 'inline-block' : 'none';
    });
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
          try { await navigator.clipboard.writeText((codeSpan.textContent || '').trim()); HOL.toast('Code copié 📋'); }
          catch { HOL.toast('Copie impossible'); }
        });
      }
    }

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

    // --- MODIFICATION : Affichage liste joueurs avec AVATARS ---
    s.on('roomUpdate', (snap) => {
      state.room = snap;
      $('round-num').textContent = snap.round;
      const list = $('players');
      if (list) {
        list.innerHTML = ''; // Vide la liste
        list.style.display = 'grid'; // S'assure qu'on est en grid
        list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))'; // Grille responsive
        list.style.gap = '10px';

        snap.players.forEach(p => {
          // Création de la carte joueur
          const card = document.createElement('div');
          card.style.cssText = 'background:rgba(255,255,255,0.05);border-radius:10px;padding:10px;text-align:center;display:flex;flex-direction:column;align-items:center;border:1px solid rgba(255,255,255,0.1);';
          
          // L'avatar
          const seed = (p.name || '').trim() || 'default';
          const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
          
          const img = document.createElement('img');
          img.src = avatarUrl;
          img.style.cssText = 'width:50px;height:50px;border-radius:50%;margin-bottom:6px;';
          
          // Le nom
          const span = document.createElement('div');
          span.textContent = p.name;
          span.style.cssText = 'font-weight:bold;font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;';

          // Indicateur "Prêt" (optionnel, selon ton state)
          // Si tu veux, on pourra ajouter une petite pastille verte ici

          card.appendChild(img);
          card.appendChild(span);
          list.appendChild(card);
        });
      }
// On force l'appel à la version globale
if (window.HOL.updateScoreboard) {
   window.HOL.updateScoreboard(snap.players);
}    });
    // --- FIN MODIF ---

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

      // Met à jour l'avatar si on arrive depuis une URL
      if (nameInput) updateAvatarPreview(nameInput.value);

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