// ═══════════════════════════════════════════════════
//  SP HOME INTERIOR — WORKER SERVICE WORKER
//  Scope: /worker/
// ═══════════════════════════════════════════════════
const CACHE = 'sphome-admin-v1';
const ASSETS = [
  './',
  './index.html',
  './admin.js',
  './manifest.json',
  '../shared/config.js',
  '../shared/logo.js',
  '../shared/logo.png',
  '../shared/icon-192.png',
  '../shared/icon-512.png',
  '../shared/maskable-192.png',
  '../shared/maskable-512.png',
  '../shared/apple-touch-icon.png',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.allSettled(ASSETS.map(function (u) { return cache.add(u); }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.indexOf('sphome-admin-') === 0 && k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  const url = e.request.url;
  // Never cache the backend API
  if (url.indexOf('script.google.com') !== -1 || url.indexOf('googleusercontent.com') !== -1) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return new Response(JSON.stringify({ ok: false, error: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }
  // Cache-first for assets
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (res) {
        if (e.request.method === 'GET' && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      });
    }).catch(function () {
      if (e.request.headers.get('accept') && e.request.headers.get('accept').indexOf('text/html') !== -1) {
        return caches.match('./index.html');
      }
    })
  );
});
