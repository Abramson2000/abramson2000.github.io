/* Small, durable per-word transfers, independent of the legacy full dictionary. */
(function(root){
'use strict';
const PREFIX='cidian-word-v4-';
const ordered=o=>Object.fromEntries(Object.keys(o).sort().map(k=>[k,o[k]]));
function record(w){
 const o=Object.assign({},w);delete o.id;delete o.order;delete o.note;
 o.kind=o.kind||'word';o.tags=Array.isArray(o.tags)?o.tags:[];o.comment=o.comment||'';
 o.deleted=!!o.deleted;o.favorite=!!o.favorite;o.laoshi=!!o.laoshi;
 return ordered(o);
}
function key(uid){
 let a=2166136261,b=2246822507;
 for(const c of String(uid)){a=Math.imul(a^c.codePointAt(0),16777619);b=Math.imul(b^c.codePointAt(0),3266489909);}
 return PREFIX+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
function create(c){
 const seeds=new Map((c.seed||[]).map(w=>[w.uid,record(w)]));
 const pack=w=>{
  const seed=seeds.get(w.uid);if(!seed)return w;
  const patch={};for(const k of Object.keys(w))if(JSON.stringify(w[k])!==JSON.stringify(seed[k]))patch[k]=w[k];
  return {$base:w.uid,patch};
 };
 const unpack=w=>w&&w.$base?ordered(Object.assign({},seeds.get(w.$base),w.patch)):record(w);
 const stringify=w=>JSON.stringify(record(w));
 const allKeys=()=>{const a=[];for(let i=0;i<c.storage.length;i++){const k=c.storage.key(i);if(k.startsWith(PREFIX))a.push(k);}return a;};
 const selected=()=>c.selection?new Set(c.selection().map(key)):null;
 const allowed=k=>k.startsWith(PREFIX)&&(!c.selection||selected().has(k));
 const get=k=>{const raw=c.storage.getItem(k);return raw===null?null:stringify(unpack(JSON.parse(raw)));};
 const save=(k,raw)=>{const w=record(JSON.parse(raw));if(!w.uid||key(w.uid)!==k)throw Error('Неверная запись слова');c.storage.setItem(k,JSON.stringify(pack(w)));};
 const stateStorage={
  getItem(k){const raw=c.storage.getItem(k);if(!raw)return raw;const s=JSON.parse(raw);for(const p of Object.keys(s.base||{}))if(typeof s.base[p]==='string')s.base[p]=stringify(unpack(JSON.parse(s.base[p])));return JSON.stringify(s);},
  setItem(k,raw){const s=JSON.parse(raw);for(const p of Object.keys(s.base||{}))if(typeof s.base[p]==='string')s.base[p]=JSON.stringify(pack(JSON.parse(s.base[p])));c.storage.setItem(k,JSON.stringify(s));}
 };
 const engine=CrmSyncCore.create({
  stateKey:c.stateKey,storage:stateStorage,keys:allKeys,allowed,get,
  set:(k,v)=>{save(k,v);if(c.incoming)c.incoming(JSON.parse(v));},
  request:c.request,changed:()=>{if(c.changed)c.changed();},
  initialMerge:(k,l,r)=>{
   if(c.sender)return r; // Re-sending never resets Cidian edits or Laoshi marks.
   const local=JSON.parse(l),remote=JSON.parse(r),seed=seeds.get(local.uid);
   if(seed){const newer=String(local.updatedAt||'')>String(remote.updatedAt||'');const m=CrmSyncCore.threeWay(seed,newer?local:remote,newer?remote:local);m.updatedAt=String(local.updatedAt||'')>String(remote.updatedAt||'')?local.updatedAt:remote.updatedAt;return stringify(m);}
   return String(local.updatedAt||'')>String(remote.updatedAt||'')?l:r;
  },status:c.status||(()=>{})
 });
 function stage(words,onlyMissing){
  let changed=false;
  for(const row of words){
   if(!row.uid)continue;
   const w=record(row),k=key(w.uid),raw=stringify(w),old=get(k),seed=seeds.get(w.uid);
   if(onlyMissing&&old!==null)continue;
   if(old!==null&&String(JSON.parse(old).updatedAt||'')>String(w.updatedAt||''))continue;
   if(old===null&&seed&&raw===stringify(seed))continue;
   if(old!==raw){save(k,raw);changed=true;}
  }
  if(changed)engine.mark();
  return changed;
 }
 function rows(){return allKeys().filter(allowed).map(k=>JSON.parse(get(k)));}
 async function confirm(uids){
  const keys=[...new Set(uids.map(key))];
  for(let i=0;i<keys.length;i+=20){
   const batch=keys.slice(i,i+20),j=await c.request('/api/sync?keys='+encodeURIComponent(batch.join(','))+'&check='+Date.now());
   if(!j.ok)throw Error('Не удалось проверить получение слов');
   for(const k of batch){const r=j.records&&j.records[k];if(!r||!r.value||key(JSON.parse(r.value).uid)!==k)throw Error('Слово не получено сервером');}
  }
  return true;
 }
 return Object.assign({},engine,{stage,rows,confirm,key,get});
}
root.CrmWordSync={create,key,record,PREFIX};
})(typeof globalThis!=='undefined'?globalThis:self);
