const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function worker(app,{missing=null}={}) {
  const base=`https://crmuro.ru/${app}/`,handlers={},rows=new Map();let skipped=false,offline=false;
  const key=x=>new URL(typeof x==='string'?x:x.url,base).href;
  const fetch=async input=>{
    const url=key(input);
    if(offline||missing&&url.includes(missing))throw Error('offline');
    return new Response(url.endsWith('sync-check.html')?'diagnostic':'application');
  };
  const cache={
    async add(req){rows.set(key(req),await fetch(req));},
    async put(k,res){rows.set(key(k),res);},
    async match(k){return rows.get(key(k))?.clone();}
  };
  class LocalRequest extends Request {constructor(url,opts){super(new URL(url,base),opts);}}
  const ctx=vm.createContext({URL,Request:LocalRequest,Response,Headers,fetch,
    caches:{open:async()=>cache,match:cache.match,keys:async()=>[],delete:async()=>true},
    self:{location:{origin:'https://crmuro.ru',href:base},addEventListener:(k,fn)=>handlers[k]=fn,
      skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{}}}});
  vm.runInContext(fs.readFileSync(`${__dirname}/../../${app}/sw.js`,'utf8'),ctx);
  return {handlers,rows,key,offline:()=>offline=true,skipped:()=>skipped,
    install(){let promise;handlers.install({waitUntil:p=>promise=p});return promise;},
    navigate(path){let promise;handlers.fetch({request:{method:'GET',mode:'navigate',url:new URL(path,base).href},respondWith:p=>promise=p});return promise;}};
}
for(const app of ['tingli','cidian'])test(`${app} keeps the old worker when a mandatory transport script is unavailable`,async()=>{
  const w=worker(app,{missing:'sync-transport.'});
  await assert.rejects(w.install(),/shell missing .*sync-transport/);
  assert.equal(w.skipped(),false);
});
for(const app of ['tingli','cidian'])test(`${app} worker leaves other applications and their icons to the network`,()=>{
  const w=worker(app),other=app==='tingli'?'cidian':'tingli';
  for(const path of ['/'+other+'/', '/'+other+'/apple-touch-icon.png', '/icon.svg']) {
    assert.equal(w.navigate(path),undefined);
  }
});
test('opening Tingli diagnostics preserves the offline application and its separate diagnostic page',async()=>{
  const w=worker('tingli');await w.install();
  assert.equal(await (await w.navigate('sync-check.html')).text(),'diagnostic');
  await Promise.resolve();
  assert.equal(await w.rows.get(w.key('./index.html')).clone().text(),'application');
  w.offline();
  assert.equal(await (await w.navigate('./')).text(),'application');
  assert.equal(await (await w.navigate('sync-check.html')).text(),'diagnostic');
});
