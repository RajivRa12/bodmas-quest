/* ═══════════════════════════════════════════════════════════════
   sw.js — BODMAS Quest Service Worker (PWA offline support)
═══════════════════════════════════════════════════════════════ */
const CACHE_NAME = 'bodmas-quest-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/js/audio.js',
  '/js/particles.js',
  '/js/confetti.js',
  '/js/storage.js',
  '/js/achievements.js',
  '/js/profile.js',
  '/js/questions.js',
  '/js/game.js',
  '/js/ui.js',
  '/js/main.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for PHP API calls, cache-first for static assets
  if (e.request.url.includes('api.php')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'offline' }), { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});
