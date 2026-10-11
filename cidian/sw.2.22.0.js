// A complete version-pinned shell starts without waiting for the network.
const V = '2.22.0';
const CACHE = 'cidian-cache-v' + V + '-offline';
const ENTRY = './index.' + V + '.html';
const CORE = [ENTRY, './styles.'+V+'.css', './app.'+V+'.js', './offline.'+V+'.js',
 './sync-core.'+V+'.js', './sync-transport.'+V+'.js', './word-sync.'+V+'.js',
 './restore-2026-10-07.js', './data-bkrs.'+V+'.js', './manifest.'+V+'.json',
 './favicon-20261010.ico', './apple-touch-icon-20261010.png', './icon-192-v4.png',
 './icon-512-v4.png', './icon-512-maskable-v4.png', './landscape-v3.webp',
 './fonts/noto-serif-sc-reg.woff2', './fonts/noto-serif-sc-bold.woff2'];
async function download(url, cache, timeout=30000) {
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeout);
 try {
  const res=await fetch(url,{cache:'reload',signal:controller.signal});
  if(!res.ok)throw Error('HTTP '+res.status);
  const headers=new Headers(res.headers);
  for(const h of ['content-encoding','content-length','content-range'])headers.delete(h);
  await cache.put(url,new Response(await res.blob(),{status:res.status,statusText:res.statusText,headers}));
 } finally {clearTimeout(timer);}
}
async function status(){
 const cache=await caches.open(CACHE),missing=[];
 for(const url of CORE)if(!(await cache.match(url)))missing.push(url);
 return {version:V,total:CORE.length,have:CORE.length-missing.length,missing,ready:!missing.length};
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const url of CORE){
  try {await download(url,cache);}
  catch(error){throw Error('cidian shell missing '+url+': '+error.message);}
 }
 if(!(await status()).ready)throw Error('cidian shell incomplete');
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 // Preserve prior caches: an old open page may still need its own scripts.
 await self.clients.claim();
})()));
async function previous(){
 return (await caches.keys()).filter(k=>k.startsWith('cidian-cache-')&&k!==CACHE).reverse();
}
async function cached(request){
 const hit=await (await caches.open(CACHE)).match(request);if(hit)return hit;
 for(const name of await previous()){
  const hit=await (await caches.open(name)).match(request);if(hit)return hit;
 }
}
function unavailable(){
 return new Response('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Словарь — нет сети</title><body><h1>Нет сохранённой копии Словаря</h1><p>Откройте Словарь при связи и проверьте готовность к полёту в разделе «Ещё». Ваши слова не удалены.</p></body></html>',{status:503,headers:{'content-type':'text/html;charset=utf-8'}});
}
async function shell(){
 const cache=await caches.open(CACHE),hit=await cache.match(ENTRY);if(hit)return hit;
 for(const name of await previous()){
  const old=await caches.open(name),keys=await old.keys();
  const entry=keys.find(k=>/\/index\.\d+\.\d+\.\d+\.html$/.test(new URL(k.url).pathname));
  const hit=entry&&await old.match(entry)||await old.match('./index.html')||await old.match('./');
  if(hit)return hit;
 }
 try {await download(ENTRY,cache,4000);return await cache.match(ENTRY)||unavailable();}
 catch(_){return unavailable();}
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/cidian/'))return;
 if(request.mode==='navigate'&&['/cidian/','/cidian/index.html','/cidian/index.'+V+'.html'].includes(url.pathname)){
  event.respondWith(shell());return;
 }
 event.respondWith((async()=>{
  const hit=await cached(request);if(hit)return hit;
  try{return await fetch(request);}catch(_){return Response.error();}
 })());
});
let repairJob=null;
self.addEventListener('message',event=>{
 const data=event.data||{},port=event.ports&&event.ports[0];
 if(!port||!['cidian-offline-status','cidian-offline-repair'].includes(data.type))return;
 event.waitUntil((async()=>{
  try{
   if(data.type==='cidian-offline-repair'){
    if(repairJob)throw Error('Загрузка уже идёт');
    repairJob=(async()=>{
     const cache=await caches.open(CACHE),initial=await status();
     for(const url of initial.missing){port.postMessage({progress:true,url});await download(url,cache);}
    })();
    try{await repairJob;}finally{repairJob=null;}
   }
   port.postMessage(await status());
  }catch(error){port.postMessage({version:V,error:error.message});}
 })());
});
