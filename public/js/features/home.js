// public/js/features/home.js

(function () {
  if (!window.HOL) return;
  const { $, show, socket, state, onEnter } = window.HOL;

  // --- FONCTION AVATAR (DiceBear Bottts v9) ---
  function getAvatar(seed) {
    return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed || 'anonyme')}`;
  }

  function initHomeActions() {
    // Onglets
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
        socket.emit('joinRoom', { name, code, roomId: code });
      };
      onEnter('join-code', () => btnJoin.click());
      onEnter('name-join', () => btnJoin.click());
    }
  }

  function initLobbyActions() {
    // Bouton PRÊT
    $('btn-ready').onclick = () => {
      window.HOL.audio?.play('pop');
      socket.emit('toggleReady');
    };

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

    // --- FIX BOUTON RETOUR À L'ACCUEIL ---
    // Utilise l'ID exact de ton HTML : btn-back-home
    const btnBack = $('btn-back-home');
    if (btnBack) {
        btnBack.onclick = () => {
            window.HOL.audio?.play('pop');
            socket.emit('leaveRoom');
            // Gestion manuelle de l'affichage
            $('screen-lobby').style.display = 'none';
            $('screen-home').style.display = 'block';
            state.room = null;
            state.roomCode = null;
        };
    }
  }

  function updateLobbyUI(room) {
    const list = $('players');
    if (!list) return;
    list.innerHTML = '';

    const actionsRow = $('lobby-actions');
    let startBtn = $('btn-start');
    const me = (room.players || []).find(p => p.id === socket.id);
    
    // Bouton Start (Host)
    if (me && me.isHost) {
        if (!startBtn && actionsRow) {
            startBtn = document.createElement('button');
            startBtn.id = 'btn-start';
            startBtn.textContent = 'Démarrer la partie';
            startBtn.style.background = 'linear-gradient(45deg, #8b5cf6, #d946ef)';
            startBtn.onclick = () => socket.emit('startGame');
            actionsRow.insertBefore(startBtn, actionsRow.firstChild);
        }
    } else if (startBtn) {
        startBtn.remove();
    }
    
    if ($('host-badge')) $('host-badge').style.display = (me && me.isHost) ? 'block' : 'none';

    // Liste des joueurs avec Avatars corrigés
    (room.players || []).forEach(p => {
      const row = document.createElement('div');
      row.className = 'player-item';
      row.style.cssText = 'display:flex;align-items:center;background:rgba(255,255,255,0.05);padding:10px;border-radius:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.05);';
      
      const img = document.createElement('img');
      img.src = getAvatar(p.name);
      img.style.cssText = 'width:40px;height:40px;border-radius:50%;margin-right:12px;background:#b6e3f4;';
      
      const txt = document.createElement('span');
      txt.textContent = p.name + (p.isHost ? ' 👑' : '') + (p.id === socket.id ? ' (Toi)' : '');
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

    const readyCount = (room.players || []).filter(p => p.isReady).length;
    const totalCount = (room.players || []).length;
    if ($('lobby-ready-pill')) $('lobby-ready-pill').textContent = `${readyCount}/${totalCount} prêts`;
  }

  function initSocket() {
    socket.off('roomJoined');
    socket.off('roomCreated');

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
    socket.on('errorMsg', (msg) => alert(msg));
  }

  function init() {
    initHomeActions();
    initLobbyActions();
    initSocket();
    // Check URL params pour auto-join
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) {
        $('join-code').value = params.get('code');
        $('tab-join').click();
    }
  }

  window.HOL.features.home = { init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 50);
})();