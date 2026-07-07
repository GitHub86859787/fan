// 梵 Service Worker
// - fan.html / sw.js 本身：网络优先，永远拿最新的（保证 PWA 自动更新，不用删了重装）
// - 音效 mp3、图标等静态资源：缓存优先，只下载一次，之后直接用本地缓存（不再每次重新下载）
const CACHE = 'fan-cache-v2';

// Static, rarely-changing media assets — safe to cache-first
const STATIC_ASSET_PATTERN = /\.(mp3|png|jpg|jpeg|svg|woff2?|ico)(\?|$)/i;

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const isStaticAsset = STATIC_ASSET_PATTERN.test(req.url);

  if (isStaticAsset) {
    // CACHE-FIRST: audio/icons rarely change — check local cache first,
    // only hit the network the very first time (or if somehow not yet cached).
    e.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          throw err;
        }
      })()
    );
  } else {
    // NETWORK-FIRST: the app shell (fan.html) and everything else must always
    // fetch the latest version, so updates actually reach the PWA.
    e.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(req);
          if (cached) return cached;
          if (req.mode === 'navigate') {
            const fallback = await caches.match('fan.html');
            if (fallback) return fallback;
          }
          throw err;
        }
      })()
    );
  }
});
