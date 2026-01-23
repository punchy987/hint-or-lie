// public/js/features/home.js
// VERSION DEBUG : "Sherlock Holmes" 🕵️‍♂️

(function () {
  console.log("🕵️‍♂️ [DEBUG] home.js : Le fichier est lu par le navigateur.");

  // Vérification de sécurité : est-ce que window.HOL existe ?
  if (!window.HOL) {
    console.error("⛔ [FATAL] window.HOL n'existe pas ! L'ordre des scripts est incorrect.");
    return;
  }

  const { $, show, socket, state, onEnter } = window.HOL;

  function init() {
    console.log("🕵️‍♂️ [DEBUG] init() : La fonction d'initialisation a été appelée.");

    // --- TEST DU BOUTON CRÉER ---
    const btnCreate = document.getElementById('btn-create'); // On utilise le JS natif pour être sûr
    
    if (btnCreate) {
      console.log("✅ [DEBUG] Bouton 'btn-create' TROUVÉ dans le HTML.");
      
      // On retire les anciens écouteurs pour éviter les doublons (juste au cas où)
      const newBtn = btnCreate.cloneNode(true);
      btnCreate.parentNode.replaceChild(newBtn, btnCreate);

      newBtn.onclick = function() {
        console.log("🖱️ [CLICK] Click détecté sur le bouton Créer !");
        const name = document.getElementById('name-create').value.trim();
        console.log("📝 [CLICK] Pseudo récupéré :", name);
        
        if (!name) return alert('Choisis un pseudo !');
        
        if (window.HOL.audio) window.HOL.audio.play('pop');
        console.log("🚀 [SOCKET] Envoi de 'createRoom'...");
        socket.emit('createRoom', { name });
      };
    } else {
      console.error("❌ [ERREUR] Le bouton 'btn-create' est INTROUVABLE dans le DOM au moment du chargement.");
    }

    // --- TEST DU BOUTON REJOINDRE ---
    const btnJoin = document.getElementById('btn-join');
    if (btnJoin) {
        btnJoin.onclick = () => {
            const name = document.getElementById('name-join').value.trim();
            const code = document.getElementById('join-code').value.trim().toUpperCase();
            if (!name || !code) return alert('Remplis tout !');
            socket.emit('joinRoom', { name, roomId: code });
        };
    }

    // --- TEST DES ONGLETS ---
    const btnTabJoin = document.getElementById('tab-join');
    const btnTabCreate = document.getElementById('tab-create');
    
    if (btnTabJoin && btnTabCreate) {
        console.log("✅ [DEBUG] Onglets trouvés.");
        btnTabJoin.onclick = () => {
            document.getElementById('pane-join').classList.add('active');
            document.getElementById('pane-create').classList.remove('active');
            btnTabJoin.setAttribute('aria-selected', 'true');
            btnTabCreate.setAttribute('aria-selected', 'false');
        };
        btnTabCreate.onclick = () => {
            document.getElementById('pane-join').classList.remove('active');
            document.getElementById('pane-create').classList.add('active');
            btnTabJoin.setAttribute('aria-selected', 'false');
            btnTabCreate.setAttribute('aria-selected', 'true');
        };
    }

    initSocketListeners();
  }

  function initSocketListeners() {
    socket.off('roomJoined'); // Nettoyage préventif
    socket.on('roomJoined', (room) => {
      console.log("📡 [SOCKET] roomJoined reçu !", room);
      state.room = room;
      state.roomCode = room.id;
      
      show('screen-lobby');
      const home = document.getElementById('screen-home');
      if(home) home.style.display = 'none';
      
      if(document.getElementById('lobby-code')) document.getElementById('lobby-code').textContent = room.id;
      updateLobbyUI(room);
    });
    
    socket.on('updatePlayerList', (players) => {
      if (state.room) state.room.players = players;
      updateLobbyUI({ players });
    });
  }

  function updateLobbyUI(room) {
    // Code des avatars (copié de la version précédente)
    const list = document.getElementById('players');
    if (!list) return;
    list.innerHTML = '';
    
    (room.players || []).forEach(p => {
        const row = document.createElement('div');
        row.className = 'player-item';
        row.style.cssText = 'display:flex;align-items:center;background:rgba(255,255,255,0.05);padding:10px;border-radius:12px;margin-bottom:8px;';
        
        const img = document.createElement('img');
        img.src = `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(p.name)}`;
        img.style.cssText = 'width:32px;height:32px;border-radius:50%;margin-right:12px;background:#222;';
        
        const txt = document.createElement('span');
        txt.textContent = p.name;
        
        row.appendChild(img);
        row.appendChild(txt);
        list.appendChild(row);
    });
  }

  // EXPORT
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.home = { init };
})();