const test = require('node:test');
const assert = require('node:assert/strict');
const {DatabaseSync} = require('node:sqlite');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const Core = require(path.join(root,'tingli/sync-core.js'));
let worker;
const ready = import(pathToFileURL(path.join(root,'backend/tingli-worker/worker.js'))).then(m=>worker=m.default);

function dbEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE kv(key TEXT PRIMARY KEY,value TEXT,updated_at INTEGER)');
  const DB = { prepare(sql) {
    let args=[];
    const stmt={bind(...v){args=v;return stmt;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:db.prepare(sql).run(...args)};}};
    return stmt;
  }};
  return {DB,db};
}
class Storage {
  constructor(){this.data=new Map();}
  getItem(k){return this.data.has(k)?this.data.get(k):null;}
  setItem(k,v){this.data.set(k,String(v));}
  key(i){return [...this.data.keys()][i]??null;}
  get length(){return this.data.size;}
}
async function call(env,url,opts={}) {
  await ready;
  const r=await worker.fetch(new Request('https://api.crmuro.ru'+url,opts),env);
  const j=await r.json();
  if(!r.ok&&r.status!==409)throw new Error('HTTP '+r.status);
  return {...j,status:r.status};
}
function client(env,{storage=new Storage(),request,initialMerge}={}) {
  const status=[],changes=[];
  const engine=Core.create({stateKey:'local-sync-v2',storage,
    get:k=>storage.getItem(k),set:(k,v)=>storage.setItem(k,v),keys:()=>[...storage.data.keys()],
    allowed:k=>/^tingli-|^cidian-data-v1$/.test(k),
    request:request||((u,o)=>call(env,u,o)),
    initialMerge:initialMerge||((k,l,r)=>{
      if(k==='cidian-data-v1')return JSON.stringify(Core.mergeWords(JSON.parse(r),JSON.parse(l)));
      if(k==='tingli-schedule-v1')return JSON.stringify(Core.mergeSchedule(JSON.parse(r),JSON.parse(l)));
      try{return JSON.stringify(Core.threeWay({},JSON.parse(l),JSON.parse(r)));}catch{return l||r;}
    }),changed:k=>changes.push(k),status:(s,e)=>status.push([s,e])});
  return {engine,storage,status,changes};
}
function seed(env,key,value){env.db.prepare('INSERT OR REPLACE INTO kv VALUES(?,?,?)').run(key,typeof value==='string'?value:JSON.stringify(value),1);}
function value(env,key){const row=env.db.prepare('SELECT value FROM kv WHERE key=?').get(key);return row?row.value:null;}
const json=x=>JSON.stringify(x);

