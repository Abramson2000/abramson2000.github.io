/* Tingli — офлайн-кэш приложения.
   HTML — сеть вперёд (чтобы обновления приходили), остальное из кэша.
   Запросы к облаку (другой домен) не трогаем вообще. */
const CACHE = 'tingli-cache-v5125-lesson10';
const ASSETS = [
  './', './index.html', './manifest.json',
  './fonts/simsun-subset.woff2', './fonts/xiaoshan-title.woff2',
  './bg.jpg', './logo.png', './sched-logo.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  let u;
  try { u = new URL(req.url); } catch (err) { return; }
  if (u.origin !== self.location.origin) return;
  const isHtml = req.mode === 'navigate' || /\.html?$/.test(u.pathname) || u.pathname.endsWith('/');
  if (isHtml) {
    e.respondWith(
      fetch(req).then(function (res) {
        const cp = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', cp); });
        return res;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (r) {
      if (r) return r;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          const cp = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, cp); });
        }
        return res;
      });
    })
  );
});
