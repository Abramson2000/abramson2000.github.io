const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
function surface(app, options = {}){
  const map=new Map(Object.entries(options.seed || {})),els=new Map(),events=[],timers=[],errors=[];
  const el=id=>{
    if(els.has(id))return els.get(id);
    const x={id,tagName:'DIV',innerHTML:'',textContent:'',value:'',dataset:{},style:{},offsetWidth:100,
      classList:{add(){},remove(){},toggle(){},contains(k){return k==='hidden';}},
      addEventListener(){},removeEventListener(){},getAttribute(){return '';},setAttribute(){},removeAttribute(){},
      querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},remove(){},focus(){},select(){},scrollIntoView(){},
      getBoundingClientRect:()=>({x:0,y:0,width:100,height:100}),closest:()=>null};
    els.set(id,x);return x;
  };
  const document={hidden:false,visibilityState:'visible',body:el('body'),head:el('head'),documentElement:el('html'),activeElement:null,
    getElementById:id=>el(id),querySelector:s=>el(s.startsWith('#')?s.slice(1):s),querySelectorAll:()=>[],createElement:t=>el('created-'+t),
    addEventListener:(k,f)=>events.push([k,f]),removeEventListener(){}};
  const localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>{const next=new Map(map);next.set(k,String(v));if(options.quota && [...next].reduce((n,[key,val])=>n+2*(key.length+val.length),0)>options.quota)throw Error('QuotaExceededError');map.set(k,String(v));},removeItem:k=>map.delete(k),key:i=>[...map.keys()][i],get length(){return map.size;}};
  const context={console,document,localStorage,location:new URL('https://crmuro.ru/'+app+'/'),navigator:{onLine:true,language:'ru-RU'},
    URL,URLSearchParams,Intl,Date,Math,JSON,Set,Map,Promise,Number,String,Object,Array,RegExp,Error,Blob,Response,Request,Headers,AbortController,
    Audio:class{constructor(){this.paused=true;}addEventListener(){}pause(){}play(){return Promise.resolve();}},
    MutationObserver:class{observe(){}disconnect(){}},
    addEventListener:(k,f)=>events.push([k,f]),removeEventListener(){},scrollTo(){},scrollY:0,innerHeight:800,innerWidth:400,
    getComputedStyle:()=>({getPropertyValue:()=>''}),matchMedia:()=>({matches:false,addEventListener(){}}),
    setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimeout(){},setInterval:()=>1,clearInterval(){},
    alert:x=>errors.push(x),confirm:()=>false,fetch:options.fetch || (async()=>{throw Error('offline test');}),history:{replaceState(){}},
    requestAnimationFrame:f=>{f();return 1;},cancelAnimationFrame(){}};
  context.window=context;context.self=context;context.globalThis=context;
  const ctx=vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root,app,'sync-core.js'),'utf8'),ctx);
  if(app==='cidian')vm.runInContext(fs.readFileSync(path.join(root,app,'word-sync.js'),'utf8'),ctx);
  if(app==='tingli'){
    const html=fs.readFileSync(path.join(root,'tingli/index.html'),'utf8');
    for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
      const src=/src="([^"]+)"/.exec(match[1]);
      if(src){const f=src[1].split('?')[0];if(f!=='sync-core.js'&&fs.existsSync(path.join(root,app,f)))vm.runInContext(fs.readFileSync(path.join(root,app,f),'utf8'),ctx,{filename:f});}
      else vm.runInContext(match[2],ctx,{filename:'tingli-inline.js'});
    }
    assert.match(el('app').innerHTML,/crs-/);
    const h=el('app').innerHTML;assert.equal((h.match(/<div\b/g)||[]).length,(h.match(/<\/div>/g)||[]).length,'Tingli div balance');
    assert.equal(vm.runInContext('APP_VER',ctx),'5.64.4');
    if(options.exercise!==false){vm.runInContext("saveLocal('tingli-hw-109-6-0','проба');",ctx);
    assert.equal(map.get('tingli-hw-109-6-0'),'проба');}
  }else{
    vm.runInContext(fs.readFileSync(path.join(root,app,'restore-2026-10-07.js'),'utf8'),ctx,{filename:'data.js'});
    vm.runInContext(fs.readFileSync(path.join(root,app,'app.js'),'utf8'),ctx,{filename:'app.js'});
    assert.match(el('content').innerHTML,/Мой словарь/);
    const h=el('content').innerHTML;assert.equal((h.match(/<div\b/g)||[]).length,(h.match(/<\/div>/g)||[]).length,'Cidian div balance');
    assert.equal(vm.runInContext('VERSION',ctx),'2.15.1');
    if(options.exercise!==false){
    vm.runInContext("const openRow=words[0], openId=openRow.id;const incoming=words.slice().reverse().map(w=>({...w}));applyIncomingWords(incoming);",ctx);
    assert.equal(vm.runInContext('words.includes(openRow)&&openRow.id===openId',ctx),true,'sync preserves an open detail row and form target');
    const old=vm.runInContext('wkey(words[0])',ctx);
    vm.runInContext("mutateWord(words[0],{translation:'изменено'});saveWords();",ctx);
    assert.equal(vm.runInContext('words.some(w=>wkey(w)==='+JSON.stringify(old)+'&&!w.deleted)',ctx),true);
    }
    vm.runInContext("renderMore();",ctx);
    assert.match(el('content').innerHTML,/Синхронизация/);
  }
  assert.equal(errors.length,0,errors.join('\n'));
  if (!options.quiet) console.log(app+': real scripts boot and rendering OK');
  return {ctx,map,el,document};
}
if (require.main === module) { surface('tingli');surface('cidian'); }
module.exports = {surface};
