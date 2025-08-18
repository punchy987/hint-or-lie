// --- Service Worker : Hint or Lie -------------------------------------------
// ⚠️ BUMPER LA VERSION À CHAQUE DEPLOIEMENT (déclenche la mise à jour PWA)
const CACHE = 'hol-v34';

// Liste des assets à précacher (shell). Ajoute ici ce qui doit marcher offline.
const ASSETS = [
  '/',                // shell de nav
  '/index.html',
  '/style.css',

  // Images/icônes/manifest
  '/images/background-hero.svg?v=1', // <-- tu charges cette URL dans le CSS
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',

  // CSS split
  '/css/01-tokens.css',
  '/css/02-base.css',
  '/css/03-components.css',
  '/css/04-phase.css',
  '/css/05-hints.css',
  '/css/06-vote.css',
  '/css/07-modal-score.css',
  '/css/98-responsive.css',
  '/css/99-pwa-update.css', // garde si tu utilises le bandeau de MAJ

 '/js/core/dom.js','/js/core/state.js','/js/core/socket.js',
  '/js/features/home.js','/js/features/hints.js','/js/features/vote.js',
  '/js/features/results.js','/js/features/leaderboard.js',
  '/js/pwa/update.js','/js/main.js',
];
// ---------------------------------------------------------------------------
// INSTALL : pré-cache + passe immédiatement en waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ACTIVATE : nettoyage des anciens caches + prise de contrôle immédiate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// Messages depuis la page (ex: bouton "Mettre à jour")
self.addEventListener('message', (event) => {
  const type = event?.data?.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', cache: CACHE });
  }
});

// ---------------------------------------------------------------------------
// FETCH : stratégies par type de ressource
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ne s'occupe que des requêtes même origine
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1) NAVIGATIONS : network-first avec fallback sur index.html du cache
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstForNavigation(req));
    return;
  }

  // 2) CSS & JS : stale-while-revalidate (rapide + rafraîchi en arrière-plan)
  if (req.destination === 'style' || req.destination === 'script') {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 3) IMAGES / FONTS / AUTRES : cache-first
  if (
    req.destination === 'image' ||
    req.destination === 'font' ||
    req.destination === 'manifest'
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Par défaut : passe-through
});

// ---------------------------------------------------------------------------
// Helpers de stratégie

async function networkFirstForNavigation(req) {
  const cache = await caches.open(CACHE);
  try {
    // on tente la dernière version en ligne
    const fresh = await fetch(req, { cache: 'no-store' });
    // on garde aussi une copie d'index.html pour le mode offline
    // (on met la vraie ressource en cache sous sa clé d'URL)
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    // offline : on retombe sur le shell
    return (
      (await cache.match('/')) ||
      (await cache.match('/index.html')) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const fetchAndUpdate = fetch(req)
    .then((res) => {
      cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached || fetchAndUpdate || fetch(req);
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  return cached || fetch(req).then((res) => {
    cache.put(req, res.clone());
    return res;
  });
}
