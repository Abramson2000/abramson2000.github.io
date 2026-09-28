const CACHE = 'cidian-cache-v3';
const CORE = ["./", "./index.html", "./styles.css?v=1.1.1", "./app.js?v=1.1.1", "./manifest.json", "./icon-192-v3.png", "./icon-512-v3.png", "./apple-touch-icon-v3.png", "./landscape-v3.webp", "./data-01.js?v=1.1.1", "./data-02.js?v=1.1.1", "./data-03.js?v=1.1.1", "./data-04.js?v=1.1.1", "./data-05.js?v=1.1.1", "./data-06.js?v=1.1.1", "./data-07.js?v=1.1.1", "./data-08.js?v=1.1.1", "./data-09.js?v=1.1.1", "./data-10.js?v=1.1.1", "./data-11.js?v=1.1.1", "./data-12.js?v=1.1.1", "./data-13.js?v=1.1.1", "./data-14.js?v=1.1.1", "./data-15.js?v=1.1.1", "./data-16.js?v=1.1.1", "./data-17.js?v=1.1.1", "./data-18.js?v=1.1.1"];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  // Activate only when every word shard and visual asset is available offline.
  await cache.addAll(CORE.map(url => new Request(url, {cache: 'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('cidian-cache-') && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/cidian/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = request.mode === 'navigate' ? await cache.match('./index.html') : await cache.match(request);
    if (hit) return hit;
    return fetch(request);
  })());
});
