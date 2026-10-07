const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {surface}=require('./app-smoke.cjs');
const ev=(s,j)=>vm.runInContext(j,s.ctx);
test('a 5 MiB shared origin with a recovery snapshot syncs a manually added word',async()=>{
 let value=null,rev=0;
 const fetch=async(url,opts={})=>{
  const u=new URL(url);let data;
  if(opts.method==='POST'){const j=JSON.parse(opts.body);assert.equal(j.base,value);value=j.value;data={ok:true,value,rev:++rev};}
  else if(u.searchParams.has('list'))data={ok:true,revisions:value?{'cidian-data-v3':rev}:{}};
  else data={ok:true,records:{'cidian-data-v3':{value,rev}}};
  return new Response(JSON.stringify(data));
 };
 const restored=JSON.parse(fs.readFileSync(__dirname+'/../../cidian/restore-2026-10-07.js','utf8').replace('window.CIDIAN_RESTORE=','').trim().replace(/;$/,''));
 const snapshot=JSON.stringify({words:restored.words,ts:new Date().toISOString()});
 const a=surface('cidian',{exercise:false,quiet:true,fetch,quota:5*1024*1024,seed:{'cidian-backup-auto-v3':snapshot,'tingli-existing-work':'x'.repeat(200000)}});
 assert.equal(await ev(a,'cidianSync.run()'),true);
 ev(a,"words.push({uid:makeUid(),id:4053,order:4053,hanzi:'跨设备新词',kind:'word',translation:'новое слово',tags:[],laoshi:false});saveWords()");
 assert.equal(await ev(a,'cidianSync.run()'),true);
 const b=surface('cidian',{exercise:false,quiet:true,fetch,quota:5*1024*1024});assert.equal(await ev(b,'cidianSync.run()'),true);
 assert.equal(ev(b,"words.some(w=>w.hanzi==='跨设备新词'&&!w.laoshi)"),true);
 const restarted=surface('cidian',{exercise:false,quiet:true,fetch,quota:5*1024*1024,seed:Object.fromEntries(a.map)});assert.equal(await ev(restarted,'cidianSync.run()'),true);
 assert.equal(ev(restarted,"words.filter(w=>w.hanzi==='跨设备新词').length"),1);
});
