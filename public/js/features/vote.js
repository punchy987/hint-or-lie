// Phase "Vote" — re-cliquable jusqu’à la fin du timer
(function () {
  const { $, show, socket, resetPhaseProgress, state } = window.HOL;

  let myTarget = null;     // dernier choix local (hintId)
  let votingClosed = false;

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

  // Rendu : liste d’indices anonymes, chacun avec son bouton "Voter" rouge compact aligné à droite
  function renderHintsWithVote(hints) {
    const box = $('hints'); if (!box) return;
    const legacyButtons = $('vote-buttons'); // plus utilisé
    if (legacyButtons) legacyButtons.innerHTML = '';

    box.style.display = '';   // on (ré)affiche la liste
    box.classList.add('hints-table'); // grid compacte
    box.innerHTML = '';

    (hints || []).forEach(h => {
      const row = document.createElement('div');
      row.className = 'hint-row';

      const txt = document.createElement('span');
      txt.className = 'hint-text';
      const full = (h.text ?? h.hint ?? '').toString().trim();
      txt.textContent = full || '—';
      txt.title = full; // tooltip

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-vote-red';
      btn.dataset.id = h.id;
      btn.textContent = 'Voter';

      btn.onclick = () => {
        if (votingClosed) return;
        myTarget = h.id;

        // visuel: un seul bouton sélectionné
        box.querySelectorAll('.btn-vote-red').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        socket.emit('submitVote', { hintId: h.id });

        // petit boost UX: on incrémente le compteur localement, le serveur recalcule derrière
        const pv = $('progress-vote');
        if (pv) {
          const [cur, tot] = (pv.textContent || '0/0').split('/').map(x => parseInt(x, 10) || 0);
          if (cur < tot) pv.textContent = `${cur + 1}/${tot}`;
        }
      };

      row.appendChild(txt);
      row.appendChild(btn);
      box.appendChild(row);
    });
  }

  // Handler commun pour recevoir la liste des indices (nouveau et ancien format)
  function handleHintsForVote(hints, domain, round) {
    votingClosed = false;
    myTarget = null;

    show('screen-vote');
    resetPhaseProgress();

    setVoteTheme(domain);           // ✅ fixe "Thème : ..."
    renderHintsWithVote(hints);     // ⬅️ liste + bouton rouge par ligne

    const pv = $('progress-vote'); if (pv) pv.textContent = `0/${(hints || []).length}`;
  }

  function initSocket() {
    // Format nouveau: { hints:[{id,text}], domain, round }
    // Compat ancien:  [ {id, name, hint}, ... ]
    socket.on('hintsList', (payload) => {
      const raw = Array.isArray(payload) ? payload : (payload?.hints || []);
      const hints = raw.map(h => ({
        id: h.id,
        // supporte h.text (nouveau) et h.hint (ancien)
        text: (typeof h.text === 'string') ? h.text : (h.hint || '')
      }));
      const domain = Array.isArray(payload) ? null : (payload?.domain ?? null);
      const round  = Array.isArray(payload) ? null : (payload?.round  ?? null);
      handleHintsForVote(hints, domain, round);
    });

    // Compat ancien event si jamais
    socket.on('allHints', ({ hints, domain, round }) => {
      const mapped = (hints || []).map(h => ({
        id: h.id,
        text: (typeof h.text === 'string') ? h.text : (h.hint || '')
      }));
      handleHintsForVote(mapped, domain, round);
    });

    // Mise à jour serveur du compteur (prend la main sur le local si émis)
    socket.on('phaseProgress', ({ phase, submitted, total }) => {
      if (phase === 'voting') {
        const elv = $('progress-vote'); if (elv) elv.textContent = `${submitted}/${total}`;
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
        document.querySelectorAll('.btn-vote-red').forEach(b => b.disabled = true);
      }
    });
  }
function renderHintsWithVote(hints) {
  const box = $('hints'); if (!box) return;
  const legacyButtons = $('vote-buttons'); if (legacyButtons) legacyButtons.innerHTML = '';

  box.style.display = '';
  box.classList.add('hints-table');   // ← important
  box.innerHTML = '';

  (hints || []).forEach(h => {
    const row = document.createElement('div');
    row.className = 'hint-row';

    const txt = document.createElement('span');
    txt.className = 'hint-text';
    const full = (h.text ?? h.hint ?? '').toString().trim();
    txt.textContent = full || '—';
    txt.title = full;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-vote-red';
    btn.dataset.id = h.id;
    btn.textContent = 'Voter';

    btn.onclick = () => {
      if (votingClosed) return;
      myTarget = h.id;

      box.querySelectorAll('.btn-vote-red').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      socket.emit('submitVote', { hintId: h.id });
    };

    row.appendChild(txt);
    row.appendChild(btn);
    box.appendChild(row);
  });
}
  function init() { initSocket(); }
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.vote = { init };
})();
