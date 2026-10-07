/* Мои слова · 我的生词 — v2.0.0
   Разделы (Слова/Фразы/Названия), тэги вместо «пометок», статус Лаоши, версия в шапке. */
const KINDS=[{k:'word',ru:'Слова',zh:'词',forms:['слово','слова','слов']},{k:'phrase',ru:'Фразы',zh:'短语',forms:['фраза','фразы','фраз']},{k:'name',ru:'Названия',zh:'名称',forms:['название','названия','названий']}];
const KMAP={};KINDS.forEach(x=>KMAP[x.k]=x);
const STORAGE='cidian-data-v3',VERSION='2.13.0',SNAP='cidian-backup-auto-v3',MAX_BYTES=4200000;
const RESTORE_WORDS=window.CIDIAN_RESTORE.words;
const CIDIAN_INBOX='cidian-inbox-v3';
let inboxAdded=0;
let words=loadWords(),currentTab='words',kind='word',addKind='word',addKindOwner=null,sortMode='order',filter='all',tagFilter=[],query='',visible=120,editingId=null;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function migrate(w){const o={...w};if(!Array.isArray(o.tags))o.tags=String(o.note||'').trim()?[String(o.note).trim()]:[];o.tags=o.tags.map(t=>String(t).trim()).filter(Boolean);delete o.note;if(o.kind!=='phrase'&&o.kind!=='name')o.kind='word';o.laoshi=!!o.laoshi;o.favorite=!!o.favorite;o.deleted=!!o.deleted;o.comment=o.comment||'';return o;}
// стабильный uid: выдаём один раз и сохраняем навсегда (для корректного merge без дублей)
function ensureUids(arr){let ch=false;for(const w of arr){if(w&&!w.uid){w.uid=makeUid();ch=true;}}return ch;}
function loadWords(){
  let arr=null;
  try { const x=JSON.parse(localStorage.getItem(STORAGE)||'null'); if(Array.isArray(x))arr=x.map(migrate); } catch (_) {}
  if(!arr) {
    arr=RESTORE_WORDS.map(w=>migrate(JSON.parse(JSON.stringify(w))));
    const old=localStorage.getItem('cidian-data-v1');
    if(old) { try { snapStore('перед восстановлением главного бэкапа 07.10.2026',JSON.parse(old)); } catch (_) {} }
  }
  ensureUids(arr);
  localStorage.setItem(STORAGE,JSON.stringify(arr));
  localStorage.removeItem('cidian-sync-v2');
  // The previous local data stays recoverable in the snapshot; retire only its duplicate.
  if(localStorage.getItem(SNAP))localStorage.removeItem('cidian-data-v1');
  return arr;
}
/* приём слов из Тингли: она кладёт их в очередь cidian-inbox-v3 (тот же localStorage) */
function intakeItems(q,arr){try{if(!Array.isArray(q)||!q.length)return 0;const have=new Set(arr.map(w=>String(w.hanzi||'').trim()));let id=Math.max(0,...arr.map(w=>+w.id||0)),ord=Math.max(0,...arr.map(w=>+w.order||0)),added=0;q.forEach(it=>{const h=String(it.hanzi||'').trim();if(!h||have.has(h))return;id++;ord++;arr.push({id,order:ord,uid:'t3-'+h,kind:'word',hanzi:h,pinyin:String(it.pinyin||''),translation:String(it.ru||''),tags:[],comment:it.src?('из Тингли: '+it.src):'',laoshi:false,favorite:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});have.add(h);added++;});if(added){localStorage.setItem(STORAGE,JSON.stringify(arr));try{scheduleCloudPush();}catch(_){}}return added;}catch(e){throw e;}}
function applyInbox(arr){try{const raw=localStorage.getItem(CIDIAN_INBOX);if(!raw)return 0;const q=JSON.parse(raw)||[];const n=intakeItems(q,arr);localStorage.removeItem(CIDIAN_INBOX);return n;}catch(e){return 0;}}

/* облачный «почтовый ящик» Тингли → «Мой словарь» (для разных доменов и устройств) */
let inboxCloudTs=0,inboxCloudBusy=false;
async function checkInboxCloud(force){
  if(inboxCloudBusy || (!force&&Date.now()-inboxCloudTs<15000))return 0;
  inboxCloudBusy=true;inboxCloudTs=Date.now();
  try{
    if(!initialSyncComplete){initialSyncComplete=await cidianSync.run();if(!initialSyncComplete)return 0;}
    const j=await syncRequest('/api/sync?keys=tingli-cidian-outbox-v3');
    const raw=j.records&&j.records['tingli-cidian-outbox-v3']&&j.records['tingli-cidian-outbox-v3'].value;
    if(!raw)return 0;
    const n=intakeItems(Object.values(JSON.parse(raw)),words);
    if(n){saveWords();repaintSyncedWords();toast('Из Тингли: +'+n+' '+pl(n,['слово','слова','слов']));}
    return n;
  }catch(e){return 0;}finally{inboxCloudBusy=false;}
}
/* приём слов из Тингли «на ходу»: очередь проверяем при возврате в приложение, по storage-событию и раз в 20 с */

async function checkInboxLive(){try{
  if(!initialSyncComplete){initialSyncComplete=await cidianSync.run();if(!initialSyncComplete)return;}
  if(!localStorage.getItem(CIDIAN_INBOX)){ checkInboxCloud(true); return; }
  const n=applyInbox(words);
  if(n>0){
    saveWords();
    try{ if(currentTab==='xl')renderXl(); else if(currentTab==='more')renderMore(); else if(currentTab==='words')renderWords(); }catch(_){}
    toast('Из Тингли: +'+n+' '+pl(n,['слово','слова','слов']));
  }
}catch(e){}}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) checkInboxLive(); });
window.addEventListener('focus',checkInboxLive);
window.addEventListener('storage',e=>{ if(!e.key || e.key===CIDIAN_INBOX) checkInboxLive(); });
setInterval(checkInboxLive,15000);
setTimeout(()=>{try{checkInboxLive();checkInboxCloud(true);}catch(_){}},1200);
/* ── ручной приём слов из Тингли (听力): локальная очередь + облачный ящик явно отправленных слов ── */

