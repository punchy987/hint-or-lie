// Phase "Vote" — re-cliquable jusqu’à la fin du timer
(function () {
  const { $, show, socket, resetPhaseProgress, state } = window.HOL; // + state ✅

  let myTarget = null;     // dernier choix local
  let votingClosed = false;

  function renderHints(hints) {
    const box = $('hints'); if (!box) return;
    box.innerHTML = '';
    (hints || []).forEach(h => {
      const p = document.createElement('p');
      p.appendChild(document.createTextNode((h.name || 'Joueur') + ' : ' + (h.hint || '')));
      box.appendChild(p);
    });
  }

  // Fixe le thème avec fallback: payload.domain -> state.roundDomain -> ce qui est déjà affiché
  function setVoteTheme(domainMaybe) {
    const text =
      (domainMaybe && String(domainMaybe).trim()) ||
      (state?.roundDomain && String(state.roundDomain).trim()) ||
      ($('theme-hint-name')?.textContent?.trim()) ||
      '—';
    const el = $('theme-vote-name');
    if (el) el.textContent = text;
  }

  function buildVoteButtons(hints) {
    const cont = $('vote-buttons'); if (!cont) return;
    cont.innerHTML = '';
    (hints || []).forEach(h => {
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

        // on (ré)envoie le vote à chaque clic — le serveur garde la dernière valeur
        socket.emit('submitVote', { targetId: h.id });
      };

      cont.appendChild(b);
    });
  }

  // Handler commun pour recevoir la liste des indices (nouveau et ancien format)
  function handleHintsForVote(hints, domain, round) {
    votingClosed = false;
    myTarget = null;

    show('screen-vote');
    resetPhaseProgress();

    setVoteTheme(domain);       // ✅ fixe "Thème : ..."
    renderHints(hints);
    buildVoteButtons(hints);

    const pv = $('progress-vote'); if (pv) pv.textContent = `0/${(hints || []).length}`;
  }

  function initSocket() {
    // Format actuel: payload peut être un array (hints) ou un objet {hints, domain, round}
    socket.on('hintsList', (payload) => {
      const isArray = Array.isArray(payload);
      const hints  = isArray ? payload           : (payload?.hints  || []);
      const domain = isArray ? null              : (payload?.domain ?? null);
      const round  = isArray ? null              : (payload?.round  ?? null);
      handleHintsForVote(hints, domain, round);
    });

    // Compat ancien event
    socket.on('allHints', ({ hints, domain, round }) => {
      handleHintsForVote(hints, domain, round);
    });

    socket.on('phaseProgress', ({ phase, submitted, total }) => {
      if (phase === 'voting') {
        const elv = $('progress-vote'); if (elv) elv.textContent = `${submitted}/${total}`;
        // on laisse les boutons actifs jusqu'à la fin
      }
    });

    socket.on('voteAck', () => {
      // Option: feedback visuel si tu veux (toast), sans verrouiller.
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
