const CACHE='my-china-v2.6.0';
const ASSETS=[
  './','./index.html','./styles.css?v=2.6.0','./data.js?v=2.6.0','./favorites.js?v=2.6.0','./app.js?v=2.6.0','./manifest.json?v=2.6.0',
  './assets/brand/logo-main.webp','./assets/brand/logo-main.png','./assets/brand/app-icon-192.png','./assets/brand/app-icon-512.png','./assets/guide/china-relief-map.webp','./assets/guide/mobile-bg.jpg','./assets/library/china-geography-cover.webp','./assets/library/china-geography-territory-page.webp','./assets/library/china-geography-relief-page.webp','./assets/sections/library.svg','./assets/sections/tea.svg','./assets/sections/trips.svg','./assets/fonts/noto-serif-sc-reg.woff2','./assets/fonts/noto-serif-sc-bold.woff2'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
const PREFIX='my-china-';
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.indexOf(PREFIX)===0).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{ if(e.request.method!=='GET') return; e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request))); });
