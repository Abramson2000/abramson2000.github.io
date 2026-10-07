const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {surface}=require('./app-smoke.cjs');
const evaluate=(s,js)=>vm.runInContext(js,s.ctx);
function cloud(seed={}){
 const rows=new Map(Object.entries(seed)),rev=new Map([...rows.keys()].map(k=>[k,1]));let fail=false;
 const fetch=async(url,opts={})=>{
  const u=new URL(url);let d,status=200;
  if(u.pathname==='/api/sync'&&opts.method==='POST'){
   if(fail){fail=false;throw Error('lost connection');}
   const {key,base,value}=JSON.parse(opts.body),remote=rows.get(key)??null;
   if(base!==remote){status=409;d={ok:false,value:remote,rev:rev.get(key)||0};}
   else{rows.set(key,value);rev.set(key,(rev.get(key)||0)+1);d={ok:true,value,rev:rev.get(key)};}
  }else if(u.searchParams.has('list'))d={ok:true,revisions:Object.fromEntries(rev)};
  else if(u.searchParams.has('keys'))d={ok:true,records:Object.fromEntries(u.searchParams.get('keys').split(',').map(k=>[k,{value:rows.get(k)??null,rev:rev.get(k)||0}]))};
  else d={ok:false};
  return new Response(JSON.stringify(d),{status});
 };
 return{rows,fetch,failNext(){fail=true;}};
}
async function sync(s,app='tingli'){assert.equal(await evaluate(s,app==='tingli'?'tingliSync.run()':'cidianSync.run()'),true);}
function markup(s){const html=s.el('app').innerHTML;assert.equal((html.match(/<div\b/g)||[]).length,(html.match(/<\/div>/g)||[]).length);return html;}

test('homework checkbox covers every text, voice and record assignment and all card surfaces',()=>{
 const s=surface('tingli',{quiet:true});
 const parts=JSON.parse(evaluate(s,"JSON.stringify(ALL_UNITS.flatMap(u=>u.parts.filter(p=>p.kind==='hw'||p.kind==='record_hw').map(p=>({u:u.unit,p:p.id,kind:p.kind}))))"));
 assert.ok(parts.length>30);
 for(const p of parts){evaluate(s,`const ru${p.u}_${p.p}=crsUnit(${p.u});const rp${p.u}_${p.p}=ru${p.u}_${p.p}.parts.find(x=>x.id===${p.p});${p.kind==='record_hw'?'renderRecordHw':'renderHw'}(ru${p.u}_${p.p},rp${p.u}_${p.p})`);assert.match(markup(s),new RegExp(`data-hw-done="u${p.u}p${p.p}"`));}
 evaluate(s,"crsMode='hw';crsHwFilter='all';curUnit=null;curPart=null;renderCourses()");
 assert.match(s.el('crsBody').innerHTML,/aria-checked="false"/);
 const sample=evaluate(s,"crsHwList().find(h=>h.existing).key");
 assert.match(evaluate(s,`crsHwCard(crsHwList().find(h=>h.key===${JSON.stringify(sample)}))`),/data-hw-done=/);
 evaluate(s,`crsHwSetState(${JSON.stringify(sample)},'done')`);
 assert.match(evaluate(s,`crsHwDoneButton(${JSON.stringify(sample)})`),/aria-checked="true"/);
 assert.match(evaluate(s,`crsHwDoneButton(${JSON.stringify(sample)})`),/✓ ДЗ выполнено/);
});

test('homework completion, uncheck and answer preservation propagate across devices and restart',async()=>{
 const c=cloud(),a=surface('tingli',{fetch:c.fetch,quiet:true}),b=surface('tingli',{fetch:c.fetch,quiet:true});
 await sync(a);await sync(b);
 const ref=JSON.parse(evaluate(a,"JSON.stringify(ALL_UNITS.flatMap(u=>u.parts.filter(p=>p.kind==='hw'&&!p.voiceHomework).map(p=>({u:u.unit,p:p.id}))).find(Boolean))"));
 const k='u'+ref.u+'p'+ref.p,ans=`tingli-hw-${ref.u}-${ref.p}-0`;
 evaluate(a,`saveLocal(${JSON.stringify(ans)},'我的答案');crsHwToggleDone(${JSON.stringify(k)});`);
 await sync(a);await sync(b);
 assert.equal(evaluate(b,`crsHwState('${k}')`),'done');assert.equal(b.map.get(ans),'我的答案');
 evaluate(b,`openPart(${ref.u},${ref.p});crsHwToggleDone('${k}');hwRefresh()`);
 assert.equal(evaluate(b,`crsHwState('${k}')`),'todo');assert.equal(b.map.get(ans),'我的答案');
 await sync(b);await sync(a);assert.equal(evaluate(a,`crsHwState('${k}')`),'todo');
 const fresh=surface('tingli',{fetch:c.fetch,quiet:true});await sync(fresh);assert.equal(evaluate(fresh,`crsHwState('${k}')`),'todo');
 const reloaded=surface('tingli',{seed:Object.fromEntries(b.map),fetch:c.fetch,quiet:true});await sync(reloaded);assert.equal(evaluate(reloaded,`crsHwState('${k}')`),'todo');
 evaluate(a,`crsHwSetState('${k}','done')`);c.failNext();assert.equal(await evaluate(a,'tingliSync.run()'),false);
 const retry=surface('tingli',{seed:Object.fromEntries(a.map),fetch:c.fetch,quiet:true});await sync(retry);await sync(b);assert.equal(evaluate(b,`crsHwState('${k}')`),'done');
});

