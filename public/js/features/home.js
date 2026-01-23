// public/js/features/home.js
// Gère l'accueil (Login), le Lobby, et le lien d'invitation propre 🧹

(function () {
  const { $, show, socket, state, onEnter } = window.HOL;

  // --- Gestion de l'URL et Auto-Join ---
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const name = params.get('name');

    // Cas 1 : Lien d'invitation (Code seulement)
    if (code && !name) {
      // On pré-remplit le code
      const inputCode = $('input-room-code');
      if (inputCode) inputCode.value = code;
      
      // On bascule sur l'onglet "Rejoindre"
      show('tab-join'); // Assure-toi que ton CSS gère l'affichage des onglets
      
      // On met le curseur sur le Pseudo pour qu'il tape direct
      $('input-pseudo-join')?.focus();
      
      // On nettoie l'URL pour faire propre
      window.history.replaceState({}, document.title, "/");
    }
    
    // Cas 2 : Rechargement de page en pleine partie (Code + Nom)
    // (Optionnel : tu peux le garder si tu veux que F5 reconnecte le joueur)
    else if (code && name) {
      // Là on peut tenter une reconnexion auto si tu le souhaites
      // Mais pour la sécurité, mieux vaut laisser l'utilisateur revalider
      $('input-room-code').value = code;
      $('input-pseudo-join').value = name;
      show('tab-join');
    }
  }

  function initHomeActions() {
    // Bouton CRÉER
    $('btn-create').onclick = () => {
      const name = $('input-pseudo-create').value.trim();
      if (!name) return alert('Choisis un pseudo !');
      window.HOL.audio?.play('bgm'); // Musique (si activée)
      window.HOL.audio?.play('pop');
      socket.emit('createRoom', { name });
    };

    // Bouton REJOINDRE
    $('btn-join').onclick = () => {
      const name = $('input-pseudo-join').value.trim();
      const code = $('input-room-code').value.trim().toUpperCase();
      if (!name || !code) return alert('Remplis tout !');
      window.HOL.audio?.play('bgm');
      window.HOL.audio?.play('pop');
      socket.emit('joinRoom', { name, roomId: code });
    };

    // Support de la touche Entrée
    onEnter('input-pseudo-create', () => $('btn-create').click());
    onEnter('input-room-code', () => $('btn-join').click());
    onEnter('input-pseudo-join', () => $('btn-join').click());

    // --- NAVIGATION ONGLETS (Rejoindre / Créer) ---
    // Simple logique pour basculer les formulaires
    const btnTabJoin = document.getElementById('tab-btn-join');
    const btnTabCreate = document.getElementById('tab-btn-create');
    
    if (btnTabJoin && btnTabCreate) {
      btnTabJoin.onclick = () => {
        show('tab-join');
        btnTabJoin.setAttribute('aria-selected', 'true');
        btnTabCreate.setAttribute('aria-selected', 'false');
      };
      btnTabCreate.onclick = () => {
        show('tab-create');
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

    // Bouton INVITER (CORRIGÉ 🔗)
    $('btn-invite').onclick = () => {
      if (!state.roomCode) return;
      
      // On construit un lien PROPRE : juste l'origine + le code
      // Exemple : https://mon-jeu.com/?code=ABCD
      const inviteUrl = `${window.location.origin}/?code=${state.roomCode}`;
      
      navigator.clipboard.writeText(inviteUrl).then(() => {
        window.HOL.toast("Lien copié ! 🔗");
      }).catch(err => {
        console.error(err);
        window.HOL.toast("Erreur copie");
      });
    };

    // Bouton DÉMARRER (Host seulement)
    $('btn-start').onclick = () => {
      window.HOL.audio?.play('pop');
      socket.emit('startGame');
    };
  }

  function initSocket() {
    // Confirmation d'entrée dans le salon
    socket.on('roomJoined', (room) => {
      state.room = room;
      state.roomCode = room.id;
      state.myId = socket.id;

      // Mise à jour UI
      show('screen-lobby');
      $('lobby-room-code').textContent = room.id;
      
      // Si on veut mettre le code dans l'URL pour le rechargement (F5), on peut :
      // const myName = room.players.find(p => p.id === socket.id)?.name;
      // window.history.replaceState({}, '', `/?code=${room.id}&name=${myName}`);
      
      updateLobbyUI(room);
    });

    // Mise à jour de la liste des joueurs
    socket.on('updatePlayerList', (players) => {
      if (state.room) state.room.players = players;
      updateLobbyUI({ players });
    });

    // Erreurs
    socket.on('errorMsg', (msg) => {
      alert(msg); // Ou un toast plus joli
    });
  }

  // Fonction d'affichage du Lobby
  function updateLobbyUI(room) {
    const list = $('players-list');
    if (!list) return;
    list.innerHTML = '';

    const me = (room.players || []).find(p => p.id === socket.id);
    // Gestion bouton Start
    if (me && me.isHost) $('admin-controls').style.display = 'block';
    else $('admin-controls').style.display = 'none';

    // Remplissage liste
    (room.players || []).forEach(p => {
      const li = document.createElement('li');
      li.className = 'player-item';
      
      // Avatar
      const img = document.createElement('img');
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${p.name}`;
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

    // Mise à jour du Scoreboard GLOBAL (pour qu'il s'affiche partout)
    if (window.HOL.updateScoreboard) {
      window.HOL.updateScoreboard(room.players);
    }
  }

  function init() {
    initHomeActions();
    initLobbyActions();
    initSocket();
    checkUrlParams(); // On vérifie l'URL au chargement
  }

  window.HOL.features = window.HOL.features || {};
  window.HOL.features.home = { init };
})();