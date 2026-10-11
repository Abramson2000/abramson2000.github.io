const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../../spin/app.js','utf8');
function fn(name){
 const start=source.search(new RegExp('(?:async )?function '+name+'\\('));if(start<0)throw Error(name);
 const end=source.indexOf('\n}',start);return source.slice(start,end+2);
}
const names=['loadState','loadExtra','loadMed','loadSpiced','loadPro','loadXDone','saveXDone','syncPayload','save','durablePayload','mergeSnapshot','setSync','pendKey','pendSet','hasPending','sigOf','canonMap','canonScs','canonTrn','mergeScs','mergeTrn','mergeXDone','uniArr','spinDeadline','progressSession','cloudSave','cloudLoad'];
const copy=x=>JSON.parse(JSON.stringify(x));
function client({rows=new Map(),snapshots=new Map(),api,sessionId='u',session,slowDb=false}={}){
 const timers=[],elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',style:{},classList:{add(){},remove(){}}});return elements.get(id);};
 const state=vm.runInNewContext('('+source.match(/const S = ([\s\S]*?\n});/)[1]+')');
 let sessionCalls=0,boots=0;
 const context={S:state,USER:{id:'u',name:'User',email:'u@example.invalid'},SB:{auth:{getSession:session||(()=>{sessionCalls++;return Promise.resolve({data:{session:{access_token:'test:'+sessionId,user:{id:sessionId}}}});})}},
 LS_KEY:'spin-lab-v1:u',APP_VER:'3.1.0',_cloudReady:true,_cloudSaveJob:null,_syncT:null,curExtra:null,curXb:0,curMed:null,curSpiced:null,curPro:null,
 Date,Math,JSON,Set,Map,Object,Number,String,Promise,Error,Response,AbortController,
 setTimeout:(f,ms)=>{timers.push({f,ms,cancelled:false});return timers.length;},clearTimeout:i=>{if(timers[i-1])timers[i-1].cancelled=true;},
 localStorage:{getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,String(v)),removeItem:k=>rows.delete(k)},
 durablePut:async(id,p)=>snapshots.set(id,copy(p)),durableGet:()=>slowDb?new Promise(()=>{}):Promise.resolve(snapshots.get('u')||null),
 updateSyncUI(){},syncChrome(){},toast(){},xpBackfill(){},xpRepair:()=>0,scBackfill(){},refreshExtra(){},stampVersion(){},initOffline(){},switchTab(){boots++;},
 userName:u=>u.name||'User',$:el,spinApi:api|| (async body=>new Response(JSON.stringify(body.action==='get'?{ok:true,data:null}:{ok:true}))),
 SUPABASE_URL:'test',SUPABASE_ANON:'test',REVIEW_MODE:false};
 context.window={supabase:{createClient:()=>context.SB}};
 const ctx=vm.createContext(context);vm.runInContext(names.map(fn).join('\n'),ctx);state.dirty=false;state.sync='off';
 return {ctx,state,rows,snapshots,timers,el,run:j=>vm.runInContext(j,ctx),sessionCalls:()=>sessionCalls,boots:()=>boots};
}
test('an old acknowledgement cannot clear a newer lesson or quiz result',async()=>{
 let ack,started;const begin=new Promise(r=>started=r);let sent;
 const c=client({api:async body=>{sent=copy(body.data);started();return new Promise(r=>ack=()=>r(new Response(JSON.stringify({ok:true}))));}});
 c.state.done=[1];c.run('save()');const sending=c.run('cloudSave()');await begin;
 c.state.done.push(2);c.state.correct=7;c.run('save()');ack();await sending;
 assert.deepEqual(sent.done,[1]);assert.deepEqual(c.state.done,[1,2]);assert.equal(c.state.dirty,true);
 assert.ok(c.rows.has('spin-pending-v1:u'));assert.equal(c.state.sync,'saving');
 c.ctx.spinApi=async body=>{sent=copy(body.data);return new Response(JSON.stringify({ok:true}));};await c.run('cloudSave()');
 assert.deepEqual(sent.done,[1,2]);assert.equal(sent.correct,7);assert.equal(c.state.dirty,false);assert.equal(c.state.sync,'saved');
 assert.equal(c.rows.has('spin-pending-v1:u'),false);assert.equal(c.snapshots.get('u').pending,false);
});
test('parallel saves serialize rather than uploading overlapping snapshots',async()=>{
 let ack,calls=0,started;const begin=new Promise(r=>started=r);
 const c=client({api:async()=>{calls++;started();return new Promise(r=>ack=()=>r(new Response(JSON.stringify({ok:true}))));}});
 c.run('save()');const a=c.run('cloudSave()');await begin;const b=c.run('cloudSave()');assert.equal(calls,1);ack();await Promise.all([a,b]);
});
test('offline progress, course marks and practices survive restart and reach a second device',async()=>{
 let remote=null;const api=async body=>{if(body.action==='save'){remote=copy(body.data);return new Response(JSON.stringify({ok:true}));}return new Response(JSON.stringify({ok:true,data:remote}));};
 const a=client({api:async()=>{throw Error('offline');}});
 Object.assign(a.state,{done:[2,5],medDone:[1],spicedDone:[3],proDone:[4],cDone:[0],xDone:{x4:[1,2]},scStat:{main:{a:[0,1],r:[1]}},trn:{spin:{ord:[0,1],i:1,sc:1,done:false,wrong:[0]}},xp:150,correct:2,attempts:3});
 a.run('save()');await a.run('cloudSave()');assert.equal(a.state.dirty,true);
 const restarted=client({rows:a.rows,snapshots:a.snapshots,api});restarted.run('loadState();loadMed();loadSpiced();loadPro();loadXDone()');
 restarted.run('mergeSnapshot('+JSON.stringify(a.snapshots.get('u'))+')');await restarted.run('cloudLoad()');await restarted.run('cloudSave()');
 assert.deepEqual(remote.done,[2,5]);assert.deepEqual(remote.medDone,[1]);assert.equal(remote.trn.spin.i,1);
 const phone=client({api});await phone.run('cloudLoad()');
 assert.deepEqual([...phone.state.done],[2,5]);assert.deepEqual([...phone.state.medDone],[1]);assert.deepEqual([...phone.state.xDone.x4],[1,2]);assert.equal(phone.state.correct,2);
});
test('a missing session leaves a persistent pending mark and never sends progress',async()=>{
 let calls=0;const c=client({session:async()=>({data:{session:null}}),api:async()=>calls++});
 c.run('save()');await c.run('cloudSave()');assert.equal(calls,0);assert.equal(c.state.dirty,true);assert.ok(c.rows.has('spin-pending-v1:u'));assert.equal(c.state.sync,'noauth');
});
test('a token for another account cannot send or merge the current user progress',async()=>{
 let calls=0;const c=client({sessionId:'other',api:async()=>calls++});c.state.done=[9];c.run('save()');
 await c.run('cloudSave()');await c.run('cloudLoad()');assert.equal(calls,0);assert.deepEqual(c.state.done,[9]);assert.equal(c.state.sync,'noauth');
});
test('an invalid cloud response is an error rather than a saved result',async()=>{
 const c=client({api:async()=>new Response(JSON.stringify({unexpected:true}))});await c.run('cloudLoad()');assert.equal(c.state.sync,'error');
});
test('saved user boots before the first network session request',async()=>{
 const c=client({session:()=>new Promise(()=>{})});c.rows.set('spin-user',JSON.stringify(c.ctx.USER));
 vm.runInContext(fn('initAuth'),c.ctx);let booted=false;c.ctx.boot=async()=>booted=true;
 await c.run('initAuth()');assert.equal(booted,true);
});
test('slow IndexedDB cannot block local progress rendering; late snapshot merges safely',async()=>{
 const c=client({session:()=>new Promise(()=>{})});c.rows.set('spin-lab-v1:u',JSON.stringify({done:[3],xp:90}));
 let finishDb;c.ctx.durableGet=()=>new Promise(r=>finishDb=r);
 c.ctx.spinDeadline=async()=>undefined;
 vm.runInContext(fn('boot'),c.ctx);await c.run('boot(USER)');
 assert.ok(c.boots()>0);assert.deepEqual([...c.state.done],[3]);assert.equal(c.snapshots.has('u'),false,'do not overwrite an unread backup');
 c.state.done.push(4);finishDb({done:[1,3],xp:100});await Promise.resolve();await Promise.resolve();
 assert.deepEqual([...c.state.done],[1,3,4]);assert.ok(c.rows.has('spin-pending-v1:u'));
});
test('first successful local database read seeds the independent backup',async()=>{
 const c=client({session:()=>new Promise(()=>{})});c.rows.set('spin-lab-v1:u',JSON.stringify({done:[6],xp:180}));
 vm.runInContext(fn('boot'),c.ctx);await c.run('boot(USER)');assert.deepEqual(c.snapshots.get('u').done,[6]);
});
test('course marks in the main local snapshot remain visible without IndexedDB',async()=>{
 const c=client({session:()=>new Promise(()=>{})});
 c.rows.set('spin-lab-v1:u',JSON.stringify({medDone:[2],spicedDone:[3],proDone:[4],xd:{x4:[5]}}));
 c.rows.set('spin-med:u',JSON.stringify([1]));c.rows.set('spin-xdone:u',JSON.stringify({x4:[1]}));
 c.run('loadState();loadMed();loadSpiced();loadPro();loadXDone()');
 assert.deepEqual([...c.state.medDone],[1,2]);assert.deepEqual([...c.state.spicedDone],[3]);
 assert.deepEqual([...c.state.proDone],[4]);assert.deepEqual([...c.state.xDone.x4],[1,5]);
});
test('a session deadline releases the caller without waiting for a stalled refresh',async()=>{
 const c=client();c.ctx.setTimeout=(f,ms)=>setTimeout(f,Math.min(ms,5));c.ctx.clearTimeout=clearTimeout;
 assert.equal(await c.run('spinDeadline(new Promise(()=>{}),4000,null)'),null);
});
test('API timeout includes body reads and falls back to the next host',async()=>{
 const c=client();let calls=0;c.ctx.SPIN_API_HOSTS=['https://second.invalid'];c.ctx._spinApiGood='https://first.invalid';c.ctx._spinApiRemote=false;c.ctx.spinApiRemember=()=>{};
 c.ctx.setTimeout=(f,ms)=>setTimeout(f,Math.min(ms,5));c.ctx.clearTimeout=clearTimeout;
 c.ctx.fetch=async(u,o)=>{calls++;if(u.includes('first'))return {ok:true,status:200,text:()=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('aborted'))))};return new Response(JSON.stringify({ok:true,data:null}));};
 vm.runInContext(fn('spinApi'),c.ctx);const r=await c.run("spinApi({action:'get'})");assert.equal((await r.json()).ok,true);assert.equal(calls,2);
});
test('authorization rejection stops fallback without repeatedly sending a token',async()=>{
 const c=client();let calls=0;c.ctx.SPIN_API_HOSTS=['https://second.invalid'];c.ctx._spinApiGood='https://first.invalid';c.ctx._spinApiRemote=false;
 c.ctx.fetch=async()=>{calls++;return new Response('{}',{status:401});};vm.runInContext(fn('spinApi'),c.ctx);
 await assert.rejects(c.run("spinApi({action:'get'})"),/401/);assert.equal(calls,1);
});
