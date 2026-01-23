// public/js/features/vote.js
// Phase "Vote" — Affichage en mode "Cartes / Tuiles" 🃏

(function () {
  const { $, show, socket, resetPhaseProgress, state } = window.HOL;

  let myTarget = null;     // dernier choix local (hintId)
  let votingClosed = false;

  // Fixe le thème avec fallback
  function setVoteTheme(domainMaybe) {
    const text =
      (domainMaybe && String(domainMaybe).trim()) ||
      (state?.roundDomain && String(state.roundDomain).trim()) ||
      ($('theme-hint-name')?.textContent?.trim()) ||
      '—';
    const el = $('theme-vote-name');
    if (el) el.textContent = text;
  }

  // --- NOUVEAU RENDU : CARTES CLIQUABLES ---
  function renderHintsWithVote(hints) {
    const box = $('hints'); if (!box) return;
    
    // Nettoyage de l'ancien système
    const legacyButtons = $('vote-buttons'); 
    if (legacyButtons) legacyButtons.innerHTML = ''; // On le vide, on ne s'en sert plus

    box.style.display = '';   
    box.innerHTML = ''; // On efface la liste précédente

    (hints || []).forEach(h => {
      // Création de la CARTE (c'est un bouton géant)
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'vote-card'; // La classe CSS qu'on a ajoutée tout à l'heure
      card.dataset.id = h.id;

      // Le texte de l'indice
      const fullText = (h.text ?? h.hint ?? '').toString().trim();
      const strong = document.createElement('strong');
      strong.textContent = fullText || '—';
      
      card.appendChild(strong);

      // Le clic sur la carte
      card.onclick = () => {
        if (votingClosed) return;
        myTarget = h.id;

        // Visuel : On retire la sélection des autres cartes et on allume celle-ci
        box.querySelectorAll('.vote-card').forEach(b => b.classList.remove('selected'));
        card.classList.add('selected');

        // Envoi au serveur
        socket.emit('submitVote', { hintId: h.id });

        // Petit effet immédiat sur le compteur (UX fluide)
        const pv = $('progress-vote');
        if (pv) {
          const [cur, tot] = (pv.textContent || '0/0').split('/').map(x => parseInt(x, 10) || 0);
          if (cur < tot) pv.textContent = `${cur + 1}/${tot}`;
        }
      };

      box.appendChild(card);
    });
  }
  // ------------------------------------------

  // Handler commun pour recevoir la liste des indices
  function handleHintsForVote(hints, domain, round) {
    votingClosed = false;
    myTarget = null;

    show('screen-vote');
    resetPhaseProgress();

    setVoteTheme(domain);           
    renderHintsWithVote(hints);     // Affiche les cartes

    const pv = $('progress-vote'); if (pv) pv.textContent = `0/${(hints || []).length}`;
  }

  function initSocket() {
    // Format nouveau: { hints:[{id,text}], domain, round }
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

    // Mise à jour serveur du compteur
    socket.on('phaseProgress', ({ phase, submitted, total }) => {
      if (phase === 'voting') {
        const elv = $('progress-vote'); if (elv) elv.textContent = `${submitted}/${total}`;
      }
    });

    socket.on('voteAck', () => {
      // Vote bien reçu
    });

    // Fermeture par le timer — on verrouille les cartes
    socket.on('timer', ({ phase, leftMs }) => {
      if (phase === 'voting' && leftMs <= 0) {
        votingClosed = true;
        document.querySelectorAll('.vote-card').forEach(b => b.disabled = true);
      }
    });
  }

  function init() { initSocket(); }
  
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.vote = { init };
})();