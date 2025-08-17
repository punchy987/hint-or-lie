// Classement (Top 50) + rendu
(function () {
  const { $, el, socket, getDeviceId, tierFromWins } = window.HOL;

  function renderLeaderboard(items) {
    const meId = getDeviceId();
    const box = $('lb-list');
    if (!Array.isArray(items) || !items.length) {
      if (box) box.textContent = 'Aucun résultat pour l’instant.';
      return;
    }
    const frag = document.createDocumentFragment();
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none'; ul.style.padding = '0'; ul.style.margin = '0';
    items.forEach((x, i) => {
      const li = document.createElement('li');
      li.style.display = 'grid';
      li.style.gridTemplateColumns = 'minmax(24px,40px) 1fr auto';
      li.style.gap = '8px';
      li.style.padding = '6px 0';

      const rank = el('span', `#${i + 1}`);
      const mid = document.createElement('span');
      const strong = el('strong', x.pseudo || 'Joueur');
      const pill = el('span', tierFromWins(x.wins || 0), { class: 'pill' });
      pill.style.marginLeft = '6px';
      mid.appendChild(strong);
      mid.appendChild(pill);
      if (x.deviceId === meId) mid.appendChild(el('span', ' (toi)'));

      const wins = el('span', `${x.wins || 0} victoires`, { class: 'muted' });

      li.appendChild(rank);
      li.appendChild(mid);
      li.appendChild(wins);
      ul.appendChild(li);
    });
    frag.appendChild(ul);
    if (box) { box.innerHTML = ''; box.appendChild(frag); }
  }

  function requestLeaderboard() { socket.emit('getLeaderboard'); }

  function initUI() {
    const btn = $('btn-lb-refresh');
    if (!btn) return;
    let refreshing = false;
    const original = btn.textContent;

    const onData = (items) => {
      renderLeaderboard(items);
      if (refreshing) {
        refreshing = false;
        btn.disabled = false;
        btn.textContent = original;
      }
    };
    socket.off?.('leaderboardData', onData);
    socket.on('leaderboardData', onData);

    btn.onclick = () => {
      if (refreshing) return;
      refreshing = true;
      btn.disabled = true;
      btn.textContent = '...';
      requestLeaderboard();
      setTimeout(() => { // failsafe
        if (refreshing) {
          refreshing = false;
          btn.disabled = false;
          btn.textContent = original;
        }
      }, 2000);
    };
  }

  function init() { initUI(); requestLeaderboard(); }
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.leaderboard = { init };
})();
