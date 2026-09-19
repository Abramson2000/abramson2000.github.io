// Service Worker «Тингли» — офлайн-режим (авиарежим / полёт)
// Стратегия: навигация (index.html) — network-first; статика и аудио — cache-first с дозаписью;
// /api/* (облачный бэкап) — только сеть, не кэшируется.
// data-build: v2.27.1 (2026-09-19: раздел «团队» — новый урок 面试困难 (unit 212): диалог, слова 1 (19), слова 2 (7), ДЗ с ИИ-проверкой) + font-build: simsun-subset-STSong-1488 — маркер прекэша
const CACHE = 'tingli-cache-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './data/units.js?v=2.27.1',
  './data/extra.js?v=2.27.1',
  './data/idv.js?v=2.27.1',
  './data/biz.js?v=2.27.1',
  './apple-touch-icon-v2.png',
  './apple-touch-icon.png',
  './bg.jpg',
  './dict.png',
  './favicon-v2.png',
  './favicon.png',
  './favs.png',
  './grammar.png',
  './icon-192-v2.png',
  './icon-192.png',
  './icon-512-v2.png',
  './icon-512.png',
  './icon-v1.png',
  './idv.png',
  './logo.png',
  './recolored_tab-ci-off.png',
  './recolored_tab-ci.png',
  './recolored_tab-fa-off.png',
  './recolored_tab-fa.png',
  './recolored_tab-ju-off.png',
  './recolored_tab-ju.png',
  './recolored_tab-ting-off.png',
  './recolored_tab-ting.png',
  './recolored_tab-yu-off.png',
  './recolored_tab-yu.png',
  './tab-ci-off.png',
  './tab-biz.png',
  './tab-biz-off.png',
  './tab-tuan.png',
  './tab-tuan-off.png',
  './tab-ci.png',
  './tab-fa-off.png',
  './tab-fa.png',
  './tab-ju-off.png',
  './tab-ju.png',
  './tab-ting-off.png',
  './tab-ting.png',
  './tab-yu-off.png',
  './tab-yu.png',
  './tingli-favicon.png',
  './tingli-icon-180.png',
  './tingli-icon-192.png',
  './tingli-icon-512.png',
  './title.png',
  './img/201.jpg',
  './fonts/inter-cyr-400.woff2',
  './fonts/inter-cyr-600.woff2',
  './fonts/inter-cyr-700.woff2',
  './fonts/inter-cyr-800.woff2',
  './fonts/roboto-cyr-400.woff2',
  './fonts/roboto-cyr-500.woff2',
  './fonts/roboto-cyr-700.woff2',
  './fonts/rubik-cyr-400.woff2',
  './fonts/rubik-cyr-600.woff2',
  './fonts/rubik-cyr-700.woff2',
  './fonts/rubik-cyr-800.woff2',
  './fonts/simsun-subset.woff2?v=2.27.1',
  './fonts/xiaoshan-mashan.woff2',
  './fonts/xiaoshan-title.woff2?v=2.23.3',
  './fonts/xiaoshan-longcang.woff2',
  './fonts/xiaoshan-klee.woff2'
];

// скачать все файлы приложения в кэш (по одному — сбой одного файла не ломает остальные)
async function precache(onProgress) {
  const c = await caches.open(CACHE);
  let done = 0;
  const failed = [];
  for (const u of ASSETS) {
    try {
      const r = await fetch(u, { cache: 'reload' });
      if (!r || !r.ok) throw new Error(String(r && r.status));
      await c.put(u, r.clone());
    } catch (e) {
      failed.push(u);
    }
    done++;
    if (onProgress) onProgress(done, ASSETS.length, failed.length);
  }
  return { total: ASSETS.length, ok: ASSETS.length - failed.length, failed: failed };
}

// что уже лежит в кэше (без учёта query — версии меняются)
async function cacheStatus() {
  const c = await caches.open(CACHE);
  let have = 0;
  const missing = [];
  for (const u of ASSETS) {
    let hit = null;
    try { hit = await c.match(u); } catch (e) {}
    if (!hit) { try { hit = await c.match(u, { ignoreSearch: true }); } catch (e2) {} }
    if (hit) have++; else missing.push(u);
  }
  return { total: ASSETS.length, have: have, missing: missing, ready: have === ASSETS.length };
}

self.addEventListener('message', (e) => {
  const data = e.data || {};
  const port = e.ports && e.ports[0];
  const reply = (msg) => { try { if (port) port.postMessage(msg); } catch (_) {} };
  if (data.type === 'status') {
    cacheStatus().then((s) => reply(Object.assign({ type: 'status' }, s))).catch(() => reply({ type: 'status', total: ASSETS.length, have: 0, ready: false }));
    return;
  }
  if (data.type === 'precache') {
    precache((done, total, failed) => { try { if (port) port.postMessage({ type: 'progress', done: done, total: total, failed: failed }); } catch (_) {} })
      .then((r) => reply(Object.assign({ type: 'precache-done' }, r)))
      .catch(() => reply({ type: 'precache-done', total: ASSETS.length, ok: 0, failed: ASSETS }));
    return;
  }
});

self.addEventListener('install', (e) => {
  // cache:'reload' — тянем свежие файлы в обход HTTP-кеша (иначе после деплоя
  // можно закешировать старые data/*.js и «потерять» новый урок)
  e.waitUntil(precache().then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') !== -1) return; // бэкап — только сеть

  // Навигация: сначала сеть (свежий index.html), при ошибке — кэш
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

  // Статика и аудио: cache-first, при промахе — сеть с дозаписью в кэш.
  // Аудио качаем в обход HTTP-кэша браузера (cache:no-store), чтобы удаление
  // из Cache Storage действительно делало файл недоступным офлайн.
  const isAudio = url.pathname.indexOf('/audio/') !== -1;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req, isAudio ? { cache: 'no-store' } : {}).then((r) => {
      if (r.ok) {
        const cp = r.clone();
        caches.open(CACHE).then((c) => c.put(req, cp));
      }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((loose) => loose || hit)))
  );
});
