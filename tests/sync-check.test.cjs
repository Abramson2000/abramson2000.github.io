const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../tingli/sync-check.js'),'utf8');
async function check({fail=false,broken=false}={}){
 const original={'tingli-schedule-v1':JSON.stringify({done:{'s:today:2026-10-07':123}}),'cidian-data-v4':JSON.stringify({restoreRows:[1,2]})};if(broken)original['tingli-sync-v2']='{broken';
 const map=new Map(Object.entries(original)),el=new Map(),requests=[],cloud=new Map();
 const get=id=>{if(!el.has(id))el.set(id,{textContent:'',disabled:false,after(){}});return el.get(id);};
 const fetch=async(url,opts={})=>{requests.push({url,opts});if(fail)throw Error('Failed to fetch');const u=new URL(url);let j;
  if(u.pathname==='/api/_report'){j={ok:true};}
  else if(opts.method==='POST'){const p=JSON.parse(opts.body);assert.match(p.key,/^tingli-diag-probe-/);assert.equal(p.base,null);assert.equal(cloud.has(p.key),false);cloud.set(p.key,p.value);j={ok:true,value:p.value,rev:1};}
  else if(u.searchParams.has('list'))j={ok:true,protocol:2,revisions:{}};
  else {const k=u.searchParams.get('keys');j={ok:true,records:{[k]:{value:cloud.get(k)||null,rev:0}}};}
  return new Response(JSON.stringify(j));
 };
 vm.runInNewContext(source,{document:{getElementById:get,createElement:()=>({style:{},focus(){},select(){}})},localStorage:{getItem:k=>map.get(k)??null,get length(){return map.size},key:i=>[...map.keys()][i]},location:{origin:'https://crmuro.ru'},navigator:{},crypto:{randomUUID:()=> 'unique-check'},fetch,AbortController,setTimeout,clearTimeout,URL,Date,JSON,Set,Math,Error});
 for(let i=0;i<60&&get('again').disabled;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('again').disabled,false,'diagnostic must finish visibly');assert.deepEqual(Object.fromEntries(map),original,'personal data unchanged');return {el,requests};
}
test('automatic new-record write and independent read report success without changing personal data',async()=>{const r=await check();assert.match(r.el.get('result').textContent,/Отчёт отправлен/);assert.match(r.el.get('log').textContent,/Новая запись прочитана/);const last=r.requests.at(-1);const report=JSON.parse(last.opts.body);assert.equal(report.local.words,2);assert.equal(report.local.completedToday.length,1);assert.equal(report.checks.length,3);});
test('unreachable API always shows an error and offers a copyable report',async()=>{const r=await check({fail:true});assert.match(r.el.get('result').textContent,/Отчёт не отправлен/);assert.match(r.el.get('log').textContent,/Failed to fetch/);});
test('corrupt saved sync metadata is reported instead of preventing all diagnosis',async()=>{const r=await check({broken:true});const report=JSON.parse(r.requests.at(-1).opts.body);assert.match(report.localErrors[0],/tingli-sync-v2/);assert.match(r.el.get('result').textContent,/найдена ошибка/);});
