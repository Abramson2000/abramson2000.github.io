/* Tingli — офлайн-кэш приложения.
   HTML — сеть вперёд (чтобы обновления приходили), остальное из кэша.
   Запросы к облаку (другой домен) не трогаем вообще. */
const CACHE = 'tingli-cache-v5170-push';
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


/* Web Push: работает, когда Tingli закрыт. */
self.addEventListener('push', function (e) {
  let data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (err) { try { data = { body: e.data ? e.data.text() : '' }; } catch (x) {} }

  const title = data.title || '小山听力 · Tingli';
  const body = data.body || data.text || 'Напоминание о занятии';
  const kind = data.kind || 'lesson';
  const key = data.key || data.id || '';
  const tag = data.tag || ('tingli-' + kind + '-' + key);
  const url = data.url || './?tab=sched';

  e.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: data.icon || './icon-192.png',
    badge: data.badge || './icon-192.png',
    tag: tag,
    renotify: false,
    data: { url: url, kind: kind, key: key }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const d = e.notification.data || {};
  const target = new URL(d.url || './?tab=sched', self.location.href).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (wins) {
    for (let i = 0; i < wins.length; i++) {
      if ('focus' in wins[i]) {
        try { wins[i].postMessage({ type: 'TINGLI_PUSH_OPEN', kind: d.kind || '', key: d.key || '' }); } catch (err) {}
        return wins[i].focus();
      }
    }
    return clients.openWindow ? clients.openWindow(target) : null;
  }));
});

self.addEventListener('pushsubscriptionchange', function () {
  /* Safari/браузер может заменить подписку. Клиент при следующем открытии
     проверит её и заново отправит серверу вместе с актуальной очередью. */
});
