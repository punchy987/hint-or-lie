// sw.js — très simple cache "app shell" pour Hint or Lie
const CACHE = 'hol-v21';  // change la version quand tu modifies les assets
const ASSETS = ['/', '/index.html']; // ajoute d'autres fichiers statiques si besoin

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Laisse passer Socket.IO et toute requête non-GET (polling/websocket, POST…)
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/socket.io/')) return;

  // Cache d'abord, sinon réseau
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req))
  );
});