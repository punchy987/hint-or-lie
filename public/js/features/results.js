// Phase "Résultat" + prêt manche suivante
(function () {
  // + toast (tu l’utilises plus bas)
  const { $, el, show, socket, state, toast } = window.HOL;

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

      // L’imposteur n’a PAS de mot (on laisse un tiret visuel si l’élément existe)
      if ($('res-imp')) $('res-imp').textContent = '—';

      $('res-imp-name').textContent = res.impostorName || '(?)';

      // ✅ Nouveau : mensonge = indice de l’imposteur envoyé par le serveur
      // (serveur: io.to(code).emit('roundResult', { ..., impostorHint })
      const lie = res.impostorHint || '—';
      const lieEl = $('res-imp-lie') || $('res-imp-word'); // compat si tu as déjà créé res-imp-word
      if (lieEl) lieEl.textContent = lie;

      // bannière perso
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

      // votes
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
