const FAV_KEY='my-china-favorites-v1';
// серверный эндпоинт ИИ (ключ модели живёт на сервере, в браузер не попадает)
const API_AI='https://api.crmuro.ru/api/china-beautify';
let refsOpen=false;
let favBusy=false;

function favLoad(){
  try{return JSON.parse(localStorage.getItem(FAV_KEY)||'[]')}catch(_){return[]}
}
function favSave(items){
  localStorage.setItem(FAV_KEY,JSON.stringify(items));
  favRefreshEntry();
}
function favHash(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
}
function favType(el){
  if(el.classList.contains('province'))return 'регион';
  if(el.classList.contains('chip'))return 'место';
  if(el.classList.contains('panel'))return 'факт';
  if(el.classList.contains('card'))return state.tab==='library'?'библиотека':state.tab==='tea'?'чай':'карточка';
  if(el.classList.contains('list-item'))return state.tab==='trips'?'поездка':state.tab==='tea'?'чай':state.tab==='library'?'библиотека':'факт';
  return 'факт';
}
function favExtract(el){
  const clone=el.cloneNode(true);
  clone.querySelectorAll('.fav-star,.refs-actions').forEach(x=>x.remove());
  const raw=(clone.innerText||clone.textContent||'').replace(/\s+/g,' ').trim();
  const title=((clone.querySelector('b,.ru,.detail-title,.cn')||{}).textContent||raw.slice(0,80)).trim();
  const type=favType(el);
  const source=state.detail?('Путеводитель · '+state.detail):(tabs.find(t=>t.id===state.tab)?.label||'Мой Китай');
  const key=type+'|'+source+'|'+raw;
  return {id:favHash(key),type,title,raw,source,pretty:'',createdAt:new Date().toISOString()};
}
function favToggle(item){
  const items=favLoad(),i=items.findIndex(x=>x.id===item.id);
  if(i>=0)items.splice(i,1);else items.unshift(item);
  favSave(items);
  if(refsOpen)renderRefs();
  else favDecorate();
}
function favStar(el){
  if(el.dataset.noFav==='1'||el.querySelector(':scope > .fav-star'))return;
  el.classList.add('fav-host');
  const item=favExtract(el);
  const on=favLoad().some(x=>x.id===item.id);
  const s=document.createElement('span');
  s.className='fav-star'+(on?' on':'');
  s.textContent=on?'★':'☆';
  s.title=on?'Убрать из избранного':'Добавить в избранное';
  s.setAttribute('role','button');s.setAttribute('tabindex','0');
  const go=e=>{e.preventDefault();e.stopPropagation();favToggle(item)};
  s.addEventListener('click',go);
  s.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){go(e)}});
  el.appendChild(s);
}
function favDecorate(){
  if(refsOpen)return;
  document.querySelectorAll('#content .province,#content .card,#content .list-item,#content .panel,#content .chip')
    .forEach(favStar);
  favRefreshEntry();
}
function favEntry(){
  if(document.getElementById('refsEntry'))return;
  const wrap=document.createElement('div');wrap.id='refsEntry';wrap.className='refs-entry';
  wrap.innerHTML='<button class="refs-btn" id="refsOpen">★ Справочники <span class="n" id="refsCount">0</span></button>';
  const host=document.getElementById('content');
  if(host)host.insertBefore(wrap,host.firstChild);
  document.getElementById('refsOpen').onclick=()=>{refsOpen=true;renderRefs()};
}
function favRefreshEntry(){
  const n=favLoad().length;
  const c=document.getElementById('refsCount');
  // запись в DOM внутри MutationObserver: трогаем узел только если значение изменилось,
  // иначе наблюдатель срабатывает снова и страница зависает
  if(c&&c.textContent!==String(n))c.textContent=String(n);
}
function refsCard(x){
  return '<div class="refs-card" data-no-fav="1">'+
    '<div class="refs-top"><div><div class="refs-title">'+esc(x.title)+'</div><div class="refs-type">'+esc(x.type)+'</div></div></div>'+
    '<div class="refs-raw">'+esc(x.raw)+'</div>'+
    (x.pretty?'<div class="refs-pretty">'+esc(x.pretty)+'</div>':'')+
    '<div class="refs-source">Источник: '+esc(x.source)+'</div>'+
    '<div class="refs-actions"><button class="ai-btn" data-ai="'+x.id+'">'+(x.pretty?'ИИ · переделать':'ИИ · оформить')+'</button><button class="small-btn" data-del="'+x.id+'">Удалить</button></div></div>';
}
function renderRefs(){
  refsOpen=true;
  const items=favLoad();
  document.getElementById('content').innerHTML=
    '<div class="detail-head"><button class="back" id="refsBack">← Назад</button><div class="detail-title">Справочники <span class="detail-cn">★</span></div></div>'+
    '<div class="panel" data-no-fav="1"><div class="info-title">Избранное</div><p>Сюда попадает всё, что отмечено ★. Исходный текст сохраняется без изменений; ИИ создаёт отдельную оформленную версию факта.</p></div>'+
    (items.length?'<div id="refsList">'+items.map(refsCard).join('')+'</div>':'<div class="refs-empty">Пока пусто. Нажми ☆ на любом факте, месте, книге, чае или поездке.</div>');
  document.getElementById('refsBack').onclick=()=>{refsOpen=false;render();setTimeout(()=>{favEntry();favDecorate()},0)};
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>favDelete(b.dataset.del));
  document.querySelectorAll('[data-ai]').forEach(b=>b.onclick=()=>favBeautify(b.dataset.ai,b));
}
function favDelete(id){
  favSave(favLoad().filter(x=>x.id!==id));renderRefs();
}
async function favBeautify(id,btn){
  if(favBusy)return;
  const items=favLoad(),item=items.find(x=>x.id===id);if(!item)return;
  favBusy=true;btn.disabled=true;btn.textContent='ИИ…';
  try{
    const r=await fetch(API_AI,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,type:item.type,title:item.title,text:item.raw,source:item.source})});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    const text=(j.text||j.beautiful||j.result||'').trim();
    if(!text)throw new Error('empty');
    item.pretty=text;favSave(items);renderRefs();
  }catch(_){
    btn.disabled=false;btn.textContent='ИИ не подключен';
    setTimeout(()=>{if(btn.isConnected)btn.textContent=item.pretty?'ИИ · переделать':'ИИ · оформить'},1800);
  }finally{favBusy=false}
}
function favGlobalEntry(){
  const top=document.querySelector('.top-actions');
  if(top&&!document.getElementById('refsTop')){
    const b=document.createElement('button');b.id='refsTop';b.className='icon-btn';b.textContent='★';b.title='Справочники';b.onclick=()=>{refsOpen=true;renderRefs()};top.prepend(b);
  }
  const side=document.getElementById('sideNav');
  if(side&&!document.getElementById('refsSide')){
    const b=document.createElement('button');b.id='refsSide';b.className='side-refs';b.textContent='★  Справочники';b.onclick=()=>{refsOpen=true;renderRefs()};side.appendChild(b);
  }
}
const favObserver=new MutationObserver(()=>{if(favBusy)return;favGlobalEntry();if(!refsOpen){favEntry();favDecorate()}});
favObserver.observe(document.body,{childList:true,subtree:true});
favGlobalEntry();favEntry();favDecorate();