let inboxAvailTs=0,inboxAvailN=null,inboxPulling=false;
async function inboxAvailable(){
  try{
    if(Date.now()-inboxAvailTs<60000 && inboxAvailN!==null) return inboxAvailN;
    let pend=0,total=0;
    try{ const raw=localStorage.getItem(CIDIAN_INBOX); const q=(raw?(JSON.parse(raw)||[]):[]); pend+=q.length; total+=q.length; }catch(_){}
    try{
      const j=await syncRequest('/api/sync?keys=tingli-cidian-outbox-v3');const raw=j.records&&j.records['tingli-cidian-outbox-v3']&&j.records['tingli-cidian-outbox-v3'].value;const items=raw?Object.values(JSON.parse(raw)):[];const have=new Set(words.map(w=>String(w.hanzi||'').trim()));pend+=items.filter(x=>!have.has(x.hanzi)).length;total+=items.length;
    }catch(_){}
    inboxAvailTs=Date.now(); inboxAvailN={new:pend,total:total};
    return inboxAvailN;
  }catch(e){ return {new:0,total:0}; }
}
async function doInboxPull(){
  if(inboxPulling) return; inboxPulling=true;
  const b=$('#inboxBtn'); const was=b?b.innerHTML:''; if(b){ b.disabled=true; b.innerHTML='⤓ Ищу…'; }
  let nLocal=0,nCloud=0,nDict=0,found=[],exist=[],err='';
  try{
    let q=[];
    try{ const raw=localStorage.getItem(CIDIAN_INBOX); if(raw){ q=JSON.parse(raw)||[]; } }catch(_){}
    nLocal=intakeItems(q,words);localStorage.removeItem(CIDIAN_INBOX);
    nCloud=(await checkInboxCloud(true))||0;
  }catch(e){}
  const total=nLocal+nCloud;
  if(nLocal)saveWords();
  inboxAvailTs=0; inboxAvailN=null;
  if(b){ b.disabled=false; b.innerHTML=was; }
  try{ if(currentTab==='words')renderWords(); else if(currentTab==='xl')renderXl(); else if(currentTab==='more')renderMore(); }catch(_){}
  const short=a=>a.slice(0,4).join('、')+(a.length>4?(' и ещё '+(a.length-4)):'');
  if(total>0) toast('Из 听力 принято: '+total+(found.length?(' · '+short(found)):''));
  else if(err) toast('Не получилось: '+err+' — проверь интернет');
  else if(!found.length) toast('В 听力 словарь пуст — сначала отправь слова из урока Тингли');
  else toast('Связь с 听力 есть: '+found.length+' '+pl(found.length,['слово','слова','слов'])+' ('+short(exist)+') — всё уже есть в словаре');
  try{ inboxAvailable().then(r=>{const bb=$('#inboxBtn');if(bb){bb.innerHTML='⤓ Забрать слова из 听力'+(r&&r.new?(' ('+r.new+')'):'');bb.classList.toggle('has',!!(r&&r.new));}}); }catch(_){}
}
/* ── облачный синк словаря (как у Тингли): push при правках, pull при открытии/фокусе ── */
/* Единственный API; прежний словарь и старые очереди не участвуют в восстановлении. */
const CIDIAN_API=['https://api.crmuro.ru'];
let initialSyncComplete=false,cidianRecoveryMode=null,PUSH_LOCK=false,cidianLastHost='https://api.crmuro.ru';
function renumber(arr){arr.sort((a,b)=>((+a.order||0)-(+b.order||0))||String(a.hanzi).localeCompare(String(b.hanzi)));arr.forEach((w,i)=>{w.id=i+1;w.order=i+1;});return arr;}
function newerWord(x,y){return String(x.updatedAt||'')>=String(y.updatedAt||'');}
function makeUid(){return 'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function wkey(w){return w.uid || 'c:'+CrmSyncCore.wordKey(w);}
function mergeWords(a,b){return CrmSyncCore.mergeWordRecords(a,b);}
async function syncRequest(path, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch('https://api.crmuro.ru' + path, Object.assign({}, opts || {}, {
      cache:'no-store', signal:ctrl.signal, headers:{'Content-Type':'text/plain;charset=UTF-8'}
    }));
    const data = await r.json();
    if (!r.ok && r.status !== 409) throw new Error('HTTP ' + r.status);
    return Object.assign({}, data, {status:r.status});
  } finally { clearTimeout(timer); }
}

async function cidianFetch(path,opts) {
  const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),20000);
  try {const r=await fetch(CIDIAN_API[0]+path,Object.assign({},opts||{},{cache:'no-store',signal:ctrl.signal}));if(!r.ok)throw Error('HTTP '+r.status);return r;}
  finally{clearTimeout(timer);}
}
function repaintSyncedWords(){
  updateCounts();
  if(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName))return;
  if(!$('#modal').classList.contains('hidden'))return;
  if(currentTab==='xl')renderXl();else if(currentTab==='more')renderMore();else if(currentTab==='words')renderWords();
}
let lastSavedWords=JSON.stringify(words);
function applyIncomingWords(data){
  const existing=new Map(words.map(w=>[wkey(w),w]));
  let nextId=Math.max(0,...words.map(w=>+w.id||0)),nextOrder=Math.max(0,...words.map(w=>+w.order||0));
  words=data.map(row=>{
    const old=existing.get(wkey(row)), incoming=migrate(row);
    if(old){const id=old.id,order=old.order;Object.assign(old,incoming,{id,order});return old;}
    return Object.assign(incoming,{id:++nextId,order:++nextOrder});
  });
  lastSavedWords=JSON.stringify(words);
}

