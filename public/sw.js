const CACHE = 'remy-v1';
const PRECACHE = ['/dashboard/voice', '/dashboard', '/offline'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only handle GET requests for same-origin pages
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // API routes: network only, no cache
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache navigations so the app loads offline
        if (res.ok && e.request.mode === 'navigate') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => cached || caches.match('/dashboard/voice')))
  );
});

// Push notifications — fires when backend sends a Web Push message
self.addEventListener('push', e => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); } catch { payload = { title: 'Remy', body: e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(payload.title || 'Remy', {
      body: payload.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: payload.tag || 'remy-notification',
      data: { url: payload.url || '/dashboard/voice' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/dashboard/voice';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const match = wins.find(w => w.url.includes(location.origin));
      if (match) return match.focus().then(w => w.navigate(url));
      return clients.openWindow(url);
    })
  );
});
