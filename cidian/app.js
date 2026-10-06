/* Мои слова · 我的生词 — v2.0.0
   Разделы (Слова/Фразы/Названия), тэги вместо «пометок», статус Лаоши, версия в шапке. */
const KINDS=[{k:'word',ru:'Слова',zh:'词',forms:['слово','слова','слов']},{k:'phrase',ru:'Фразы',zh:'短语',forms:['фраза','фразы','фраз']},{k:'name',ru:'Названия',zh:'名称',forms:['название','названия','названий']}];
/* слова, которых ещё нет в Лаоши (всё остальное считается внесённым) */
const LAOSHI_NEW=['尽量','澡堂'];
const LAOSHI_SET=new Set(LAOSHI_NEW);
const KMAP={};KINDS.forEach(x=>KMAP[x.k]=x);
function mkBase(r,i){const t=String(r[3]||'').trim();const hz=r[0]||'';return{id:i+1,order:i+1,kind:'word',hanzi:hz,pinyin:r[1]||'',translation:r[2]||'',tags:t?[t]:[],comment:'',laoshi:!LAOSHI_SET.has(String(hz).trim()),favorite:false,createdAt:'',updatedAt:''};}
const BASE_WORDS=(window.CIDIAN_BASE||[]).map(mkBase);
const CONTENT_KEY='cidian-migr-content',CONTENT_TAG='content-2026-09-28';
const FIX_KEY='cidian-migr-content-fix',FIX_TAG='fix-2026-09-28',FIX_NEW=['鲁菜','苏菜','粤菜','闽菜'];
const ANKI_KEY='cidian-migr-anki',ANKI_TAG='anki-2026-09-28';
const ANKI_WORDS=[["说实话","shuō shíhuà","честно говоря"],["老实说","lǎoshí shuō","по правде"],["看来","kànlái","похоже"],["在我看来","zài wǒ kànlái","на мой взгляд"],["据我所知","jù wǒ suǒzhī","насколько я знаю"],["总之","zǒngzhī","короче, словом"],["也就是说","yějiùshì shuō","то есть"],["换句话说","huànjù huàshuō","иначе говоря"],["顺便说一下","shùnbiàn shuōyíxià","кстати"],["幸好","xìnghǎo","к счастью"],["果然","guǒrán","как и ожидалось"],["竟然","jìngrán","и вдруг; кто бы мог подумать"],["可不是","kěbúshì","именно так; конечно; а то как же"],["再三说","zàisān shuō","много раз говорить; повторять снова и снова"],["推回去","tuīhuíqù","возвращать обратно; отталкивать"],["初恋","chūliàn","первая любовь"],["老年","lǎonián","старость, пожилой возраст"],["拉手","lāshǒu","держаться за руки"],["使劲儿","shǐjìnr","изо всех сил, напрячься (разг.)"]];
const ANKI_PHRASES=[["带点儿什么","dài diǎnr shénme","взять с собой что-нибудь"],["空着手","kōng zhe shǒu","с пустыми руками (без ничего)"],["过意不去","guòyì bù qù","чувствовать себя неловко; быть не по себе (из-за неудобства, вины)"],["轮到你了","lúndào nǐle","теперь твоя очередь"],["通知大家","tōngzhī dàjiā","сообщить всем"],["在这儿集合","zài zhèr jíhé","собраться здесь"],["我建议","wǒ jiànyì","я советую"],["吸引注意力","xīyǐn zhùyìlì","привлекать внимание"]];
const ANKI_FIVE=['一般来说','总的来说','无论如何','得','误会'];
const ANKI5_KEY='cidian-migr-anki5',ANKI5_TAG='anki-2026-09-28-five';
const ANKI_PHRASE_ALL=["一路平安", "一路顺风", "不知不觉", "不管怎么说", "人山人海", "入乡随俗", "欲速不达", "恭喜发财", "万事如意", "早日康复", "带点儿什么", "空着手", "过意不去", "轮到你了", "通知大家", "在这儿集合", "我建议", "吸引注意力"];
let ankiAdded=0;
const NAMES_KEY='cidian-migr-names',NAMES_TAG='names-2026-09-28';
const NAMES_LIST=[["辽宁","liáo níng","провинция Ляонин"],["沈阳","shěn yáng","город Шэньян"],["仙居","xiān jū","Сяньцзюй"],["神仙居","shén xiān jū","горы Шэньсяньцзюй"],["大同","dà tóng","город Датун"],["平遥","píng yáo","город Пинъяо"],["太原","tài yuán","Тайюань"],["天津","tiān jīn","Тяньцзинь"],["山西","shān xī","провинция Шаньси"],["张家界","zhāng jiā jiè","Чжанцзяцзе"],["芙蓉","fú róng","город Фужун/Фуронг"],["长沙","cháng shā","город Чанша"],["湖南","hú nán","провинция Хунань"],["长春","cháng chūn","город Чанчунь"],["吉林","jí lín","провинция Цзилинь"],["泰安","tài ān","город Тайань"],["济南","jǐ nán","город Цзинань"],["山东","shān dōng","провинция Шаньдун"],["台北","tái běi","Тайбэй"],["纽约","niǔ yuē","Нью-Йорк"],["拉萨","lā sà","город Лхаса"],["西藏","xī zàng","Тибет"],["黄河","huáng hé","река Хуанхэ"],["长江","cháng jiāng","река Янцзы"],["张掖","zhāng yè","Чжанъе"],["内蒙古","nèi měng gǔ","Внутренняя Монголия"],["呼和浩特","hū hé hào tè","Хух-Хото"],["西宁","xī níng","Синин"],["兰州","lán zhōu","Ланьчжоу"],["敦煌","dūn huáng","Дуньхуан"],["银川","yín chuān","Иньчуань"],["乌鲁木齐","wū lǔ mù qí","Урумчи"],["青海","qīng hǎi","провинция Цинхай"],["甘肃","gān sù","провинция Ганьсу"],["宁夏","níng xià","Нинся автономный район"],["新疆","xīn jiāng","Синьцзян"],["冥王星","míng wáng xīng","Плутон"],["海王星","hǎi wáng xīng","Нептун"],["天王星","tiān wáng xīng","Уран"],["土星","tǔ xīng","Сатурн"],["木星","mù xīng","Юпитер"],["火星","huǒ xīng","Марс"],["地球","dì qiú","Земля"],["金星","jīn xīng","Венера"],["水星","shuǐ xīng","Меркурий"],["湖北","hú běi","провинция Хубэй"],["武汉","wǔ hàn","Ухань"],["重庆","chóng qìng","Чунцин"],["深圳","shēn zhèn","Шэньчжэнь"],["支付宝","zhī fù bǎo","Alipay"],["石家庄","shí jiā zhuāng","Шицзячжуан"],["山海关","shān hǎi guān","Шаньхайгуань"],["北戴河","běi dài hé","Бэйдайхэ"],["秦皇岛","qín huáng dǎo","Циньхуандао"],["河北","hé běi","провинция Хэбэй"],["南昌","nán chāng","Наньчан"],["江西","jiāng xī","провинция Цзянси"],["广州","guǎng zhōu","Гуанчжоу"],["广东","guǎng dōng","провинция Гуандун"],["福州","fú zhōu","Фучжоу"],["福建","fú jiàn","провинция Фуцзянь"],["浙江","zhè jiāng","провинция Чжэцзян"],["南京","nán jīng","Нанкин"],["苏州","sū zhōu","Сучжоу"],["江苏","jiāng sū","провинция Цзянсу"],["陕西","shǎn xī","провинция Шэньси"],["郑州","zhèng zhōu","Чжэнчжоу"],["洛阳","luò yáng","Лоян"],["河南","hé nán","провинция Хэнань"],["哈尔滨","hā ěr bīn","Харбин"],["黑龙江","hēi lóng jiāng","провинция Хэйлунцзян"],["南宁","nán níng","Наньнин"],["广西","guǎng xī","провинция Гуанси"],["杭州","háng zhōu","Ханчжоу"],["滇菜","diān cài","юньнаньская кухня"],["津菜","jīn cài","тяньцзиньская кухня"],["楚菜","chǔ cài","хубэйская кухня"],["沪菜","hù cài","шанхайская кухня"],["豫菜","yù cài","хэнаньская кухня"],["京菜","jīng cài","пекинская кухня"],["东北菜","dōng běi cài","дунбэйская кухня"],["秦菜","qín cài","шаньсинская кухня"],["徽菜","huī cài","аньхойская кухня"],["湘菜","xiāng cài","хунаньская кухня"],["闽菜","mǐn cài","фуцзяньская кухня"],["浙菜","zhè cài","чжэцзянская кухня"],["粤菜","yuè cài","кантонская кухня"],["苏菜","sū cài","кухня Цзянсу"],["鲁菜","lǔ cài","шаньдунская кухня"],["川菜","chuān cài","сычуаньская кухня"],["麦当劳","mài dāng láo","Макдоналдс"],["肯德基","kěn dé jī","KFC"],["埃及","āi jí","Египет"],["泰国","tài guó","Таиланд"],["唐人街","táng rén jiē","чайна-таун"],["成都","chéng dū","Чэнду"],["德国","dé guó","Германия"],["乌克兰","wū kè lán","Украина"],["香港","xiāng gǎng","Гонконг"],["澳门","ào mén","Макао"],["奥地利","ào dì lì","Австрия"],["亚","yà","Азия"],["土耳其","tǔ ěr qí","Турция"],["长城","cháng chéng","Великая Китайская стена"],["台湾","tái wān","Тайвань"],["上海","shàng hǎi","Шанхай"],["四川","sì chuān","провинция Сычуань"],["非洲","fēi zhōu","Африка"],["故宫","gù gōng","Гугун, Запретный город"],["大雁塔","dà yàn tǎ","Большая пагода диких гусей"],["兵马俑","bīng mǎ yǒng","Терракотовая армия"]];
let namesAdded=0;
function applyNames(arr,force){try{
  if(!force && localStorage.getItem(NAMES_KEY)===NAMES_TAG) return 0;
  const S=new Map(NAMES_LIST.map(r=>[r[0],r]));
  const have=new Map(arr.map(w=>[String(w.hanzi||'').trim(),w]));
  let id=Math.max(0,...arr.map(w=>+w.id||0)),ord=Math.max(0,...arr.map(w=>+w.order||0)),added=0;
  S.forEach((r,h)=>{const w=have.get(h);
    if(w){ try{ if(w.kind!=='name') w.kind='name'; if(w.laoshi!==false) w.laoshi=false; if(!w.pinyin) w.pinyin=r[1]; w.updatedAt=new Date().toISOString(); }catch(_){} }
    else { id++; ord++;
      const nw={id,order:ord,uid:makeUid(),kind:'name',hanzi:h,pinyin:r[1],translation:r[2],tags:[],comment:'',laoshi:false,favorite:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      arr.push(nw); have.set(h,nw); added++; } });
  localStorage.setItem(NAMES_KEY,NAMES_TAG);
  snapStore('перед добавлением названий из прописей (28.09.2026)',arr.map(w=>({...w})));
  localStorage.setItem(STORAGE,JSON.stringify(arr));
  return added;}catch(e){return 0;}}
const Chengyu_KEY='cidian-migr-chengyu',Chengyu_TAG='chengyu-2026-09-28';
const Chengyu_LIST=[["旅途愉快","lǚ tú yú kuài","Счастливого пути!"],["鸡毛蒜皮","jī máo suàn pí","пустяк"],["一路平安","yí lù píng ān","Счастливого пути!"],["一路顺风","yī lù shùn fēng","Попутного ветра!"],["不知不觉","bù zhī bù jué","сам того не замечая; бессознательно"],["不管怎么说","bù guǎn zěn me shuō","так или иначе"],["人山人海","rén shān rén hǎi","яблоку негде упасть"],["入乡随俗","rù xiāng suí sú","в чужой монастырь со своим уставом не ходят"],["欲速不达","yù sù bù dá","поспешишь — людей насмешишь"],["恭喜发财","gōng xǐ fā cái","Желаю вам огромного богатства!"],["万事如意","wàn shì rú yì","Всех благ!"],["早日康复","zǎo rì kāng fù","скорейшего выздоровления! поправляйся!"],["半途而废","bàn tú ér fèi","бросить на полпути"],["礼尚往来","lǐ shàng wǎng lái","каков привет, таков и ответ"]];
let chengyuAdded=0;
function applyChengyu(arr,force){try{
  if(!force && localStorage.getItem(Chengyu_KEY)===Chengyu_TAG) return 0;
  const S=new Map(Chengyu_LIST.map(r=>[r[0],r]));
  const have=new Map(arr.map(w=>[String(w.hanzi||'').trim(),w]));
  let id=Math.max(0,...arr.map(w=>+w.id||0)),ord=Math.max(0,...arr.map(w=>+w.order||0)),added=0;
  S.forEach((r,h)=>{const w=have.get(h);
    if(w){ try{ w.kind='phrase'; const tg=Array.isArray(w.tags)?w.tags:[]; if(!tg.includes('成语')) tg.push('成语'); w.tags=tg; if(w.laoshi!==false) w.laoshi=false; if(!w.pinyin) w.pinyin=r[1]; w.updatedAt=new Date().toISOString(); }catch(_){} }
    else { id++; ord++;
      const nw={id,order:ord,uid:makeUid(),kind:'phrase',hanzi:h,pinyin:r[1],translation:r[2],tags:['成语'],comment:'',laoshi:false,favorite:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      arr.push(nw); have.set(h,nw); added++; } });
  localStorage.setItem(Chengyu_KEY,Chengyu_TAG);
  snapStore("перед добавлением списка «成语» из Лаоши (28.09.2026)",arr.map(w=>({...w})));
  localStorage.setItem(STORAGE,JSON.stringify(arr));
  return added;}catch(e){return 0;}}
const Zanghua_KEY='cidian-migr-zanghua',Zanghua_TAG='zanghua-2026-09-28';
const Zanghua_LIST=[["好牛","hǎo niú","круто!"],["屎","shǐ","говно, кал"],["逗屄","dòu bī","придурок, мудак, долбоёб"],["拉屎","lā shǐ","срать"],["他妈的","tā mā de","бля; твою мать!"],["逼","bī","эвфемизм слова пизда"],["玻璃","bō lí","гей"],["屄","bī","пизда"],["肏","cào","ебать"],["傻屄","shǎ bī","мудак, тупая пизда"],["装屄","zhuāng bī","выёбываться; пиздобол"],["牛屄","niú bī","круто, заебись"],["屌","diǎo","хуй; выёбистый; охуенный"],["鸡巴","jī bā","хуй, хуйня"],["我肏","wǒ cào","я ебал! пиздец! блядь!"],["婊子","biǎo zi","шлюха, блядь"],["牛逼","niú bī","круто"],["吹牛","chuī niú","выёбываться"],["小便","xiǎo biàn","моча; мочиться"]];
let zanghuaAdded=0;
function applyZanghua(arr,force){try{
  if(!force && localStorage.getItem(Zanghua_KEY)===Zanghua_TAG) return 0;
  const S=new Map(Zanghua_LIST.map(r=>[r[0],r]));
  const have=new Map(arr.map(w=>[String(w.hanzi||'').trim(),w]));
  let id=Math.max(0,...arr.map(w=>+w.id||0)),ord=Math.max(0,...arr.map(w=>+w.order||0)),added=0;
  S.forEach((r,h)=>{const w=have.get(h);
    if(w){ try{ w.kind='word'; const tg=Array.isArray(w.tags)?w.tags:[]; if(!tg.includes('脏话')) tg.push('脏话'); w.tags=tg; if(w.laoshi!==false) w.laoshi=false; if(!w.pinyin) w.pinyin=r[1]; w.updatedAt=new Date().toISOString(); }catch(_){} }
    else { id++; ord++;
      const nw={id,order:ord,uid:makeUid(),kind:'word',hanzi:h,pinyin:r[1],translation:r[2],tags:['脏话'],comment:'',laoshi:false,favorite:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      arr.push(nw); have.set(h,nw); added++; } });
  localStorage.setItem(Zanghua_KEY,Zanghua_TAG);
  snapStore("перед добавлением списка «脏话» из Лаоши (28.09.2026)",arr.map(w=>({...w})));
  localStorage.setItem(STORAGE,JSON.stringify(arr));
  return added;}catch(e){return 0;}}
const CIDIAN_INBOX='cidian-inbox-v1';
let inboxAdded=0;
/* контент из снимка базы Саши (28.09.2026): ярко-жёлтое — фразы, светло-жёлтое — названия */
const CONTENT_PHRASES=['一路平安','一路顺风','不知不觉','不管怎么说','人山人海','入乡随俗','欲速不达','恭喜发财','万事如意','早日康复'];
const CONTENT_NAMES=['川菜','鲁菜','苏菜','粤菜','浙菜','闽菜','湘菜','徽菜','秦菜','东北菜','京菜','豫菜','沪菜','楚菜','津菜','滇菜'];
const CONTENT_NEW=[{hanzi:'鲁菜',pinyin:'Lǔcài',translation:'Шаньдунская кухня',laoshi:false},{hanzi:'苏菜',pinyin:'Sūcài',translation:'Цзянсуская кухня',laoshi:false},{hanzi:'粤菜',pinyin:'Yuècài',translation:'Кантонская кухня',laoshi:false},{hanzi:'闽菜',pinyin:'Mǐncài',translation:'Фуцзяньская кухня',laoshi:false}];
const STORAGE='cidian-data-v1',VERSION='2.10.7',SNAP='cidian-backup-auto',MAX_BYTES=4200000,MIGR_KEY='cidian-migr',MIGR_TAG='laoshi-2026-09-28';
let words=loadWords(),currentTab='words',kind='word',addKind='word',addKindOwner=null,sortMode='order',filter='all',tagFilter=[],query='',visible=120,editingId=null;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function migrate(w){const o={...w};if(!Array.isArray(o.tags))o.tags=String(o.note||'').trim()?[String(o.note).trim()]:[];o.tags=o.tags.map(t=>String(t).trim()).filter(Boolean);delete o.note;if(o.kind!=='phrase'&&o.kind!=='name')o.kind='word';o.laoshi=!!o.laoshi;o.favorite=!!o.favorite;o.deleted=!!o.deleted;o.comment=o.comment||'';return o;}
// стабильный uid: выдаём один раз и сохраняем навсегда (для корректного merge без дублей)
function ensureUids(arr){let ch=false;for(const w of arr){if(w&&!w.uid){w.uid=makeUid();ch=true;}}return ch;}
function loadWords(){let arr=null;try{const x=JSON.parse(localStorage.getItem(STORAGE)||'null');if(Array.isArray(x)&&x.length)arr=x.map(migrate);}catch(e){}
if(!arr)arr=BASE_WORDS.map(x=>({...x}));
/* одноразовая разметка статуса Лаоши (28.09.2026): всё внесено, кроме 尽量 и 澡堂 */
try{if(localStorage.getItem(MIGR_KEY)!==MIGR_TAG){snapStore('перед разметкой «в Лаоши» (28.09.2026)',arr.map(w=>({...w})));arr.forEach(w=>{w.laoshi=!LAOSHI_SET.has(String(w.hanzi).trim());});localStorage.setItem(MIGR_KEY,MIGR_TAG);localStorage.setItem(STORAGE,JSON.stringify(arr));}}catch(e){}
applyContent(arr);
applyNewFix(arr);
ankiAdded=applyAnki(arr)+applyAnkiFive(arr);
namesAdded=applyNames(arr);
zanghuaAdded=applyZanghua(arr);
chengyuAdded=applyChengyu(arr);
inboxAdded=applyInbox(arr);
/* стабильный uid для каждой записи (один раз, навсегда) */
try{const uidCh=ensureUids(arr);if(uidCh){try{localStorage.setItem(STORAGE,JSON.stringify(arr));}catch(e){}}}catch(e){}
/* локальная дедупликация при старте: убираем задвоенные записи из старых бэкапов */
try {
  const seen=new Set();const out=[];let ch=false;
  for(const w of arr){const hz=String((w&&w.hanzi)||'').trim();if(!hz){ch=true;continue;}const k=[hz,String((w&&w.pinyin)||'').trim(),String((w&&w.translation)||'').trim(),String((w&&w.kind)||'word')].join('\u0001');if(seen.has(k)){ch=true;continue;}seen.add(k);out.push(w);}
  if(ch){arr=out;try{localStorage.setItem(STORAGE,JSON.stringify(arr));}catch(e){}}
}catch(e){}
return arr;}
/* приём слов из Тингли: она кладёт их в очередь cidian-inbox-v1 (тот же localStorage) */
function intakeItems(q,arr){try{if(!Array.isArray(q)||!q.length)return 0;const have=new Set(arr.map(w=>String(w.hanzi||'').trim()));let id=Math.max(0,...arr.map(w=>+w.id||0)),ord=Math.max(0,...arr.map(w=>+w.order||0)),added=0;q.forEach(it=>{const h=String(it.hanzi||'').trim();if(!h||have.has(h))return;id++;ord++;arr.push({id,order:ord,uid:makeUid(),kind:'word',hanzi:h,pinyin:String(it.pinyin||''),translation:String(it.ru||''),tags:[],comment:it.src?('из Тингли: '+it.src):'',laoshi:false,favorite:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});have.add(h);added++;});if(added){snapStore('перед приёмом слов из Тингли',arr.map(w=>({...w})));localStorage.setItem(STORAGE,JSON.stringify(arr));}return added;}catch(e){return 0;}}
function applyInbox(arr){try{const raw=localStorage.getItem(CIDIAN_INBOX);if(!raw)return 0;const q=JSON.parse(raw)||[];localStorage.removeItem(CIDIAN_INBOX);return intakeItems(q,arr);}catch(e){return 0;}}

/* облачный «почтовый ящик» Тингли → «Мой словарь» (для разных доменов и устройств) */
const CIDIAN_INBOX_API='https://abramson-crm.pages.dev/api/cidian-inbox';
let inboxCloudTs=0,inboxCloudBusy=false;
async function checkInboxCloud(force){try{
  const now=Date.now();
  if(!force && now-inboxCloudTs<15000) return 0;
  if(inboxCloudBusy) return 0;
  inboxCloudBusy=true; inboxCloudTs=now;
  let list=null;
  try{ const r=await fetch(CIDIAN_INBOX_API+'?t='+now,{cache:'no-store'}); const j=await r.json(); if(j&&Array.isArray(j.items)) list=j.items; }catch(_){}
  let n=0;
  if(list&&list.length){
    n=intakeItems(list,words);
    try{ fetch(CIDIAN_INBOX_API,{method:'DELETE'}); }catch(_){}
    if(n>0){
      try{ if(currentTab==='xl')renderXl(); else if(currentTab==='more')renderMore(); else if(currentTab==='words')renderWords(); }catch(_){}
      toast('Из Тингли: +'+n+' '+pl(n,['слово','слова','слов']));
    }
  }
  return n;
}catch(e){ return 0; } finally{ inboxCloudBusy=false; }}
/* приём слов из Тингли «на ходу»: очередь проверяем при возврате в приложение, по storage-событию и раз в 20 с */

function checkInboxLive(){try{
  if(!localStorage.getItem(CIDIAN_INBOX)){ checkInboxCloud(true); return; }
  const n=applyInbox(words);
  if(n>0){
    try{ if(currentTab==='xl')renderXl(); else if(currentTab==='more')renderMore(); else if(currentTab==='words')renderWords(); }catch(_){}
    toast('Из Тингли: +'+n+' '+pl(n,['слово','слова','слов']));
  }
}catch(e){}}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) checkInboxLive(); });
window.addEventListener('focus',checkInboxLive);
window.addEventListener('storage',e=>{ if(!e.key || e.key===CIDIAN_INBOX) checkInboxLive(); });
setInterval(checkInboxLive,15000);
setTimeout(()=>{try{checkInboxLive();checkInboxCloud(true);}catch(_){}},1200);
/* ── ручной приём слов из Тингли (听力): локальная очередь + облачный ящик + словарь Тингли в облаке ── */
const TGL_API='https://abramson-crm.pages.dev';
let inboxAvailTs=0,inboxAvailN=null,inboxPulling=false;
function tglDictItems(d){
  try{
    const raw=(d&&d.value!==undefined)?d.value:((d&&d.values&&d.values['tingli-dict-v1']!==undefined)?d.values['tingli-dict-v1']:(d&&d['tingli-dict-v1']));
    let arr=raw;
    if(typeof raw==='string'){ try{arr=JSON.parse(raw);}catch(_){arr=null;} }
    if(!Array.isArray(arr)) return [];
    return arr.map(x=>({hanzi:String((x&&(x.zh||x.hanzi))||''),pinyin:String((x&&(x.py||x.pinyin))||''),ru:String((x&&x.ru)||''),src:String((x&&x.src)||'Тингли')})).filter(x=>x.hanzi);
  }catch(e){ return []; }
}
async function inboxAvailable(){
  try{
    if(Date.now()-inboxAvailTs<60000 && inboxAvailN!==null) return inboxAvailN;
    let pend=0,total=0;
    try{ const raw=localStorage.getItem(CIDIAN_INBOX); const q=(raw?(JSON.parse(raw)||[]):[]); pend+=q.length; total+=q.length; }catch(_){}
    try{
      const r=await fetch(CIDIAN_INBOX_API+'?t='+Date.now(),{cache:'no-store'}); const j=await r.json();
      if(j&&Array.isArray(j.items)){ pend+=j.items.length; total+=j.items.length; }
    }catch(_){}
    try{
      const r2=await fetch(TGL_API+'/api/backup?key=tingli-dict-v1&t='+Date.now(),{cache:'no-store'}); const d=await r2.json();
      const items=tglDictItems(d);
      const have=new Set(words.map(w=>String(w.hanzi||'').trim()));
      pend+=items.filter(x=>!have.has(x.hanzi)).length; total+=items.length;
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
    try{ const raw=localStorage.getItem(CIDIAN_INBOX); if(raw){ q=JSON.parse(raw)||[]; localStorage.removeItem(CIDIAN_INBOX); } }catch(_){}
    nLocal=intakeItems(q,words);
    nCloud=(await checkInboxCloud(true))||0;
    try{
      const r=await fetch(TGL_API+'/api/backup?key=tingli-dict-v1&t='+Date.now(),{cache:'no-store'}); const d=await r.json();
      const items=tglDictItems(d);
      found=items.map(x=>x.hanzi);
      const have=new Set(words.map(w=>String(w.hanzi||'').trim()));
      exist=items.filter(x=>have.has(x.hanzi)).map(x=>x.hanzi);
      if(items.length) nDict=intakeItems(items,words);
    }catch(e){ err='нет связи с Тингли'; }
  }catch(e){}
  const total=nLocal+nCloud+nDict;
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
function applyAnkiFive(arr,force){try{
  if(!force && localStorage.getItem(ANKI5_KEY)===ANKI5_TAG) return 0;
  const S=new Set(ANKI_FIVE); let n=0;
  arr.forEach(w=>{ if(S.has(String(w.hanzi||'').trim())){ w.laoshi=false; n++; } });
  localStorage.setItem(ANKI5_KEY,ANKI5_TAG);
  if(n){ snapStore('перед отметкой «не в Лаоши» (5 слов из Anki)',arr.map(w=>({...w}))); localStorage.setItem(STORAGE,JSON.stringify(arr)); }
  return n;}catch(e){return 0;}}
function applyAnki(arr,force){try{
  const S=new Set(ANKI_PHRASE_ALL);
  arr.forEach(w=>{ if(S.has(String(w.hanzi||'').trim())) w.kind='phrase'; });
  if(!force && localStorage.getItem(ANKI_KEY)===ANKI_TAG) return 0;
  const have=new Set(arr.map(w=>String(w.hanzi||'').trim()));
  let id=Math.max(0,...arr.map(w=>+w.id||0)),ord=Math.max(0,...arr.map(w=>+w.order||0)),added=0;
  const push=(h,py,ru,kind)=>{ if(!h||have.has(h))return; id++;ord++;
    arr.push({id,order:ord,uid:makeUid(),kind,hanzi:h,pinyin:py,translation:ru,tags:[],comment:'',laoshi:false,favorite:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    have.add(h); added++; };
  ANKI_WORDS.forEach(r=>push(r[0],r[1],r[2],'word'));
  ANKI_PHRASES.forEach(r=>push(r[0],r[1],r[2],'phrase'));
  localStorage.setItem(ANKI_KEY,ANKI_TAG);
  if(added){ snapStore('перед добавлением слов из Anki (28.09.2026)',arr.map(w=>({...w}))); localStorage.setItem(STORAGE,JSON.stringify(arr)); }
  return added;}catch(e){return 0;}}
function applyNewFix(arr,force){try{if(!force&&localStorage.getItem(FIX_KEY)===FIX_TAG)return;const S=new Set(FIX_NEW);snapStore('перед отметкой «не в Лаоши» для новых записей',arr.map(w=>({...w})));arr.forEach(w=>{if(S.has(String(w.hanzi||'').trim()))w.laoshi=false;});localStorage.setItem(FIX_KEY,FIX_TAG);localStorage.setItem(STORAGE,JSON.stringify(arr));}catch(e){}}
function applyContent(arr,force){try{if(!force&&localStorage.getItem(CONTENT_KEY)===CONTENT_TAG)return;const before=arr.map(w=>({...w}));const P=new Set(CONTENT_PHRASES),N=new Set(CONTENT_NAMES);arr.forEach(w=>{const hz=String(w.hanzi||'').trim();if(P.has(hz))w.kind='phrase';else if(N.has(hz))w.kind='name';});let id=Math.max(0,...arr.map(w=>+w.id||0)),ord=Math.max(0,...arr.map(w=>+w.order||0));CONTENT_NEW.forEach(n=>{if(!arr.some(w=>String(w.hanzi||'').trim()===n.hanzi)){id++;ord++;arr.push({id,order:ord,uid:makeUid(),kind:'name',hanzi:n.hanzi,pinyin:n.pinyin,translation:n.translation,tags:[],comment:'',laoshi:n.laoshi!==false?false:n.laoshi,favorite:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}});snapStore('перед добавлением фраз и названий (28.09.2026)',before);localStorage.setItem(CONTENT_KEY,CONTENT_TAG);localStorage.setItem(STORAGE,JSON.stringify(arr));}catch(e){}}
/* ── облачный синк словаря (как у Тингли): push при правках, pull при открытии/фокусе ── */
const CIDIAN_API=['https://api.crmuro.ru','https://tingli-api.crmuro.ru','https://abramson-crm.pages.dev'];
let pushTimer=null,pullTs=0;
let initialSyncComplete=false,cidianRecoveryMode=null,PUSH_LOCK=true;
async function cidianFetch(path,opts){return new Promise(function(resolve,reject){let done=false,left=CIDIAN_API.length,lastErr=null;if(!left){reject(new Error('нет связи'));return;}const timers=[];const stop=function(){timers.forEach(function(t){clearTimeout(t);});};CIDIAN_API.forEach(function(host){let ctrl=null;try{ctrl=new AbortController();}catch(e){}const tm=setTimeout(function(){try{if(ctrl)ctrl.abort();}catch(e){}},20000);timers.push(tm);const o=Object.assign({},opts||{});if(ctrl&&ctrl.signal)o.signal=ctrl.signal;fetch(host+path,o).then(function(r){if(done)return;if(!r.ok){lastErr=new Error('HTTP '+r.status);if(--left<=0){stop();reject(lastErr);}return;}done=true;stop();resolve(r);}).catch(function(e){if(done)return;lastErr=e;if(--left<=0){stop();reject(lastErr||new Error('нет связи'));}});});});}
function renumber(arr){arr.sort((a,b)=>((+a.order||0)-(+b.order||0))||String(a.hanzi).localeCompare(String(b.hanzi)));arr.forEach((w,i)=>{w.id=i+1;w.order=i+1;});return arr;}
function newerWord(x,y){const tx=String((x&&x.updatedAt)||''),ty=String((y&&y.updatedAt)||'');if(tx&&ty)return tx>=ty;return !!tx||!ty;}
function makeUid(){return 'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
// Стабильный uid: изменение перевода/пиньиня НЕ создаёт дубль. Fallback — content-key для старых записей без uid.
function wkey(w){if(w&&w.uid)return 'u:'+String(w.uid);const hz=String((w&&w.hanzi)||'').trim();if(!hz)return null;return 'c:'+[hz,String((w&&w.pinyin)||'').trim(),String((w&&w.translation)||'').trim(),String((w&&w.kind)||'word')].join('\u0001');}
function mergeWords(a,b){const m=new Map();const put=w=>{if(!w)return;const h=wkey(w);if(!h)return;const ex=m.get(h);if(!ex||newerWord(w,ex))m.set(h,w);};(a||[]).forEach(put);(b||[]).forEach(put);return Array.from(m.values());}
function scheduleCloudPush(){if(!initialSyncComplete||PUSH_LOCK)return;if(pushTimer)clearTimeout(pushTimer);pushTimer=setTimeout(pushCloud,1500);}
async function pushCloud(){if(!initialSyncComplete||PUSH_LOCK||cidianRecoveryMode)return;try{
  // перед push: pull cloud → merge(local, cloud) → push merged (удаления — через deleted-tombstone)
  let cloud=null;
  try{const r=await cidianFetch('/api/backup?key='+encodeURIComponent('cidian-data-v1')+'&t='+Date.now(),{cache:'no-store'});const j=await r.json();if(j&&j.ok&&typeof j.value==='string'){try{cloud=JSON.parse(j.value);}catch(e){}}}catch(e){}
  let toPush=words;
  if(Array.isArray(cloud)&&cloud.length){
    const merged=renumber(mergeWords(cloud.map(migrate),words.map(w=>({...w}))));
    if(JSON.stringify(merged)!==JSON.stringify(words)){words=merged;try{localStorage.setItem(STORAGE,JSON.stringify(words));}catch(e){}updateCounts();}
    toPush=merged;
  }
  const payload=JSON.stringify({'cidian-data-v1':JSON.stringify(toPush)});
  await cidianFetch('/api/backup',{method:'POST',body:payload});
}catch(e){}}
async function pullCloud(force){try{
  if(cidianRecoveryMode)return;
  if(!force&&Date.now()-pullTs<15000)return;pullTs=Date.now();
  const r=await cidianFetch('/api/backup?key='+encodeURIComponent('cidian-data-v1')+'&t='+Date.now(),{cache:'no-store'});
  const j=await r.json();
  if(!j||!j.ok||typeof j.value!=='string'){ if(words&&words.length) scheduleCloudPush(); return; }
  let cloud=null;try{cloud=JSON.parse(j.value);}catch(e){return;}
  if(!Array.isArray(cloud)||!cloud.length){ if(words&&words.length) scheduleCloudPush(); return; }
  const merged=renumber(mergeWords(words.map(w=>({...w})),cloud.map(migrate)));
  if(JSON.stringify(merged)!==JSON.stringify(words)){words=merged;saveWords();try{if(currentTab==='xl')renderXl();else if(currentTab==='more')renderMore();else if(currentTab==='words')renderWords();}catch(_){}toast('☁️ Словарь синхронизирован');}
}catch(e){}finally{initialSyncComplete=true;}}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) pullCloud(); });
window.addEventListener('focus',()=>{ pullCloud(); });
function cidianIsCanonical(){return /[#?]canonical\b/.test(location.href);}
function cidianIsCloudWins(){return /[#?]cloudwins\b/.test(location.href);}
async function cidianCanonicalUpload(){cidianRecoveryMode='canonical';try{
  try{const r=await cidianFetch('/api/backup?key='+encodeURIComponent('cidian-data-v1')+'&t='+Date.now(),{cache:'no-store'});const j=await r.json();if(j&&j.ok&&typeof j.value==='string'){await cidianFetch('/api/backup',{method:'POST',body:JSON.stringify({['tingli-safety-backup-'+Date.now()]:JSON.stringify({'cidian-data-v1':j.value})})});}}catch(e){}
  // ?force=1 — эталонная запись: словарь заменяет облачную копию без union-слияния
  const payload=JSON.stringify({'cidian-data-v1':JSON.stringify(words)});
  await cidianFetch('/api/backup?force=1',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:payload});
  toast('✅ Эталон загружен: '+words.filter(w=>!w.deleted).length+' записей');
}catch(e){toast('⚠️ Не удалось загрузить эталон');}finally{initialSyncComplete=true;cidianRecoveryMode=null;}}
async function cidianCloudWins(){cidianRecoveryMode='cloudwins';try{
  const r=await cidianFetch('/api/backup?key='+encodeURIComponent('cidian-data-v1')+'&t='+Date.now(),{cache:'no-store'});
  const j=await r.json();
  if(!j||!j.ok||typeof j.value!=='string'){toast('⚠️ Нет связи с облаком');return;}
  let cloud=null;try{cloud=JSON.parse(j.value);}catch(e){toast('⚠️ Облако повреждено');return;}
  if(!Array.isArray(cloud)){toast('⚠️ Облако повреждено');return;}
  words=renumber(cloud.map(migrate));
  saveWords();
  try{if(currentTab==='xl')renderXl();else if(currentTab==='more')renderMore();else if(currentTab==='words')renderWords();}catch(_){}
  toast('☁️ Восстановлено из облака: '+words.filter(w=>!w.deleted).length+' записей');
}catch(e){toast('⚠️ Не удалось восстановить из облака');}finally{initialSyncComplete=true;cidianRecoveryMode=null;}}
setTimeout(()=>{
  if(/[#?]unlock\b/.test(location.href))PUSH_LOCK=false;
  if(cidianIsCanonical())cidianCanonicalUpload();
  else if(cidianIsCloudWins())cidianCloudWins();
  else pullCloud(true);
},1200);
function saveWords(){const blob=JSON.stringify(words);if(blob.length>MAX_BYTES&&!saveWords.warned){saveWords.warned=true;alert('Словарь занимает '+Math.round(blob.length/1024)+' КБ из ~5000 КБ. Сделайте резервную копию (Ещё → Резервная копия): при переполнении браузер может стереть данные.');}try{localStorage.setItem(STORAGE,blob);}catch(e){alert('Не удалось сохранить словарь на устройстве.');}updateCounts();scheduleCloudPush();}
function snapInfo(){try{const j=JSON.parse(localStorage.getItem(SNAP)||'null');return j&&j.words?j:null;}catch(e){return null;}}
function snapStore(reason,arr){try{localStorage.setItem(SNAP,JSON.stringify({ts:new Date().toISOString(),reason,words:arr}));}catch(e){}}
function snapMake(reason){snapStore(reason,words);}
function snapDate(ts){try{return new Date(ts).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return ts;}}
function snapRestore(){const j=snapInfo();if(!j)return;if(confirm('Вернуть словарь из автоснимка от '+snapDate(j.ts)+' ('+j.words.length+' записей)? Текущие правки будут заменены.')){snapMake('перед возвратом автоснимка');words=j.words.map(migrate);saveWords();renderMore();}}
function toast(msg,actionLabel,action,doneMsg){const old=document.getElementById('toast');if(old)old.remove();const d=document.createElement('div');d.id='toast';d.className='toast';d.innerHTML='<span>'+esc(msg)+'</span>';const timer=setTimeout(()=>d.remove(),action?7000:3500);if(actionLabel&&action){const b=document.createElement('button');b.className='toast-act';b.textContent=actionLabel;b.onclick=()=>{clearTimeout(timer);d.remove();action();if(doneMsg)toast(doneMsg);};d.appendChild(b);}document.body.appendChild(d);}
function countOf(k){let n=0;for(const w of words)if(w.kind===k&&!w.deleted)n++;return n;}
function newOf(k){let n=0;for(const w of words)if(w.kind===k&&!w.laoshi&&!w.deleted)n++;return n;}
function updateCounts(){const el=$('#count');if(el){const m=KMAP[kind]||KMAP.word;el.textContent=countOf(kind).toLocaleString('ru-RU')+' '+pl(countOf(kind),m.forms);}const sc=$('#settingsCount');if(sc)sc.textContent=words.filter(w=>!w.deleted).length.toLocaleString('ru-RU');}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function pl(n,f){const a=Math.abs(n)%100,b=a%10;if(a>10&&a<20)return f[2];if(b>1&&b<5)return f[1];if(b===1)return f[0];return f[2];}
function tagPool(){const m=new Map();for(const w of words)if(!w.deleted)for(const t of(w.tags||[]))m.set(t,(m.get(t)||0)+1);return [...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ru'));}
function getFiltered(){let a=words.filter(w=>w.kind===kind&&!w.deleted);const q=norm(query.trim());if(q)a=a.filter(w=>norm(w.hanzi+' '+w.pinyin+' '+w.translation+' '+w.comment+' '+(w.tags||[]).join(' ')).includes(q));if(filter==='new')a=a.filter(w=>!w.laoshi);if(filter==='done')a=a.filter(w=>w.laoshi);if(tagFilter.length)a=a.filter(w=>(w.tags||[]).some(t=>tagFilter.includes(t)));if(sortMode==='order')a.sort((x,y)=>(x.order||0)-(y.order||0));if(sortMode==='new')a.sort((x,y)=>(y.order||0)-(x.order||0));if(sortMode==='hanzi')a.sort((x,y)=>String(x.hanzi).localeCompare(String(y.hanzi),'zh-CN'));return a;}
function headHtml(){return `<div class="head"><img src="icon-192-v4.png" class="app-icon" alt="词 — Мой словарь" width="112" height="112"><div class="headtext"><div class="title-row"><div class="title">Мой словарь</div><div class="ver">v${VERSION}</div></div><div class="subtitle">我的生词</div></div></div>`;}
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
function saveForm(next){const h=$('#fHanzi').value.trim(),py=$('#fPy').value.trim(),tr=$('#fTr').value.trim(),tags=parseTags($('#fTags').value),comment=$('#fComment').value.trim();if(!h){alert('Введите слово.');return;}if(editingId){const w=words.find(x=>x.id===editingId);Object.assign(w,{hanzi:h,pinyin:py,translation:tr,tags,comment,kind:addKind,updatedAt:new Date().toISOString()});}else{const id=Math.max(0,...words.map(x=>+x.id||0))+1,order=Math.max(0,...words.map(x=>+x.order||0))+1;words.push({id,order,uid:makeUid(),kind:addKind,hanzi:h,pinyin:py,translation:tr,tags,comment,laoshi:false,favorite:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}saveWords();if(next)renderAdd();else{kind=addKind;query='';tagFilter=[];filter='all';visible=120;renderWords();}}
function renderMore(){currentTab='more';setTabs();const sj=snapInfo();$('#content').innerHTML=`<div class="view-title">Ещё</div><div class="view-title" style="font-size:0;height:0;margin:0"></div><div class="settings-card"><div class="setting"><span>Всего записей</span><strong id="settingsCount"></strong></div>${KINDS.map(m=>`<div class="setting"><span>${m.ru} <span style="color:var(--muted)">${m.zh}</span></span><small>${countOf(m.k).toLocaleString('ru-RU')} · не в Лаоши: ${newOf(m.k).toLocaleString('ru-RU')}</small></div>`).join('')}</div><div class="settings-card"><button class="setting" id="xlOpen"><span>Список как в Excel</span><small>таблица ›</small></button><button class="setting" id="tagManage"><span>Тэги словаря</span><small>${tagPool().length} шт. ›</small></button>${sj?`<button class="setting" id="snapRestore"><span>Автоснимок перед правками</span><small>${snapDate(sj.ts)} ›</small></button>`:''}</div><div class="settings-card"><button class="setting" id="exportCsv"><span>Экспорт для Excel</span><small>CSV ›</small></button><button class="setting" id="backup"><span>Резервная копия</span><small>JSON ›</small></button><button class="setting" id="restore"><span>Восстановить из копии</span><small>‹ JSON</small></button><input type="file" id="restoreFile" accept="application/json,.json" class="hidden"></div><div class="settings-card"><button class="setting" id="reset"><span>Вернуть исходный список из Excel</span><small>3913 слов</small></button></div><div class="settings-card"><div class="setting"><span>Мой словарь</span><small>v${VERSION}</small></div></div>`;updateCounts();$('#xlOpen').onclick=renderXl;$('#tagManage').onclick=manageTags;const sr=$('#snapRestore');if(sr)sr.onclick=snapRestore;$('#exportCsv').onclick=exportCsv;$('#backup').onclick=backupJson;$('#restore').onclick=()=>$('#restoreFile').click();$('#restoreFile').onchange=restoreJson;$('#reset').onclick=resetBase;}
function showTags(){const pool=tagPool();$('#modal').innerHTML=`<div class="sheet"><div class="grab"></div><div class="sheet-title">Отбор по тэгам</div>${pool.length?pool.map(([t,n])=>`<button class="sortopt ${tagFilter.includes(t)?'on':''}" data-t="${esc(t)}">#${esc(t)} <span style="color:var(--muted);font-size:12px"> · ${n}</span></button>`).join(''):'<div class="empty">Тэгов пока нет</div>'}<div class="actions"><button class="secondary" id="tagClear">Сбросить отбор</button><button class="primary" id="tagDone" style="margin-top:0">Готово</button></div></div>`;$('#modal').classList.remove('hidden');$$('.sortopt[data-t]').forEach(b=>b.onclick=()=>{const t=b.dataset.t;tagFilter.includes(t)?tagFilter=tagFilter.filter(x=>x!==t):tagFilter.push(t);b.classList.toggle('on');});$('#tagClear').onclick=()=>{tagFilter=[];closeModal();visible=120;renderWords();};$('#tagDone').onclick=()=>{closeModal();visible=120;renderWords();};$('#modal').onclick=e=>{if(e.target.id==='modal')$('#tagDone').click();};}
function manageTags(){const pool=tagPool();$('#modal').innerHTML=`<div class="sheet"><div class="grab"></div><div class="sheet-title">Тэги словаря</div><div class="tagnote">Нажмите на тэг, чтобы переименовать. Крестик — удалить тэг у всех записей.</div>${pool.length?pool.map(([t,n])=>`<div class="tagrow"><button class="tagname" data-ren="${esc(t)}">#${esc(t)} <span style="color:var(--muted);font-size:12px">· ${n}</span></button><button class="tagdel" data-del="${esc(t)}" aria-label="Удалить тэг">✕</button></div>`).join(''):'<div class="empty">Тэгов пока нет</div>'}<div class="actions"><button class="primary" id="tagDone" style="margin-top:0">Готово</button></div></div>`;$('#modal').classList.remove('hidden');$$('[data-ren]').forEach(b=>b.onclick=()=>{const old=b.dataset.ren;const nv=prompt('Новое название тэга (пусто — удалить тэг):',old);if(nv===null)return;const t=nv.trim();snapMake('перед переименованием тэга');if(!t){words.forEach(w=>w.tags=(w.tags||[]).filter(x=>x!==old));}else{words.forEach(w=>{w.tags=(w.tags||[]).map(x=>x===old?t:x);});}tagFilter=tagFilter.map(x=>x===old?t:x).filter((x,i,a)=>x&&a.indexOf(x)===i);saveWords();manageTags();});$$('[data-del]').forEach(b=>b.onclick=()=>{const t=b.dataset.del;const n=(tagPool().find(x=>x[0]===t)||[t,0])[1];if(!confirm('Удалить тэг «'+t+'» у '+n+' записей?'))return;snapMake('перед удалением тэга «'+t+'»');words.forEach(w=>w.tags=(w.tags||[]).filter(x=>x!==t));tagFilter=tagFilter.filter(x=>x!==t);saveWords();manageTags();});$('#tagDone').onclick=()=>{closeModal();renderWords();};$('#modal').onclick=e=>{if(e.target.id==='modal')$('#tagDone').click();};}
function bkrsInfo(hz){try{var d=(typeof BKRS!=='undefined')?BKRS[String(hz||'').trim()]:null;return (d&&(d.ru||(d.ex&&d.ex.length)))?d:null;}catch(e){return null;}}
function normRu(t){t=String(t||'').trim();var m=t.match(/^\s*(?:[IVX]+|\d+)\s*[).]\s*([\s\S]+)$/);if(m&&!/\s(?:[IVX]+|\d+)\s*[).]\s/.test(' '+m[1]))t=m[1].trim();return t;}
function bkrsBlockHtml(w){var d=bkrsInfo(w.hanzi);if(!d)return '';var ex=(d.ex&&d.ex.length)?('<div class="bkr-ex">'+d.ex.map(function(p){return '<div class="bkr-pair"><span class="bkr-zh">'+esc(p[0])+'</span><span class="bkr-ru2">'+esc(p[1])+'</span></div>';}).join('')+'</div>'):'';return '<div class="info"><div class="k">Значение и примеры</div>'+(d.ru?('<div class="bkr-ru">'+esc(normRu(d.ru))+'</div>'):'')+ex+'</div>';}
function openDetail(id){const w=words.find(x=>x.id===id);if(!w)return;const k=KMAP[w.kind]||KMAP.word;$('#modal').innerHTML=`<div class="sheet"><div class="grab"></div><div class="big-hanzi">${esc(w.hanzi)}</div><div class="big-py">${esc(w.pinyin||'')}</div><div class="big-tr">${esc(w.translation||'')}</div>${bkrsBlockHtml(w)}<div class="info"><div class="k">Тэги</div><div class="tagline">${(w.tags||[]).length?(w.tags||[]).map(t=>`<span class="tg">#${esc(t)} <button class="tgx" data-rm="${esc(t)}" aria-label="Убрать">✕</button></span>`).join(''):'<span class="muted">пока нет</span>'}</div><div class="tagadd"><input id="newTag" placeholder="новый тэг" autocomplete="off" list="tagList"><button class="small-btn" id="addTag">Добавить</button></div></div>${w.comment?`<div class="info"><div class="k">Заметка</div>${esc(w.comment)}</div>`:''}<div class="info"><div class="k">Раздел — переложить в…</div><div class="kindmove">${KINDS.map(m=>`<button class="kindbtn ${w.kind===m.k?'on':''}" data-move="${m.k}"><b>${m.ru} <span class="zh">${m.zh}</span></b></button>`).join('')}</div></div><div class="info"><div class="k">Статус</div>${w.laoshi?'Уже в Лаоши ✓':'Ещё не внесено в Лаоши'}</div><div class="info"><div class="k">Порядок в словаре</div>№ ${w.order}</div><datalist id="tagList">${tagPool().map(t=>`<option value="${esc(t[0])}"></option>`).join('')}</datalist><div class="actions"><button class="primary" id="laoshiBtn" style="margin-top:0">${w.laoshi?'Снять отметку «в Лаоши»':'✓ Внести в Лаоши'}</button><button class="secondary" id="editWord" style="margin-top:0">Редактировать</button><button class="danger" id="deleteWord">Удалить</button></div></div>`;$('#modal').classList.remove('hidden');const _cb=$('#closeModal');if(_cb)_cb.onclick=closeModal;$('#laoshiBtn').onclick=()=>toggleLaoshi(id);$('#editWord').onclick=()=>{closeModal();renderAdd(id);};$$('[data-move]').forEach(b=>b.onclick=()=>{const k=b.dataset.move;if(!KMAP[k]||k===w.kind)return;snapMake('перед переносом «'+w.hanzi+'»');const from=(KMAP[w.kind]||KMAP.word).ru;w.kind=k;w.updatedAt=new Date().toISOString();saveWords();openDetail(id);toast('«'+w.hanzi+'»: '+from+' → '+KMAP[k].ru);});$('#addTag').onclick=()=>{const t=$('#newTag').value.trim();if(!t)return;const add=parseTags(t);add.forEach(x=>{if(!(w.tags||[]).includes(x))w.tags.push(x);});w.updatedAt=new Date().toISOString();saveWords();openDetail(id);};$$('[data-rm]').forEach(b=>b.onclick=()=>{const t=b.dataset.rm;w.tags=(w.tags||[]).filter(x=>x!==t);w.updatedAt=new Date().toISOString();saveWords();openDetail(id);});$('#deleteWord').onclick=()=>{const nm=w.hanzi;if(confirm('Удалить «'+nm+'»?')){snapMake('перед удалением «'+nm+'»');w.deleted=true;w.updatedAt=new Date().toISOString();saveWords();closeModal();renderWords();toast('Удалено: '+nm,'Вернуть',()=>{w.deleted=false;w.updatedAt=new Date().toISOString();saveWords();renderWords();},'Восстановлено: '+nm);}};}
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
function restoreJson(e){const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);const a=Array.isArray(j)?j:j.words;if(!Array.isArray(a)||!a.length)throw 0;if(confirm('Заменить текущий словарь данными из резервной копии?')){snapMake('перед восстановлением из файла');words=a.map(migrate);saveWords();renderMore();}}catch(_){alert('Не удалось прочитать резервную копию.');}};r.readAsText(f);}
function resetBase(){if(confirm('Вернуть исходные 3913 слов из первого листа Excel? Все локальные изменения (тэги и отметки Лаоши) будут удалены.')){snapMake('перед возвратом исходного списка');words=BASE_WORDS.map(x=>({...x}));applyContent(words,true);applyNewFix(words,true);applyAnki(words,true);applyAnkiFive(words,true);applyNames(words,true);applyZanghua(words,true);applyChengyu(words,true);saveWords();renderMore();}}
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
if(ankiAdded||chengyuAdded||inboxAdded||namesAdded||zanghuaAdded)setTimeout(()=>{const pp=[];if(ankiAdded)pp.push(ankiAdded+' из Anki'); if(chengyuAdded)pp.push('成语 '+chengyuAdded); if(inboxAdded)pp.push('из Тингли '+inboxAdded); if(namesAdded)pp.push('названий из прописей '+namesAdded); if(zanghuaAdded)pp.push('脏话 '+zanghuaAdded);if(pp.length)toast('Добавлено: '+pp.join(' · ')+' — все как «не в Лаоши»')},400);
if('serviceWorker' in navigator){
  let hadController=!!navigator.serviceWorker.controller, updating=false;
  navigator.serviceWorker.register('sw.js?v=2.10.7',{updateViaCache:'none'}).then(reg=>{
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
