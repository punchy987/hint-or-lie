// --- Service Worker (Hint or Lie) ---
// BUMP ICI à chaque déploiement
const CACHE = 'hol-v31';

// Liste des assets critiques à pré-cacher
// -> adapte si tu as d’autres fichiers critiques
const ASSETS = [
  '/',                // navigation
  '/index.html',
  '/style.css',
  // '/client.js',    // dé-commente si tu as un JS global
  '/images/background-hero.svg', // ton fond
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json'
];

// Install : pré-cache + remplace l’ancien SW dès qu’il est prêt
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // ⚡ passe direct en "waiting"
});

// Activate : supprime les vieux caches + prend le contrôle immédiat
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim(); // ⚡ contrôle immédiat des pages
});

// Réception du message "SKIP_WAITING" (clic sur "Mettre à jour")
self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Stratégies de cache équilibrées
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1) Navigations (index.html) -> network-first (toujours tenter la dernière version)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('/', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  // 2) CSS/JS -> stale-while-revalidate (rapide ET à jour en arrière-plan)
  if (req.destination === 'style' || req.destination === 'script') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const fetching = fetch(req).then((res) => {
        cache.put(req, res.clone());
        return res;
      }).catch(() => undefined);
      return cached || fetching || fetch(req);
    })());
    return;
  }

  // 3) Images/icônes/autres -> cache-first
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    return cached || fetch(req);
  })());
});
