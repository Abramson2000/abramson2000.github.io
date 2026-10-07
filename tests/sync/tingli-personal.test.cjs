const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const {surface} = require('./app-smoke.cjs');
const oldDict='tingli-dict-v1', oldFav='tingli-favs-v1', dict='tingli-dict-v2', fav='tingli-favs-v2';
function cloud() {
  const rows=new Map([[oldDict,JSON.stringify([{zh:'旧词',py:'jiu',ru:'старое'}])],[oldFav,'["109:6:0","9:0"]'],['tingli-manual-v1','{"109":{"u":1,"p":{"6":1}}}']]);
  const revisions=new Map([...rows.keys()].map(k=>[k,1])), requests=[];
  const fetch=async(url,opts={})=>{
    const u=new URL(String(url)); requests.push({url:u.href,body:opts.body});
    let out, status=200;
    if(u.searchParams.has('list')) out={ok:true,revisions:Object.fromEntries(revisions)};
    else if(u.searchParams.has('keys')) {
      out={ok:true,records:Object.fromEntries(u.searchParams.get('keys').split(',').map(k=>[k,{value:rows.get(k)??null,rev:revisions.get(k)||0}]))};
    } else if(opts.method==='POST' && u.pathname==='/api/sync') {
      const {key,base,value}=JSON.parse(opts.body), remote=rows.get(key)??null;
      if(base!==remote) {status=409;out={ok:false,value:remote,rev:revisions.get(key)||0};}
      else {rows.set(key,value);revisions.set(key,(revisions.get(key)||0)+1);out={ok:true,value,rev:revisions.get(key)};}
    } else out={ok:false};
    return new Response(JSON.stringify(out),{status});
  };
  return {rows,fetch,requests};
}
const evaluate=(s,js)=>vm.runInContext(js,s.ctx);
const sync=async s=>assert.equal(await evaluate(s,'tingliSync.run()'),true);
function empty(s) {
  assert.equal(evaluate(s,'dictLoad().length'),0);
  assert.equal(evaluate(s,'loadFavs().length'),0);
  evaluate(s,'renderDict()'); assert.match(s.el('app').innerHTML,/Словарь пуст/);
  evaluate(s,'renderFavs()'); assert.match(s.el('app').innerHTML,/Пока пусто/);
  const html=s.el('app').innerHTML;
  assert.equal((html.match(/<div\b/g)||[]).length,(html.match(/<\/div>/g)||[]).length);
}
test('fresh/private and existing devices ignore retired personal lists and keep checkmarks',async()=>{
  const c=cloud();
  for(const seed of [{},{[oldDict]:c.rows.get(oldDict),[oldFav]:c.rows.get(oldFav),'cidian-data-v1':'[{"hanzi":"词"}]','cidian-inbox-v3':'[]'}]) {
    const s=surface('tingli',{seed,fetch:c.fetch,quiet:true}); await sync(s); empty(s);
    assert.equal(evaluate(s,'man[109].u'),1);
    assert.equal(evaluate(s,'man[109].p[6]'),1);
    assert.equal(s.map.has(oldDict),false); assert.equal(s.map.has(oldFav),false);
    if(seed['cidian-data-v1']) assert.equal(s.map.get('cidian-data-v1'),seed['cidian-data-v1']);
    else assert.equal(s.map.has('cidian-inbox-v3'),false);
    assert.equal(s.map.has('tingli-cidian-outbox-v3'),false);
    await sync(s); empty(s);
  }
  assert.equal(c.rows.get(dict),'{}'); assert.equal(c.rows.get(fav),'{}');
  for(const request of c.requests) {
    assert.ok(!request.url.includes(encodeURIComponent(oldDict)) && !request.url.includes(encodeURIComponent(oldFav)));
    if(request.body) assert.ok(![oldDict,oldFav,'cidian-data-v1'].includes(JSON.parse(request.body).key));
  }
});
test('stale old device cannot restore cleared lists; intentional new additions/deletions sync',async()=>{
  const c=cloud(), a=surface('tingli',{fetch:c.fetch,quiet:true}), b=surface('tingli',{fetch:c.fetch,quiet:true});
  await sync(a); await sync(b);
  c.rows.set(oldDict,'[{"zh":"再次出现"}]');c.rows.set(oldFav,'["109:6:0"]');
  await sync(a); await sync(b); empty(a); empty(b);
  evaluate(a,`saveFavs(['109:6:0']);dictSave([{zh:'手动',ru:'вручную'}]);`);
  evaluate(b,`saveFavs(['109:6:1']);dictSave([{zh:'新词',ru:'новое'}]);`);
  await sync(a);await sync(b);await sync(a);
  assert.equal(evaluate(a,'loadFavs().length'),2);assert.equal(evaluate(a,'dictLoad().length'),2);
  evaluate(a,`saveFavs([]);dictSave([]);`);await sync(a);await sync(b);empty(b);
  const reloaded=surface('tingli',{seed:Object.fromEntries(b.map),fetch:c.fetch,quiet:true});await sync(reloaded);empty(reloaded);
  const fresh=surface('tingli',{fetch:c.fetch,quiet:true});await sync(fresh);empty(fresh);
});
test('sending one, all or selected words to Cidian never fills personal Tingli dictionary',async()=>{
  const c=cloud(), s=surface('tingli',{fetch:c.fetch,quiet:true});await sync(s);
  evaluate(s,`curUnit=ALL_UNITS[0];curPart={title:'test',words:[{zh:'只发一个',py:'yi',ru:'один'}]};
    sendWordOne({closest:()=>({dataset:{i:'0'},classList:{add(){}}})});
    curPart.words=[{zh:'全部',py:'quan',ru:'все'}];sendAllWords();`);
  s.document.querySelectorAll=()=>[{dataset:{i:'0'},classList:{remove(){},add(){}},querySelector:()=>null}];
  evaluate(s,`curPart.words=[{zh:'选择',py:'xuan',ru:'выбранное'}];sendToDict();`);
  assert.equal(evaluate(s,'dictLoad().length'),0);
  assert.deepEqual(JSON.parse(s.map.get('cidian-inbox-v3')).map(w=>w.hanzi),['只发一个','全部','选择']);
  await sync(s);assert.equal(c.rows.get(dict),'{}');assert.equal(evaluate(s,'loadFavs().length'),0);
});
