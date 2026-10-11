const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/../../tingli/index.html','utf8');
const start=html.indexOf('/* Свайп от левого края внутри урока/упражнения');
const source=html.slice(start,html.indexOf('/* ===== Экраны ===== */',start));
function scene(){
  const handlers={},timers=[],events=[],classes=new Set();let open=true,closes=0,backs=0;
  const app={style:{setProperty(){events.push('paint');},removeProperty(){}},classList:{add(x){classes.add(x);},remove(x){classes.delete(x);}}};
  const window={innerWidth:390,TingliWritingFocus:{isOpen:()=>open,close(){closes++;open=false;}}};
  const document={getElementById:id=>id==='app'?app:{},addEventListener(type,fn,options){handlers[type]={fn,options};}};
  vm.runInNewContext(source,{window,document,curUnit:1,curPart:1,getComputedStyle:()=>({display:'none'}),goBack(){backs++;},requestAnimationFrame(fn){fn();return 1;},setTimeout(fn){timers.push(fn);}});
  let prevented=0;
  const touch=(type,x,y=100)=>handlers[type].fn({touches:[{clientX:x,clientY:y}],changedTouches:[{clientX:x,clientY:y}],cancelable:true,preventDefault(){prevented++;}});
  return{touch,handlers,timers,events,classes,window,closes:()=>closes,backs:()=>backs,prevented:()=>prevented};
}
test('one edge swipe after checking closes only writing, immediately, without delayed lesson navigation',()=>{
 const s=scene();s.touch('touchstart',8);s.touch('touchmove',105);s.touch('touchend',105);
 assert.equal(s.closes(),1);assert.equal(s.backs(),0);assert.equal(s.timers.length,0);assert.equal(s.prevented(),1);assert.equal(s.handlers.touchmove.options.passive,false);assert.equal(s.events.length,0);
 // Duplicate/cancelled end events cannot trigger another return.
 s.touch('touchend',105);s.touch('touchcancel',105);assert.equal(s.backs(),0);assert.equal(s.closes(),1);
 // A distinct second gesture still uses the existing exercise return.
 s.touch('touchstart',8);s.touch('touchmove',105);s.touch('touchend',105);
 assert.equal(s.closes(),1);assert.equal(s.backs(),0);s.timers.shift()();assert.equal(s.backs(),1);
});
test('short, cancelled, vertical and non-edge gestures keep the writing screen open',()=>{
 for(const type of ['short','cancel','vertical','middle']){
  const s=scene();s.touch('touchstart',type==='middle'?100:8);
  s.touch('touchmove',type==='short'?35:105,type==='vertical'?270:100);
  s.touch(type==='cancel'?'touchcancel':'touchend',type==='short'?35:105,type==='vertical'?270:100);
  while(s.timers.length)s.timers.shift()();assert.equal(s.closes(),0,type);assert.equal(s.backs(),0,type);
 }
});
test('sidebar gesture does not open the menu behind a writing panel',()=>{
 const a=html.indexOf('/* Свайпы: колонка');const b=html.indexOf('/* Свайп от левого края внутри урока/упражнения',a);
 const handlers={};let mutations=0;
 const sb={classList:{add(){mutations++;},remove(){mutations++;}},style:{},offsetWidth:300};
 vm.runInNewContext(html.slice(a,b),{window:{innerWidth:390,TingliWritingFocus:{isOpen:()=>true}},document:{body:{classList:{contains:()=>true}},getElementById:()=>sb,addEventListener(t,f){handlers[t]=f;}},getComputedStyle:()=>({display:'flex'}),sbOpen(){mutations++;},sbClose(){mutations++;}});
 handlers.touchstart({touches:[{clientX:8,clientY:100}]});handlers.touchmove({touches:[{clientX:105,clientY:100}]});handlers.touchend({changedTouches:[{clientX:105,clientY:100}]});assert.equal(mutations,0);
});
function homeworkSave({missing=false,reject=false}={}){
 const a=html.indexOf('function hwKey('),b=html.indexOf('function hwAnswered()',a),writes=[];let refresh=0;
 const context={document:{querySelector:()=>missing?null:{value:'新的答案'}},curUnit:{unit:210},curPart:{id:12},localStorage:{getItem:()=>null},saveLocal(k,v){if(reject)throw Error('quota');writes.push([k,v]);},hwRefresh(){refresh++;}};
 vm.createContext(context);vm.runInContext(html.slice(a,b),context);
 return{save:()=>context.hwSave(2),writes,refresh:()=>refresh};
}
test('homework navigation receives a successful durable save before advancing',()=>{
 const s=homeworkSave();assert.equal(s.save(),true);assert.deepEqual(s.writes,[['tingli-hw-210-12-2','新的答案']]);assert.equal(s.refresh(),1);
});
test('failed or missing homework answer storage is reported to navigation',()=>{
 for(const opts of [{reject:true},{missing:true}]){const s=homeworkSave(opts);assert.equal(s.save(),false);assert.deepEqual(s.writes,[]);assert.equal(s.refresh(),0);}
});
function checkClick({saved=true,check=true}={}){
 const path=html.match(/<script src="(writing\.[^"]+\.js)"><\/script>/)[1];
 const js=fs.readFileSync(__dirname+'/../../tingli/'+path,'utf8');
 const start=js.indexOf("screen.addEventListener('click',e=>{");
 const end=js.indexOf('},true);',start);
 const body=js.slice(start+"screen.addEventListener('click',e=>{".length,end);
 let blurs=0,saves=0,prevented=0,stopped=0;
 const button={matches:()=>check},active={block:{contains:()=>true},input:{blur(){blurs++;}}};
 const ctx={active,saveAnswer(){saves++;return saved;}};vm.createContext(ctx);
 const fn=vm.runInContext('(e=>{'+body+'})',ctx);
 fn({target:{closest:()=>button},preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}});
 return{blurs,saves,prevented,stopped};
}
test('checking ends keyboard editing without closing the answer panel or preventing its check',()=>{
 assert.deepEqual(checkClick(),{blurs:1,saves:1,prevented:0,stopped:0});
 assert.deepEqual(checkClick({check:false}),{blurs:0,saves:0,prevented:0,stopped:0});
});
test('a failed save keeps editing active and does not check stale stored homework',()=>{
 assert.deepEqual(checkClick({saved:false}),{blurs:0,saves:1,prevented:1,stopped:1});
});
test('homework heading follows the real course mapping, independent of the selected tab',()=>{
 const programs=html.match(/const CRS_PROGS = (\[[\s\S]*?\]);/)[1];
 const mapper=html.slice(html.indexOf('function crsProgOfUnit('),html.indexOf('function crsHwOpen('));
 const prog=html.slice(html.indexOf('function crsProg('),html.indexOf('function crsProgTitle('));
 const heading=html.slice(html.indexOf('function TingliWritingHeading('),html.indexOf('function renderHw('));
 const ctx={curUnit:null,curPart:{title:'ДЗ 3 作业'},originTab:'sched'};vm.createContext(ctx);
 vm.runInContext('const CRS_PROGS='+programs+';'+mapper+prog+heading,ctx);
 for(const [src,title,ru] of [['extra','语法','Ли Лаоши'],['idv','口语','Люба'],['team','团队','Группа'],['biz','小山商务','Самоучёба'],[undefined,'小山听力','Самоучёба'],['yin','声音','Звуки']]){
  ctx.curUnit={src};const h=ctx.TingliWritingHeading();assert.equal(h.title,title);assert.equal(h.subtitle,ru);assert.equal(h.label,'ДЗ 3 作业');
 }
 ctx.curUnit=null;ctx.curPart=null;assert.equal(ctx.TingliWritingHeading().title,'作业');
});