const cidianSync=CrmSyncCore.create({
  stateKey:'cidian-sync-v3',storage:localStorage,keys:()=>[STORAGE],allowed:k=>k===STORAGE,
  get:k=>localStorage.getItem(k),
  set:(k,v)=>{const data=JSON.parse(v);if(!Array.isArray(data))throw Error('Облако повреждено');localStorage.setItem(k,v);applyIncomingWords(data);},
  initialMerge:(k,l,r)=>CrmSyncCore.reconcile(k,JSON.stringify(RESTORE_WORDS),l,r),
  changed:()=>repaintSyncedWords(),request:syncRequest,
  status:(state,error)=>{
    const n=document.getElementById('syncStatus');
    if(n)n.textContent=state==='saved'?'синхронизировано':state==='syncing'?'синхронизация…':'сохранено на устройстве';
    if(error){try{localStorage.setItem('cidian-sync-error-v2',error);}catch(_){}}
  }
});
function scheduleCloudPush(){cidianSync.mark();}
function pushCloud(){return cidianSync.run();}
function pullCloud(){return cidianSync.run();}
function cidianIsCanonical(){return /[#?]canonical\b/.test(location.href);}
function cidianIsCloudWins(){return /[#?]cloudwins\b/.test(location.href);}
function cidianCanonicalUpload(){return cidianSync.run();}
function cidianCloudWins(){return cidianSync.run();}
setTimeout(async()=>{initialSyncComplete=await cidianSync.run();if(/[#?]diag\b/.test(location.href))await cidianDiag();},1200);
window.addEventListener('online',()=>cidianSync.run());
window.addEventListener('focus',()=>cidianSync.run());
window.addEventListener('pagehide',()=>cidianSync.run());
window.addEventListener('storage',e=>{
  if(e.key===STORAGE){try{const a=JSON.parse(localStorage.getItem(STORAGE)||'[]');applyIncomingWords(a);repaintSyncedWords();cidianSync.mark();}catch(_){}}
});
document.addEventListener('visibilitychange',()=>cidianSync.run());
function mutateWord(w,changes){Object.assign(w,changes,{updatedAt:new Date().toISOString()});}
async function cidianDiag(){try{
  const byKind={},lF={},lT={},samples=[];
  for(const w of words){const k=String(w.kind||'word');byKind[k]=(byKind[k]||0)+1;if(w.laoshi)lT[k]=(lT[k]||0)+1;else{lF[k]=(lF[k]||0)+1;if(samples.length<8)samples.push({hanzi:w.hanzi,kind:w.kind,translation:String(w.translation||'').slice(0,40),tags:w.tags});}}
  const rep={ver:VERSION,url:location.href,lastHost:cidianLastHost,hostname:location.hostname,total:words.length,byKind:byKind,laoshiTrue:lT,laoshiFalse:lF,notLaoshiSamples:samples,localBytes:(function(){try{return (localStorage.getItem(STORAGE)||'').length;}catch(e){return -1;}})()};
  try{
    const r0=await cidianFetch('/api/backup?key='+encodeURIComponent(STORAGE)+'&t='+Date.now(),{cache:'no-store'});
    const j0=await r0.json();
    let cnt=-1;try{cnt=JSON.parse(j0.value).length;}catch(e){}
    rep.cloud={host:cidianLastHost,ok:!!j0.ok,bytes:typeof j0.value==='string'?j0.value.length:-1,count:cnt};
  }catch(e){rep.cloud={error:String((e&&e.message)||e)};}
  await cidianFetch('/api/_report',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(rep)});
  toast('📊 Диагностика отправлена: '+words.length+' записей');
}catch(e){toast('⚠️ Диагностика не ушла');}}
function saveWords(){
  // Timestamp every actual user edit, including bulk tag edits and undo.
  const previous=new Map(JSON.parse(lastSavedWords).map(w=>[wkey(w),w]));
  const semantic=w=>{const x=Object.assign({},w);delete x.id;delete x.order;delete x.updatedAt;delete x.uid;return JSON.stringify(x);};
  words.forEach(w=>{const old=previous.get(wkey(w));if(!old||semantic(old)!==semantic(w))w.updatedAt=new Date(Math.max(Date.now(),Date.parse(old&&old.updatedAt)||0)+1).toISOString();});
  const blob=JSON.stringify(words);
  if(blob.length>MAX_BYTES&&!saveWords.warned){saveWords.warned=true;alert('Словарь занимает '+Math.round(blob.length/1024)+' КБ. Сделайте резервную копию.');}
  try{localStorage.setItem(STORAGE,blob);lastSavedWords=blob;}catch(e){alert('Не удалось сохранить словарь на устройстве.');return;}
  updateCounts();scheduleCloudPush();
}
function snapInfo(){try{const j=JSON.parse(localStorage.getItem(SNAP)||'null');return j&&j.words?j:null;}catch(e){return null;}}
function snapStore(reason,arr){try{localStorage.setItem(SNAP,JSON.stringify({ts:new Date().toISOString(),reason,words:arr}));}catch(e){}}
function snapMake(reason){snapStore(reason,words);}
function snapDate(ts){try{return new Date(ts).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return ts;}}
function snapRestore(){const j=snapInfo();if(!j)return;if(confirm('Вернуть словарь из автоснимка от '+snapDate(j.ts)+' ('+j.words.length+' записей)? Текущие правки будут заменены.')){snapMake('перед возвратом автоснимка');words=j.words.map(migrate);ensureUids(words);saveWords();renderMore();}}
function toast(msg,actionLabel,action,doneMsg){const old=document.getElementById('toast');if(old)old.remove();const d=document.createElement('div');d.id='toast';d.className='toast';d.innerHTML='<span>'+esc(msg)+'</span>';const timer=setTimeout(()=>d.remove(),action?7000:3500);if(actionLabel&&action){const b=document.createElement('button');b.className='toast-act';b.textContent=actionLabel;b.onclick=()=>{clearTimeout(timer);d.remove();action();if(doneMsg)toast(doneMsg);};d.appendChild(b);}document.body.appendChild(d);}
function countOf(k){let n=0;for(const w of words)if(w.kind===k&&!w.deleted)n++;return n;}
function newOf(k){let n=0;for(const w of words)if(w.kind===k&&!w.laoshi&&!w.deleted)n++;return n;}
function updateCounts(){const el=$('#count');if(el){const m=KMAP[kind]||KMAP.word;el.textContent=countOf(kind).toLocaleString('ru-RU')+' '+pl(countOf(kind),m.forms);}const sc=$('#settingsCount');if(sc)sc.textContent=words.filter(w=>!w.deleted).length.toLocaleString('ru-RU');}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function pl(n,f){const a=Math.abs(n)%100,b=a%10;if(a>10&&a<20)return f[2];if(b>1&&b<5)return f[1];if(b===1)return f[0];return f[2];}
function tagPool(){const m=new Map();for(const w of words)if(!w.deleted)for(const t of(w.tags||[]))m.set(t,(m.get(t)||0)+1);return [...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ru'));}
function getFiltered(){let a=words.filter(w=>w.kind===kind&&!w.deleted);const q=norm(query.trim());if(q)a=a.filter(w=>norm(w.hanzi+' '+w.pinyin+' '+w.translation+' '+w.comment+' '+(w.tags||[]).join(' ')).includes(q));if(filter==='new')a=a.filter(w=>!w.laoshi);if(filter==='done')a=a.filter(w=>w.laoshi);if(tagFilter.length)a=a.filter(w=>(w.tags||[]).some(t=>tagFilter.includes(t)));if(sortMode==='order')a.sort((x,y)=>(x.order||0)-(y.order||0));if(sortMode==='new')a.sort((x,y)=>(y.order||0)-(x.order||0));if(sortMode==='hanzi')a.sort((x,y)=>String(x.hanzi).localeCompare(String(y.hanzi),'zh-CN'));return a;}
function headHtml(){return `<div class="head"><img src="icon-192-v4.png" class="app-icon" alt="词 — Мой словарь" width="112" height="112"><div class="headtext"><div class="title-row"><div class="title">Мой словарь</div><div class="ver">v${VERSION}</div></div><div class="subtitle">我的生词</div><div id="syncStatus" class="subtitle">сохранено на устройстве</div></div></div>`;}
function kindsHtml(){return `<div class="kinds">${KINDS.map(m=>`<button class="kindbtn ${kind===m.k?'on':''}" data-kind="${m.k}"><b>${m.ru} <span class="zh">${m.zh}</span></b><small>${countOf(m.k).toLocaleString('ru-RU')}</small></button>`).join('')}</div>`;}
function tagsBarHtml(){return (tagFilter.length?tagFilter.map(t=>`<button class="chip tag on" data-untag="${esc(t)}">#${esc(t)} ✕</button>`).join(''):'')+`<button class="chip" id="tagBtn"># тэги${tagFilter.length?' ('+tagFilter.length+')':''}</button>`;}
/* ── режим «как в Excel»: просмотр списком, две колонки, только чтение ── */
function xlRowHtml(w){const second=(w.pinyin?('('+w.pinyin+') '):'')+(w.translation||'');
  return `<div class="xlt"><div class="xlh">${esc(w.hanzi)}</div><div class="xlr">${esc(second)}</div></div>`;}
function renderXl(){currentTab='xl';setTabs();
  const rows=words.filter(w=>!w.deleted&&(w.kind||'word')==='word').slice().sort((a,b)=>(+a.order||0)-(+b.order||0));
  const box=$('#content');
  if(box)box.innerHTML=`<div class="xlwrap"><div class="xlhead"><div>Слово</div><div>(пиньинь) перевод</div></div>${rows.map(xlRowHtml).join('')}</div>`;
  requestAnimationFrame(()=>{try{window.scrollTo({top:document.documentElement.scrollHeight,behavior:'auto'});}catch(_){}});}
function renderWords(){currentTab='words';setTabs();$('#content').innerHTML=headHtml()+kindsHtml()+`<div class="searchrow"><div class="search"><span class="mag">⌕</span><input id="q" placeholder="Поиск: слово, пиньинь, перевод, тэг" value="${esc(query)}"><button class="clear ${query?'':'hidden'}" id="clearQ" aria-label="Очистить поиск">×</button></div><button class="iconbtn" id="sortBtn" aria-label="Сортировка">☷</button><button class="iconbtn" id="xlBtn" aria-label="Список как в Excel" title="Список как в Excel">▤</button></div><div class="chips"><button class="chip ${filter==='all'?'on':''}" data-f="all">Все</button><button class="chip ${filter==='new'?'on':''}" data-f="new">Не в Лаоши</button><button class="chip ${filter==='done'?'on':''}" data-f="done">В Лаоши</button>${tagsBarHtml()}</div><div id="bulk"></div><div class="list" id="list"></div>`;updateCounts();bindWordControls();renderList();}
function bindWordControls(){$('#q').addEventListener('input',e=>{query=e.target.value;visible=120;$('#clearQ').classList.toggle('hidden',!query);renderList();});$('#clearQ').onclick=()=>{query='';$('#q').value='';$('#clearQ').classList.add('hidden');visible=120;renderList();};$('#sortBtn').onclick=showSort;$$('.chip').forEach(b=>{if(b.dataset.f)b.onclick=()=>{filter=b.dataset.f;visible=120;renderWords();};else if(b.dataset.untag)b.onclick=()=>{tagFilter=tagFilter.filter(t=>t!==b.dataset.untag);visible=120;renderWords();};});const xb=$('#xlBtn');if(xb)xb.onclick=renderXl;const ib=$('#inboxBtn');if(ib)ib.onclick=doInboxPull;const tb=$('#tagBtn');if(tb)tb.onclick=showTags;$$('.kindbtn').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;addKind=kind;visible=120;renderWords();});}
function renderList(){const all=getFiltered(),take=all.slice(0,visible),list=$('#list');const bulk=$('#bulk');if(bulk)bulk.innerHTML=(filter==='new'&&all.length)?`<button class="bulkbar" id="bulkLaoshi">✓ Внести показанные (${all.length.toLocaleString('ru-RU')}) в Лаоши</button>`:'';if(bulk&&$('#bulkLaoshi'))$('#bulkLaoshi').onclick=bulkLaoshi;if(!list)return;if(!take.length){list.innerHTML='<div class="empty">Ничего не найдено</div>';return;}list.innerHTML=take.map(w=>`<div class="word ${w.laoshi?'done':'fresh'}" data-id="${w.id}"><div class="hanzi">${esc(w.hanzi)}</div><div class="meta"><div class="py">${esc(w.pinyin||'')}</div><div class="tr">${esc(w.translation||'')}</div>${(w.tags||[]).map(t=>`<span class="tg" data-tag="${esc(t)}">#${esc(t)}</span>`).join('')}</div><button class="ck ${w.laoshi?'on':''}" data-ck="${w.id}" title="${w.laoshi?'в Лаоши — нажмите, чтобы снять':'не в Лаоши — нажмите, чтобы отметить'}">${w.laoshi?'✓':'○'}</button></div>`).join('')+(all.length>visible?`<button class="more" id="more">Показать ещё · ${all.length-visible}</button>`:'');list.querySelectorAll('.word').forEach(el=>el.onclick=e=>{if(e.target.closest('[data-ck]')||e.target.closest('[data-tag]'))return;openDetail(+el.dataset.id);});list.querySelectorAll('[data-ck]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleLaoshi(+b.dataset.ck,true);});list.querySelectorAll('[data-tag]').forEach(s=>s.onclick=e=>{e.stopPropagation();const t=s.dataset.tag;if(!tagFilter.includes(t))tagFilter.push(t);visible=120;renderWords();});const m=$('#more');if(m)m.onclick=()=>{visible+=150;renderList();};}
function toggleLaoshi(id,quick){const w=words.find(x=>x.id===id);if(!w)return;w.laoshi=!w.laoshi;w.updatedAt=new Date().toISOString();saveWords();if(currentTab==='words'){renderList();}else{openDetail(id);}if(quick)toast(w.laoshi?'В Лаоши: '+w.hanzi:'Снял отметку: '+w.hanzi);}
function bulkLaoshi(){const list=getFiltered();if(!list.length)return;if(!confirm('Отметить «в Лаоши» '+list.length+' записей по текущему отбору?'))return;snapMake('перед отметкой «в Лаоши»');const ids=new Set(list.map(w=>w.id));const before=words.map(w=>({id:w.id,laoshi:w.laoshi}));words.forEach(w=>{if(ids.has(w.id)){w.laoshi=true;w.updatedAt=new Date().toISOString();}});saveWords();filter='all';renderWords();toast('В Лаоши: '+list.length,'Вернуть',()=>{const m=new Map(before.map(b=>[b.id,b.laoshi]));words.forEach(w=>{if(m.has(w.id))w.laoshi=m.get(w.id);});saveWords();renderWords();},'Отметки возвращены');}
function setTabs(){$$('.tab').forEach(x=>x.classList.toggle('on',x.dataset.tab===currentTab));}
function renderAdd(id=null){currentTab='add';editingId=id;setTabs();const w=id?words.find(x=>x.id===id):{hanzi:'',pinyin:'',translation:'',tags:[],comment:'',kind:addKind};if(id&&w){if(addKindOwner!==id){addKind=w.kind||'word';addKindOwner=id;}}else{addKindOwner=null;}const k=KMAP[addKind]||KMAP.word;$('#content').innerHTML=`<div class="view-title">${id?'Редактировать':'Добавить'}</div><div class="subtitle" style="margin-top:-15px;margin-bottom:14px">${id?'编辑':'新词条'}</div><div class="kmove-hint">Раздел (можно переложить запись):</div><div class="kinds">${KINDS.map(m=>`<button class="kindbtn ${addKind===m.k?'on':''}" data-akind="${m.k}"><b>${m.ru} <span class="zh">${m.zh}</span></b></button>`).join('')}</div><div class="form"><label>Слово / фраза / название</label><input id="fHanzi" value="${esc(w.hanzi)}" autocomplete="off"><label>Пиньинь</label><input id="fPy" value="${esc(w.pinyin||'')}" autocomplete="off"><label>Перевод</label><textarea id="fTr">${esc(w.translation||'')}</textarea><label>Тэги (через запятую)</label><input id="fTags" value="${esc((w.tags||[]).join(', '))}" placeholder="например: 成语, урок 10" autocomplete="off" list="tagList"><datalist id="tagList">${tagPool().map(t=>`<option value="${esc(t[0])}"></option>`).join('')}</datalist><label>Заметка</label><textarea id="fComment" style="min-height:70px" placeholder="необязательно">${esc(w.comment||'')}</textarea><button class="primary" id="saveBtn">Сохранить в «${k.ru}»</button>${id?'':'<button class="secondary" id="saveNext">Сохранить и добавить следующее</button>'}${id?'':'<button class="secondary" id="inboxBtn" title="Забрать слова, отправленные из Тингли (听力)">⤓ Забрать слова из 听力</button>'}</div>`;$$('.kindbtn').forEach(b=>b.onclick=()=>{addKind=b.dataset.akind;const h=$('#fHanzi').value,py=$('#fPy').value,tr=$('#fTr').value,tg=$('#fTags').value,cm=$('#fComment').value;renderAdd(id);$('#fHanzi').value=h;$('#fPy').value=py;$('#fTr').value=tr;$('#fTags').value=tg;$('#fComment').value=cm;});$('#saveBtn').onclick=()=>saveForm(false);const sn=$('#saveNext');if(sn)sn.onclick=()=>saveForm(true);const ib=$('#inboxBtn');if(ib){ib.onclick=doInboxPull;try{inboxAvailable().then(r=>{if(ib&&r&&r.new)ib.innerHTML='⤓ Забрать слова из 听力 ('+r.new+')';});}catch(_){}}}
function parseTags(s){return [...new Set(String(s||'').split(/[,;]+/).map(t=>t.trim()).filter(Boolean))];}
function saveForm(next){const h=$('#fHanzi').value.trim(),py=$('#fPy').value.trim(),tr=$('#fTr').value.trim(),tags=parseTags($('#fTags').value),comment=$('#fComment').value.trim();if(!h){alert('Введите слово.');return;}if(editingId){const w=words.find(x=>x.id===editingId);mutateWord(w,{hanzi:h,pinyin:py,translation:tr,tags,comment,kind:addKind});}else{const id=Math.max(0,...words.map(x=>+x.id||0))+1,order=Math.max(0,...words.map(x=>+x.order||0))+1;words.push({id,order,uid:makeUid(),kind:addKind,hanzi:h,pinyin:py,translation:tr,tags,comment,laoshi:false,favorite:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}saveWords();if(next)renderAdd();else{kind=addKind;query='';tagFilter=[];filter='all';visible=120;renderWords();}}
function renderMore(){currentTab='more';setTabs();const sj=snapInfo();$('#content').innerHTML=`<div class="view-title">Ещё</div><div class="view-title" style="font-size:0;height:0;margin:0"></div><div class="settings-card"><div class="setting"><span>Всего записей</span><strong id="settingsCount"></strong></div>${KINDS.map(m=>`<div class="setting"><span>${m.ru} <span style="color:var(--muted)">${m.zh}</span></span><small>${countOf(m.k).toLocaleString('ru-RU')} · не в Лаоши: ${newOf(m.k).toLocaleString('ru-RU')}</small></div>`).join('')}</div><div class="settings-card"><button class="setting" id="xlOpen"><span>Список как в Excel</span><small>таблица ›</small></button><button class="setting" id="tagManage"><span>Тэги словаря</span><small>${tagPool().length} шт. ›</small></button>${sj?`<button class="setting" id="snapRestore"><span>Автоснимок перед правками</span><small>${snapDate(sj.ts)} ›</small></button>`:''}</div><div class="settings-card"><button class="setting" id="exportCsv"><span>Экспорт для Excel</span><small>CSV ›</small></button><button class="setting" id="backup"><span>Резервная копия</span><small>JSON ›</small></button><button class="setting" id="restore"><span>Восстановить из копии</span><small>‹ JSON</small></button><input type="file" id="restoreFile" accept="application/json,.json" class="hidden"></div><div class="settings-card"><button class="setting" id="reset"><span>Вернуть главный бэкап 07.10.2026</span><small>4048 записей</small></button></div><div class="settings-card"><div class="setting"><span>Мой словарь</span><small>v${VERSION}</small></div><div class="setting"><span>Синхронизация</span><small id="syncStatus">сохранено на устройстве</small></div></div>`;updateCounts();$('#xlOpen').onclick=renderXl;$('#tagManage').onclick=manageTags;const sr=$('#snapRestore');if(sr)sr.onclick=snapRestore;$('#exportCsv').onclick=exportCsv;$('#backup').onclick=backupJson;$('#restore').onclick=()=>$('#restoreFile').click();$('#restoreFile').onchange=restoreJson;$('#reset').onclick=resetBase;}
function showTags(){const pool=tagPool();$('#modal').innerHTML=`<div class="sheet"><div class="grab"></div><div class="sheet-title">Отбор по тэгам</div>${pool.length?pool.map(([t,n])=>`<button class="sortopt ${tagFilter.includes(t)?'on':''}" data-t="${esc(t)}">#${esc(t)} <span style="color:var(--muted);font-size:12px"> · ${n}</span></button>`).join(''):'<div class="empty">Тэгов пока нет</div>'}<div class="actions"><button class="secondary" id="tagClear">Сбросить отбор</button><button class="primary" id="tagDone" style="margin-top:0">Готово</button></div></div>`;$('#modal').classList.remove('hidden');$$('.sortopt[data-t]').forEach(b=>b.onclick=()=>{const t=b.dataset.t;tagFilter.includes(t)?tagFilter=tagFilter.filter(x=>x!==t):tagFilter.push(t);b.classList.toggle('on');});$('#tagClear').onclick=()=>{tagFilter=[];closeModal();visible=120;renderWords();};$('#tagDone').onclick=()=>{closeModal();visible=120;renderWords();};$('#modal').onclick=e=>{if(e.target.id==='modal')$('#tagDone').click();};}
function manageTags(){const pool=tagPool();$('#modal').innerHTML=`<div class="sheet"><div class="grab"></div><div class="sheet-title">Тэги словаря</div><div class="tagnote">Нажмите на тэг, чтобы переименовать. Крестик — удалить тэг у всех записей.</div>${pool.length?pool.map(([t,n])=>`<div class="tagrow"><button class="tagname" data-ren="${esc(t)}">#${esc(t)} <span style="color:var(--muted);font-size:12px">· ${n}</span></button><button class="tagdel" data-del="${esc(t)}" aria-label="Удалить тэг">✕</button></div>`).join(''):'<div class="empty">Тэгов пока нет</div>'}<div class="actions"><button class="primary" id="tagDone" style="margin-top:0">Готово</button></div></div>`;$('#modal').classList.remove('hidden');$$('[data-ren]').forEach(b=>b.onclick=()=>{const old=b.dataset.ren;const nv=prompt('Новое название тэга (пусто — удалить тэг):',old);if(nv===null)return;const t=nv.trim();snapMake('перед переименованием тэга');if(!t){words.forEach(w=>w.tags=(w.tags||[]).filter(x=>x!==old));}else{words.forEach(w=>{w.tags=(w.tags||[]).map(x=>x===old?t:x);});}tagFilter=tagFilter.map(x=>x===old?t:x).filter((x,i,a)=>x&&a.indexOf(x)===i);saveWords();manageTags();});$$('[data-del]').forEach(b=>b.onclick=()=>{const t=b.dataset.del;const n=(tagPool().find(x=>x[0]===t)||[t,0])[1];if(!confirm('Удалить тэг «'+t+'» у '+n+' записей?'))return;snapMake('перед удалением тэга «'+t+'»');words.forEach(w=>w.tags=(w.tags||[]).filter(x=>x!==t));tagFilter=tagFilter.filter(x=>x!==t);saveWords();manageTags();});$('#tagDone').onclick=()=>{closeModal();renderWords();};$('#modal').onclick=e=>{if(e.target.id==='modal')$('#tagDone').click();};}
function bkrsInfo(hz){try{var d=(typeof BKRS!=='undefined')?BKRS[String(hz||'').trim()]:null;return (d&&(d.ru||(d.ex&&d.ex.length)))?d:null;}catch(e){return null;}}
function normRu(t){t=String(t||'').trim();var m=t.match(/^\s*(?:[IVX]+|\d+)\s*[).]\s*([\s\S]+)$/);if(m&&!/\s(?:[IVX]+|\d+)\s*[).]\s/.test(' '+m[1]))t=m[1].trim();return t;}
function bkrsBlockHtml(w){var d=bkrsInfo(w.hanzi);if(!d)return '';var ex=(d.ex&&d.ex.length)?('<div class="bkr-ex">'+d.ex.map(function(p){return '<div class="bkr-pair"><span class="bkr-zh">'+esc(p[0])+'</span><span class="bkr-ru2">'+esc(p[1])+'</span></div>';}).join('')+'</div>'):'';return '<div class="info"><div class="k">Значение и примеры</div>'+(d.ru?('<div class="bkr-ru">'+esc(normRu(d.ru))+'</div>'):'')+ex+'</div>';}
function openDetail(id){const w=words.find(x=>x.id===id);if(!w)return;const k=KMAP[w.kind]||KMAP.word;$('#modal').innerHTML=`<div class="sheet"><div class="grab"></div><div class="big-hanzi">${esc(w.hanzi)}</div><div class="big-py">${esc(w.pinyin||'')}</div><div class="big-tr">${esc(w.translation||'')}</div>${bkrsBlockHtml(w)}<div class="info"><div class="k">Тэги</div><div class="tagline">${(w.tags||[]).length?(w.tags||[]).map(t=>`<span class="tg">#${esc(t)} <button class="tgx" data-rm="${esc(t)}" aria-label="Убрать">✕</button></span>`).join(''):'<span class="muted">пока нет</span>'}</div><div class="tagadd"><input id="newTag" placeholder="новый тэг" autocomplete="off" list="tagList"><button class="small-btn" id="addTag">Добавить</button></div></div>${w.comment?`<div class="info"><div class="k">Заметка</div>${esc(w.comment)}</div>`:''}<div class="info"><div class="k">Раздел — переложить в…</div><div class="kindmove">${KINDS.map(m=>`<button class="kindbtn ${w.kind===m.k?'on':''}" data-move="${m.k}"><b>${m.ru} <span class="zh">${m.zh}</span></b></button>`).join('')}</div></div><div class="info"><div class="k">Статус</div>${w.laoshi?'Уже в Лаоши ✓':'Ещё не внесено в Лаоши'}</div><div class="info"><div class="k">Порядок в словаре</div>№ ${w.order}</div><datalist id="tagList">${tagPool().map(t=>`<option value="${esc(t[0])}"></option>`).join('')}</datalist><div class="actions"><button class="primary" id="laoshiBtn" style="margin-top:0">${w.laoshi?'Снять отметку «в Лаоши»':'✓ Внести в Лаоши'}</button><button class="secondary" id="editWord" style="margin-top:0">Редактировать</button><button class="danger" id="deleteWord">Удалить</button></div></div>`;$('#modal').classList.remove('hidden');const _cb=$('#closeModal');if(_cb)_cb.onclick=closeModal;$('#laoshiBtn').onclick=()=>toggleLaoshi(id);$('#editWord').onclick=()=>{closeModal();renderAdd(id);};$$('[data-move]').forEach(b=>b.onclick=()=>{const k=b.dataset.move;if(!KMAP[k]||k===w.kind)return;snapMake('перед переносом «'+w.hanzi+'»');const from=(KMAP[w.kind]||KMAP.word).ru;mutateWord(w,{kind:k});saveWords();openDetail(id);toast('«'+w.hanzi+'»: '+from+' → '+KMAP[k].ru);});$('#addTag').onclick=()=>{const t=$('#newTag').value.trim();if(!t)return;const add=parseTags(t);add.forEach(x=>{if(!(w.tags||[]).includes(x))w.tags.push(x);});w.updatedAt=new Date().toISOString();saveWords();openDetail(id);};$$('[data-rm]').forEach(b=>b.onclick=()=>{const t=b.dataset.rm;w.tags=(w.tags||[]).filter(x=>x!==t);w.updatedAt=new Date().toISOString();saveWords();openDetail(id);});$('#deleteWord').onclick=()=>{const nm=w.hanzi;if(confirm('Удалить «'+nm+'»?')){snapMake('перед удалением «'+nm+'»');w.deleted=true;w.updatedAt=new Date().toISOString();saveWords();closeModal();renderWords();toast('Удалено: '+nm,'Вернуть',()=>{w.deleted=false;w.updatedAt=new Date().toISOString();saveWords();renderWords();},'Восстановлено: '+nm);}};}
function closeModal(){$('#modal').classList.add('hidden');$('#modal').innerHTML='';}
function showSort(){$('#modal').innerHTML=`<div class="sheet"><div class="grab"></div><div class="sheet-title">Сортировка</div><button class="sortopt ${sortMode==='order'?'on':''}" data-sort="order">По мере добавления — основной</button><button class="sortopt ${sortMode==='new'?'on':''}" data-sort="new">Последние добавленные сверху</button><button class="sortopt ${sortMode==='hanzi'?'on':''}" data-sort="hanzi">По китайскому алфавиту</button></div>`;$('#modal').classList.remove('hidden');$$('.sortopt').forEach(b=>b.onclick=()=>{sortMode=b.dataset.sort;closeModal();visible=120;renderList();});$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal();};
// ===== шторки: смахнуть за левый край (вправо) или за верхний (вниз) + анимация =====
function sheetSwipe(){
  const modal=$('#modal'); if(!modal) return;
  let sheet=null,edgeX=false,edgeY=false,sx=0,sy=0,dx=0,dy=0,mode=0,busy=false;
  const clear=el=>{ if(!el)return; el.style.transition=''; el.style.transform=''; el.style.opacity=''; };
  const reset=()=>{ clear(sheet); sheet=null; mode=0; sx=sy=dx=dy=0; edgeX=edgeY=false; busy=false; };
  new MutationObserver(()=>{
    const s=modal.querySelector('.sheet');
    if(s&&s!==sheet){ reset(); sheet=s;
      if(!modal.classList.contains('hidden')){
        s.style.transition='none'; s.style.transform='translateY(22px)'; s.style.opacity='.55';
        requestAnimationFrame(()=>{ if(!sheet)return;
          s.style.transition='transform .26s cubic-bezier(.22,.9,.3,1),opacity .18s ease-out';
          s.style.transform='translateY(0)'; s.style.opacity='1'; });
      }
    }
    if(!s) reset();
  }).observe(modal,{childList:true});
  const start=e=>{
    if(!sheet||busy||modal.classList.contains('hidden')||e.touches.length!==1) return;
    const t=e.touches[0], r=sheet.getBoundingClientRect();
    edgeX=(t.clientX<=r.left+40);
    edgeY=(t.clientY<=r.top+66)&&sheet.scrollTop<=0;
    if(!edgeX&&!edgeY) return;
    sx=t.clientX; sy=t.clientY; dx=dy=0; mode=0; sheet.style.transition='none';
  };
  const move=e=>{
    if(!sheet||busy||!sx||e.touches.length!==1) return;
    const t=e.touches[0]; dx=t.clientX-sx; dy=t.clientY-sy;
    if(!mode){
      if(Math.abs(dx)<7&&Math.abs(dy)<7) return;
      if(Math.abs(dy)>=Math.abs(dx)) mode=edgeY?1:(edgeX&&dy>0?1:0);
      else mode=(edgeX&&dx>0)?2:0;
      if(!mode) return;
    }
    if(mode===1){ dy=Math.max(0,dy); if(dy>0){ e.preventDefault(); sheet.style.transform='translateY('+dy+'px)'; sheet.style.opacity=String(Math.max(.35,1-dy/(sheet.clientHeight||600)));} }
    if(mode===2){ dx=Math.max(0,dx); if(dx>0){ e.preventDefault(); sheet.style.transform='translateX('+dx+'px)'; sheet.style.opacity=String(Math.max(.35,1-dx/(sheet.clientWidth||400)));} }
  };
  const end=()=>{
    if(!sheet||busy) return;
    const s=sheet, m=mode, vx=dx, vy=dy; mode=0; sx=sy=0;
    if(m===1&&vy>Math.min(120,(s.clientHeight||600)*0.28)){
      busy=true; s.style.transition='transform .26s cubic-bezier(.4,0,.7,.2),opacity .22s ease-out';
      s.style.transform='translateY('+(s.clientHeight+40)+'px)'; s.style.opacity='0';
      setTimeout(()=>{ busy=false; closeModal(); },240);
    } else if(m===2&&vx>Math.min(110,(s.clientWidth||400)*0.3)){
      busy=true; s.style.transition='transform .26s cubic-bezier(.4,0,.7,.2),opacity .22s ease-out';
      s.style.transform='translateX('+(s.clientWidth+40)+'px)'; s.style.opacity='0';
      setTimeout(()=>{ busy=false; closeModal(); },240);
    } else {
      s.style.transition='transform .22s cubic-bezier(.3,1.2,.5,1),opacity .18s ease-out';
      s.style.transform='translate3d(0,0,0)'; s.style.opacity='1';
    }
    dx=dy=0;
  };
  modal.addEventListener('touchstart',start,{passive:true});
  modal.addEventListener('touchmove',move,{passive:false});
  modal.addEventListener('touchend',end,{passive:true});
  modal.addEventListener('touchcancel',end,{passive:true});
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#modal').classList.contains('hidden')) closeModal(); });
sheetSwipe();}
function dl(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function csvCell(s){s=String(s??'');return /[",\r\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function exportCsv(){const rows=[['№','раздел','слово','pinyin','перевод','тэги','в Лаоши','заметка']];words.slice().sort((a,b)=>(a.order||0)-(b.order||0)).forEach(w=>rows.push([w.order,(KMAP[w.kind]||KMAP.word).ru,w.hanzi,w.pinyin,w.translation,(w.tags||[]).join(', '),w.laoshi?'да':'',w.comment]));dl('cidian-'+new Date().toISOString().slice(0,10)+'.csv','﻿'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');}
function backupJson(){dl('cidian-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({version:VERSION,words},null,2),'application/json');}
function restoreJson(e){const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);const a=Array.isArray(j)?j:j.words;if(!Array.isArray(a)||!a.length)throw 0;if(confirm('Заменить текущий словарь данными из резервной копии?')){snapMake('перед восстановлением из файла');words=a.map(migrate);ensureUids(words);saveWords();renderMore();}}catch(_){alert('Не удалось прочитать резервную копию.');}};r.readAsText(f);}
function resetBase(){if(confirm('Вернуть главный бэкап от 07.10.2026? Текущие изменения будут заменены.')){snapMake('перед возвратом главного бэкапа');words=RESTORE_WORDS.map(w=>migrate(JSON.parse(JSON.stringify(w))));saveWords();renderMore();}}
$$('.tab').forEach(b=>b.onclick=()=>{const t=b.dataset.tab;if(t==='words')renderWords();if(t==='add')renderAdd();if(t==='more')renderMore();});
$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal();};
// ===== шторки: смахнуть за левый край (вправо) или за верхний (вниз) + анимация =====
function sheetSwipe(){
  const modal=$('#modal'); if(!modal) return;
  let sheet=null,edgeX=false,edgeY=false,sx=0,sy=0,dx=0,dy=0,mode=0,busy=false;
  const clear=el=>{ if(!el)return; el.style.transition=''; el.style.transform=''; el.style.opacity=''; };
  const reset=()=>{ clear(sheet); sheet=null; mode=0; sx=sy=dx=dy=0; edgeX=edgeY=false; busy=false; };
  new MutationObserver(()=>{
    const s=modal.querySelector('.sheet');
    if(s&&s!==sheet){ reset(); sheet=s;
      if(!modal.classList.contains('hidden')){
        s.style.transition='none'; s.style.transform='translateY(22px)'; s.style.opacity='.55';
        requestAnimationFrame(()=>{ if(!sheet)return;
          s.style.transition='transform .26s cubic-bezier(.22,.9,.3,1),opacity .18s ease-out';
          s.style.transform='translateY(0)'; s.style.opacity='1'; });
      }
    }
    if(!s) reset();
  }).observe(modal,{childList:true});
  const start=e=>{
    if(!sheet||busy||modal.classList.contains('hidden')||e.touches.length!==1) return;
    const t=e.touches[0], r=sheet.getBoundingClientRect();
    edgeX=(t.clientX<=r.left+40);
    edgeY=(t.clientY<=r.top+66)&&sheet.scrollTop<=0;
    if(!edgeX&&!edgeY) return;
    sx=t.clientX; sy=t.clientY; dx=dy=0; mode=0; sheet.style.transition='none';
  };
  const move=e=>{
    if(!sheet||busy||!sx||e.touches.length!==1) return;
    const t=e.touches[0]; dx=t.clientX-sx; dy=t.clientY-sy;
    if(!mode){
      if(Math.abs(dx)<7&&Math.abs(dy)<7) return;
      if(Math.abs(dy)>=Math.abs(dx)) mode=edgeY?1:(edgeX&&dy>0?1:0);
      else mode=(edgeX&&dx>0)?2:0;
      if(!mode) return;
    }
    if(mode===1){ dy=Math.max(0,dy); if(dy>0){ e.preventDefault(); sheet.style.transform='translateY('+dy+'px)'; sheet.style.opacity=String(Math.max(.35,1-dy/(sheet.clientHeight||600)));} }
    if(mode===2){ dx=Math.max(0,dx); if(dx>0){ e.preventDefault(); sheet.style.transform='translateX('+dx+'px)'; sheet.style.opacity=String(Math.max(.35,1-dx/(sheet.clientWidth||400)));} }
  };
  const end=()=>{
    if(!sheet||busy) return;
    const s=sheet, m=mode, vx=dx, vy=dy; mode=0; sx=sy=0;
    if(m===1&&vy>Math.min(120,(s.clientHeight||600)*0.28)){
      busy=true; s.style.transition='transform .26s cubic-bezier(.4,0,.7,.2),opacity .22s ease-out';
      s.style.transform='translateY('+(s.clientHeight+40)+'px)'; s.style.opacity='0';
      setTimeout(()=>{ busy=false; closeModal(); },240);
    } else if(m===2&&vx>Math.min(110,(s.clientWidth||400)*0.3)){
      busy=true; s.style.transition='transform .26s cubic-bezier(.4,0,.7,.2),opacity .22s ease-out';
      s.style.transform='translateX('+(s.clientWidth+40)+'px)'; s.style.opacity='0';
      setTimeout(()=>{ busy=false; closeModal(); },240);
    } else {
      s.style.transition='transform .22s cubic-bezier(.3,1.2,.5,1),opacity .18s ease-out';
      s.style.transform='translate3d(0,0,0)'; s.style.opacity='1';
    }
    dx=dy=0;
  };
  modal.addEventListener('touchstart',start,{passive:true});
  modal.addEventListener('touchmove',move,{passive:false});
  modal.addEventListener('touchend',end,{passive:true});
  modal.addEventListener('touchcancel',end,{passive:true});
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#modal').classList.contains('hidden')) closeModal(); });
sheetSwipe();
renderWords();
/* ленивая подгрузка БКРС (533 КБ) — не блокируем первый показ словаря */
(function(){try{if(typeof BKRS!=='undefined')return;const s=document.createElement('script');s.src='data-bkrs.js?v='+VERSION;s.async=true;document.head.appendChild(s);}catch(_){}})();
if('serviceWorker' in navigator){
  let hadController=!!navigator.serviceWorker.controller, updating=false;
  let _swReloaded=false;
  try{navigator.serviceWorker.addEventListener('controllerchange',function(){if(_swReloaded)return;_swReloaded=true;location.reload();});}catch(e){}
  navigator.serviceWorker.register('sw.'+VERSION+'.js',{updateViaCache:'none'}).then(reg=>{
    // самолечение: проверяем обновление при каждом возврате в приложение
    const chk=()=>{ if(document.visibilityState!=='visible'||updating) return; updating=true;
      if(!reg||!reg.update){ updating=false; return; }
      reg.update().catch(()=>{}).then(()=>{ updating=false; }); };
    document.addEventListener('visibilitychange',chk); window.addEventListener('focus',chk);
/* приём слов из Тингли «на ходу»: очередь проверяем при возврате в приложение, по storage-событию и раз в 20 с */

    // если подтянулась новая версия — предложить обновление, а не молчать
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(!hadController){ hadController=true; return; }
      try{ toast('Доступно обновление приложения','Обновить',()=>location.reload()); }catch(_){}
    });
  }).catch(()=>{});
}
