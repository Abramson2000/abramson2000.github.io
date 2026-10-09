/* Both addresses route to crmuro-ru-api and the same D1 database. */
(function(root){
  'use strict';
  const HOSTS=['https://crmuro-ru-api.abramson-mynote.workers.dev','https://api.crmuro.ru'];
  function create(config={}) {
    const hosts=config.hosts||HOSTS, fetcher=config.fetch||root.fetch.bind(root);
    const timeout=config.timeoutMs||20000, hedge=config.hedgeMs||700;
    let preferred=null;
    const history=[];
    async function attempt(host,path,options,controllers) {
      const ctrl=new AbortController(),started=Date.now();
      if(controllers)controllers.push(ctrl);
      let expired=false;
      const timer=setTimeout(()=>{expired=true;ctrl.abort();},timeout);
      const entry={host,method:options.method||'GET'};
      try {
        const response=await fetcher(host+path,Object.assign({},options,{
          cache:'no-store',signal:ctrl.signal,
          headers:Object.assign({},options.headers||{}, {'Content-Type':'text/plain;charset=UTF-8'})
        }));
        entry.status=response.status;
        let data;
        try { data=JSON.parse(await response.text()); }
        catch(e) { if(ctrl.signal.aborted)throw e;throw Error('HTTP '+response.status+': сервер вернул не JSON'); }
        const conflict=response.status===409&&data&&Object.prototype.hasOwnProperty.call(data,'value');
        if(!data||typeof data!=='object'||(!response.ok&&!conflict)||(!data.ok&&!conflict))
          throw Error('HTTP '+response.status+': '+((data&&data.error)||'сервер не подтвердил запрос'));
        entry.ok=true;
        return Object.assign({},data,{status:response.status});
      } catch(e) {
        const message=expired?'Сервер не ответил за '+Math.round(timeout/1000)+' секунд':e.message;
        entry.ok=false;
        if(ctrl.signal.aborted&&!expired)entry.cancelled=true;
        else entry.error=message;
        throw Error(host+': '+message);
      } finally {
        clearTimeout(timer);entry.ms=Date.now()-started;
        history.push(entry);if(history.length>16)history.shift();
      }
    }
    function choose(path,options) {
      return new Promise((resolve,reject)=>{
        const controllers=[],errors=[],launched=new Set();
        let finished=false,timer;
        const launch=host=>{
          if(finished||launched.has(host))return;
          launched.add(host);
          attempt(host,path,options,controllers).then(data=>{
            if(finished)return;
            finished=true;preferred=host;clearTimeout(timer);
            controllers.forEach(c=>c.abort());resolve(data);
          },error=>{
            if(finished)return;
            errors.push(error.message);
            const next=hosts.find(h=>!launched.has(h));
            if(next){clearTimeout(timer);launch(next);}
            else if(errors.length===hosts.length){finished=true;clearTimeout(timer);reject(Error(errors.join('; ')));}
          });
        };
        launch(hosts[0]);
        timer=setTimeout(()=>hosts.forEach(launch),hedge);
      });
    }
    async function json(path,options={}) {
      if(!/^\/api\//.test(path))throw Error('Неверный путь API');
      const method=(options.method||'GET').toUpperCase();
      if(method!=='GET'&&method!=='POST')throw Error('Неверный метод синхронизации');
      options=Object.assign({},options,{method});
      // Only reads race. Writes run once at a time; CAS resolves an uncertain acknowledgement.
      if(!preferred&&method==='GET')return choose(path,options);
      const ordered=preferred?[preferred,...hosts.filter(h=>h!==preferred)]:hosts;
      const errors=[];
      for(const host of ordered) {
        try { const data=await attempt(host,path,options);preferred=host;return data; }
        catch(e){preferred=null;errors.push(e.message);}
      }
      throw Error(errors.join('; '));
    }
    return {json,host:()=>preferred,attempts:()=>history.map(x=>Object.assign({},x))};
  }
  root.CrmSyncTransport={create,HOSTS};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.CrmSyncTransport;
})(typeof globalThis!=='undefined'?globalThis:self);
