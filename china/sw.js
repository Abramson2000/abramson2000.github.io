const CACHE='my-china-v2.14.1';
const SHELL = './index.html?v=2.14.1';
const ASSETS=[
  './travel/catalog.js?v=2.14.1','./travel/index.html','./travel/reader.css','./travel/reader.js','./books/geography.html','./tea.html','./books/history.html','./books/culture.html','./books/culture-cover.webp','./books/history-cover.webp',SHELL,'./styles.css?v=2.14.1','./data.js?v=2.14.1','./favorites.js?v=2.14.1','./app.js?v=2.14.1','./manifest.json?v=2.14.1',
  './assets/brand/logo-main.webp','./assets/brand/logo-main.png','./assets/brand/app-icon-192.png','./assets/brand/app-icon-512.png','./assets/guide/china-relief-map.webp','./assets/maps/china-guide.svg','./assets/maps/china-library.svg','./assets/maps/relief-guide.webp','./assets/maps/relief-color.webp','./assets/maps/relief-gray.webp','./assets/guide/mobile-bg.jpg','./assets/guide/desktop-bg.jpg','./assets/library/china-geography-cover.webp','./assets/library/china-geography-territory-page.webp','./assets/library/china-geography-relief-page.webp','./assets/sections/library.svg','./assets/sections/tea.svg','./assets/sections/trips.svg','./assets/icons/menu/guide.svg','./assets/icons/menu/library.svg','./assets/icons/menu/tea.svg','./assets/icons/menu/trips.svg','./assets/icons/menu/reference.svg','./assets/icons/brand/sidebar-mark.svg','./assets/icons/browser/favicon.svg','./assets/icons/browser/favicon-32.png','./assets/icons/browser/favicon.ico','./assets/fonts/noto-serif-sc-reg.woff2','./assets/fonts/noto-serif-sc-bold.woff2'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
const PREFIX='my-china-';
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.indexOf(PREFIX)===0).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  const shellNavigation = request.mode === 'navigate' && (path === '' || path === 'index.html');
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(shellNavigation ? SHELL : request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && (path.startsWith('travel/') || /^books\/(geography|history|culture)-images\//.test(path))) {
      try { await cache.put(request, response.clone()); } catch {}
    }
    return response;
  })());
});