test('Tingli: cloud checkmarks load into an existing local copy',async()=>{
  const env=dbEnv(),key='tingli-manual-v1';seed(env,key,{8:{u:1,p:{3:1}}});
  const c=client(env);c.storage.setItem(key,'{}');
  assert.equal(await c.engine.run(),true);c.engine.stop();
  assert.deepEqual(JSON.parse(c.storage.getItem(key)),{8:{u:1,p:{3:1}}});assert.ok(c.changes.includes(key));
});
test('Tingli: a failed POST remains pending and survives page restart',async()=>{
  const env=dbEnv(),key='tingli-hw-109-6-0';seed(env,key,'old');let fail=false;
  const c=client(env,{request:(u,o)=>{if(fail&&o?.method==='POST')throw Error('offline');return call(env,u,o);}});
  await c.engine.run();c.engine.stop();c.storage.setItem(key,'новый ответ');fail=true;
  assert.equal(await c.engine.run(),false);c.engine.stop();assert.equal(value(env,key),'old');assert.ok(c.engine.pending().includes(key));
  const restarted=client(env,{storage:c.storage});assert.equal(await restarted.engine.run(),true);restarted.engine.stop();
  assert.equal(value(env,key),'новый ответ');
});
test('Tingli: typing during an in-flight POST is not overwritten or acknowledged early',async()=>{
  const env=dbEnv(),key='tingli-hw-109-6-1';seed(env,key,'initial');let hold=false,release,entered;
  const reached=new Promise(r=>entered=r);
  const c=client(env,{request:async(u,o)=>{if(hold&&o?.method==='POST'){entered();await new Promise(r=>release=r);}return call(env,u,o);}});
  await c.engine.run();c.engine.stop();hold=true;c.storage.setItem(key,'draft1');
  const running=c.engine.run();await reached;c.storage.setItem(key,'draft2');release();await running;c.engine.stop();
  assert.equal(c.storage.getItem(key),'draft2');assert.ok(c.engine.pending().includes(key));
  hold=false;await c.engine.run();c.engine.stop();assert.equal(value(env,key),'draft2');
});
test('Tingli: simultaneous devices retain independent edits via CAS conflict retry',async()=>{
  const env=dbEnv(),key='tingli-manual-v1';seed(env,key,{});
  const a=client(env),b=client(env);await Promise.all([a.engine.run(),b.engine.run()]);a.engine.stop();b.engine.stop();
  a.storage.setItem(key,json({8:{u:1}}));b.storage.setItem(key,json({9:{u:1}}));
  assert.deepEqual(await Promise.all([a.engine.run(),b.engine.run()]),[true,true]);a.engine.stop();b.engine.stop();
  assert.deepEqual(JSON.parse(value(env,key)),{8:{u:1},9:{u:1}});
  await a.engine.run();a.engine.stop();assert.deepEqual(JSON.parse(a.storage.getItem(key)),{8:{u:1},9:{u:1}});
});
test('Tingli: independent concurrent edits survive first creation of a key',async()=>{
  const env=dbEnv(),key='tingli-manual-v1',a=client(env),b=client(env);
  a.storage.setItem(key,json({8:{u:1}}));b.storage.setItem(key,json({9:{u:1}}));
  assert.deepEqual(await Promise.all([a.engine.run(),b.engine.run()]),[true,true]);a.engine.stop();b.engine.stop();
  assert.deepEqual(JSON.parse(value(env,key)),{8:{u:1},9:{u:1}});
});
test('Tingli: clearing an existing homework answer syncs as an intentional edit',async()=>{
  const env=dbEnv(),key='tingli-hw-109-6-3';seed(env,key,'answer');const a=client(env),b=client(env);
  await Promise.all([a.engine.run(),b.engine.run()]);a.engine.stop();b.engine.stop();
  a.storage.setItem(key,'');await a.engine.run();a.engine.stop();await b.engine.run();b.engine.stop();
  assert.equal(value(env,key),'');assert.equal(b.storage.getItem(key),'');
});
test('Tingli: removing a checkmark and favorite propagates to the other device',async()=>{
  const env=dbEnv();seed(env,'tingli-manual-v1',{8:{u:1,p:{2:1}}});seed(env,'tingli-favs-v1',['8:2']);
  const a=client(env),b=client(env);await Promise.all([a.engine.run(),b.engine.run()]);a.engine.stop();b.engine.stop();
  a.storage.setItem('tingli-manual-v1','{}');a.storage.setItem('tingli-favs-v1','[]');await a.engine.run();a.engine.stop();await b.engine.run();b.engine.stop();
  assert.equal(b.storage.getItem('tingli-manual-v1'),'{}');assert.equal(b.storage.getItem('tingli-favs-v1'),'[]');
});
test('Tingli: new local data is uploaded even when the first pull finds an empty server',async()=>{
  const env=dbEnv(),c=client(env);c.storage.setItem('tingli-hw-1-2-0','offline work');
  assert.equal(await c.engine.run(),true);c.engine.stop();assert.equal(value(env,'tingli-hw-1-2-0'),'offline work');
});
test('Tingli: schedule preserves payments, done numbers, homework and tombstones',()=>{
  const a={upd:1,payments:{p:{amount:100,upd:1}},done:{x:1000},hwstate:{h:{state:'done',upd:1}},lessons:{l:{upd:1},'s:sid:2026':{upd:1}}};
  const b={upd:2,payments:{q:{amount:200,upd:2}},done:{y:2000},hwstate:{h:{state:'todo',upd:2}},killed:{l:2,sid:2},hwdue:{h:{date:'2026-10-09',upd:2}},hwdel:{z:{upd:2}}};
  const m=Core.mergeSchedule(a,b);assert.deepEqual(Object.keys(m.payments),['p','q']);assert.deepEqual(m.done,{x:1000,y:2000});assert.equal(m.hwstate.h.state,'todo');assert.deepEqual(m.lessons,{});assert.equal(m.hwdue.h.date,'2026-10-09');assert.ok(m.hwdel.z);
});
test('API: legacy schedule POST uses the same merge as the clients',async()=>{
  const env=dbEnv(),key='tingli-schedule-v1';seed(env,key,{payments:{p:{upd:2,amount:200}},done:{x:1000}});
  await call(env,'/api/backup',{method:'POST',body:json({[key]:json({payments:{q:{upd:3,amount:300}},done:{y:2000}})})});
  const m=JSON.parse(value(env,key));assert.deepEqual(Object.keys(m.payments),['p','q']);assert.deepEqual(m.done,{x:1000,y:2000});
});
test('API: compare-and-set rejects a stale snapshot and returns current value',async()=>{
  const env=dbEnv(),key='tingli-hw-1-1-0';seed(env,key,'one');
  const a=await call(env,'/api/sync',{method:'POST',body:json({key,base:'one',value:'two'})});assert.equal(a.status,200);
  const b=await call(env,'/api/sync',{method:'POST',body:json({key,base:'one',value:'three'})});assert.equal(b.status,409);assert.equal(b.value,'two');assert.equal(value(env,key),'two');
});
test('API: concurrent first creation has only one winner',async()=>{
  const env=dbEnv(),key='tingli-hw-1-1-1';
  const all=await Promise.all(['a','b'].map(v=>call(env,'/api/sync',{method:'POST',body:json({key,base:null,value:v})})));
  assert.deepEqual(all.map(x=>x.status).sort(),[200,409]);
});
test('API: failed/malformed reads cannot enable overwrite of cloud data',async()=>{
  const env=dbEnv(),key='tingli-hw-1-1-2';seed(env,key,'cloud');const c=client(env,{request:async()=>({ok:true,records:{}})});c.storage.setItem(key,'local');
  assert.equal(await c.engine.run(),false);c.engine.stop();assert.equal(value(env,key),'cloud');assert.equal(c.storage.getItem(key),'local');assert.equal(c.status.at(-1)[0],'offline');
});
test('Cidian: server ignores uid when deduplicating the same content',async()=>{
  const env=dbEnv(),key='cidian-data-v1',w={hanzi:'中国',pinyin:'Zhōngguó',translation:'Китай',kind:'name'};seed(env,key,[{...w,uid:'old',laoshi:false,updatedAt:'2026-10-06'}]);
  await call(env,'/api/backup',{method:'POST',body:json({[key]:json([{...w,uid:'new',laoshi:true,updatedAt:'2026-10-07'}])})});
  const arr=JSON.parse(value(env,key));assert.equal(arr.length,1);assert.equal(arr[0].laoshi,true);
});
test('Cidian: same word metadata merges independently across devices',async()=>{
  const env=dbEnv(),key='cidian-data-v1';seed(env,key,[{hanzi:'中国',kind:'name',translation:'Китай',laoshi:false,comment:''}]);
  const a=client(env),b=client(env);await Promise.all([a.engine.run(),b.engine.run()]);a.engine.stop();b.engine.stop();
  let wa=JSON.parse(a.storage.getItem(key)),wb=JSON.parse(b.storage.getItem(key));wa[0].laoshi=true;wb[0].comment='заметка';a.storage.setItem(key,json(wa));b.storage.setItem(key,json(wb));
  await Promise.all([a.engine.run(),b.engine.run()]);a.engine.stop();b.engine.stop();
  const w=JSON.parse(value(env,key))[0];assert.equal(w.laoshi,true);assert.equal(w.comment,'заметка');
});
test('Cidian: deletion tombstone propagates and is not resurrected by old data',async()=>{
  const env=dbEnv(),key='cidian-data-v1';seed(env,key,[{hanzi:'字',translation:'иероглиф',deleted:false}]);
  const a=client(env),b=client(env);await Promise.all([a.engine.run(),b.engine.run()]);a.engine.stop();b.engine.stop();
  const wa=JSON.parse(a.storage.getItem(key));wa[0].deleted=true;a.storage.setItem(key,json(wa));await a.engine.run();a.engine.stop();await b.engine.run();b.engine.stop();
  assert.equal(JSON.parse(b.storage.getItem(key))[0].deleted,true);
});
test('API: secret keys and unknown API paths are rejected',async()=>{
  await ready;const env=dbEnv();
  for(const u of ['/api/sync?keys=tingli-gist-token','/api/_copy?t=tingli-migrate-2026','/api/unknown']){
    const r=await worker.fetch(new Request('https://api.crmuro.ru'+u),env);assert.ok(r.status>=400);
  }
});
