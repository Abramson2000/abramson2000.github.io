// Offline shell: immutable release files, complete installation, no network wait.
const VERSION = '3.2.0';
const CACHE = 'spin-cache-' + VERSION + '-offline';
const ENTRY = './index.'+VERSION+'.html';
const CORE = [ENTRY, './styles.'+VERSION+'.css', './app.'+VERSION+'.js',
 ...['data','meddicc-data','spiced-data','proactive-data','boss-gate','remote-sales-data','channel-sales-data'].map(n=>'./'+n+'.'+VERSION+'.js'),
 './supabase.'+VERSION+'.min.js', './manifest.'+VERSION+'.webmanifest',
 './emblem-np.png', './emblem-np-solid.png',
 ...Array.from({length:10},(_,i)=>'./hero-'+(i+1)+'.jpg')];
async function download(url,cache,timeout=30000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const r=await fetch(url,{cache:'reload',signal:controller.signal});
  if(!r.ok)throw Error('HTTP '+r.status);
  const headers=new Headers(r.headers);
  for(const h of ['content-encoding','content-length','content-range'])headers.delete(h);
  await cache.put(url,new Response(await r.blob(),{status:r.status,statusText:r.statusText,headers}));
 }finally{clearTimeout(timer);}
}
async function cacheStatus(){
 const cache=await caches.open(CACHE),missing=[];
 for(const url of CORE)if(!(await cache.match(url)))missing.push(url);
 return {version:VERSION,total:CORE.length,have:CORE.length-missing.length,missing,ready:!missing.length};
}
self.addEventListener('install',e=>e.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const url of CORE){
  try{await download(url,cache);}
  catch(error){throw Error('SPIN precache incomplete: '+url+' '+error.message);}
 }
 if(!(await cacheStatus()).ready)throw Error('SPIN incomplete');
 await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
async function previous(){
 return (await caches.keys()).filter(k=>k.startsWith('spin-cache-')&&k!==CACHE).reverse();
}
async function matchPrevious(request){
 for(const name of await previous()){
  const hit=await(await caches.open(name)).match(request);if(hit)return hit;
 }
}
async function shell(){
 const cache=await caches.open(CACHE),hit=await cache.match(ENTRY);if(hit)return hit;
 for(const name of await previous()){
  const old=await caches.open(name),keys=await old.keys();
  const entry=keys.find(k=>/\/index\.\d+\.\d+\.\d+\.html$/.test(new URL(k.url).pathname));
  const hit=entry&&await old.match(entry)||await old.match('./index.html')||await old.match('./');
  if(hit)return hit;
 }
 try{await download(ENTRY,cache,4000);return await cache.match(ENTRY);}
 catch(_){return new Response('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Навыки продаж — нет сети</title><h1>Нет сохранённой копии приложения</h1><p>Откройте «Навыки продаж» при связи и проверьте загрузку для полёта. Прогресс не сбрасывался.</p></html>',{status:503,headers:{'content-type':'text/html;charset=utf-8'}});}
}
self.addEventListener('fetch',e=>{
 const req=e.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/spin/'))return;
 if(req.mode==='navigate'&&['/spin/','/spin/index.html','/spin/index.'+VERSION+'.html'].includes(url.pathname)){
  e.respondWith(shell());return;
 }
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE),hit=await cache.match(req)||await matchPrevious(req);
  if(hit)return hit;
  // Image query aliases reference the same preserved artwork.
  if(/\.(png|jpg)$/.test(url.pathname)){
   const image=await cache.match(req,{ignoreSearch:true});if(image)return image;
  }
  try{return await fetch(req);}catch(_){return Response.error();}
 })());
});
let downloadJob=null;
self.addEventListener('message',e=>{
 const data=e.data||{},port=e.ports&&e.ports[0];if(!port||!['status','precache'].includes(data.type))return;
 e.waitUntil((async()=>{
  try{
   if(data.type==='precache'){
    if(downloadJob)throw Error('Загрузка уже идёт');
    downloadJob=(async()=>{
     const cache=await caches.open(CACHE),status=await cacheStatus();let done=status.have;
     for(const url of status.missing){
      port.postMessage({type:'progress',done,total:CORE.length,failed:0});
      await download(url,cache);done++;
      port.postMessage({type:'progress',done,total:CORE.length,failed:0});
     }
    })();
    try{await downloadJob;}finally{downloadJob=null;}
   }
   const status=await cacheStatus();
   port.postMessage(Object.assign({type:data.type==='status'?'status':'precache-done',ok:status.have,failed:status.missing},status));
  }catch(error){
   const status=await cacheStatus();
   port.postMessage(Object.assign({type:'precache-done',error:error.message,ok:status.have,failed:status.missing},status));
  }
 })());
});
