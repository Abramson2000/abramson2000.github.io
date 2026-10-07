const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {surface}=require('./app-smoke.cjs');
const ev=(s,j)=>vm.runInContext(j,s.ctx);
function cloud(){
 const rows=new Map(),revs=new Map(),posts=[];let fail=false;
 const fetch=async(url,opts={})=>{
  const u=new URL(url);let j,status=200;
  if(opts.method==='POST'){
   const p=JSON.parse(opts.body);posts.push(p);
   if(p.key==='cidian-data-v3'||fail){fail=false;throw Error('large transfer blocked');}
   const old=rows.get(p.key)??null;
   if(old!==p.base){status=409;j={ok:false,value:old,rev:revs.get(p.key)||0};}
   else{rows.set(p.key,p.value);revs.set(p.key,(revs.get(p.key)||0)+1);j={ok:true,value:p.value,rev:revs.get(p.key)};}
  }else if(u.searchParams.has('list'))j={ok:true,revisions:Object.fromEntries(revs)};
  else if(u.searchParams.has('keys')){
   const keys=u.searchParams.get('keys').split(',');if(keys.includes('cidian-data-v3'))throw Error('large dictionary download blocked');
   j={ok:true,records:Object.fromEntries(keys.map(k=>[k,{value:rows.get(k)??null,rev:revs.get(k)||0}]))};
  }else j={ok:false};
  return new Response(JSON.stringify(j),{status});
 };
 return {rows,posts,fetch,failNext(){fail=true;}};
}
test('manual form word reaches an independent phone even when full dictionary requests fail',async()=>{
 const c=cloud(),a=surface('cidian',{exercise:false,quiet:true,fetch:c.fetch}),b=surface('cidian',{exercise:false,quiet:true,fetch:c.fetch});
 ev(a,'renderAdd()');a.el('fHanzi').value='手机独立校验';a.el('fTr').value='на телефоне';ev(a,'saveForm(false)');
 assert.equal(await ev(a,'cidianLegacySync.run()'),false);
 assert.equal(await ev(a,'cidianSync.run()'),true);assert.equal(await ev(b,'cidianSync.run()'),true);
 assert.equal(ev(b,"words.some(w=>w.hanzi==='手机独立校验'&&!w.laoshi)"),true);
 assert.equal(ev(b,"getFiltered()[0].hanzi"),'手机独立校验');
 assert.ok(c.posts.every(p=>p.key!=='cidian-data-v3'&&p.value.length<1500));
 ev(a,"mutateWord(words.find(w=>w.hanzi==='手机独立校验'),{translation:'исправлен перевод'});saveWords()");
 ev(b,"mutateWord(words.find(w=>w.hanzi==='手机独立校验'),{laoshi:true});saveWords()");
 await ev(a,'cidianSync.run()');await ev(b,'cidianSync.run()');await ev(a,'cidianSync.run()');
 assert.equal(ev(a,"words.find(w=>w.hanzi==='手机独立校验').laoshi"),true);
 assert.equal(ev(a,"words.find(w=>w.hanzi==='手机独立校验').translation"),'исправлен перевод');
});
test('Tingli sends directly to small word records before Cidian is opened; remote proof required',async()=>{
 const c=cloud(),t=surface('tingli',{quiet:true,fetch:c.fetch});
 ev(t,"dictSave([{zh:'听力直接发送校验',py:'tingli',ru:'отправка',src:'урок'}]);renderDict()");
 await ev(t,'dictSendAll()');
 assert.equal([...c.rows.keys()].filter(k=>k.startsWith('cidian-word-v4-')).length,1);
 assert.equal(c.rows.has('tingli-cidian-outbox-v3'),false);
 const p=surface('cidian',{exercise:false,quiet:true,fetch:c.fetch});assert.equal(await ev(p,'cidianSync.run()'),true);
 assert.equal(ev(p,"words.some(w=>w.hanzi==='听力直接发送校验'&&!w.laoshi)"),true);
 ev(p,"mutateWord(words.find(w=>w.hanzi==='听力直接发送校验'),{laoshi:true,translation:'правка в Cidian'});saveWords()");await ev(p,'cidianSync.run()');
 await ev(t,'dictSendAll()');await ev(p,'cidianSync.run()');
 assert.equal(ev(p,"words.find(w=>w.hanzi==='听力直接发送校验').laoshi"),true);
 assert.equal(ev(p,"words.find(w=>w.hanzi==='听力直接发送校验').translation"),'правка в Cidian');
});
test('failed individual writes survive restart and existing local-only words are recovered',async()=>{
 const c=cloud(),a=surface('cidian',{exercise:false,quiet:true,fetch:c.fetch});
 ev(a,"words.push({uid:makeUid(),id:9000,order:9000,hanzi:'离线队列校验',kind:'word',tags:[],translation:'очередь',laoshi:false});saveWords()");
 c.failNext();assert.equal(await ev(a,'cidianSync.run()'),false);
 const retry=surface('cidian',{exercise:false,quiet:true,fetch:c.fetch,seed:Object.fromEntries(a.map)});assert.equal(await ev(retry,'cidianSync.run()'),true);
 const phone=surface('cidian',{exercise:false,quiet:true,fetch:c.fetch});await ev(phone,'cidianSync.run()');assert.equal(ev(phone,"words.some(w=>w.hanzi==='离线队列校验')"),true);
 ev(phone,"mutateWord(words.find(w=>w.hanzi==='离线队列校验'),{deleted:true});saveWords()");await ev(phone,'cidianSync.run()');await ev(retry,'cidianSync.run()');
 assert.equal(ev(retry,"words.find(w=>w.hanzi==='离线队列校验').deleted"),true);
});
