// public/js/features/home.js
// Gère l'accueil, le Lobby et les Avatars
// VERSION FIX : DiceBear v9 + Onglets robustes

(function () {
  // On récupère les utilitaires depuis le scope global
  const { $, show, socket, state, onEnter } = window.HOL;

  // --- 1. Gestion de l'URL et Auto-Join ---
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const name = params.get('name');

    // Cas : Lien d'invitation (Code seulement)
    if (code && !name) {
      const inputCode = $('join-code');
      if (inputCode) inputCode.value = code;

      // On simule un clic sur l'onglet Rejoindre pour être sûr d'être sur la bonne vue
      const btnTabJoin = document.getElementById('tab-join');
      if (btnTabJoin) btnTabJoin.click();

      $('name-join')?.focus();

      // Nettoyage de l'URL
      window.history.replaceState({}, document.title, "/");
    }
  }

  // --- 2. Initialisation des Actions Accueil ---
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
        $('name-join')?.focus();
      };

      btnTabCreate.onclick = () => {
        paneJoin.classList.remove('active');
        paneCreate.classList.add('active');
        btnTabJoin.setAttribute('aria-selected', 'false');
        btnTabCreate.setAttribute('aria-selected', 'true');
        $('name-create')?.focus();
      };
    }

    // --- ACTIONS DES BOUTONS ---

    // Bouton CRÉER
    const btnCreate = $('btn-create');
    if (btnCreate) {
      btnCreate.onclick = () => {
        const name = $('name-create').value.trim();
        if (!name) return alert('Choisis un pseudo !');
        
        window.HOL.audio?.play('pop');
        console.log(" Création de salle demandée pour :", name);
        socket.emit('createRoom', { name });
      };
    }

    // Bouton REJOINDRE
    const btnJoin = $('btn-join');
    if (btnJoin) {
      btnJoin.onclick = () => {
        const name = $('name-join').value.trim();
        const code = $('join-code').value.trim().toUpperCase();
        
        if (!name || !code) return alert('Il faut un pseudo et un code !');
        
        window.HOL.audio?.play('pop');
        socket.emit('joinRoom', { name, roomId: code });
      };
    }

    // Touche Entrée
    onEnter('name-create', () => btnCreate?.click());
    onEnter('join-code', () => btnJoin?.click());
    onEnter('name-join', () => btnJoin?.click());
  }

  // --- 3. Initialisation des Actions Lobby ---
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
          // Petit toast manuel si pas de système de toast global
          const toast = $('toast');
          if(toast) {
             toast.textContent = "Lien copié ! 🔗";
             toast.style.display = 'block';
             setTimeout(() => toast.style.display = 'none', 2000);
          } else {
             alert("Lien copié !");
          }
        }).catch(err => console.error(err));
      };
    }
  }

  // --- 4. Socket Events ---
  function initSocket() {
    socket.on('roomJoined', (room) => {
      state.room = room;
      state.roomCode = room.id;
      state.myId = socket.id;

      show('screen-lobby'); 
      // Force le masquage de l'accueil au cas où
      const home = document.getElementById('screen-home');
      if(home) home.style.display = 'none';

      const codeDisplay = $('lobby-code');
      if(codeDisplay) codeDisplay.textContent = room.id;

      updateLobbyUI(room);
    });

    socket.on('updatePlayerList', (players) => {
      if (state.room) state.room.players = players;
      updateLobbyUI({ players });
    });

    socket.on('errorMsg', (msg) => {
      alert(msg);
    });
  }

  // --- 5. UI du Lobby (C'est ici que ça bloquait) ---
  function updateLobbyUI(room) {
    const list = $('players');
    if (!list) return;
    list.innerHTML = '';

    const actionsRow = $('lobby-actions');
    let startBtn = document.getElementById('btn-start');
    
    const me = (room.players || []).find(p => p.id === socket.id);
    
    // Gestion du bouton START (Host uniquement)
    if (me && me.isHost) {
        if (!startBtn && actionsRow) {
            startBtn = document.createElement('button');
            startBtn.id = 'btn-start';
            startBtn.textContent = 'Démarrer la partie';
            // Ajout d'un style inline pour le distinguer
            startBtn.style.background = 'linear-gradient(45deg, #8b5cf6, #d946ef)';
            startBtn.style.border = '2px solid rgba(255,255,255,0.2)';
            
            startBtn.onclick = () => socket.emit('startGame');
            actionsRow.insertBefore(startBtn, actionsRow.firstChild);
        }
    } else {
        if (startBtn) startBtn.remove();
    }
    
    if ($('host-badge')) $('host-badge').style.display = (me && me.isHost) ? 'block' : 'none';

    // Remplissage de la liste des joueurs
    (room.players || []).forEach(p => {
      const row = document.createElement('div');
      row.className = 'player-item';
      // Style directement ici pour éviter les bugs CSS
      row.style.cssText = 'display:flex;align-items:center;background:rgba(255,255,255,0.05);padding:10px;border-radius:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.05);';
      
      // --- FIX AVATAR DICEBEAR v9 ---
      const img = document.createElement('img');
      // On retire le background complexe pour éviter les erreurs d'URL
      // On utilise bottts qui marche bien pour les robots
      img.src = `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(p.name)}`;
      
      // Fallback si Dicebear plante (affiche l'icône du jeu)
      img.onerror = function() { 
          this.src = '/icons/icon-192.png'; 
          this.style.borderRadius = '14px'; // Carré arrondi si c'est le logo
      };

      img.style.cssText = 'width:38px;height:38px;border-radius:50%;margin-right:12px;background:#2a2535;';
      
      const txt = document.createElement('span');
      txt.textContent = p.name + (p.isHost ? ' 👑' : '') + (p.id === socket.id ? ' (Toi)' : '');
      txt.style.fontWeight = '600';
      txt.style.fontSize = '1.05rem';

      if (p.isReady) {
        txt.style.color = '#4ade80'; // Vert
        txt.innerHTML += ' &nbsp;✓';
        row.style.borderColor = 'rgba(74, 222, 128, 0.3)'; // Bordure verte
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

    // Scoreboard Global
    if (window.HOL.updateScoreboard && room.players) {
      window.HOL.updateScoreboard(room.players);
    }
  }

  function init() {
    initHomeActions();
    initLobbyActions();
    initSocket();
    setTimeout(checkUrlParams, 50);
  }

  // Export
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.home = { init };
})();