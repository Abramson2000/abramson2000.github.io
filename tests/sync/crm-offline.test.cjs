const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=__dirname+'/../..',html=fs.readFileSync(root+'/index.html','utf8'),source=fs.readFileSync(root+'/sw.js','utf8');
const base='https://crmuro.ru/',api='https://mkehzkobjxnjobkqeiwt.supabase.co/rest/v1/clinics?select=*';
const jwt=(sub,iat=1)=>'Bearer x.'+Buffer.from(JSON.stringify({sub,iat})).toString('base64url')+'.x';
function worker(){
 const stores=new Map(),events={},queue=[],calls=[];let network=async()=>new Response('[]'),online=true,skipped=false;
 const key=x=>new URL(typeof x==='string'?x:x.url,base).href;
 function cache(n){if(!stores.has(n)){const rows=new Map();stores.set(n,{rows,match:async k=>rows.get(key(k))?.clone(),put:async(k,r)=>rows.set(key(k),r.clone())});}return stores.get(n);}
 class BrowserRequest extends Request { constructor(input,options){super(typeof input === "string" ? new URL(input,base).href : input,options);} }
 const ctx={URL,Request:BrowserRequest,Response,Headers,AbortController,atob,setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,30)),clearTimeout,
  navigator:{get onLine(){return online;}},fetch:async(u,o={})=>{calls.push({url:key(u),options:o});return network(u,o);},
  self:{location:{origin:'https://crmuro.ru'},addEventListener:(t,f)=>events[t]=f,skipWaiting:async()=>skipped=true,clients:{claim:async()=>{},matchAll:async()=>[]}},
  caches:{open:async n=>cache(n),keys:async()=>[...stores.keys()],match:async k=>{for(const c of stores.values()){const hit=await c.match(k);if(hit)return hit;}}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 ctx.dbDo=async(store,mode,fn)=>{const out=fn({getAll:()=>({result:queue.map(x=>({...x}))}),get:()=>({result:null}),count:()=>({result:queue.length}),delete:id=>{const i=queue.findIndex(x=>x.qid===id);if(i>=0)queue.splice(i,1);return{};},add:item=>{queue.push({...item,qid:queue.length+1});return{};},put:()=>({}),clear:()=>{queue.length=0;return{};}});return out.result;};
 return {ctx,queue,calls,stores,cache,events,network:f=>network=f,offline:()=>online=false,skipped:()=>skipped,
  async install(){let p;events.install({waitUntil:x=>p=x});await p;},async flush(auth){return ctx.flushQueue(auth);}};
}
function edit(qid=1){return{qid,table:'clinics',method:'PATCH',url:api+'&id=eq.1',body:'{"name":"edited offline"}',headers:{authorization:jwt('owner'),'content-type':'application/json'}};}
for(const status of [400,401,403,409,429])test('CRM retains rejected edit and dependent queue on HTTP '+status,async()=>{
 const w=worker();w.queue.push(edit(),edit(2));w.network(async()=>new Response('{}',{status}));const r=await w.flush();
 assert.equal(r.left,2);assert.equal(r.blocked,status);assert.equal(w.queue[0].body,'{"name":"edited offline"}');assert.equal(w.calls.length,1);
});
test('CRM retries retained edit with fresh credentials for the same account',async()=>{
 const w=worker();w.queue.push(edit());w.network(async()=>new Response('{}',{status:401}));await w.flush();
 w.network(async()=>new Response(null,{status:204}));const fresh=jwt('owner',2);const r=await w.flush(fresh);
 assert.equal(r.ok,1);assert.equal(w.queue.length,0);assert.equal(w.calls.at(-1).options.headers.authorization,fresh);
});
test('CRM never substitutes another account credentials',async()=>{
 const w=worker();w.queue.push(edit());w.network(async()=>new Response('{}',{status:401}));await w.flush(jwt('another',2));
 assert.equal(w.calls[0].options.headers.authorization,jwt('owner'));assert.equal(w.queue.length,1);
});
test('CRM stalled GET reaches saved data and pending edit overlay',async()=>{
 const w=worker();await w.cache('crm-data-v1').put('/rest/v1/clinics?select=*',new Response('[{"id":1,"name":"saved"}]'));
 w.queue.push(edit());w.network(()=>new Promise(()=>{}));const r=await w.ctx.handleRest(new Request(api));
 assert.equal((await r.json())[0].name,'edited offline');assert.equal(r.headers.get('x-crm-offline'),'1');
});
test('CRM response body deadline reaches saved data',async()=>{
 const w=worker();await w.cache('crm-data-v1').put('/rest/v1/clinics?select=*',new Response('[{"id":1}]'));
 w.network(async()=>({arrayBuffer:()=>new Promise(()=>{})}));const r=await w.ctx.handleRest(new Request(api));assert.equal((await r.json())[0].id,1);
});
test('CRM stalled write is durably queued with its original body',async()=>{
 const w=worker();w.network(()=>new Promise(()=>{}));const req=new Request(api,{method:'PATCH',headers:{'content-type':'application/json',authorization:jwt('owner')},body:'{"name":"new"}'});
 const r=await w.ctx.handleRest(req);assert.equal(r.status,204);assert.equal(w.queue.length,1);assert.equal(w.queue[0].body,'{"name":"new"}');
});
test('CRM shell prepares the exact SDK URL and opens offline',async()=>{
 const w=worker();w.network(async()=>new Response('cached',{headers:{'content-encoding':'br','content-length':'999'}}));await w.install();assert.equal(w.skipped(),true);
 const sdk=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)][0][1];assert.equal(sdk,'supabase.v139.min.js?v=139');assert.ok(w.cache('crm-app-v24').rows.has(base+sdk));
 w.offline();w.network(async()=>{throw Error('offline');});const r=await w.ctx.handleShell(new Request(base+sdk));assert.equal(await r.text(),'cached');assert.equal(r.headers.has('content-encoding'),false);
});
test('CRM previous plain SDK cache supports migration without network',async()=>{
 const w=worker();await w.cache('crm-app-old').put('./supabase.v139.min.js',new Response('old SDK'));w.network(async()=>{throw Error('offline');});
 assert.equal(await(await w.ctx.handleShell(new Request(base+'supabase.v139.min.js?v=139'))).text(),'old SDK');
});
test('CRM cannot activate a fresh install without its exact SDK',async()=>{
 const w=worker();w.network(async u=>{if(String(u).includes('supabase'))throw Error('missing');return new Response('shell');});await assert.rejects(w.install(),/incomplete/);assert.equal(w.skipped(),false);
});
test('CRM saved-user init boots before any network authorization request',async()=>{
 const start=html.indexOf('async function init()'),end=html.indexOf('async function doLogin()',start);let booted=0;
 const ctx={applyAccent(){},showLogin(){},localStorage:{getItem:()=>JSON.stringify({email:'owner@crm.ru'})},bootstrap:async()=>booted++,window:{},sb:{auth:{getSession(){throw Error('network should not run');}}}};
 vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);await ctx.init();assert.equal(booted,1);
});
test('CRM bootstrap chooses stored identity before session lookup and honors explicit login identity',async()=>{
 const start=html.indexOf('async function bootstrap('),end=html.indexOf("  if (window.__d) window.__d.m.push('user",start);
 const body=html.slice(start,end)+'return {user, stored:SESSION_FROM_STORAGE};}';
 const ctx={window:{},sb:{auth:{getSession(){throw Error('unexpected session lookup');}}},localStorage:{getItem:()=>JSON.stringify({email:'owner@crm.ru'})},SESSION_FROM_STORAGE:false,toast(){},showLogin(){}};
 vm.createContext(ctx);vm.runInContext(body,ctx);const saved=await ctx.bootstrap();assert.equal(saved.user.email,'owner@crm.ru');assert.equal(saved.stored,true);
 const explicit=await ctx.bootstrap({email:'new@crm.ru'});assert.equal(explicit.user.email,'new@crm.ru');assert.equal(explicit.stored,false);
});
test('CRM SDK paths and release version remain consistent; no added update button',()=>{
 assert.match(html,/const APP_VER = '4\.7\.0'/);assert.match(html,/offline-safe-24/);assert.equal(html.includes('updateApp'),false);
});
