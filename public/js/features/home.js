// public/js/features/home.js
// VERSION ULTIME : Polyglotte + Invite Propre + Clic Code 📋🤖

(function () {
  // Sécurité chargement
  if (!window.HOL) console.warn("HOL chargement...");
  const { $, show, socket, state, onEnter } = window.HOL || {};

  // --- 1. Gestion URL ---
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const name = params.get('name');

    if (code && !name) {
      const inputCode = document.getElementById('join-code');
      if (inputCode) inputCode.value = code;

      const btnTabJoin = document.getElementById('tab-join');
      if (btnTabJoin) btnTabJoin.click();

      const inputName = document.getElementById('name-join');
      if (inputName) inputName.focus();

      window.history.replaceState({}, document.title, "/");
    }
  }

  // --- 2. Actions Accueil ---
  function initHomeActions() {
    // Navigation Onglets
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

    // Bouton CRÉER
    const btnCreate = document.getElementById('btn-create');
    if (btnCreate) {
      const newBtn = btnCreate.cloneNode(true);
      btnCreate.parentNode.replaceChild(newBtn, btnCreate);
      
      newBtn.onclick = () => {
        const nameInput = document.getElementById('name-create');
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) return alert('Choisis un pseudo !');
        
        if (window.HOL.audio) window.HOL.audio.play('pop');
        if (window.HOL.socket) window.HOL.socket.emit('createRoom', { name });
      };
      if (window.HOL.onEnter) window.HOL.onEnter('name-create', () => newBtn.click());
    }

    // Bouton REJOINDRE
    const btnJoin = document.getElementById('btn-join');
    if (btnJoin) {
      const newBtnJoin = btnJoin.cloneNode(true);
      btnJoin.parentNode.replaceChild(newBtnJoin, btnJoin);

      newBtnJoin.onclick = () => {
        const name = document.getElementById('name-join').value.trim();
        const code = document.getElementById('join-code').value.trim().toUpperCase();
        
        if (!name || !code) return alert('Pseudo et Code requis !');
        
        if (window.HOL.audio) window.HOL.audio.play('pop');
        
        if (window.HOL.socket) {
            // On envoie tout ce qu'on a pour être sûr que le serveur comprenne
            window.HOL.socket.emit('joinRoom', { 
                name: name, 
                code: code,
                roomId: code
            });
        }
      };

      if (window.HOL.onEnter) {
          window.HOL.onEnter('join-code', () => newBtnJoin.click());
          window.HOL.onEnter('name-join', () => newBtnJoin.click());
      }
    }
  }

  // --- 3. Actions Lobby ---
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
        // Lien propre sans le pseudo de l'hôte
        const inviteUrl = `${window.location.origin}/?code=${state.roomCode}`;
        navigator.clipboard.writeText(inviteUrl)
          .then(() => alert("Lien d'invitation copié ! 🔗"))
          .catch(e => console.error(e));
      };
    }
    
    // Feature : Clic sur le code pour copier (Ajout demandé)
    const codeDisplay = document.getElementById('lobby-code');
    if (codeDisplay) {
        codeDisplay.style.cursor = 'pointer';
        codeDisplay.title = "Cliquer pour copier le code";
        codeDisplay.onclick = () => {
            const code = codeDisplay.textContent;
            if(code) {
                navigator.clipboard.writeText(code)
                    .then(() => alert(`Code ${code} copié !`))
                    .catch(console.error);
            }
        };
    }
  }

  // Entrée dans le lobby (Factorisé)
  function enterLobby(roomData) {
      const realId = roomData.id || roomData.code;
      
      window.HOL.state.room = roomData;
      window.HOL.state.roomCode = realId;
      window.HOL.state.myId = window.HOL.socket.id;

      window.HOL.show('screen-lobby');
      const home = document.getElementById('screen-home');
      if(home) home.style.display = 'none';

      const codeDisplay = document.getElementById('lobby-code');
      if(codeDisplay) codeDisplay.textContent = realId;

      if (roomData.players) {
        updateLobbyUI(roomData);
      } else {
        const myName = document.getElementById('name-create')?.value || 'Moi';
        updateLobbyUI({ players: [{ id: window.HOL.socket.id, name: myName, isHost: true }] });
      }
  }

  function initSocket() {
    const s = window.HOL.socket;
    if(!s) return;

    s.off('roomJoined');
    s.off('roomCreated');

    // Serveur moderne
    s.on('roomJoined', (room) => {
      console.log("✅ Room Joined");
      enterLobby(room);
    });

    // Serveur ancien (Fix Créateur)
    s.on('roomCreated', (data) => {
       console.log("✅ Room Created (Fix Host)");
       enterLobby(data);
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

    // Liste Joueurs + ROBO HASH 🤖
    (room.players || []).forEach(p => {
      const row = document.createElement('div');
      row.className = 'player-item';
      row.style.cssText = 'display:flex;align-items:center;background:rgba(255,255,255,0.05);padding:10px;border-radius:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.05);';
      
      const img = document.createElement('img');
      img.src = `https://robohash.org/${encodeURIComponent(p.name)}.png?set=set1&size=64x64`;
      img.style.cssText = 'width:40px;height:40px;border-radius:50%;margin-right:12px;background:#1a1625;border:2px solid rgba(255,255,255,0.1);';
      
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

  function init() {
    initHomeActions();
    initLobbyActions();
    initSocket();
    setTimeout(checkUrlParams, 100);
  }

  window.HOL.features = window.HOL.features || {};
  window.HOL.features.home = { init };

  // Auto-Démarrage
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
  } else {
      setTimeout(init, 50); 
  }
})();