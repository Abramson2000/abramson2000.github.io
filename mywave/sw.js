const CACHE='mywave-0.14.0';
const SHELL=['./','./index.html','./assets/bg.jpg','./assets/logo.png','./assets/i1.png','./assets/i2.png','./assets/i3.png','./assets/i4.png','./assets/i5.png','./assets/i6.png','./assets/i7.png','./assets/i8.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()).catch(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE&&x.startsWith('mywave-')).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(c2=>c2.put(r,c))}return res}).catch(()=>hit)));
});
