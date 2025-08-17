// Enregistre le SW, détecte une MAJ et affiche le bandeau "Mettre à jour"
(function () {
  if (!('serviceWorker' in navigator)) return;

  const BANNER_ID = 'update-banner';
  function ensureBanner() {
    if (document.getElementById(BANNER_ID)) return;
    const wrap = document.createElement('div');
    wrap.id = BANNER_ID;
    wrap.innerHTML = `
      <div class="update-card" role="status" aria-live="polite">
        <span>✨ Nouvelle version disponible</span>
        <div class="update-actions">
          <button id="update-reload" type="button">Mettre à jour</button>
          <button id="update-dismiss" type="button" aria-label="Fermer">Plus tard</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById('update-dismiss')?.addEventListener('click', () => wrap.remove());
    document.getElementById('update-reload')?.addEventListener('click', async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach(r => r.waiting?.postMessage({ type: 'SKIP_WAITING' }));
      // petit délai puis reload
      setTimeout(() => location.reload(), 150);
    });
  }

  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('/sw.js').catch(() => null);
    if (!reg) return;

    function check(registration) {
      if (registration.waiting) {
        ensureBanner(); return;
      }
      registration.addEventListener('updatefound', () => {
        const sw = registration.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) ensureBanner();
        });
      });
    }
    check(reg);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // on a pris la main → on peut retirer le bandeau si présent
      document.getElementById(BANNER_ID)?.remove();
    });
  });
})();