test('unchecked homework defeats older submitted metadata, manual ticks and completed recordings',()=>{
 const s=surface('tingli',{quiet:true});
 const ref=JSON.parse(evaluate(s,"JSON.stringify(ALL_UNITS.flatMap(u=>u.parts.filter(p=>p.kind==='record_hw').map(p=>({u:u.unit,p:p.id}))).find(Boolean))"));
 evaluate(s,`const u=crsUnit(${ref.u}),p=u.parts.find(p=>p.id===${ref.p});p.lines.forEach((_,i)=>localStorage.setItem(recHwMetaKey(u,p,i),'{}'));crsHwSetState(crsHwKey(u.unit,p.id),'done');crsHwSetState(crsHwKey(u.unit,p.id),'todo');`);
 assert.equal(evaluate(s,'partDone(u,p)'),false);
 const raw=evaluate(s,`initialTingliMerge('tingli-hwmeta-1-1',JSON.stringify({done:true,submitted:1}),JSON.stringify({done:false,submitted:0,updatedAt:9}))`);
 assert.equal(JSON.parse(raw).done,false);
});

const canonical=()=>JSON.parse(fs.readFileSync(__dirname+'/../../cidian/restore-2026-10-07.js','utf8').replace('window.CIDIAN_RESTORE=','').trim().replace(/;$/,''));
test('Cidian restores exact main backup on a fresh or stale device, preserving categories and all Laoshi marks',async()=>{
 const backup=canonical().words,wrong=JSON.stringify([{id:1,hanzi:'错误',kind:'word',laoshi:false}]);
 const c=cloud({'cidian-data-v1':wrong,'tingli-dict-v1':wrong,'tingli-cidian-outbox-v2':JSON.stringify({wrong:{hanzi:'污染'}})});
 for(const seed of [{},{'cidian-data-v1':wrong,'cidian-inbox-v1':JSON.stringify([{hanzi:'污染'}])}]){
  const s=surface('cidian',{exercise:false,fetch:c.fetch,seed,quiet:true});await sync(s,'cidian');
  const result=JSON.parse(evaluate(s,'JSON.stringify(words)'));assert.equal(result.length,4052);
  assert.deepEqual(result,backup.map(w=>({...w,deleted:!!w.deleted})),'no migration changes the authoritative rows');
  assert.equal(evaluate(s,"countOf('word')"),3911);assert.equal(evaluate(s,"countOf('phrase')"),26);assert.equal(evaluate(s,"countOf('name')"),111);
  assert.equal(evaluate(s,"newOf('word')+newOf('phrase')+newOf('name')"),0);
  assert.equal(evaluate(s,"words.some(w=>w.hanzi==='污染')"),false);
 }
 assert.equal(JSON.parse(c.rows.get('cidian-data-v3')).length,4052);
 assert.equal(c.rows.get('cidian-data-v1'),wrong);
});

test('Cidian concurrent marks, field edits and deletions sync by stable record without resetting new devices',async()=>{
 const c=cloud(),a=surface('cidian',{exercise:false,fetch:c.fetch,quiet:true}),b=surface('cidian',{exercise:false,fetch:c.fetch,quiet:true});await sync(a,'cidian');await sync(b,'cidian');
 evaluate(a,"words[0].laoshi=false;saveWords()");evaluate(b,"mutateWord(words[0],{translation:'новый перевод'});saveWords()");
 await sync(a,'cidian');await sync(b,'cidian');await sync(a,'cidian');
 assert.equal(evaluate(a,'words[0].laoshi'),false);assert.equal(evaluate(a,'words[0].translation'),'новый перевод');
 assert.equal(evaluate(a,'words.length'),4052);
 evaluate(a,"words[1].deleted=true;saveWords()");await sync(a,'cidian');await sync(b,'cidian');
 const fresh=surface('cidian',{exercise:false,fetch:c.fetch,quiet:true});await sync(fresh,'cidian');
 assert.equal(evaluate(fresh,'words[0].laoshi'),false);assert.equal(evaluate(fresh,'words[0].translation'),'новый перевод');assert.equal(evaluate(fresh,'words[1].deleted'),true);
 c.failNext();evaluate(a,"words[2].laoshi=false;saveWords()");assert.equal(await evaluate(a,'cidianSync.run()'),false);
 const retry=surface('cidian',{exercise:false,seed:Object.fromEntries(a.map),fetch:c.fetch,quiet:true});await sync(retry,'cidian');await sync(b,'cidian');assert.equal(evaluate(b,'words[2].laoshi'),false);
});

test('Cidian accepts explicit new Tingli sends but ignores retired queues and never changes old Laoshi records',async()=>{
 const c=cloud(),s=surface('cidian',{exercise:false,fetch:c.fetch,quiet:true});await sync(s,'cidian');
 c.rows.set('tingli-cidian-outbox-v3',JSON.stringify({new:{hanzi:'专门发送的新词',pinyin:'xin',ru:'только отправленное',ts:Date.now()}}));
 assert.equal(await evaluate(s,'checkInboxCloud(true)'),1);await sync(s,'cidian');
 assert.equal(evaluate(s,'words.length'),4053);assert.equal(evaluate(s,'words.slice(0,4052).filter(w=>!w.deleted&&!w.laoshi).length'),0);
 assert.equal(await evaluate(s,'checkInboxCloud(true)'),0);
 evaluate(s,"words[words.length-1].deleted=true;saveWords()");assert.equal(await evaluate(s,'checkInboxCloud(true)'),0,'permanent outbox does not resurrect deletion');
});
