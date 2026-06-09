const CACHE = 'boulder-coach-v1';

const PRECACHE = ['/', '/checkin', '/session', '/history', '/insights', '/program', '/drills'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          const clone = res.clone();
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          return res;
        }),
    ),
  );
});
