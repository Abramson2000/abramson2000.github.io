// Сервис-воркер словаря /cidian/.
// Версию приложения (V) синхронно проставляет scripts/cidian_bump.py:
// из неё собираются и ссылки ?v=, и имя кэша — так обновления доезжают до телефона.
const V = '2.8.36';
const CACHE = 'cidian-cache-v' + V;

// ВАЖНО: Cloudflare (и иногда GitHub) отдают файлы сжатыми (content-encoding: br/gzip),
// а Cache API хранит уже РАСПАКОВАННОЕ тело. Если отдать такое из кэша, браузер
// пытается распаковать второй раз — и навигация падает с net::ERR_FAILED.
// Поэтому перед записью в кэш снимаем заголовки сжатия и длину.
async function cleanResponse(res) {
  if (!res || !res.ok) return res;
  if (!res.headers.get('content-encoding') && !res.headers.get('content-length')) return res;
  const headers = new Headers(res.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('content-range');
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers });
}

async function putClean(cache, key, res) {
  try { await cache.put(key, await cleanResponse(res)); } catch (_) {}
}
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=' + V,
  './app.js?v=' + V,
  './data-bkrs.js?v=' + V,
  './manifest.json',
  './icon-192-v4.png',
  './icon-512-v4.png',
  './icon-512-maskable-v4.png',
  './apple-touch-icon-v4.png',
  './landscape-v3.webp',
  './fonts/noto-serif-sc-reg.woff2',
  './fonts/noto-serif-sc-bold.woff2',
];
const DATA_FILES = Array.from({ length: 18 }, (_, i) => './data-' + String(i + 1).padStart(2, '0') + '.js?v=' + V);
const CORE = ASSETS.concat(DATA_FILES);
// минимум, без которого приложение не считается готовым к офлайну
const REQUIRED = ['./index.html', './app.js?v=' + V, './data-01.js?v=' + V];

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  // качаем по одному: если один ассет недоступен, установка не падает целиком
  for (const url of CORE) {
    try {
      const res = await fetch(url, { cache: 'reload' });
      if (res && res.ok) await putClean(cache, url, res);
    } catch (_) {}
  }
  for (const url of REQUIRED) {
    if (!(await cache.match(url))) throw new Error('cidian shell missing ' + url);
  }
  await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('cidian-cache-') && k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/cidian/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = (await cache.match('./index.html')) || (await cache.match('./'));
      if (hit) {
        // свежую версию тянем фоном; строковый URL — чтобы не тащить navigate-режим
        setTimeout(() => {
          fetch(request.url, { cache: 'no-store' })
            .then(res => putClean(cache, './index.html', res))
            .catch(() => {});
        }, 0);
        return hit;
      }
      try {
        const res = await fetch(request, { cache: 'no-store' });
        if (res && res.ok) await putClean(cache, './index.html', res);
        return res;
      } catch (_) {
        return new Response('<h1>Нет сети</h1><p>Словарь не был открыт онлайн на этом устройстве.</p>',
          { status: 503, headers: { 'content-type': 'text/html;charset=utf-8' } });
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit) return hit;
    try {
      const res = await fetch(request);
      if (res && res.ok) await putClean(cache, request, res);
      return res;
    } catch (_) {
      const loose = await cache.match(request, { ignoreSearch: true });
      return loose || Response.error();
    }
  })());
});
