/* SignalNest Service Worker - Offline Support */
const CACHE_VERSION = 'signalnest-v1';
const STATIC_CACHE = 'signalnest-static-v1';
const DYNAMIC_CACHE = 'signalnest-dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/assets/css/main.css',
  '/assets/js/app.js',
  '/assets/js/search.js',
  '/assets/images/logo.svg',
  '/assets/images/favicon.svg'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[ServiceWorker] Skip waiting');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - cache-first strategy for articles, network-first for everything else
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Skip admin and data requests
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/data/')) {
    return;
  }
  
  // Cache-first strategy for articles and static assets
  if (url.pathname.startsWith('/articles/') || 
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/categories/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          console.log('[ServiceWorker] Serving from cache:', request.url);
          return cached;
        }
        
        return fetch(request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200) {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(DYNAMIC_CACHE).then(cache => {
            console.log('[ServiceWorker] Caching new resource:', request.url);
            cache.put(request, responseToCache);
          });
          
          return response;
        }).catch(() => {
          // Return offline page if available
          return caches.match('/offline.html');
        });
      })
    );
  } else {
    // Network-first strategy for homepage and other pages
    event.respondWith(
      fetch(request).then(response => {
        const responseToCache = response.clone();
        
        if (response.status === 200) {
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, responseToCache);
          });
        }
        
        return response;
      }).catch(() => {
        return caches.match(request).then(cached => {
          return cached || caches.match('/offline.html');
        });
      })
    );
  }
});

// Background sync for analytics (if implemented)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalytics());
  }
});

function syncAnalytics() {
  // Placeholder for analytics sync
  return Promise.resolve();
}

// Push notification support (future enhancement)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New content available',
    icon: '/assets/images/logo.svg',
    badge: '/assets/images/favicon.svg',
    vibrate: [200, 100, 200]
  };
  
  event.waitUntil(
    self.registration.showNotification('SignalNest', options)
  );
});
