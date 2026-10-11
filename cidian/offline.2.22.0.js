/* Application file readiness; existing word storage and sync are unchanged. */
(function(){
 function request(type,progress){
  return new Promise((resolve,reject)=>{
   const worker=navigator.serviceWorker&&navigator.serviceWorker.controller;
   if(!worker){reject(Error('Сохранённая копия ещё устанавливается. Повторите проверку при связи.'));return;}
   const channel=new MessageChannel();let timer;
   const finish=(error,value)=>{clearTimeout(timer);channel.port1.close();error?reject(error):resolve(value);};
   const renew=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(Error('Сохранённая копия ещё не готова. Повторите проверку при связи.')),40000);};
   channel.port1.onmessage=event=>{
    const data=event.data||{};
    if(data.progress){renew();if(progress)progress(data);return;}
    if(data.version!=='2.22.0'){finish(Error('Дождитесь обновления Словаря до 2.22.0.'));return;}
    finish(data.error?Error(data.error):null,data);
   };
   renew();worker.postMessage({type},[channel.port2]);
  });
 }
 window.cidianOfflineCheck=async function(){
  const button=document.getElementById('offlineCheck'),info=document.getElementById('offlineInfo');
  if(!button||button.disabled)return;button.disabled=true;
  if(info)info.textContent='Проверяю…';
  try{
   let report=await request('cidian-offline-status');
   if(!report.ready&&navigator.onLine){
    if(info)info.textContent='Докачиваю файлы…';
    report=await request('cidian-offline-repair',()=>{if(info)info.textContent='Докачиваю файлы…';});
   }
   if(info)info.textContent=report.ready?'Готов к полёту · '+report.have+'/'+report.total:'Не готов · '+report.have+'/'+report.total+'. Нужна связь для докачивания.';
  }catch(error){if(info)info.textContent=error.message;}
  finally{button.disabled=false;}
 };
})();
