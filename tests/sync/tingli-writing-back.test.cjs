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
