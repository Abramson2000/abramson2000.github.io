// Service Worker «Навыки продаж» — офлайн-режим (авиарежим / полёт)
// Стратегия:
//   навигация (index.html) — network-first, при офлайне — кэш;
//   статика с ?v= — точный cache-first, при промахе — сеть с дозаписью,
//   при офлайне и промахе — «мягкий» поиск того же файла без query (старая версия лучше пустого экрана);
//   /api/* и внешние домены (supabase) — только сеть.
// Прекэш: все файлы приложения кладутся по одному; сбой одного файла НЕ ломает установку.
// Страница может запросить статус/скачивание: postMessage({type:'status'|'precache'}).
const CACHE = 'spin-cache-3.0.1.5-safe';

// Cloudflare отдаёт файлы сжатыми (content-encoding: br), а Cache API хранит уже
// распакованное тело: если отдать такую запись на НАВИГАЦИЮ, браузер пытается
// распаковать её второй раз и падает с net::ERR_FAILED. Поэтому перед записью
// в кэш снимаем заголовки сжатия и длину.
async function putClean(cache, key, res) {
  try {
    if (!res || !res.ok) return;
    let out = res;
    if (res.headers.get('content-encoding') || res.headers.get('content-length')) {
      const h = new Headers(res.headers);
      h.delete('content-encoding'); h.delete('content-length'); h.delete('content-range');
      out = new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: h });
    }
    await cache.put(key, out);
  } catch (e) {}
}

const CORE = [
  './',
  './index.html',
  './styles.css?v=3.0.1.5',
  './app.js?v=3.0.1.5',
  './data.js?v=3.0.1.5',
  './meddicc-data.js?v=3.0.1.5',
  './spiced-data.js?v=3.0.1.5',
  './proactive-data.js?v=3.0.1.5',
  './boss-gate.js?v=3.0.1.5',
  './remote-sales-data.js?v=3.0.1.5',
  './channel-sales-data.js?v=3.0.1.5',
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
      await putClean(c, u, r.clone());
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
  e.waitUntil((async () => {
    const r = await precache();
    const c = await caches.open(CACHE);
    // Без этих файлов приложение не запускается. Если они не скачались —
    // не активируем новый worker, оставляем предыдущую рабочую версию.
    const required = [
      './index.html',
      './styles.css?v=3.0.1.5',
      './app.js?v=3.0.1.5',
      './data.js?v=3.0.1.5',
      './meddicc-data.js?v=3.0.1.5',
      './spiced-data.js?v=3.0.1.5',
      './proactive-data.js?v=3.0.1.5',
      './boss-gate.js?v=3.0.1.5',
      './remote-sales-data.js?v=3.0.1.5',
      './channel-sales-data.js?v=3.0.1.5',
      './supabase.min.js'
    ];
    for (const u of required) {
      if (!(await c.match(u))) throw new Error('SPIN precache incomplete: ' + u);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
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

function fetchNavFast(req, timeoutMs) {
  return Promise.race([
    fetch(req, { cache: 'no-store' }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('nav-timeout')), timeoutMs || 1200))
  ]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // supabase и чужие домены — мимо SW
  if (url.pathname.indexOf('/api/') !== -1) return; // API прогресса — только сеть

  // Навигация: кэш сначала. Это надёжнее для iOS/авиарежима.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      let hit = (await c.match('./index.html')) || (await c.match('./'));
      if (!hit) {
        const keys = (await caches.keys()).filter((k) => k.startsWith('spin-cache-') && k !== CACHE).reverse();
        for (const k of keys) {
          const old = await caches.open(k);
          hit = (await old.match('./index.html')) || (await old.match('./'));
          if (hit) break;
        }
      }
      if (hit) {
        fetch(req, { cache: 'no-store' }).then((r) => {
          if (r && r.ok) putClean(c, './index.html', r.clone());
        }).catch(() => {});
        return hit;
      }
      try {
        const r = await fetchNavFast(req, 1200);
        if (r && r.ok) await putClean(c, './index.html', r.clone());
        return r;
      } catch (e) {
        return new Response('<h1>Нет сети</h1>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
    })());
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
        caches.open(CACHE).then((c) => putClean(c, req, cp));
      }
      return r;
    } catch (err) {
      const loose = await caches.match(req, { ignoreSearch: true });
      if (loose) return loose;
      throw err;
    }
  })());
});
