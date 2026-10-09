// Сервис-воркер словаря /cidian/.
// Версию приложения (V) синхронно проставляет scripts/cidian_bump.py:
// из неё собираются и ссылки ?v=, и имя кэша — так обновления доезжают до телефона.
const V = '2.17.0';
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
  './app.' + V + '.js',
  './sync-core.' + V + '.js',
  './sync-transport.' + V + '.js',
  './word-sync.' + V + '.js',
  './data-bkrs.js?v=' + V,
  './manifest.json',
  './favicon-2.17.0.ico',
  './favicon-2.17.0-32.png',
  './favicon-2.17.0-192.png',
  './icon-192-v4.png',
  './icon-512-v4.png',
  './icon-512-maskable-v4.png',
  './apple-touch-icon-v4.png',
  './apple-touch-icon-v5.png',
  './landscape-v3.webp',
  './fonts/noto-serif-sc-reg.woff2',
  './fonts/noto-serif-sc-bold.woff2',
];
const DATA_FILES = ['./restore-2026-10-07.js'];
const CORE = ASSETS.concat(DATA_FILES);
// минимум, без которого приложение не считается готовым к офлайну
const REQUIRED = ['./index.html', './app.' + V + '.js',
  './sync-core.' + V + '.js',
  './sync-transport.' + V + '.js',
  './word-sync.' + V + '.js', './restore-2026-10-07.js'];

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
    // СЕТЬ-ВПЕРЁД: иначе новая версия приложения доезжает только со второго открытия
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(request.url, { cache: 'no-store' });
        if (res && res.ok) {
          // ВАЖНО: в кэш отдаём КЛОН — иначе тело оригинала «съедается»
          // и Safari падает с "Response is disturbed or locked".
          try { await putClean(cache, './index.html', res.clone()); } catch (_) {}
          return res;
        }
      } catch (_) {}
      const hit = (await cache.match('./index.html')) || (await cache.match('./'));
      return hit || new Response('<h1>Нет сети</h1><p>Словарь не был открыт онлайн на этом устройстве.</p>',
        { status: 503, headers: { 'content-type': 'text/html;charset=utf-8' } });
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit) return hit;
    try {
      const res = await fetch(request);
      if (res && res.ok) { try { await putClean(cache, request, res.clone()); } catch (_) {} }
      return res;
    } catch (_) {
      const loose = await cache.match(request, { ignoreSearch: true });
      return loose || Response.error();
    }
  })());
});
