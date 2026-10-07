const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {surface}=require('./app-smoke.cjs');
const ev=(s,j)=>vm.runInContext(j,s.ctx);
test('a 5 MiB shared origin with recovery snapshot syncs small records and preserves baseline after restart',async()=>{
 const rows=new Map(),rev=new Map();
 const fetch=async(url,opts={})=>{
  const u=new URL(url);let data;
  if(opts.method==='POST'){const j=JSON.parse(opts.body);assert.equal(j.base,rows.get(j.key)??null);assert.ok(j.value.length<2000);rows.set(j.key,j.value);rev.set(j.key,(rev.get(j.key)||0)+1);data={ok:true,value:j.value,rev:rev.get(j.key)};}
  else if(u.searchParams.has('list'))data={ok:true,revisions:Object.fromEntries(rev)};
  else data={ok:true,records:Object.fromEntries(u.searchParams.get('keys').split(',').map(k=>[k,{value:rows.get(k)??null,rev:rev.get(k)||0}]))};
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

test('near-full existing storage migrates all words and its exact snapshot without losing local-only additions',async()=>{
 const restored=JSON.parse(fs.readFileSync(__dirname+'/../../cidian/restore-2026-10-07.js','utf8').replace('window.CIDIAN_RESTORE=','').trim().replace(/;$/,''));
 const words=restored.words.map(w=>({...w,uid:w.uid}));words.push({uid:'old-local-only',id:9900,order:9900,hanzi:'尚未发送的旧词',translation:'ещё не было в облаке',kind:'word',tags:['проверка'],laoshi:false});
 const snapshot={ts:'2026-10-07T12:00:00.000Z',reason:'исходный снимок',words:words.map(w=>({...w,uid:'snapshot-'+w.uid}))};
 const dictionary=JSON.stringify(words),backup=JSON.stringify(snapshot);
 const used=2*(dictionary.length+backup.length),fill=Math.max(0,Math.floor((5*1024*1024-used-4000)/2));
 const s=surface('cidian',{exercise:false,quiet:true,quota:5*1024*1024,seed:{'cidian-data-v3':dictionary,'cidian-backup-auto-v3':backup,'tingli-other-work':'x'.repeat(fill)}});
 assert.equal(ev(s,"words.filter(w=>w.hanzi==='尚未发送的旧词').length"),1);
 assert.deepEqual(JSON.parse(ev(s,'JSON.stringify(snapInfo())')),snapshot);
 assert.equal(s.map.has('cidian-data-v3'),false);
 assert.ok(s.map.get('cidian-data-v4').length<dictionary.length/3);
 assert.equal(ev(s,"cidianSync.rows().some(w=>w.uid==='old-local-only')"),true);
 const copy=JSON.parse(ev(s,'JSON.stringify(expandWords(compactWords(words)))'));
 assert.deepEqual(copy,JSON.parse(ev(s,'JSON.stringify(words)')));
});
