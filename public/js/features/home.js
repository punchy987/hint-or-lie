// public/js/features/home.js
// VERSION FINALE : Avatars v9 + Auto-Démarrage 🚀

(function () {
  // On récupère les outils du jeu. 
  // Si window.HOL n'existe pas encore, on attend un peu.
  if (!window.HOL) {
      console.warn("HOL pas encore prêt, on retentera l'init plus tard...");
  }
  
  const { $, show, socket, state, onEnter } = window.HOL || {};

  // --- 1. Gestion de l'URL et Auto-Join ---
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const name = params.get('name');

    if (code && !name) {
      const inputCode = document.getElementById('join-code');
      if (inputCode) inputCode.value = code;

      // On bascule sur l'onglet Rejoindre
      const btnTabJoin = document.getElementById('tab-join');
      if (btnTabJoin) btnTabJoin.click();

      const inputName = document.getElementById('name-join');
      if (inputName) inputName.focus();

      window.history.replaceState({}, document.title, "/");
    }
  }

  // --- 2. Initialisation des Actions Accueil ---
  function initHomeActions() {
    // --- NAVIGATION ONGLETS ---
    const btnTabJoin = document.getElementById('tab-join');
    const btnTabCreate = document.getElementById('tab-create');
    const paneJoin = document.getElementById('pane-join');
    const paneCreate = document.getElementById('pane-create');

    if (btnTabJoin && btnTabCreate) {
      btnTabJoin.onclick = () => {
        paneJoin.classList.add('active');
        paneCreate.classList.remove('active');
        btnTabJoin.setAttribute('aria-selected', 'true');
        btnTabCreate.setAttribute('aria-selected', 'false');
      };

      btnTabCreate.onclick = () => {
        paneJoin.classList.remove('active');
        paneCreate.classList.add('active');
        btnTabJoin.setAttribute('aria-selected', 'false');
        btnTabCreate.setAttribute('aria-selected', 'true');
      };
    }

    // --- BOUTON CRÉER ---
    const btnCreate = document.getElementById('btn-create');
    if (btnCreate) {
      // On retire les anciens clics pour être sûr
      const newBtn = btnCreate.cloneNode(true);
      btnCreate.parentNode.replaceChild(newBtn, btnCreate);
      
      newBtn.onclick = () => {
        const nameInput = document.getElementById('name-create');
        const name = nameInput ? nameInput.value.trim() : '';
        
        if (!name) return alert('Choisis un pseudo !');
        
        if (window.HOL.audio) window.HOL.audio.play('pop');
        console.log("🚀 Création demandée pour :", name);
        
        // Sécurité si socket n'est pas encore là
        if (window.HOL.socket) window.HOL.socket.emit('createRoom', { name });
      };
      
      // Touche Entrée
      if (window.HOL.onEnter) window.HOL.onEnter('name-create', () => newBtn.click());
    }

    // --- BOUTON REJOINDRE ---
    const btnJoin = document.getElementById('btn-join');
    if (btnJoin) {
      const newBtnJoin = btnJoin.cloneNode(true);
      btnJoin.parentNode.replaceChild(newBtnJoin, btnJoin);

      newBtnJoin.onclick = () => {
        const name = document.getElementById('name-join').value.trim();
        const code = document.getElementById('join-code').value.trim().toUpperCase();
        
        if (!name || !code) return alert('Pseudo et Code requis !');
        
        if (window.HOL.audio) window.HOL.audio.play('pop');
        if (window.HOL.socket) window.HOL.socket.emit('joinRoom', { name, roomId: code });
      };

      if (window.HOL.onEnter) {
          window.HOL.onEnter('join-code', () => newBtnJoin.click());
          window.HOL.onEnter('name-join', () => newBtnJoin.click());
      }
    }
  }

  // --- 3. Initialisation Lobby (Avatars) ---
  function initLobbyActions() {
    const btnReady = document.getElementById('btn-ready');
    if (btnReady) {
      btnReady.onclick = () => {
        if (window.HOL.audio) window.HOL.audio.play('pop');
        window.HOL.socket.emit('toggleReady');
      };
    }

    const btnInvite = document.getElementById('btn-invite');
    if (btnInvite) {
      btnInvite.onclick = () => {
        const state = window.HOL.state;
        if (!state.roomCode) return;
        const inviteUrl = `${window.location.origin}/?code=${state.roomCode}`;
        navigator.clipboard.writeText(inviteUrl)
          .then(() => alert("Lien copié !"))
          .catch(e => console.error(e));
      };
    }
  }

  function initSocket() {
    const s = window.HOL.socket;
    if(!s) return;

    s.off('roomJoined'); // Évite les doublons
    s.on('roomJoined', (room) => {
      window.HOL.state.room = room;
      window.HOL.state.roomCode = room.id;
      window.HOL.state.myId = s.id;

      window.HOL.show('screen-lobby');
      const home = document.getElementById('screen-home');
      if(home) home.style.display = 'none';

      const codeDisplay = document.getElementById('lobby-code');
      if(codeDisplay) codeDisplay.textContent = room.id;

      updateLobbyUI(room);
    });

    s.on('updatePlayerList', (players) => {
      if (window.HOL.state.room) window.HOL.state.room.players = players;
      updateLobbyUI({ players });
    });
    
    s.on('errorMsg', (msg) => alert(msg));
  }

  function updateLobbyUI(room) {
    const list = document.getElementById('players');
    if (!list) return;
    list.innerHTML = '';

    const actionsRow = document.getElementById('lobby-actions');
    let startBtn = document.getElementById('btn-start');
    const me = (room.players || []).find(p => p.id === window.HOL.socket.id);
    
    // Bouton Start Host
    if (me && me.isHost) {
        if (!startBtn && actionsRow) {
            startBtn = document.createElement('button');
            startBtn.id = 'btn-start';
            startBtn.textContent = 'Démarrer la partie';
            startBtn.style.background = 'linear-gradient(45deg, #8b5cf6, #d946ef)';
            startBtn.onclick = () => window.HOL.socket.emit('startGame');
            actionsRow.insertBefore(startBtn, actionsRow.firstChild);
        }
    } else {
        if (startBtn) startBtn.remove();
    }
    
    const hostBadge = document.getElementById('host-badge');
    if (hostBadge) hostBadge.style.display = (me && me.isHost) ? 'block' : 'none';

    // Liste Joueurs + Avatars v9
    (room.players || []).forEach(p => {
      const row = document.createElement('div');
      row.className = 'player-item';
      row.style.cssText = 'display:flex;align-items:center;background:rgba(255,255,255,0.05);padding:10px;border-radius:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.05);';
      
      const img = document.createElement('img');
      img.src = `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(p.name)}`;
      img.style.cssText = 'width:38px;height:38px;border-radius:50%;margin-right:12px;background:#2a2535;';
      
      // Fallback
      img.onerror = function() { this.src = '/icons/icon-192.png'; this.style.borderRadius = '12px'; };

      const txt = document.createElement('span');
      txt.textContent = p.name + (p.isHost ? ' 👑' : '') + (p.id === window.HOL.socket.id ? ' (Toi)' : '');
      txt.style.fontWeight = '600';

      if (p.isReady) {
        txt.style.color = '#4ade80';
        txt.innerHTML += ' ✓';
        row.style.borderColor = 'rgba(74, 222, 128, 0.3)';
      }

      row.appendChild(img);
      row.appendChild(txt);
      list.appendChild(row);
    });
    
    // Compteurs
    const readyCount = (room.players || []).filter(p => p.isReady).length;
    const totalCount = (room.players || []).length;
    const readyPill = document.getElementById('lobby-ready-pill');
    if (readyPill) readyPill.textContent = `${readyCount}/${totalCount} prêts`;
  }

  // --- LA FONCTION PRINCIPALE ---
  function init() {
    console.log("✅ home.js : Initialisation...");
    initHomeActions();
    initLobbyActions();
    initSocket();
    setTimeout(checkUrlParams, 100);
  }

  window.HOL.features = window.HOL.features || {};
  window.HOL.features.home = { init };

  // --- AUTO-DÉMARRAGE (Le fix !) ---
  // On regarde si la page est chargée. Si oui, on lance init() tout de suite.
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
  } else {
      // Petite pause pour être sûr que main.js a créé window.HOL
      setTimeout(init, 50); 
  }

})();