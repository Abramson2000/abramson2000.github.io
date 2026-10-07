const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {surface}=require('./app-smoke.cjs');
const ev=(app,script)=>vm.runInContext(script,app.ctx);
function cloud(){
 const rows=new Map(),revs=new Map();
 const fetch=blocked=>async(url,options={})=>{
  const u=new URL(url);if(u.hostname.includes(blocked))throw Error('address unreachable');
  let data,status=200;
  if(options.method==='POST'){
   const p=JSON.parse(options.body),old=rows.get(p.key)??null;
   if(p.base!==old){status=409;data={ok:false,value:old,rev:revs.get(p.key)||0};}
   else{rows.set(p.key,p.value);revs.set(p.key,(revs.get(p.key)||0)+1);data={ok:true,value:p.value,rev:revs.get(p.key)};}
  }else if(u.searchParams.has('list'))data={ok:true,protocol:2,revisions:Object.fromEntries(revs)};
  else if(u.searchParams.has('keys'))data={ok:true,records:Object.fromEntries(u.searchParams.get('keys').split(',').map(k=>[k,{value:rows.get(k)??null,rev:revs.get(k)||0}]))};
  else data={ok:false};
  return new Response(JSON.stringify(data),{status});
 };
 return {rows,fetch};
}
test('new manual word reaches a second Cidian with different reachable API addresses',async()=>{
 const c=cloud(),pc=surface('cidian',{exercise:false,quiet:true,fetch:c.fetch('api.crmuro.ru')}),phone=surface('cidian',{exercise:false,quiet:true,fetch:c.fetch('workers.dev')});
 const hanzi='双地址独立新词校验';
 for(const app of [pc,phone])assert.equal(ev(app,`words.some(w=>w.hanzi===${JSON.stringify(hanzi)})`),false);
 ev(pc,'renderAdd()');pc.el('fHanzi').value=hanzi;pc.el('fTr').value='проверка нового слова';ev(pc,'saveForm(false)');
 assert.equal(await ev(pc,'cidianSync.run()'),true);assert.equal(await ev(phone,'cidianSync.run()'),true);
 assert.equal(ev(phone,`words.filter(w=>w.hanzi===${JSON.stringify(hanzi)}&&!w.deleted&&!w.laoshi).length`),1);
 assert.match(ev(pc,'syncTransport.host()'),/workers.dev$/);assert.match(ev(phone,'syncTransport.host()'),/api.crmuro.ru$/);
});
test('completed lessons and Tingli dictionary transfer use the same store across both addresses',async()=>{
 const c=cloud(),pc=surface('tingli',{exercise:false,quiet:true,fetch:c.fetch('api.crmuro.ru')}),phone=surface('tingli',{exercise:false,quiet:true,fetch:c.fetch('workers.dev')});
 await ev(pc,'tingliSync.run()');await ev(phone,'tingliSync.run()');
 ev(pc,"crsSetDone('s:s_team_wed:2026-10-07',true);crsSetDone('s:s_gram_wed:2026-10-07',true)");
 assert.equal(await ev(pc,'tingliSync.run()'),true);assert.equal(await ev(phone,'tingliSync.run()'),true);
 for(const key of ['s:s_team_wed:2026-10-07','s:s_gram_wed:2026-10-07'])assert.ok(JSON.parse(phone.map.get('tingli-schedule-v1')).done[key]);
 ev(pc,"dictSave([{zh:'听力双地址新词校验',py:'test',ru:'из Тингли',src:'урок'}])");
 const target=surface('cidian',{exercise:false,quiet:true,fetch:c.fetch('workers.dev')});
 assert.equal(ev(target,"words.some(w=>w.hanzi==='听力双地址新词校验')"),false);
 await ev(pc,'dictSendAll()');assert.equal(await ev(target,'cidianSync.run()'),true);
 assert.equal(ev(target,"words.filter(w=>w.hanzi==='听力双地址新词校验'&&!w.deleted&&!w.laoshi).length"),1);
});
