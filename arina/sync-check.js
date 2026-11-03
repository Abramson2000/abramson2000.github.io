/* A diagnostic page that runs independently of application startup and sync state. */
(function(){
'use strict';
const transport=CrmSyncTransport.create(),lines=[],log=document.getElementById('log'),result=document.getElementById('result');
let report={};
const write=s=>{lines.push(s);log.textContent=lines.join('\n');};
function stored(k){try{return localStorage.getItem(k);}catch(e){throw Error('Память устройства: '+e.message);}}
function parsed(k,fallback){const s=stored(k);if(s===null)return fallback;try{return JSON.parse(s);}catch(e){report.localErrors.push(k+': '+e.message);return fallback;}}
function inspect(){
 const keys=[];let bytes=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);keys.push(k);bytes+=2*(k.length+(stored(k)||'').length);}
 const schedule=parsed('tingli-schedule-v1',{}),baseline=parsed('tingli-sync-v2',{});
 const personal=parsed('cidian-data-v4',null)||parsed('cidian-data-v3',null)||parsed('cidian-data-v1',null);
 const rows=Array.isArray(personal)?personal:personal&&Array.isArray(personal.restoreRows)?personal.restoreRows:[];
 const nosync=new Set(['tingli-favs-v1','tingli-dict-v1','tingli-cidian-outbox-v2','tingli-cidian-outbox-v4','tingli-cidian-send-v4','tingli-apihost-v1','tingli-sync-err-v1','tingli-gist-token','tingli-push-enable-error-v1','tingli-sched-clean-v2','tingli-sched-cloudwins-v1','tingli-repair-history-515','tingli-repair-hwdue-516','tingli-diag-report']);
 const allowed=k=>k.startsWith('tingli-')&&!nosync.has(k)&&!/token|secret|password|passwd|auth|credential|vapid|private/i.test(k)&&!/^tingli-(sync-v2|conflicts-v2|safety-backup-|zz-|diag)/.test(k);
 const wordKeys=keys.filter(k=>k.startsWith('cidian-word-v4-'));
 for(const k of wordKeys)parsed(k,null);
 const wordState=parsed('cidian-record-sync-v4',{});
 return {origin:location.origin,storageBytes:bytes,storageKeys:keys.length,words:rows.length,wordPackets:wordKeys.length,wordBaselines:Object.keys(wordState.base||{}).length,tingliPending:keys.filter(allowed).filter(k=>stored(k)!==(baseline.base||{})[k]),completedToday:Object.keys(schedule.done||{}).filter(k=>k.includes('2026-10-07')),scheduleUpdated:schedule.upd||null,lastTingliError:stored('tingli-sync-err-v1')||null};
}
async function request(path,options={}){
 const j=await transport.json(path,options);
 if(!j.ok)throw Error(j.error||'сервер не подтвердил запрос');
 return j;
}

async function run(){
 const again=document.getElementById('again');again.disabled=true;lines.length=0;log.textContent='';report={type:'sync-check-v1',ts:Date.now(),localErrors:[],checks:[]};result.textContent='Проверяю…';
 try{report.local=inspect();write('Локальные данные: '+report.local.words+' записей Словаря; '+report.local.tingliPending.length+' изменений Тингли ожидают отправки.');write('Память: '+Math.round(report.local.storageBytes/1024)+' КБ.');if(report.localErrors.length)write('Ошибки данных: '+report.localErrors.join('\n'));}catch(e){report.localError=e.message;write(e.message);}
 let stage='Чтение списка изменений';
 try{
  const catalog=await request('/api/sync?list=1&check='+Date.now());if(catalog.protocol!==2||!catalog.revisions)throw Error('Неверный протокол синхронизации');report.checks.push({stage,ok:true});report.apiHost=transport.host();write('✓ Сервер синхронизации отвечает: '+report.apiHost);
  const cloud=await request('/api/sync?keys=tingli-schedule-v1&check='+Date.now());const raw=cloud.records&&cloud.records['tingli-schedule-v1'];const sch=raw&&raw.value?JSON.parse(raw.value):{};
  report.cloud={scheduleRevision:raw&&raw.rev,completedToday:Object.keys(sch.done||{}).filter(k=>k.includes('2026-10-07')),wordPackets:Object.keys(catalog.revisions).filter(k=>k.startsWith('cidian-word-v4-')).length};write('Отметки за 7 октября: на устройстве '+((report.local||{}).completedToday||[]).length+', в облаке '+report.cloud.completedToday.length+'.');
  const id=crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);const key='tingli-diag-probe-'+id,value=JSON.stringify({type:'sync-check-v1',id,ts:report.ts});
  stage='Подготовка новой служебной записи';const before=await request('/api/sync?keys='+key);if(!before.records||before.records[key].value!==null)throw Error('Проверочная запись уже существует');
  stage='Отправка новой записи';const ack=await request('/api/sync',{method:'POST',body:JSON.stringify({key,base:null,value})});if(ack.value!==value)throw Error('Запись не подтверждена');report.checks.push({stage,ok:true});write('✓ Новая запись отправлена и подтверждена.');
  stage='Независимое чтение новой записи';const after=await request('/api/sync?keys='+key+'&check='+Date.now());if(!after.records||after.records[key].value!==value)throw Error('Отправленная запись не получена обратно');report.checks.push({stage,ok:true});write('✓ Новая запись прочитана с сервера.');report.probeKey=key;
 }catch(e){report.checks.push({stage,ok:false,error:e.message});write('✗ '+stage+': '+e.message);}
 report.finished=Date.now();report.networkAttempts=transport.attempts();
 try{await request('/api/_report',{method:'POST',body:JSON.stringify(report)});write('✓ Отчёт отправлен. Можно вернуться в чат.');result.textContent=report.checks.some(c=>!c.ok)||report.localError||report.localErrors.length?'Проверка завершена: найдена ошибка. Отчёт отправлен.':'Связь с сервером работает. Отчёт отправлен.';}
 catch(e){write('✗ Отправка отчёта: '+e.message);result.textContent='Отчёт не отправлен. Скопируй его кнопкой ниже и пришли в чат.';}
 again.disabled=false;
}
document.getElementById('copy').onclick=async()=>{const text=JSON.stringify(report,null,2);try{await navigator.clipboard.writeText(text);write('Отчёт скопирован.');}catch(_){const t=document.createElement('textarea');t.value=text;t.style.cssText='width:100%;height:220px';log.after(t);t.focus();t.select();write('Автоматическое копирование недоступно. Текст выделен ниже.');}};
document.getElementById('again').onclick=run;
run();
})();
