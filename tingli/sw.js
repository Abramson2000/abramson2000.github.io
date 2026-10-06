/* Tingli — офлайн-кэш приложения.
   HTML — сеть вперёд (чтобы обновления приходили), остальное из кэша.
   Запросы к облаку (другой домен) не трогаем вообще. */
const CACHE = 'tingli-cache-v5591-full';
const CORE_ASSETS = [
  './', './index.html', './manifest.json',
  './fonts/simsun-subset.woff2', './fonts/xiaoshan-title.woff2',
  './bg.jpg', './logo.png', './sched-logo.png',
  './tingli-icon-180-v3.png', './tingli-icon-192-v3.png', './tingli-icon-512-v3.png',
  './tingli-favicon-v3.png', './tingli-favicon-32-v3.png',
  './tab-biz.png', './tab-biz-off.png', './tab-ci.png', './tab-ci-off.png',
  './tab-fa.png', './tab-fa-off.png', './tab-ju.png', './tab-ju-off.png',
  './tab-sch.png', './tab-sch-off.png', './tab-ting.png', './tab-ting-off.png',
  './tab-tuan.png', './tab-tuan-off.png', './tab-yu.png', './tab-yu-off.png',
  './tab-yin.png', './tab-yin-off.png'
];

/* Динамически собираем полный список файлов для офлайн-скачивания.
   Парсим index.html, вытаскиваем audio/*.mp3 и все PNG/SVG/JPG. */
async function gatherAllAssets() {
  var list = CORE_ASSETS.slice();
  try {
    var res = await fetch('./index.html', { cache: 'reload' });
    var html = await res.text();
    // audio files: "audio": "X-Y.mp3" → ./audio/X-Y.mp3
    var audioRe = /"audio"\s*:\s*"([^"]+)"/g;
    var m;
    while ((m = audioRe.exec(html)) !== null) {
      var a = './audio/' + m[1];
      if (list.indexOf(a) === -1) list.push(a);
    }
    // PNG files: src="X.png" → ./X.png (если не http и не начинается с /)
    var pngRe = /src="((?!https?:\/\/|\/)[^"]+\.png)"/g;
    while ((m = pngRe.exec(html)) !== null) {
      var p = './' + m[1];
      if (list.indexOf(p) === -1) list.push(p);
    }
    // JPG
    var jpgRe = /src="((?!https?:\/\/|\/)[^"]+\.jpg)"/g;
    while ((m = jpgRe.exec(html)) !== null) {
      var j = './' + m[1];
      if (list.indexOf(j) === -1) list.push(j);
    }
    // SVG
    var svgRe = /src="((?!https?:\/\/|\/)[^"]+\.svg)"/g;
    while ((m = svgRe.exec(html)) !== null) {
      var s = './' + m[1];
      if (list.indexOf(s) === -1) list.push(s);
    }
  } catch (e) {}
  return list;
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE_ASSETS.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
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
   { type: 'status' } → сколько закешировано
   { type: 'precache' } → докачать всё, с прогрессом через port
   { type: 'precache-unit', unit: N } → скачать аудио одного урока */
self.addEventListener('message', function (e) {
  const msg = e.data || {};
  const port = e.ports && e.ports[0];

  if (msg.type === 'status') {
    gatherAllAssets().then(function (all) {
      caches.open(CACHE).then(function (c) {
        return Promise.all(all.map(function (u) { return c.match(u, { ignoreSearch: true }); })).then(function (hits) {
          var have = hits.filter(function (x) { return !!x; }).length;
          if (port) port.postMessage({ type: 'status', ready: have === all.length, have: have, total: all.length });
        });
      });
    });
    return;
  }

  if (msg.type === 'precache') {
    gatherAllAssets().then(function (all) {
      caches.open(CACHE).then(function (c) {
        var ok = 0, failed = [];
        var done = 0;
        var total = all.length;
        function next(i) {
          if (i >= all.length) {
            if (port) port.postMessage({ type: 'done', ok: ok, failed: failed, total: total });
            return;
          }
          c.match(all[i], { ignoreSearch: true }).then(function (hit) {
            if (hit) { ok++; done++; if (port) port.postMessage({ type: 'progress', done: done, total: total }); next(i + 1); return; }
            fetch(new Request(all[i], { cache: 'reload' })).then(function (res) {
              if (res && res.ok) { return c.put(all[i], res.clone()).then(function () { ok++; }); }
              else { failed.push(all[i]); }
            }).catch(function () { failed.push(all[i]); }).then(function () {
              done++;
              if (port) port.postMessage({ type: 'progress', done: done, total: total });
              next(i + 1);
            });
          });
        }
        next(0);
      });
    });
    return;
  }

  if (msg.type === 'precache-unit' && msg.unit) {
    /* Скачиваем аудио одного урока: ./audio/N-*.mp3 */
    var prefix = './audio/' + msg.unit + '-';
    fetch('./index.html', { cache: 'reload' }).then(function (res) { return res.text(); }).then(function (html) {
      var re = new RegExp('"audio"\\s*:\\s*"(' + msg.unit + '-[^"]+)"', 'g');
      var files = [];
      var m;
      while ((m = re.exec(html)) !== null) {
        files.push('./audio/' + m[1]);
      }
      if (port) port.postMessage({ type: 'unit-start', total: files.length });
      caches.open(CACHE).then(function (c) {
        var ok = 0;
        function next(i) {
          if (i >= files.length) {
            if (port) port.postMessage({ type: 'done', ok: ok, failed: [], total: files.length });
            return;
          }
          c.match(files[i], { ignoreSearch: true }).then(function (hit) {
            if (hit) { ok++; if (port) port.postMessage({ type: 'progress', done: i + 1, total: files.length }); next(i + 1); return; }
            fetch(new Request(files[i], { cache: 'reload' })).then(function (res) {
              if (res && res.ok) return c.put(files[i], res.clone()).then(function () { ok++; });
            }).catch(function () {}).then(function () {
              if (port) port.postMessage({ type: 'progress', done: i + 1, total: files.length });
              next(i + 1);
            });
          });
        }
        next(0);
      });
    }).catch(function () {
      if (port) port.postMessage({ type: 'done', ok: 0, failed: [], total: 0 });
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
