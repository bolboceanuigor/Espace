self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Service worker placeholder for future offline strategies.
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = {};
  }
  const title = payload.title || 'Notificare noua';
  const options = {
    body: payload.message || 'Ai o notificare noua in aplicatie.',
    icon: '/icons/pwa-192.svg',
    badge: '/icons/pwa-192.svg',
    data: { link: payload.link || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || '/';
  event.waitUntil(self.clients.openWindow(link));
});

