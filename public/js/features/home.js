// public/js/features/home.js
// Gère l'accueil, le Lobby et les Avatars
// VERSION FIX : DiceBear v9 + Gestion Onglets propre

(function () {
  const { $, show, socket, state, onEnter } = window.HOL;

  // --- Gestion de l'URL et Auto-Join ---
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const name = params.get('name');

    // Cas : Lien d'invitation (Code seulement)
    if (code && !name) {
      const inputCode = $('join-code');
      if (inputCode) inputCode.value = code;

      // FIX: On simule un clic sur l'onglet Rejoindre pour afficher le bon panneau
      const btnTabJoin = document.getElementById('tab-join');
      if (btnTabJoin) btnTabJoin.click();

      // On met le focus sur le pseudo
      $('name-join')?.focus();

      // On nettoie l'URL pour faire propre
      window.history.replaceState({}, document.title, "/");
    }
  }

  function initHomeActions() {
    // --- NAVIGATION ONGLETS (Rejoindre / Créer) ---
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
        // Focus intelligent
        $('name-join')?.focus();
      };

      btnTabCreate.onclick = () => {
        paneJoin.classList.remove('active');
        paneCreate.classList.add('active');
        btnTabJoin.setAttribute('aria-selected', 'false');
        btnTabCreate.setAttribute('aria-selected', 'true');
        // Focus intelligent
        $('name-create')?.focus();
      };
    }

    // --- ACTIONS DES BOUTONS ---

    // 1. Bouton CRÉER
    const btnCreate = $('btn-create');
    if (btnCreate) {
      btnCreate.onclick = () => {
        const name = $('name-create').value.trim();
        if (!name) return alert('Choisis un pseudo !');
        
        // Petit feedback sonore
        window.HOL.audio?.play('pop');
        
        console.log("Envoi demande création salle pour :", name); // Debug
        socket.emit('createRoom', { name });
      };
    }

    // 2. Bouton REJOINDRE
    const btnJoin = $('btn-join');
    if (btnJoin) {
      btnJoin.onclick = () => {
        const name = $('name-join').value.trim();
        const code = $('join-code').value.trim().toUpperCase();
        
        if (!name || !code) return alert('Remplis le pseudo et le code !');
        
        window.HOL.audio?.play('pop');
        socket.emit('joinRoom', { name, roomId: code });
      };
    }

    // Support de la touche Entrée (Validation rapide)
    onEnter('name-create', () => btnCreate?.click());
    onEnter('join-code', () => btnJoin?.click());
    onEnter('name-join', () => btnJoin?.click());
  }

  function initLobbyActions() {
    // Bouton PRÊT
    const btnReady = $('btn-ready');
    if (btnReady) {
      btnReady.onclick = () => {
        window.HOL.audio?.play('pop');
        socket.emit('toggleReady');
      };
    }

    // Bouton INVITER
    const btnInvite = $('btn-invite');
    if (btnInvite) {
      btnInvite.onclick = () => {
        if (!state.roomCode) return;
        const inviteUrl = `${window.location.origin}/?code=${state.roomCode}`;
        
        navigator.clipboard.writeText(inviteUrl).then(() => {
          // On suppose que tu as une fonction toast
          const toast = $('toast');
          if(toast) {
             toast.textContent = "Lien copié ! 🔗";
             toast.style.display = 'block';
             setTimeout(() => toast.style.display = 'none', 2000);
          }
        }).catch(err => console.error(err));
      };
    }
  }

  function initSocket() {
    // Confirmation d'entrée dans le salon
    socket.on('roomJoined', (room) => {
      state.room = room;
      state.roomCode = room.id;
      state.myId = socket.id;

      // On cache l'accueil, on affiche le lobby
      show('screen-lobby'); 
      // Si tu as une fonction hide(), utilise-la pour screen-home, 
      // sinon on le fait à la main ici pour être sûr :
      const home = document.getElementById('screen-home');
      if(home) home.style.display = 'none';

      const codeDisplay = $('lobby-code');
      if(codeDisplay) codeDisplay.textContent = room.id;

      updateLobbyUI(room);
    });

    // Mise à jour de la liste des joueurs
    socket.on('updatePlayerList', (players) => {
      if (state.room) state.room.players = players;
      updateLobbyUI({ players });
    });

    // Erreurs
    socket.on('errorMsg', (msg) => {
      alert(msg);
    });
  }

  // --- UI DU LOBBY (AVEC FIX AVATAR) ---
  function updateLobbyUI(room) {
    const list = $('players');
    if (!list) return;
    list.innerHTML = '';

    const actionsRow = $('lobby-actions');
    let startBtn = document.getElementById('btn-start');
    
    const me = (room.players || []).find(p => p.id === socket.id);
    
    // Gestion Bouton START (Host uniquement)
    if (me && me.isHost) {
        if (!startBtn && actionsRow) {
            startBtn = document.createElement('button');
            startBtn.id = 'btn-start';
            startBtn.textContent = 'Démarrer la partie';
            startBtn.className = 'btn-primary'; // Style
            startBtn.onclick = () => socket.emit('startGame');
            actionsRow.insertBefore(startBtn, actionsRow.firstChild);
        }
    } else {
        if (startBtn) startBtn.remove();
    }
    
    if ($('host-badge')) $('host-badge').style.display = (me && me.isHost) ? 'block' : 'none';

    // Remplissage liste des joueurs
    (room.players || []).forEach(p => {
      const row = document.createElement('div');
      row.className = 'player-item';
      row.style.cssText = 'display:flex;align-items:center;background:rgba(255,255,255,0.05);padding:8px;border-radius:8px;';
      
      // --- FIX AVATAR DICEBEAR v9 ---
      const img = document.createElement('img');
      // On utilise v9, collection "bottts", et on encode bien le seed
      // Note: backgroundColor s'attend à un tableau ou virgules sans dièse
      img.src = `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      
      img.style.cssText = 'width:32px;height:32px;border-radius:50%;margin-right:12px;border:2px solid rgba(255,255,255,0.2);';
      
      const txt = document.createElement('span');
      txt.textContent = p.name + (p.isHost ? ' 👑' : '') + (p.id === socket.id ? ' (Toi)' : '');
      txt.style.fontWeight = '500';

      if (p.isReady) {
        txt.style.color = '#4ade80'; // Vert
        txt.innerHTML += ' &nbsp;✓';
      }

      row.appendChild(img);
      row.appendChild(txt);
      list.appendChild(row);
    });

    // Compteurs
    const readyCount = (room.players || []).filter(p => p.isReady).length;
    const totalCount = (room.players || []).length;
    if ($('lobby-ready-pill')) $('lobby-ready-pill').textContent = `${readyCount}/${totalCount} prêts`;
    if ($('round-num')) $('round-num').textContent = room.round || 0;

    // Mise à jour Scoreboard Global (si existant)
    if (window.HOL.updateScoreboard && room.players) {
      window.HOL.updateScoreboard(room.players);
    }
  }

  function init() {
    initHomeActions();
    initLobbyActions();
    initSocket();
    // On check l'URL à la fin pour être sûr que tout le DOM est prêt
    setTimeout(checkUrlParams, 50);
  }

  window.HOL.features = window.HOL.features || {};
  window.HOL.features.home = { init };
})();