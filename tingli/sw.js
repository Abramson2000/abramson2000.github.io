// Service Worker «Тингли» — офлайн-режим (авиарежим / полёт)
// Стратегия: навигация (index.html) — network-first; статика и аудио — cache-first с дозаписью;
// /api/* (облачный бэкап) — только сеть, не кэшируется.
// data-build: v2.17 (2026-09-10: иконка 团队 — PNG как у остальных вкладок, в офлайн-кеше) + font-build: simsun-subset-STSong-1412 — маркер прекэша
const CACHE = 'tingli-cache-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './data/units.js',
  './data/extra.js',
  './data/idv.js',
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
  './fonts/simsun-subset.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
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
    }).catch(() => hit))
  );
});
