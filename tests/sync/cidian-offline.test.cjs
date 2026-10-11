const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=__dirname+'/../..',base='https://crmuro.ru/cidian/',name='cidian-cache-v2.22.0-offline';
const html=fs.readFileSync(root+'/cidian/index.2.22.0.html','utf8');
function worker(stores=new Map()){
 const handlers={},requests=[],rejected=new Set();let hung=false,offline=false,quota=false,skipped=false;
 const key=x=>new URL(typeof x==='string'?x:x.url,base).href;
 function cache(n){
  if(!stores.has(n)){
   const rows=new Map();stores.set(n,{rows,async put(k,r){if(quota)throw Error('quota');rows.set(key(k),r.clone());},
    async match(k){return rows.get(key(k))?.clone();},async keys(){return [...rows.keys()].map(u=>new Request(u));}});
  }return stores.get(n);
 }
 const fetch=async(u,o={})=>{
  requests.push(key(u));if(offline||rejected.has(new URL(key(u)).pathname))throw Error('offline');
  if(hung)return new Promise((_,reject)=>o.signal?.addEventListener('abort',()=>reject(Error('aborted'))));
  return new Response(key(u).endsWith('index.2.22.0.html')?html:'file',{headers:{'content-encoding':'br','content-length':'999'}});
 };
 vm.runInNewContext(fs.readFileSync(root+'/cidian/sw.js','utf8'),{URL,Response,Headers,Request,AbortController,
  setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,30)),clearTimeout,fetch,
  caches:{open:async n=>cache(n),keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n)},
  self:{location:{origin:'https://crmuro.ru'},addEventListener:(t,f)=>handlers[t]=f,skipWaiting:async()=>skipped=true,clients:{claim:async()=>{}}}});
 async function lifecycle(t){let p;handlers[t]({waitUntil:x=>p=x});return p;}
 async function message(type){const rows=[];let p;handlers.message({data:{type},ports:[{postMessage:x=>rows.push(x)}],waitUntil:x=>p=x});await p;return rows.at(-1);}
 function request(path='./',mode='navigate'){let p;handlers.fetch({request:{url:key(path),method:'GET',mode},respondWith:x=>p=x});return p;}
 return {stores,cache,requests,rejected,lifecycle,message,request,skipped:()=>skipped,hung:()=>hung=true,offline:()=>offline=true,quota:()=>quota=true};
}
test('Cidian starts from its pinned complete shell without any network wait',async()=>{
 const w=worker();await w.lifecycle('install');w.hung();const before=w.requests.length;
 const r=await w.request('./?v=old');assert.equal(await r.text(),html);assert.equal(w.requests.length,before);
 const check=await w.message('cidian-offline-status');assert.equal(check.ready,true);assert.equal(check.total,18);
});
for(const file of ['styles.2.22.0.css','data-bkrs.2.22.0.js','offline.2.22.0.js','fonts/noto-serif-sc-reg.woff2']){
 test('incomplete Cidian '+file+' cannot activate or remove the prior app',async()=>{
  const w=worker();w.cache('cidian-cache-old');w.rejected.add('/cidian/'+file);
  await assert.rejects(w.lifecycle('install'),/shell missing/);assert.equal(w.skipped(),false);assert.ok(w.stores.has('cidian-cache-old'));
 });
}
test('Cidian reports missing files offline and repairs exactly those files',async()=>{
 const w=worker();await w.lifecycle('install');w.cache(name).rows.delete(base+'data-bkrs.2.22.0.js');
 const cold=worker(w.stores);cold.offline();const check=await cold.message('cidian-offline-status');assert.equal(check.ready,false);assert.equal(check.have,17);
 const resumed=worker(w.stores);const report=await resumed.message('cidian-offline-repair');
 assert.equal(report.ready,true);assert.deepEqual(resumed.requests,[base+'data-bkrs.2.22.0.js']);
});
test('Cidian update retains old pages, Tingli caches and the previous shell',async()=>{
 const w=worker();await w.cache('cidian-cache-old').put('./index.html',new Response('old shell'));
 w.cache('tingli-media-v1');await w.lifecycle('install');await w.lifecycle('activate');
 assert.ok(w.stores.has('cidian-cache-old'));assert.ok(w.stores.has('tingli-media-v1'));
 w.cache(name).rows.delete(base+'index.2.22.0.html');w.hung();
 assert.equal(await (await w.request()).text(),'old shell');
});
test('Cidian provides an explicit offline page if all saved shells are missing',async()=>{
 const w=worker();w.offline();const r=await w.request();assert.equal(r.status,503);assert.match(await r.text(),/Ваши слова не удалены/);
});
test('hanging network with no Cidian shell has a bounded timeout',async()=>{
 const w=worker();w.hung();assert.equal((await w.request()).status,503);
});
test('Cidian storage failure prevents activation and compression headers are removed',async()=>{
 const fail=worker();fail.quota();await assert.rejects(fail.lifecycle('install'),/quota/);assert.equal(fail.skipped(),false);
 const w=worker();await w.lifecycle('install');const r=await w.request();assert.equal(r.headers.has('content-encoding'),false);assert.equal(r.headers.has('content-length'),false);
});
test('Cidian new generic HTML cannot replace the installed version-pinned shell',async()=>{
 const w=worker();await w.lifecycle('install');await w.request('./index.html');
 assert.equal(w.requests.some(u=>u.endsWith('/index.html')),false);assert.equal(await (await w.request()).text(),html);
});
test('Cidian update offers a manual reload without reloading automatically',async()=>{
 const source=fs.readFileSync(root+'/cidian/app.js','utf8'),events=[],toasts=[];let reloads=0;
 const reg={update:()=>Promise.resolve()};
 const ctx={navigator:{serviceWorker:{controller:{},addEventListener:(t,f)=>events.push(f),register:()=>Promise.resolve(reg)}},
  document:{visibilityState:'visible',addEventListener(){}},window:{addEventListener(){}},location:{reload:()=>reloads++},
  toast:(...a)=>toasts.push(a)};
 vm.runInNewContext(source.slice(source.indexOf("if('serviceWorker' in navigator)")),ctx);
 await Promise.resolve();for(const f of events)f();
 assert.equal(reloads,0);assert.equal(toasts.length,1);
 toasts[0][2]();assert.equal(reloads,1);
});
