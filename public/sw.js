const CACHE_NAME = 'miam-miam-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // For API calls, try network first, then fallback to cache if needed
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // For other assets, try cache first
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-miam-miam') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // This function will be called when the browser thinks we are back online
  // We'll send a message to the client to trigger the sync logic
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_REQUIRED' });
  }
}
