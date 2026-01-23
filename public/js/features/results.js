// public/js/features/results.js
// Phase "Résultat" : Avatar Imposteur + CONFETTIS 🎉

(function () {
  const { $, el, show, socket, state, toast } = window.HOL;

  // --- FONCTION CONFETTIS ---
  function triggerConfetti() {
    if (!window.confetti) return;
    
    // Un tir canon depuis la gauche
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.1, y: 0.6 },
      colors: ['#8b5cf6', '#ef4444', '#ffffff'] // Violet, Rouge, Blanc
    });
    // Un tir canon depuis la droite
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.9, y: 0.6 },
      colors: ['#8b5cf6', '#ef4444', '#ffffff']
    });
  }
  // --------------------------

  function initUI() {
    $('btn-next').onclick = () => {
      $('btn-next').disabled = true;
      $('btn-next').textContent = 'Prêt ✓';
      socket.emit('playerReadyNext');
    };
    $('btn-modal-lobby').onclick = () => { show('screen-lobby'); $('modal').style.display = 'none'; };
  }

  function initSocket() {
    socket.on('roundResult', (res) => {
      show('screen-result');

      $('res-domain').textContent = res.domain || '?';
      $('res-common').textContent = res.common || '';

      if ($('res-imp')) $('res-imp').textContent = '—';

      // AVATAR DE L'IMPOSTEUR
      const impName = res.impostorName || '(?)';
      const impContainer = $('res-imp-name');
      impContainer.innerHTML = '';
      impContainer.style.display = 'flex';
      impContainer.style.flexDirection = 'column';
      impContainer.style.alignItems = 'center';
      impContainer.style.gap = '10px';

      const img = document.createElement('img');
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(impName)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      img.style.width = '80px';
      img.style.height = '80px';
      img.style.borderRadius = '50%';
      img.style.border = '4px solid #ef4444';
      img.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.5)';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = impName;
      nameSpan.style.fontSize = '1.5rem';
      nameSpan.style.fontWeight = 'bold';
      nameSpan.style.color = '#ef4444';

      impContainer.appendChild(img);
      impContainer.appendChild(nameSpan);

      const lie = res.impostorHint || '—';
      const lieEl = $('res-imp-lie') || $('res-imp-word');
      if (lieEl) lieEl.textContent = lie;

      // BANNIÈRE + CONFETTIS SI VICTOIRE
      let win = false, text = '';
      if (state.myIsImpostor) {
        win = !res.impostorCaught;
        text = win ? 'GAGNÉ ✅ Personne ne t’a démasqué.' : 'PERDU ❌ Tu as été démasqué.';
      } else {
        win = res.impostorCaught;
        text = win ? 'GAGNÉ ✅ L’imposteur a été démasqué.' : 'PERDU ❌ L’imposteur t’a eu.';
      }

      const banner = $('personal-banner');
      if (banner) {
        banner.textContent = text;
        banner.className = 'result-banner ' + (win ? 'result-win' : 'result-lose');
      }

      // SI GAGNÉ -> BOUM !
      if (win) {
        setTimeout(triggerConfetti, 300); // Petit délai pour l'effet de surprise
      }

      // Votes
      const box = $('res-votes'); box.innerHTML = '';
      const ul = document.createElement('ul');
      for (const [tid, c] of Object.entries(res.votes || {})) {
        const name = (state.room.players.find(p => p.id === tid) || {}).name || tid;
        const li = document.createElement('li'); li.textContent = `${name} : ${c} vote(s)`;
        ul.appendChild(li);
      }
      box.appendChild(ul);

      $('btn-next').style.display = 'block'; $('btn-next').disabled = false; $('btn-next').textContent = 'Manche suivante';
      const total = (state.room.players || []).length || 0;
      const pr = $('progress-ready'); if (pr) pr.textContent = `0/${total} prêts`;
      const tr = $('timer-reveal'); if (tr) tr.textContent = '--:--';
    });

    socket.on('readyProgress', ({ ready, total }) => {
      const el = $('progress-ready'); if (el) el.textContent = `${ready}/${total} prêts`;
    });

    socket.on('gameOver', ({ winners, autoReset }) => {
      const names = winners.map(w => `${w.name} (${w.score})`).join(', ');
      $('winners-text').textContent = winners.length > 1 ? `Égalité ! ${names}` : `${names} gagne la partie !`;
      
      // CONFETTIS AUSSI POUR LA FIN DE PARTIE
      triggerConfetti();

      $('modal').style.display = 'flex';
      show('screen-lobby');
      state.myLobbyReady = false; $('btn-ready').textContent = 'Je suis prêt';
      $('timer-lobby').style.display = 'none';
      if (autoReset) { const t = $('toast'); if (t) { t.textContent = 'Scores réinitialisés automatiquement'; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2200); } }
    });

    socket.on('scoresReset', () => { const t = $('toast'); if (t) { t.textContent = 'Scores remis à 0'; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2200); } show('screen-lobby'); });
    socket.on('actionAck', ({ action }) => { if (action === 'startRound') toast('Manche démarrée 🚀'); if (action === 'nextRound') toast('Nouvelle manche ➡️'); });
  }

  function init() { initUI(); initSocket(); }
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.results = { init };
})();