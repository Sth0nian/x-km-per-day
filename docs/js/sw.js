const CACHE_NAME = 'running-dashboard-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/dashboard.js',
  '/js/charts.js',
  '/data/running-data.json',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.log('Service Worker: Cache failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if response is valid
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Add to cache for future requests
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(error => {
          console.log('Service Worker: Fetch failed', error);
          
          // Return offline page for navigation requests
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Background sync for data updates
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync-data') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(updateRunningData());
  }
});

// Push notifications (for future use)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '1'
      },
      actions: [
        {
          action: 'explore',
          title: 'View Dashboard',
          icon: '/icons/icon-96x96.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/icons/icon-96x96.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification('Running Challenge Update', options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Function to update running data in background
async function updateRunningData() {
  try {
    const response = await fetch('/data/running-data.json');
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/data/running-data.json', response);
      console.log('Service Worker: Running data updated');
    }
  } catch (error) {
    console.log('Service Worker: Failed to update data', error);
  }
}