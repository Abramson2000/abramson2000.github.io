/* Tingli — офлайн-кэш приложения.
   HTML — сеть вперёд (чтобы обновления приходили), остальное из кэша.
   Запросы к облаку (другой домен) не трогаем вообще. */
const CACHE = 'tingli-cache-v5171-msg';
const ASSETS = [
  './', './index.html', './manifest.json',
  './fonts/simsun-subset.woff2', './fonts/xiaoshan-title.woff2',
  './bg.jpg', './logo.png', './sched-logo.png',
  './tingli-icon-180-v3.png', './tingli-icon-192-v3.png', './tingli-icon-512-v3.png',
  './tingli-favicon-v3.png', './tingli-favicon-32-v3.png'
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

/* Message handler: офлайн-прекеш по запросу клиента.
   { type: 'status' } → сколько закешировано из ASSETS
   { type: 'precache' } → докачать всё, с прогрессом через port */
self.addEventListener('message', function (e) {
  const msg = e.data || {};
  const port = e.ports && e.ports[0];

  if (msg.type === 'status') {
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) { return c.match(u, { ignoreSearch: true }); })).then(function (hits) {
        var have = hits.filter(function (x) { return !!x; }).length;
        if (port) port.postMessage({ type: 'status', ready: have === ASSETS.length, have: have, total: ASSETS.length });
      });
    });
    return;
  }

  if (msg.type === 'precache') {
    caches.open(CACHE).then(function (c) {
      var ok = 0, failed = [];
      var done = 0;
      var total = ASSETS.length;
      function next(i) {
        if (i >= ASSETS.length) {
          if (port) port.postMessage({ type: 'done', ok: ok, failed: failed, total: total });
          return;
        }
        c.match(ASSETS[i], { ignoreSearch: true }).then(function (hit) {
          if (hit) { ok++; done++; if (port) port.postMessage({ type: 'progress', done: done, total: total }); next(i + 1); return; }
          fetch(new Request(ASSETS[i], { cache: 'reload' })).then(function (res) {
            if (res && res.ok) { return c.put(ASSETS[i], res.clone()).then(function () { ok++; }); }
            else { failed.push(ASSETS[i]); }
          }).catch(function () { failed.push(ASSETS[i]); }).then(function () {
            done++;
            if (port) port.postMessage({ type: 'progress', done: done, total: total });
            next(i + 1);
          });
        });
      }
      next(0);
    });
    return;
  }
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
    icon: data.icon || './tingli-icon-192-v3.png',
    badge: data.badge || './tingli-icon-192-v3.png',
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
        try {
          if ('navigate' in wins[i]) return wins[i].navigate(target).then(function (w) { return w ? w.focus() : wins[i].focus(); });
        } catch (err) {}
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
