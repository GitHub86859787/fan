// 梵 Service Worker — network-first, always fetches the latest when online
const CACHE = 'fan-cache-v1';

// Activate a waiting worker as soon as the page asks
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (e) => {
  // Take over as soon as installed
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Clean old caches
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
      // Control all open pages immediately
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Only handle GET
  if (req.method !== 'GET') return;

  e.respondWith(
    (async () => {
      try {
        // NETWORK FIRST: always try to get the freshest version online
        const fresh = await fetch(req, { cache: 'no-store' });
        // Cache a copy for offline use
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        // OFFLINE: fall back to whatever we cached last time
        const cached = await caches.match(req);
        if (cached) return cached;
        // Last resort: for navigations, try the cached page
        if (req.mode === 'navigate') {
          const fallback = await caches.match('fan.html');
          if (fallback) return fallback;
        }
        throw err;
      }
    })()
  );
});
