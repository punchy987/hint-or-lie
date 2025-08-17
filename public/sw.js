// sw.js — cache "app shell"
const CACHE = 'hol-v30';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/sw.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/images/background-hero.svg'
];
// Permet à la page de dire au Service Worker de passer en "active" tout de suite
self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// À l'activation, prendre tout de suite le contrôle des pages ouvertes
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;           // laisse passer POST, etc.
  if (url.pathname.startsWith('/socket.io/')) return; // laisse passer Socket.IO

  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});