/**
 * RepairHub Production Progressive Web App Service Worker
 * Version: repairhub-pwa-v1.0.0
 * 
 * Strict Security Rules:
 * 1. NEVER cache any /api/ requests, auth endpoints, or private user data.
 * 2. Network-first for navigation requests with clean /offline fallback.
 * 3. Immediate cache version cleanup on activation.
 */

const CACHE_NAME = 'repairhub-pwa-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
  '/favicon.ico',
];

// Install: Cache critical static assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[PWA ServiceWorker] Pre-cache skipped or partial error:', err);
      })
  );
});

// Activate: Purge stale legacy caches and claim active clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log('[PWA ServiceWorker] Purging legacy cache:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Secure request handling with strict API bypass
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NON-GET REQUESTS: Always network only
  if (request.method !== 'GET') {
    return;
  }

  // 2. CRITICAL SECURITY GUARD: NEVER cache API, Socket.IO, or Auth endpoints
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/socket.io') ||
    url.pathname.includes('/auth/') ||
    url.port === '5000' ||
    url.hostname.includes('render.com') ||
    url.hostname.includes('railway.app') ||
    request.headers.has('Authorization')
  ) {
    // Direct network pass-through, no caching
    return;
  }

  // 3. NAVIGATION REQUESTS: Network-first with offline fallback page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // If network succeeded, return response directly
          return networkResponse;
        })
        .catch(async () => {
          // Network failed (offline) - return cached offline page
          const cache = await caches.open(CACHE_NAME);
          const cachedOffline = await cache.match(OFFLINE_URL);
          return cachedOffline || new Response('Offline - RepairHub requires an internet connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // 4. STATIC ASSETS (_next/static, public icons, images, fonts): Cache-first with network fallback
  const isStaticAsset =
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached, update in background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Fetch from network, cache response
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return networkResponse;
        });
      })
    );
    return;
  }

  // Default: Network only
});

// Support update message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notification event listener
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'RepairHub Update';
    const options = {
      body: payload.body || 'You have a new update regarding your vehicle repair.',
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-192x192.png',
      data: {
        url: payload.url || '/',
      },
      tag: payload.tag || 'repairhub-notification',
      renotify: true,
      vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // Plain text fallback
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('RepairHub', {
        body: text,
        icon: '/icons/icon-192x192.png',
      })
    );
  }
});

// Notification click event: Deep-link to app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
