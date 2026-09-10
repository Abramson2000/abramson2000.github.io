// Service Worker «Навыки продаж» — офлайн-режим (авиарежим)
// Стратегия: навигация (index.html) — network-first; статика с ?v= — cache-first;
// API и внешние домены (supabase) — только сеть, не кэшируются.
const CACHE = 'spin-cache-v81';

const ASSETS = [
  './',
  './index.html',
  './styles.css?v=crs61',
  './app.js?v=crs61',
  './data.js?v=crs61',
  './meddicc-data.js?v=crs61',
  './bariga-data.js?v=crs61',
  './spiced-data.js?v=crs61',
  './proactive-data.js?v=crs61',
  './supabase.min.js',
  './emblem-np.png',
  './emblem-np-solid.png',
  './hero-1.jpg',
  './hero-2.jpg',
  './hero-3.jpg',
  './hero-4.jpg?v=crs68',
  './hero-5.jpg?v=crs68',
  './hero-6.jpg?v=crs68',
  './hero-7.jpg?v=crs68',
  './hero-8.jpg?v=crs68',
  './hero-9.jpg?v=crs68',
  './hero-10.jpg?v=crs68',
  './manifest.webmanifest'
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
  if (url.origin !== self.location.origin) return; // supabase и чужие домены — мимо
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

  // Статика: cache-first, при промахе — сеть с дозаписью в кэш
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) {
        const cp = r.clone();
        caches.open(CACHE).then((c) => c.put(req, cp));
      }
      return r;
    }))
  );
});
