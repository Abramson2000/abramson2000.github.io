const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {surface}=require('./app-smoke.cjs');
const fixture={unit:99001,src:'extra',zh:'Тест',parts:[{id:1,kind:'tasks',title:'Тест',tasks:[{type:'fill',q:'一',answer:'一'},{type:'tf',q:'二',answer:true}]},{id:2,kind:'match',title:'Пары'},{id:3,kind:'hw',title:'ДЗ',questions:['一','二','三']},{id:4,kind:'record_hw',title:'Запись',lines:['一','二']},{id:5,kind:'text',title:'Текст'}]};
function scene(seed={}){const s=surface('tingli',{quiet:true,exercise:false,seed});vm.runInContext('globalThis.countUnit='+JSON.stringify(fixture)+';ALL_UNITS.push(countUnit);',s.ctx);return s;}
const run=(s,js)=>vm.runInContext(js,s.ctx);
const stats=s=>JSON.parse(run(s,'JSON.stringify(unitStats(countUnit))'));
test('counters include checked tasks, manual exercise marks and homework answers without double counting',()=>{
 const s=scene();assert.deepEqual(stats(s),{done:0,total:8,pct:0});
 run(s,"prog[99001]={1:{0:true,1:false}};save(prog);saveLocal('tingli-hw-99001-3-0','一');localStorage.setItem('tingliLocalRecMeta-99001-4-0','{}');");assert.equal(stats(s).done,3);
 run(s,'manTogglePart(99001,1);manTogglePart(99001,2);');assert.equal(stats(s).done,5);assert.equal(run(s,'partDone(countUnit,countUnit.parts[0])'),true);
 run(s,'manTogglePart(99001,1);');assert.equal(stats(s).done,4);assert.equal(run(s,'partDone(countUnit,countUnit.parts[0])'),false);
 assert.match(run(s,'unitCard(countUnit)'),/4\/8/);
});
test('homework Done and undo update the counter and survive reload',()=>{
 const s=scene();run(s,"saveLocal('tingli-hw-99001-3-0','一');crsHwSetState('u99001p3','done');");assert.equal(stats(s).done,3);
 const reloaded=scene(Object.fromEntries(s.map));assert.equal(stats(reloaded).done,3);assert.equal(run(reloaded,'partDone(countUnit,countUnit.parts[2])'),true);
 run(reloaded,"crsHwSetState('u99001p3','todo');");assert.equal(stats(reloaded).done,1);
 run(reloaded,"crsHwSetState('u99001p4','done');");assert.equal(stats(reloaded).done,3);
});
test('voice homework counts saved recordings and explicit completion',()=>{
 const s=scene();run(s,"countUnit.parts=[{id:6,kind:'hw',voiceHomework:true,questions:['一','二']}];saveLocal('tingli-vhw-99001-6','[true,false]');");assert.deepEqual(stats(s),{done:1,total:2,pct:50});
 run(s,"crsHwSetState('u99001p6','done');");assert.deepEqual(stats(s),{done:2,total:2,pct:100});
});
test('schedule homework chip uses completed style only when every homework item is done',()=>{
 const s=scene();run(s,"crsHwForLesson=()=>[{state:'done'}];");assert.match(run(s,"crsLessonHwBlock({evId:'test',material:{unit:99001}})"),/crs-chip hw done/);
 run(s,"crsHwForLesson=()=>[{state:'done'},{state:'todo'}];");assert.doesNotMatch(run(s,"crsLessonHwBlock({evId:'test',material:{unit:99001}})"),/crs-chip hw done/);
});
