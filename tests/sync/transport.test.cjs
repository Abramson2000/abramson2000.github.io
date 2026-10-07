const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../../tingli/sync-transport.5.67.0.js');
const hosts=['https://direct.example','https://alias.example'];
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status});
const hang=signal=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));

test('an unreachable first address cannot prevent selecting the responding address',async()=>{
 const calls=[];
 const transport=create({hosts,timeoutMs:80,hedgeMs:5,fetch:(url,o)=>{
  calls.push(url);
  return url.startsWith(hosts[0])?hang(o.signal):Promise.resolve(reply({ok:true,revisions:{}}));
 }});
 assert.equal((await transport.json('/api/sync?list=1')).ok,true);
 assert.equal(transport.host(),hosts[1]);assert.equal(calls.length,2);
 await transport.json('/api/sync?keys=tingli-schedule-v1');
 assert.equal(calls.length,3);assert.ok(calls.at(-1).startsWith(hosts[1]));
});

test('an invalid response switches addresses and does not count as a successful acknowledgement',async()=>{
 const transport=create({hosts,timeoutMs:80,hedgeMs:5,fetch:async url=>url.startsWith(hosts[0])?
  new Response('<html>error</html>'):reply({ok:true,value:'saved'})});
 assert.equal((await transport.json('/api/sync?list=1')).value,'saved');
 assert.equal(transport.host(),hosts[1]);
 assert.ok(transport.attempts().some(x=>x.error&&x.error.includes('не JSON')));
});

test('both unavailable addresses produce an error rather than a saved result',async()=>{
 const transport=create({hosts,timeoutMs:80,hedgeMs:5,fetch:async()=>{throw Error('Failed to fetch');}});
 await assert.rejects(transport.json('/api/sync?list=1'),/Failed to fetch/);
 assert.equal(transport.host(),null);
});

test('a normal write uses only the address selected by the read',async()=>{
 const calls=[];
 const transport=create({hosts,timeoutMs:80,hedgeMs:5,fetch:async(url,o)=>{
  calls.push({url,method:o.method});return reply({ok:true,value:'word'});
 }});
 await transport.json('/api/sync?list=1');
 await transport.json('/api/sync',{method:'POST',body:'payload'});
 assert.deepEqual(calls.map(x=>x.method),['GET','POST']);
 assert.ok(calls.every(x=>x.url.startsWith(hosts[0])));
});

test('a lost write acknowledgement retries sequentially and exposes CAS conflict to the sync core',async()=>{
 let stored=null,active=0,maxActive=0;const posts=[];
 const transport=create({hosts,timeoutMs:25,hedgeMs:5,fetch:async(url,o)=>{
  if(o.method==='GET')return reply({ok:true,revisions:{}});
  active++;maxActive=Math.max(maxActive,active);
  const p=JSON.parse(o.body);posts.push({host:new URL(url).origin,...p});
  try {
   if(stored!==p.base)return reply({ok:false,value:stored,rev:1},409);
   stored=p.value;await hang(o.signal);
  } finally {active--;}
 }});
 await transport.json('/api/sync?list=1');
 const result=await transport.json('/api/sync',{method:'POST',body:JSON.stringify({key:'word',base:null,value:'new'})});
 assert.equal(result.status,409);assert.equal(result.value,'new');
 assert.equal(stored,'new');assert.equal(posts.length,2);assert.equal(maxActive,1);
 assert.equal(transport.host(),hosts[1]);
});

test('a selected address going offline switches subsequent writes to its alias',async()=>{
 let offline=false;
 const transport=create({hosts,timeoutMs:80,hedgeMs:5,fetch:async url=>{
  if(offline&&url.startsWith(hosts[0]))throw Error('connection lost');
  return reply({ok:true,value:'saved'});
 }});
 await transport.json('/api/sync?list=1');offline=true;
 assert.equal((await transport.json('/api/sync',{method:'POST',body:'payload'})).value,'saved');
 assert.equal(transport.host(),hosts[1]);
});
