// Bump CACHE on any release that must invalidate cached app shell.
// The byte change here is what makes the browser re-install the worker.
const CACHE = 'boulder-coach-v2';

// App shell to make first offline load work. Hashed /_next/static/* assets
// are cached on demand by the fetch handler, not precached here.
const PRECACHE = ['/', '/checkin', '/session', '/history', '/insights', '/program', '/drills'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Per-URL so one 404 can't abort the whole install (addAll is atomic).
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Hashed build assets are immutable → safe to serve cache-first.
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:js|css|woff2?|png|svg|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first so a new deploy reaches online users immediately;
  // fall back to cache (then the cached shell) only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/'))),
    );
    return;
  }

  // Immutable static assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              void caches.open(CACHE).then((cache) => cache.put(request, clone));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else: network-first, fall back to any cached copy.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
