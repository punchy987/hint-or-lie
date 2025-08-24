// public/js/core/helpers.js
// Helpers globaux HOL + utilitaires UI (toast, show, etc.)
(function () {
  const HOL = (window.HOL = window.HOL || {});

  // === Sur quels écrans afficher le scoreboard (inline) ===
  // => UNIQUEMENT Indice, Vote, Résultat (pas sur Home, pas sur Lobby)
  HOL.SCORE_SCREENS = new Set(['screen-hint', 'screen-vote', 'screen-result']);

  HOL.$ = HOL.$ || ((s, r = document) => {
    if (!s) return null;
    const bySel = s.startsWith('#') || s.startsWith('.') || /[>\[\]:\s]/.test(s);
    return bySel ? r.querySelector(s) : r.getElementById(s);
  });
  HOL.$$ = HOL.$$ || ((s, r = document) => {
    if (!s) return [];
    const bySel = s.startsWith('#') || s.startsWith('.') || /[>\[\]:\s]/.test(s);
    return bySel ? Array.from(r.querySelectorAll(s)) : (r.getElementById(s) ? [r.getElementById(s)] : []);
  });

  // Créateur d’élément
  HOL.el = HOL.el || function el(tag, text = '', attrs = {}) {
    const n = document.createElement(tag);
    if (text != null && text !== '') n.textContent = String(text);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
    return n;
  };

  HOL.onEnter = HOL.onEnter || function (idOrSel, fn) {
    const input = HOL.$(idOrSel);
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); try { fn && fn(); } catch {} }
    });
  };

  // Monte/démonte le scoreboard "dans" la carte de l'écran courant
  function mountScoreboard(screenId) {
    const sb = document.getElementById('scoreboard');
    if (!sb) return;

    // Caché sur l'accueil ou si l'écran n'est pas whitelisté
    if (screenId === 'screen-home' || !HOL.SCORE_SCREENS.has(screenId)) {
      sb.classList.remove('scoreboard-inline');
      sb.style.display = 'none';
      // on le range hors des cartes pour ne pas polluer d'autres écrans
      document.body.appendChild(sb);
      return;
    }

    const host = document.getElementById(screenId);
    if (!host) return;

    sb.classList.add('scoreboard-inline'); // le CSS fera display:block
    sb.style.display = '';
    host.appendChild(sb); // collé à la fin du contenu de la carte
  }

  // ✅ Affichage d'écran + montage du scoreboard inline
  HOL.show = HOL.show || function (screenId) {
    const ids = ['screen-home', 'screen-lobby', 'screen-hint', 'screen-vote', 'screen-result'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.style.display = (id === screenId) ? '' : 'none';
    }
    document.body.setAttribute('data-screen', screenId);

    mountScoreboard(screenId);

    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { window.scrollTo(0, 0); }
  };

  // Toast simple
  HOL.toast = HOL.toast || function (msg, ms = 2200) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.style.cssText =
        'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);' +
        'background:rgba(20,20,28,.88);backdrop-filter:blur(4px);color:#fff;' +
        'padding:10px 14px;border-radius:12px;font-weight:700;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:9999;max-width:80vw;' +
        'text-align:center;opacity:1;transition:opacity .25s';
      document.body.appendChild(t);
    }
    t.textContent = String(msg || '');
    t.style.display = 'block';
    t.style.opacity = '1';
    clearTimeout(HOL._toastTimer);
    HOL._toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.display = 'none'; }, ms);
  };

  HOL.getDeviceId = HOL.getDeviceId || function () {
    const K = 'hol_device_id';
    let id = localStorage.getItem(K);
    if (!id) { id = 'd-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36); localStorage.setItem(K, id); }
    return id;
  };

  HOL.fmt = HOL.fmt || function fmt(ms) {
    const s = Math.max(0, Math.floor((ms ?? 0) / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  // défini dans state.js; no-op ici pour éviter les erreurs avant chargement
  HOL.updateScoreboard = HOL.updateScoreboard || function () {};
  async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Lien copié ✅');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    toast('Lien copié ✅');
  }
}

async function shareInviteLink({ code, name }) {
  const base = location.origin + location.pathname; // ex: https://ton-domaine/
  const params = new URLSearchParams();
  params.set('code', code);
  if (name) params.set('n', name);
  const url = `${base}?${params.toString()}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: '🔗 Rejoins ma partie — Hint or Lie',
        text: `Viens jouer ! Code ${code}`,
        url
      });
      return;
    } catch (_) { /* annulation → on copie */ }
  }
  await copyToClipboard(url);
}

// Expose pour qu'on l'appelle depuis home.js
window.HOL.shareInviteLink = shareInviteLink;

})();
