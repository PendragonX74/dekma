const CACHE_NAME = 'dekma-v1';

const CORE_ASSETS = [
  '/dekma/',
  '/dekma/index.html',
  '/dekma/styles.css',
  '/dekma/app.js',
  '/dekma/loader.js',
  '/dekma/favicon.ico',
  '/dekma/icon-192.png',
  '/dekma/icon-512.png',
  '/dekma/manifest.json'
];

// Install: pre-cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: wipe old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for assets, network-first for data files
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always fetch data files fresh from network (your /data/ folder)
  if (url.pathname.startsWith('/dekma/data/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('/dekma/index.html'))
  );
});