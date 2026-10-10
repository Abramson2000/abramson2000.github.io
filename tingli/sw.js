/* Tingli 5.71.0: pinned offline shell, durable media, resumable verified downloads. */
const VERSION = '5.71.0';
const CACHE = 'tingli-shell-' + VERSION;
const MEDIA_CACHE = 'tingli-media-v1';
const MANIFEST = './offline-manifest.5.71.0.json';
const CORE_ASSETS = [
  "./favicon-20261010.ico",
  "./favicon.ico",
  "./apple-touch-icon-20261010.png",
  "./apple-touch-icon.png",
  "./manifest.icons-20261010.json",
  "./",
  "./index.html",
  "./sync-check.html",
  "./sync-check.js?v=2",
  "./sync-transport.5.67.0.js",
  "./manifest.json",
  "./sync-core.js?v=5.64.0",
  "./word-sync.5.64.0.js",
  "./fonts/zhimang-course.ttf",
  "./fonts/simsun-subset.woff2",
  "./fonts/xiaoshan-title.woff2",
  "./bg.jpg",
  "./logo.png",
  "./sched-logo.png",
  "./tingli-icon-180-v3.png",
  "./tingli-icon-192-v3.png",
  "./tingli-icon-512-v3.png",
  "./tingli-favicon-v3.png",
  "./tingli-favicon-32-v3.png",
  "./tab-biz.png",
  "./tab-biz-off.png",
  "./tab-ci.png",
  "./tab-ci-off.png",
  "./tab-fa.png",
  "./tab-fa-off.png",
  "./tab-ju.png",
  "./tab-ju-off.png",
  "./tab-sch.png",
  "./tab-sch-off.png",
  "./tab-ting.png",
  "./tab-ting-off.png",
  "./tab-tuan.png",
  "./tab-tuan-off.png",
  "./tab-yu.png",
  "./tab-yu-off.png",
  "./tab-yin.png",
  "./tab-yin-off.png",
  "./offline.5.71.0.js",
  "./offline-manifest.5.71.0.json"
];
const REQUIRED_ASSETS = ['./index.html', './sync-transport.5.67.0.js', './sync-core.js?v=5.64.0',
  './word-sync.5.64.0.js', './offline.5.71.0.js', MANIFEST, './bg.jpg',
  './fonts/zhimang-course.ttf', './fonts/simsun-subset.woff2', './fonts/xiaoshan-title.woff2'];
