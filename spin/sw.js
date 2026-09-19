// Service Worker «Навыки продаж» — офлайн-режим (авиарежим / полёт)
// Стратегия:
//   навигация (index.html) — network-first, при офлайне — кэш;
//   статика с ?v= — точный cache-first, при промахе — сеть с дозаписью,
//   при офлайне и промахе — «мягкий» поиск того же файла без query (старая версия лучше пустого экрана);
//   /api/* и внешние домены (supabase) — только сеть.
// Прекэш: все файлы приложения кладутся по одному; сбой одного файла НЕ ломает установку.
// Страница может запросить статус/скачивание: postMessage({type:'status'|'precache'}).
const CACHE = 'spin-cache-v97';

const CORE = [
  './',
  './index.html',
  './styles.css?v=crs97',
  './app.js?v=crs97',
  './data.js?v=crs97',
  './meddicc-data.js?v=crs97',
  './spiced-data.js?v=crs97',
  './proactive-data.js?v=crs97',
  './boss-gate.js?v=crs97',
  './remote-sales-data.js?v=crs97',
  './supabase.min.js',
  './manifest.webmanifest',
  './emblem-np.png',
  './emblem-np-solid.png?v=2',
  './hero-1.jpg',
  './hero-2.jpg',
  './hero-3.jpg',
  './hero-4.jpg',
  './hero-5.jpg',
  './hero-6.jpg',
  './hero-7.jpg',
  './hero-8.jpg',
  './hero-9.jpg',
  './hero-10.jpg'
];

// скачать все файлы приложения в кэш (по одному, устойчиво к единичным ошибкам)
async function precache(onProgress) {
  const c = await caches.open(CACHE);
  let done = 0;
  const failed = [];
  for (const u of CORE) {
    try {
      const r = await fetch(u, { cache: 'reload' });
      if (!r || !r.ok) throw new Error(String(r && r.status));
      await c.put(u, r.clone());
    } catch (e) {
      failed.push(u);
    }
    done++;
    if (onProgress) onProgress(done, CORE.length, failed.length);
  }
  return { total: CORE.length, ok: CORE.length - failed.length, failed: failed };
}

// что уже лежит в кэше
async function cacheStatus() {
  const c = await caches.open(CACHE);
  let have = 0;
  const missing = [];
  for (const u of CORE) {
    let hit = null;
    try { hit = await c.match(u); } catch (e) {}
    if (!hit) { try { hit = await c.match(u, { ignoreSearch: true }); } catch (e2) {} }
    if (hit) have++; else missing.push(u);
  }
  return { total: CORE.length, have: have, missing: missing, ready: have === CORE.length };
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  const data = e.data || {};
  const port = e.ports && e.ports[0];
  const reply = (msg) => { try { if (port) port.postMessage(msg); } catch (_) {} };
  if (data.type === 'status') {
    cacheStatus().then((s) => reply(Object.assign({ type: 'status' }, s))).catch(() => reply({ type: 'status', total: CORE.length, have: 0, ready: false }));
    return;
  }
  if (data.type === 'precache') {
    precache((done, total, failed) => { try { if (port) port.postMessage({ type: 'progress', done: done, total: total, failed: failed }); } catch (_) {} })
      .then((r) => reply(Object.assign({ type: 'precache-done' }, r)))
      .catch(() => reply({ type: 'precache-done', total: CORE.length, ok: 0, failed: CORE }));
    return;
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // supabase и чужие домены — мимо SW
  if (url.pathname.indexOf('/api/') !== -1) return; // API прогресса — только сеть

  // Навигация: сначала сеть (свежий index.html и новые ?v=), при ошибке — кэш
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const cp = r.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', cp));
          return r;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // Статика: точный кэш → сеть (с дозаписью) → при офлайне «мягкий» кэш без query
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r && r.ok) {
        const cp = r.clone();
        caches.open(CACHE).then((c) => c.put(req, cp));
      }
      return r;
    } catch (err) {
      const loose = await caches.match(req, { ignoreSearch: true });
      if (loose) return loose;
      throw err;
    }
  })());
});
