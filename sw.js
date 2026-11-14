// Caches the app files so it opens offline. Your wins are NOT stored here (they live in IndexedDB).
// To ship an app update: change CACHE version below and re-upload.
const CACHE = 'omw-v4';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
// 'reload' bypasses the HTTP cache so an update never caches a stale copy of a file
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Pages (index.html, manifest) are fetched fresh when online so updates arrive immediately;
// the cached copy is only used offline. Other files are served from cache first.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;   // never touch blob: downloads (backup export)
  if (url.origin !== self.location.origin) return;
  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/') || /\.(html|webmanifest)$/.test(url.pathname);
  if (isPage) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
    );
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
  }
});

// Tapping a reminder opens the app (and the right screen).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const hash = e.action === 'emergency' ? '#emergency' : (data.hash || '');
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); c.postMessage({ type: 'omw-open', hash }); return; }
    }
    await self.clients.openWindow(new URL('./index.html', self.registration.scope).href + hash);
  })());
});
