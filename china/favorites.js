(function(){
  const KEY = 'my-china-favorites-v2';
  const AI_ENDPOINT = 'https://api.crmuro.ru/api/china-beautify';

  function load(){ try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e){ return []; } }
  function save(items){ localStorage.setItem(KEY, JSON.stringify(items)); }
  function all(){ return load(); }
  function has(id){ return load().some(x => x.id === id); }
  function toggle(item){
    const items = load();
    const index = items.findIndex(x => x.id === item.id);
    if(index >= 0) items.splice(index, 1); else items.unshift(item);
    save(items);
    return index < 0;
  }
  async function beautify(item){
    const r = await fetch(AI_ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id:item.id, type:item.type, title:item.title, text:item.raw, source:item.source })
    });
    if(!r.ok) throw new Error('AI request failed');
    const j = await r.json();
    return (j.text || j.result || j.beautiful || '').trim();
  }
  window.Favorites = { all, has, toggle, beautify };
})();
