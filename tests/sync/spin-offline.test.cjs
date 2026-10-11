const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=__dirname+'/../..',base='https://crmuro.ru/spin/',name='spin-cache-3.2.0-offline';
const html=fs.readFileSync(root+'/spin/index.3.2.0.html','utf8');
function worker(stores=new Map()){
 const handlers={},requests=[],rejected=new Set();let hung=false,offline=false,quota=false,skipped=false;
 const key=x=>new URL(typeof x==='string'?x:x.url,base).href;
 function cache(n){
  if(!stores.has(n)){
   const rows=new Map();stores.set(n,{rows,async put(k,r){if(quota)throw Error('quota');rows.set(key(k),r.clone());},
    async match(k,o={}){let hit=rows.get(key(k));if(!hit&&o.ignoreSearch)hit=[...rows].find(([u])=>u.split('?')[0]===key(k).split('?')[0])?.[1];return hit?.clone();},async keys(){return [...rows.keys()].map(u=>new Request(u));}});
  }return stores.get(n);
 }
 const fetch=async(u,o={})=>{
  requests.push(key(u));if(offline||rejected.has(new URL(key(u)).pathname))throw Error('offline');
  if(hung)return new Promise((_,reject)=>o.signal?.addEventListener('abort',()=>reject(Error('aborted'))));
  return new Response(key(u).endsWith('index.3.2.0.html')?html:'file',{headers:{'content-encoding':'br','content-length':'999'}});
 };
 vm.runInNewContext(fs.readFileSync(root+'/spin/sw.js','utf8'),{URL,Response,Headers,Request,AbortController,
  setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,30)),clearTimeout,fetch,
  caches:{open:async n=>cache(n),keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n)},
  self:{location:{origin:'https://crmuro.ru'},addEventListener:(t,f)=>handlers[t]=f,skipWaiting:async()=>skipped=true,clients:{claim:async()=>{}}}});
 async function lifecycle(t){let p;handlers[t]({waitUntil:x=>p=x});return p;}
 async function message(type){const rows=[];let p;handlers.message({data:{type},ports:[{postMessage:x=>rows.push(x)}],waitUntil:x=>p=x});await p;return rows.at(-1);}
 function request(path='./',mode='navigate'){let p;handlers.fetch({request:{url:key(path),method:'GET',mode},respondWith:x=>p=x});return p;}
 return {stores,cache,requests,rejected,lifecycle,message,request,skipped:()=>skipped,hung:()=>hung=true,offline:()=>offline=true,quota:()=>quota=true};
}
test('SPIN cold start uses a complete pinned shell without any network request',async()=>{
 const w=worker();await w.lifecycle('install');w.hung();const before=w.requests.length;
 assert.equal(await(await w.request('./?v=old')).text(),html);assert.equal(w.requests.length,before);
 const status=await w.message('status');assert.equal(status.ready,true);assert.equal(status.total,24);
});
for(const file of ['styles.3.2.0.css','data.3.2.0.js','supabase.3.2.0.min.js','hero-10.jpg']){
 test('missing SPIN '+file+' prevents activation and preserves prior app',async()=>{
  const w=worker();w.cache('spin-cache-old');w.rejected.add('/spin/'+file);
  await assert.rejects(w.lifecycle('install'),/incomplete/);assert.equal(w.skipped(),false);assert.ok(w.stores.has('spin-cache-old'));
 });
}
test('SPIN resumes only missing files and keeps completed files after failure and restart',async()=>{
 const w=worker();await w.lifecycle('install');const c=w.cache(name);
 c.rows.delete(base+'hero-9.jpg');c.rows.delete(base+'hero-10.jpg');
 w.rejected.add('/spin/hero-10.jpg');const failed=await w.message('precache');
 assert.equal(failed.ready,false);assert.equal(failed.have,23);assert.match(failed.error,/offline/);assert.ok(c.rows.has(base+'hero-9.jpg'));
 const next=worker(w.stores);assert.equal((await next.message('precache')).ready,true);assert.deepEqual(next.requests,[base+'hero-10.jpg']);
});
test('a stale query variant cannot pass the version-specific SPIN readiness check',async()=>{
 const w=worker();await w.lifecycle('install');const c=w.cache(name),r=c.rows.get(base+'app.3.2.0.js');c.rows.delete(base+'app.3.2.0.js');
 c.rows.set(base+'app.3.2.0.js?v=old',r);assert.equal((await w.message('status')).ready,false);
});
test('SPIN updates preserve previous shells and unrelated app caches',async()=>{
 const w=worker();await w.cache('spin-cache-old').put('./index.html',new Response('old shell'));w.cache('cidian-cache-test');w.cache('tingli-media-v1');
 await w.lifecycle('install');await w.lifecycle('activate');assert.ok(w.stores.has('cidian-cache-test'));assert.ok(w.stores.has('tingli-media-v1'));
 w.cache(name).rows.delete(base+'index.3.2.0.html');w.hung();assert.equal(await(await w.request()).text(),'old shell');
});
test('SPIN returns an explicit offline error when no saved shells exist',async()=>{
 const w=worker();w.offline();const r=await w.request();assert.equal(r.status,503);assert.match(await r.text(),/Нет сохранённой копии/);
});
test('SPIN no-shell navigation has a finite network deadline',async()=>{
 const w=worker();w.hung();assert.equal((await w.request()).status,503);
});
test('SPIN does not overwrite pinned HTML or serve another application',async()=>{
 const w=worker();await w.lifecycle('install');const before=w.requests.length;await w.request('./index.html');
 assert.equal(w.requests.length,before);assert.equal(w.request('/cidian/'),undefined);assert.equal(w.request('/tingli/'),undefined);
});
test('a SPIN storage failure stops activation and cached compression headers are removed',async()=>{
 const bad=worker();bad.quota();await assert.rejects(bad.lifecycle('install'),/quota/);assert.equal(bad.skipped(),false);
 const w=worker();await w.lifecycle('install');const r=await w.request();assert.equal(r.headers.has('content-encoding'),false);assert.equal(r.headers.has('content-length'),false);
});
test('SPIN checks for updates without a header button or forced reload',async()=>{
 const inline=[...html.matchAll(/<script\b(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)][0][1],events={};let updates=0;
 const reg={update:()=>{updates++;return Promise.resolve();}};
 const ctx={window:{addEventListener:(t,f)=>events[t]=f},navigator:{serviceWorker:{controller:{},register:()=>Promise.resolve(reg)}},
 document:{visibilityState:'visible',addEventListener(){}},setInterval(){}};
 vm.runInNewContext(inline,ctx);events.load();await Promise.resolve();events.focus();assert.equal(updates,1);
 assert.equal(html.includes('updateApp'),false);assert.equal(inline.includes('location.reload'),false);
});
test('legacy offline counts cannot mark the new SPIN app ready',async()=>{
 const app=fs.readFileSync(root+'/spin/app.js','utf8'),start=app.indexOf('function swPost('),end=app.indexOf('function offlineCardHtml()');
 const button={classList:{remove(){button.visible=true;}}};
 class Channel{constructor(){this.port1={close(){}};this.port2={send:d=>this.port1.onmessage({data:d})};}}
 const ctx={APP_VER:'3.2.0',MessageChannel:Channel,$:()=>button,navigator:{serviceWorker:{controller:{postMessage:(data,ports)=>ports[0].send({ready:true,total:25,have:25})}}},setTimeout:()=>1,clearTimeout(){}};
 vm.runInNewContext(app.slice(start,end),ctx);assert.equal(await ctx.swPost({type:'status'}),null);assert.equal(button.visible,undefined);
});
