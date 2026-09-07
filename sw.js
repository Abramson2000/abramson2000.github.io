// sw.js — сервис-воркер ОТКЛЮЧЁН (приложение переведено на облако Supabase).
// Существующие регистрации снимаются, кэш чистится. Ничего не перехватываем.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    try { await self.registration.unregister(); } catch (_) {}
    try { await self.clients.claim(); } catch (_) {}
  })());
});
