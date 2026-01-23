// public/js/features/home.js
// Gère l'accueil (Login), le Lobby, et le lien d'invitation propre 🧹
// VERSION CORRIGÉE (IDs Onglets)

(function () {
  const { $, show, socket, state, onEnter } = window.HOL;

  // --- Gestion de l'URL et Auto-Join ---
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const name = params.get('name');

    // Cas 1 : Lien d'invitation (Code seulement)
    if (code && !name) {
      const inputCode = $('join-code'); // ID corrigé pour matcher ton HTML (c'était input-room-code)
      if (inputCode) inputCode.value = code;
      
      show('tab-join'); // On bascule sur l'onglet
      // On met le focus sur le pseudo
      $('name-join')?.focus();
      
      // On nettoie l'URL
      window.history.replaceState({}, document.title, "/");
    }
  }

  function initHomeActions() {
    // Bouton CRÉER
    $('btn-create').onclick = () => {
      const name = $('name-create').value.trim(); // ID HTML = name-create
      if (!name) return alert('Choisis un pseudo !');
      window.HOL.audio?.play('bgm');
      window.HOL.audio?.play('pop');
      socket.emit('createRoom', { name });
    };

    // Bouton REJOINDRE
    $('btn-join').onclick = () => {
      const name = $('name-join').value.trim(); // ID HTML = name-join
      const code = $('join-code').value.trim().toUpperCase(); // ID HTML = join-code
      if (!name || !code) return alert('Remplis tout !');
      window.HOL.audio?.play('bgm');
      window.HOL.audio?.play('pop');
      socket.emit('joinRoom', { name, roomId: code });
    };

    // Support de la touche Entrée
    onEnter('name-create', () => $('btn-create').click());
    onEnter('join-code', () => $('btn-join').click());
    onEnter('name-join', () => $('btn-join').click());

    // --- NAVIGATION ONGLETS (Rejoindre / Créer) ---
    // C'EST ICI QUE C'ETAIT CASSÉ
    const btnTabJoin = document.getElementById('tab-join');     // ID HTML exact
    const btnTabCreate = document.getElementById('tab-create'); // ID HTML exact
    const paneJoin = document.getElementById('pane-join');
    const paneCreate = document.getElementById('pane-create');
    
    if (btnTabJoin && btnTabCreate) {
      btnTabJoin.onclick = () => {
        // Gestion des classes active/inactive
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
      
      navigator.clipboard.writeText(inviteUrl).then(() => {
        window.HOL.toast("Lien copié ! 🔗");
      }).catch(err => {
        console.error(err);
        window.HOL.toast("Erreur copie");
      });
    };

    // Bouton DÉMARRER (Host seulement)
    if ($('btn-start')) { // Sécurité si le bouton n'existe pas encore
        $('btn-start').onclick = () => {
            window.HOL.audio?.play('pop');
            socket.emit('startGame');
        };
    }
  }

  function initSocket() {
    // Confirmation d'entrée dans le salon
    socket.on('roomJoined', (room) => {
      state.room = room;
      state.roomCode = room.id;
      state.myId = socket.id;

      // Mise à jour UI
      show('screen-lobby');
      $('lobby-code').textContent = room.id;
      
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

  // Fonction d'affichage du Lobby
  function updateLobbyUI(room) {
    const list = $('players'); // ID HTML = players (pas players-list)
    if (!list) return;
    list.innerHTML = '';

    // Gestion du bouton START (Host)
    // On doit peut-être l'ajouter dynamiquement s'il n'est pas dans le HTML de base
    const actionsRow = $('lobby-actions');
    let startBtn = document.getElementById('btn-start');
    
    const me = (room.players || []).find(p => p.id === socket.id);
    
    if (me && me.isHost) {
        if (!startBtn && actionsRow) {
            startBtn = document.createElement('button');
            startBtn.id = 'btn-start';
            startBtn.textContent = 'Démarrer la partie';
            startBtn.onclick = () => socket.emit('startGame');
            // Insérer au début des actions
            actionsRow.insertBefore(startBtn, actionsRow.firstChild);
        }
    } else {
        if (startBtn) startBtn.remove();
    }
    
    // Titre "Tu es l'hôte"
    if ($('host-badge')) $('host-badge').style.display = (me && me.isHost) ? 'block' : 'none';


    // Remplissage liste
    (room.players || []).forEach(p => {
      const li = document.createElement('div'); // Div car c'est une liste style grid/flex
      li.className = 'player-item';
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.background = 'rgba(255,255,255,0.05)';
      li.style.padding = '8px';
      li.style.borderRadius = '8px';
      
      // Avatar
      const img = document.createElement('img');
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      img.style.width = '30px'; img.style.height = '30px'; 
      img.style.borderRadius = '50%'; img.style.marginRight = '10px';
      
      const span = document.createElement('span');
      span.textContent = p.name + (p.isHost ? ' 👑' : '') + (p.id === socket.id ? ' (Toi)' : '');
      
      if (p.isReady) {
        span.style.color = '#4ade80'; // Vert
        span.innerHTML += ' ✓';
      }

      li.appendChild(img);
      li.appendChild(span);
      list.appendChild(li);
    });

    // Mise à jour du compteur de prêts
    const readyCount = (room.players || []).filter(p => p.isReady).length;
    const totalCount = (room.players || []).length;
    if ($('lobby-ready-pill')) $('lobby-ready-pill').textContent = `${readyCount}/${totalCount} prêts`;

    // Mise à jour du Scoreboard GLOBAL
    if (window.HOL.updateScoreboard) {
      window.HOL.updateScoreboard(room.players);
    }
  }

  function init() {
    initHomeActions();
    initLobbyActions();
    initSocket();
    checkUrlParams(); 
  }

  window.HOL.features = window.HOL.features || {};
  window.HOL.features.home = { init };
})();