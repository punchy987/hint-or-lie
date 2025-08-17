// Phase "Vote" — re-cliquable jusqu’à la fin du timer
(function () {
  const { $, show, socket, resetPhaseProgress } = window.HOL;

  let myTarget = null;     // dernier choix local
  let votingClosed = false;

  function renderHints(hints) {
    const box = $('hints'); if (!box) return;
    box.innerHTML = '';
    hints.forEach(h => {
      const p = document.createElement('p');
      p.appendChild(document.createTextNode((h.name || 'Joueur') + ' : ' + (h.hint || '')));
      box.appendChild(p);
    });
  }

  function buildVoteButtons(hints) {
    const cont = $('vote-buttons'); if (!cont) return;
    cont.innerHTML = '';
    hints.forEach(h => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = h.name || 'Joueur';
      b.dataset.id = h.id;

      b.onclick = () => {
        if (votingClosed) return;
        myTarget = h.id;

        // visuel : un seul bouton "sélectionné"
        cont.querySelectorAll('button').forEach(x => {
          x.classList.toggle('selected', x.dataset.id === String(myTarget));
        });

        // on (ré)envoie le vote à chaque clic — serveur garde la dernière valeur
        socket.emit('submitVote', { targetId: h.id });
      };

      cont.appendChild(b);
    });
  }

  function initSocket() {
    socket.on('allHints', ({ hints, domain, round }) => {
      votingClosed = false;
      myTarget = null;

      show('screen-vote');
      resetPhaseProgress();

      const theme = $('theme-vote-name'); if (theme) theme.textContent = domain || '?';
      renderHints(hints);
      buildVoteButtons(hints);

      const pv = $('progress-vote'); if (pv) pv.textContent = `0/${hints.length}`;
    });

    socket.on('phaseProgress', ({ phase, submitted, total }) => {
      if (phase === 'voting') {
        const elv = $('progress-vote'); if (elv) elv.textContent = `${submitted}/${total}`;
        // ⚠️ NE PAS désactiver quand tout le monde a voté : on autorise le changement
      }
    });

    socket.on('voteAck', () => {
      // Option: petit feedback si tu veux (toast), mais on ne verrouille pas.
      // window.HOL.toast?.('Vote enregistré (modifiable jusqu’à la fin)');
    });

    // Fermeture par le timer — on verrouille alors les boutons
    socket.on('timer', ({ phase, leftMs }) => {
      if (phase === 'voting' && leftMs <= 0) {
        votingClosed = true;
        const cont = $('vote-buttons');
        cont?.querySelectorAll('button').forEach(b => b.disabled = true);
      }
    });
  }

  function init() { initSocket(); }
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.vote = { init };
})();