const absolute = value => new URL(typeof value === 'string' ? value : value.url, self.location.href).href;
const canonical = value => { const u = new URL(absolute(value)); return u.origin + u.pathname; };
const isMedia = value => /\/tingli\/(audio\/[^?#]+\.mp3|img\/[^?#]+\.(png|jpg|jpeg|webp|svg))$/i.test(canonical(value));
let manifestPromise, job;
async function timedFetch(url, options, timeout = 20000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, Object.assign({}, options, { signal: controller.signal })); }
  finally { clearTimeout(timer); }
}
async function cleanResponse(response, revision, heartbeat) {
  const headers = new Headers(response.headers);
  headers.delete('content-encoding'); headers.delete('content-length'); headers.delete('content-range');
  if (revision) headers.set('x-tingli-revision', revision);
  let body;
  if (heartbeat && response.body) {
    const reader = response.body.getReader(), chunks = []; let length = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      chunks.push(part.value); length += part.value.byteLength; heartbeat();
    }
    body = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  } else body = await response.blob();
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
async function put(cache, key, response, revision, heartbeat) {
  if (!response || !response.ok || response.status === 206) throw Error('Файл получен не полностью');
  await cache.put(key, await cleanResponse(response, revision, heartbeat));
}
async function downloadAsset(cache, key, url, revision, progress) {
  const controller = new AbortController(); let timer;
  const heartbeat = () => {
    clearTimeout(timer); timer = setTimeout(() => controller.abort(), 30000);
    progress();
  };
  heartbeat();
  try {
    const response = await fetch(url, { cache: 'reload', signal: controller.signal });
    await put(cache, key, response, revision, heartbeat);
  } finally { clearTimeout(timer); }
}
async function manifest() {
  if (!manifestPromise) manifestPromise = (async () => {
    const cache = await caches.open(CACHE), hit = await cache.match(MANIFEST);
    if (!hit) throw Error('Нет сохранённого списка материалов');
    const value = await hit.json();
    if (value.version !== VERSION || !Array.isArray(value.shell) || !Array.isArray(value.media)) throw Error('Неверный список материалов');
    return value;
  })().catch(error => { manifestPromise = null; throw error; });
  return manifestPromise;
}
async function mediaEntry(url) { return (await manifest()).media.find(x => canonical(x.url) === canonical(url)); }
async function mediaHit(url) {
  const cache = await caches.open(MEDIA_CACHE);
  const hit = await cache.match(canonical(url));
  if (hit) return hit;
  const names = (await caches.keys()).filter(n => n.startsWith('tingli-cache-')).reverse();
  for (const name of names) {
    const old = await caches.open(name), result = await old.match(canonical(url), { ignoreSearch: true });
    if (result) return cleanResponse(result, 'legacy');
  }
}
async function fallbackShell(path) {
  const current = await caches.open(CACHE), hit = await current.match(path, { ignoreSearch: true });
  if (hit) return hit;
  const names = (await caches.keys()).filter(n => n !== CACHE && (n.startsWith('tingli-shell-') || n.startsWith('tingli-cache-'))).reverse();
  for (const name of names) {
    const result = await (await caches.open(name)).match(path, { ignoreSearch: true });
    if (result) return cleanResponse(result);
  }
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  for (let i = 0; i < CORE_ASSETS.length; i += 4) {
    await Promise.all(CORE_ASSETS.slice(i, i + 4).map(async url => {
      try { const response = await timedFetch(url, { cache: 'reload' }); await put(cache, url, response); } catch (_) {}
    }));
  }
  for (const url of REQUIRED_ASSETS) if (!(await cache.match(url))) throw Error('tingli shell missing ' + url);
  await manifest();
  const html = await (await cache.match('./index.html')).text();
  if (!html.includes("const APP_VER = '" + VERSION + "'")) throw Error('tingli shell version mismatch');
  await self.skipWaiting();
})()));
async function migrateLegacy() {
  const target = await caches.open(MEDIA_CACHE), names = await caches.keys(), failed = new Set();
  for (const name of names.slice().reverse()) {
    if (!name.startsWith('tingli-cache-')) continue;
    const old = await caches.open(name);
    if (!old.keys) { failed.add(name); continue; }
    for (const request of await old.keys()) {
      if (!isMedia(request)) continue;
      try {
        const existing = await target.match(canonical(request));
        if (!existing) {
          const response = await old.match(request);
          if (response && response.ok) await put(target, canonical(request), response, 'legacy');
        }
      } catch (_) { failed.add(name); }
    }
  }
  const shells = names.filter(n => n !== CACHE && (n.startsWith('tingli-cache-') || n.startsWith('tingli-shell-')));
  const previous = shells[shells.length - 1];
  for (const name of shells) {
    if (name !== previous && !failed.has(name)) await caches.delete(name);
  }
}
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  await migrateLegacy();
})()));
async function serveMedia(request, event) {
  const hit = await mediaHit(request);
  if (hit) {
    event.waitUntil((async () => {
      const entry = await mediaEntry(request);
      if (entry && hit.headers.get('x-tingli-revision') !== entry.revision) {
        try {
          const response = await timedFetch(canonical(request) + '?offline=' + entry.revision, { cache: 'reload' });
          await put(await caches.open(MEDIA_CACHE), canonical(request), response, entry.revision);
        } catch (_) {}
      }
    })());
    return hit;
  }
  const entry = await mediaEntry(request);
  try {
    const response = await timedFetch(request, {});
    if (!response.ok) throw Error('HTTP ' + response.status);
    if (response.status !== 206) {
      const saved = put(await caches.open(MEDIA_CACHE), canonical(request), response.clone(), entry && entry.revision);
      event.waitUntil(saved.catch(() => {}));
    }
    return response;
  } catch (_) { return Response.error(); }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/tingli/')) return;
  if (isMedia(request)) { event.respondWith(serveMedia(request, event)); return; }
  const appEntry = url.pathname === '/tingli/' || url.pathname === '/tingli/index.html';
  const diagnostic = url.pathname === '/tingli/sync-check.html';
  if (appEntry || diagnostic) {
    event.respondWith((async () => {
      const path = diagnostic ? './sync-check.html' : './index.html', hit = await fallbackShell(path);
      if (hit) return hit; // Cold start never waits for a network request if a shell exists.
      try {
        const response = await timedFetch(request, {}, 4000);
        if (response.ok) return response;
      } catch (_) {}
      return new Response('<h1>Тингли не сохранён для офлайн</h1><p>Открой приложение при связи один раз и дождись подготовки.</p>', { status: 503, headers: { 'content-type': 'text/html;charset=utf-8' } });
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const response = await timedFetch(request, {});
      if (response.ok) event.waitUntil(put(cache, request, response.clone()).catch(() => {}));
      return response;
    } catch (_) { return Response.error(); }
  })());
});
function send(port, value) { try { if (port) port.postMessage(value); } catch (_) {} }
async function status(selected) {
  const list = await manifest(), shell = await caches.open(CACHE), media = await caches.open(MEDIA_CACHE);
  const selection = selected && new Set(selected.map(canonical));
  const items = selection ? list.media.filter(x => selection.has(canonical(x.url))) : list.media;
  if (selection && items.length !== selection.size) throw Error('Неизвестный файл урока');
  let have = 0, outdated = 0, totalBytes = 0, savedBytes = 0;
  const missing = [];
  if (!selection) for (const url of list.shell) {
    if (await shell.match(url, { ignoreSearch: true })) have++; else missing.push(url);
  }
  for (const item of items) {
    totalBytes += item.bytes;
    const hit = await mediaHit(item.url);
    if (hit) { have++; savedBytes += item.bytes; if (hit.headers.get('x-tingli-revision') !== item.revision) outdated++; }
    else missing.push(item.url);
  }
  const total = items.length + (selection ? 0 : list.shell.length);
  return { type: 'status', have, total, outdated, missing, totalBytes, savedBytes, ready: have === total && !outdated };
}
async function runDownload(selected, notify) {
  const list = await manifest(), shell = await caches.open(CACHE), media = await caches.open(MEDIA_CACHE);
  const selection = selected && new Set(selected.map(canonical));
  const items = list.media.filter(x => !selection || selection.has(canonical(x.url)));
  if (selection && items.length !== selection.size) throw Error('Неизвестный файл урока');
  const tasks = (selection ? [] : list.shell.map(url => ({ url, shell: true }))).concat(items);
  let done = 0;
  const failed = [];
  for (const item of tasks) {
    notify({ type: 'progress', done, total: tasks.length, failed: failed.length });
    const cache = item.shell ? shell : media, key = item.shell ? item.url : canonical(item.url);
    let hit = await cache.match(key, { ignoreSearch: !!item.shell });
    if (!hit || !item.shell && hit.headers.get('x-tingli-revision') !== item.revision) {
      let success = false;
      for (let attempt = 0; attempt < 2 && !success; attempt++) {
        notify({ type: 'progress', done, total: tasks.length, failed: failed.length });
        try {
          const url = item.shell ? item.url : canonical(item.url) + '?offline=' + item.revision;
          await downloadAsset(cache, key, url, item.revision,
            () => notify({ type: 'progress', done, total: tasks.length, failed: failed.length }));
          success = !!(await cache.match(key));
        } catch (_) {}
      }
      if (!success) failed.push(item.url);
    }
    done++;
    notify({ type: 'progress', done, total: tasks.length, failed: failed.length });
  }
  return { type: 'done', ok: tasks.length - failed.length, total: tasks.length, failed, status: await status(selected) };
}
self.addEventListener('message', event => {
  const data = event.data || {}, port = event.ports && event.ports[0];
  const task = (async () => {
    if (data.type === 'status' || data.type === 'verify') return status();
    if (data.type === 'unit-status') return status(data.urls || []);
    if (data.type === 'remove-files') {
      if (job) return { type: 'busy', error: 'Сначала дождись завершения загрузки' };
      await status(data.urls || []); // Validate app-owned URLs before deleting anything.
      const cache = await caches.open(MEDIA_CACHE);
      for (const url of data.urls || []) await cache.delete(canonical(url));
      for (const name of (await caches.keys()).filter(n => n.startsWith('tingli-cache-'))) {
        const old = await caches.open(name);
        for (const request of await old.keys()) {
          if ((data.urls || []).some(url => canonical(url) === canonical(request))) await old.delete(request);
        }
      }
      return { type: 'removed' };
    }
    if (data.type === 'precache' || data.type === 'download-files' || data.type === 'precache-unit') {
      const selected = data.type === 'precache' ? null : data.type === 'precache-unit' ?
        (await manifest()).media.filter(x => x.url.startsWith('./audio/' + data.unit + '-')).map(x => x.url) : data.urls || [];
      if (job) return { type: 'busy', error: 'Другая загрузка уже выполняется. Сохранённое не удалено.' };
      job = runDownload(selected, value => send(port, value));
      try { return await job; } finally { job = null; }
    }
    return { type: 'error', error: 'Неизвестная команда' };
  })().then(result => send(port, result)).catch(error => send(port, { type: 'error', error: error.message }));
  event.waitUntil(task);
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
