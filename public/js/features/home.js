// public/js/features/home.js

(function () {
  if (!window.HOL) return;
  const { $, show, socket, state, onEnter } = window.HOL;

  // --- FONCTION AVATAR ---
  function getAvatar(seed) {
    return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed || 'anonyme')}`;
  }

  function initHomeActions() {
    const btnTabJoin = $('tab-join');
    const btnTabCreate = $('tab-create');
    const paneJoin = $('pane-join');
    const paneCreate = $('pane-create');

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

    // Bouton CRÉER
    const btnCreate = $('btn-create');
    if (btnCreate) {
      btnCreate.onclick = () => {
        const name = $('name-create').value.trim();
        if (!name) return alert('Choisis un pseudo !');
        window.HOL.audio?.play('pop');
        socket.emit('createRoom', { name });
      };
      onEnter('name-create', () => btnCreate.click());
    }

    // Bouton REJOINDRE
    const btnJoin = $('btn-join');
    if (btnJoin) {
      btnJoin.onclick = () => {
        const name = $('name-join').value.trim();
        const code = $('join-code').value.trim().toUpperCase();
        if (!name || !code) return alert('Pseudo et Code requis !');
        window.HOL.audio?.play('pop');
        socket.emit('joinRoom', { name, code });
      };
      onEnter('join-code', () => btnJoin.click());
      onEnter('name-join', () => btnJoin.click());
    }
  }

  function initLobbyActions() {
    // Bouton PRÊT (Corrigé pour matcher le serveur)
    const btnReady = $('btn-ready');
    if (btnReady) {
      btnReady.onclick = () => {
        window.HOL.audio?.play('pop');
        // On vérifie si on est déjà prêt via une classe ou le texte
        const isCurrentlyReady = btnReady.getAttribute('data-ready') === 'true';
        socket.emit('playerReadyLobby', { ready: !isCurrentlyReady });
        btnReady.setAttribute('data-ready', !isCurrentlyReady);
        btnReady.textContent = isCurrentlyReady ? "Je suis prêt" : "Prêt ! (Annuler)";
      };
    }

    // Bouton INVITER
    $('btn-invite').onclick = () => {
      if (!state.roomCode) return;
      const inviteUrl = `${window.location.origin}/?code=${state.roomCode}`;
      navigator.clipboard.writeText(inviteUrl).then(() => alert("Lien copié ! 🔗"));
    };

    // CLIC SUR LE CODE POUR COPIER
    const codeDisplay = $('lobby-code');
    if (codeDisplay) {
        codeDisplay.style.cursor = 'pointer';
        codeDisplay.onclick = () => {
            navigator.clipboard.writeText(codeDisplay.textContent).then(() => alert("Code copié !"));
        };
    }

    // BOUTON RETOUR (Action leaveRoom + Reload pour purger le cache)
    const btnBack = $('btn-back-home');
    if (btnBack) {
        btnBack.onclick = () => {
            window.HOL.audio?.play('pop');
            socket.emit('leaveRoom');
            window.location.reload(); 
        };
    }
  }

  function updateLobbyUI(room) {
    const list = $('players');
    if (!list) return;
    list.innerHTML = '';

    // Sécurité : transformer l'objet players en tableau si nécessaire
    const playersArray = Array.isArray(room.players) ? room.players : Object.values(room.players || {});
    
    const actionsRow = $('lobby-actions');
    let startBtn = $('btn-start');
    
    // On trouve l'hôte et l'utilisateur actuel
    const me = playersArray.find(p => p.id === socket.id) || room.players[socket.id];
    const isHost = me?.isHost || (room.hostId === socket.id);

    // Bouton Start (Seulement pour l'Host)
    if (isHost) {
        if (!startBtn && actionsRow) {
            startBtn = document.createElement('button');
            startBtn.id = 'btn-start';
            startBtn.textContent = 'Démarrer la partie';
            startBtn.style.background = 'linear-gradient(45deg, #8b5cf6, #d946ef)';
            // CORRECTION : startRound au lieu de startGame
            startBtn.onclick = () => socket.emit('startRound');
            actionsRow.insertBefore(startBtn, actionsRow.firstChild);
        }
    } else if (startBtn) {
        startBtn.remove();
    }
    
    if ($('host-badge')) $('host-badge').style.display = isHost ? 'block' : 'none';

    // Affichage des joueurs
    playersArray.forEach(p => {
      const row = document.createElement('div');
      row.className = 'player-item';
      row.style.cssText = 'display:flex;align-items:center;background:rgba(255,255,255,0.05);padding:10px;border-radius:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.05);';
      
      const img = document.createElement('img');
      img.src = getAvatar(p.name);
      img.style.cssText = 'width:40px;height:40px;border-radius:50%;margin-right:12px;background:#b6e3f4;';
      
      const txt = document.createElement('span');
      // Le serveur utilise isHost et isReady
      const isMe = (p.id === socket.id || p.name === me?.name);
      txt.textContent = p.name + (p.isHost || p.id === room.hostId ? ' 👑' : '') + (isMe ? ' (Toi)' : '');
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

    const readyCount = playersArray.filter(p => p.isReady).length;
    const totalCount = playersArray.length;
    if ($('lobby-ready-pill')) $('lobby-ready-pill').textContent = `${readyCount}/${totalCount} prêts`;
  }

  function initSocket() {
    // On ne fait plus de .off() pour ne pas casser les autres fichiers
    const enter = (data) => {
        const id = data.id || data.code;
        state.room = data;
        state.roomCode = id;
        show('screen-lobby');
        $('screen-home').style.display = 'none';
        $('lobby-code').textContent = id;
        updateLobbyUI(data);
    };

    socket.on('roomJoined', enter);
    socket.on('roomCreated', enter);
    socket.on('updatePlayerList', (players) => {
      if (state.room) state.room.players = players;
      updateLobbyUI({ players });
    });
    
    // Ecouter la progression des prêts envoyée par le serveur
    socket.on('lobbyReadyProgress', ({ ready, total }) => {
        if ($('lobby-ready-pill')) $('lobby-ready-pill').textContent = `${ready}/${total} prêts`;
    });

    socket.on('errorMsg', (msg) => alert(msg));
  }

  function init() {
    initHomeActions();
    initLobbyActions();
    initSocket();
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) {
        $('join-code').value = params.get('code');
        $('tab-join').click();
    }
  }

  // Export pour main.js
  window.HOL.features.home = { init, updateLobbyUI };
})();