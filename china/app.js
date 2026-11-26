(() => {
  const data = window.APP_DATA;
  const state = {
    section: 'guide',
    selectedProvince: 'YN',
    currentBook: null,
    drawerOpen: false,
    visited: loadVisited(),
    aiBusy: false
  };

  const icons = {
    guide: `<img class="nav-ic" src="assets/icons/menu/guide.svg" alt="" width="28" height="28">`,
    library: `<img class="nav-ic" src="assets/icons/menu/library.svg" alt="" width="28" height="28">`,
    tea: `<img class="nav-ic" src="assets/icons/menu/tea.svg" alt="" width="28" height="28">`,
    plane: `<img class="nav-ic" src="assets/icons/menu/trips.svg" alt="" width="28" height="28">`,
    help: `<img class="nav-ic" src="assets/icons/menu/reference.svg" alt="" width="28" height="28">`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    star: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3 1.1-6.5L2.7 9.4l6.5-.9z"/></svg>`,
    bookStack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5 12 3l9 3.5L12 10z"/><path d="M3 12l9 3.5 9-3.5"/><path d="M3 17.5 12 21l9-3.5"/></svg>`,
    picture: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-4.5-4.5L8 19"/></svg>`
  };

  function loadVisited(){
    try {
      const stored = JSON.parse(localStorage.getItem('my-china-visited-v2') || 'null');
      if(Array.isArray(stored)) return stored;
    } catch(e){}
    return [...data.visitedDefaults];
  }
  function saveVisited(){ localStorage.setItem('my-china-visited-v2', JSON.stringify(state.visited)); }
  function isVisited(id){ return state.visited.includes(id); }
  function provinceById(id){ return data.provinces.find(p => p.id === id); }
  function esc(str){ return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
  function sourceName(){ return data.menu.find(m => m.id === state.section)?.title || 'Мой Китай'; }

  function regionStatus(province){
    if(isVisited(province.id)) return 'visited';
    return province.status === 'plan' ? 'plan' : 'neutral';
  }

  function makeFavoriteButton(item){
    const active = window.Favorites.has(item.id);
    return `<button class="fav-btn ${active ? 'active' : ''}" data-fav='${JSON.stringify(item).replace(/'/g, '&apos;')}' aria-label="Избранное">${icons.star}</button>`;
  }

  function renderNav(){
    const nav = document.getElementById('nav');
    nav.innerHTML = data.menu.map(item => `
      <a class="nav-item ${state.section === item.id ? 'active' : ''}" href="?section=${item.id}" ${state.section === item.id ? 'aria-current="page"' : ''}>
        <span class="nav-icon">${icons[item.icon]}</span><span>${item.title}</span>
      </a>`).join('');
  }

  function pageChrome(title, subtitle, content, side){
    return `
      <section class="hero-copy ${state.section === 'library' ? 'library-copy' : ''}">
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <div class="hero-underline"></div>
      </section>
      <section class="content-layout ${side ? '' : 'single'}">
        <div class="content-main">${content}</div>
        ${side ? `<div class="content-side">${side}</div>` : ''}
      </section>
    `;
  }

  const placeTopics = {
  "Пекин": 108,
  "Сиань": 112,
  "Лоян": 116,
  "Нанкин": 119,
  "Ханчжоу": 124,
  "Шанхай": 130,
  "Гуанчжоу": 133,
  "Шэньчжэнь": 136,
  "Куньмин": 138,
  "Сучжоу": 141,
  "Циндао": 144,
  "Лхаса": 146,
  "Гонконг": 149,
  "Макао": 151,
  "Тайбэй": 153,
  "Запретный город": 156,
  "Храм Неба": 162,
  "Летний дворец": 164,
  "Терракотовая армия": 169,
  "Могаоку": 171,
  "Лицзян": 173,
  "Пинъяо": 175,
  "Западное озеро": 180,
  "Гуйлинь": 182,
  "Улинъюань": 184,
  "Потала": 190,
  "Тайшань": 195,
  "Хуаншань": 201,
  "Лушань": 205,
  "Озеро Цинхай": 97
};
  const regionPictures = {
  "BJ": [
    "books/geography-images/ed73eafe1d52b8172e70.webp",
    "Павильон Тайхэдянь в Гугуне",
    156
  ],
  "SN": [
    "books/geography-images/c55486a950acbe6f1b82.webp",
    "Первый раскоп терракотового войска",
    169
  ],
  "HA": [
    "books/geography-images/311a1bd859d489e43b29.webp",
    "Вход в храм Белой лошади",
    116
  ],
  "JS": [
    "books/geography-images/1299db863b76cad69def.webp",
    "Канал и старые дома Сучжоу",
    141
  ],
  "ZJ": [
    "books/geography-images/78fd7583c3a603a35754.webp",
    "Ивы и павильон на озере Сиху",
    180
  ],
  "SH": [
    "books/geography-images/2d2539b2b4b2ea7b69f3.webp",
    "Телебашня «Жемчужина Востока» в Шанхае",
    130
  ],
  "GD": [
    "books/geography-images/ed0cbfdbe59841f811a7.webp",
    "Панорама Гуанчжоу",
    133
  ],
  "YN": [
    "books/geography-images/6bb7630f8ec8c291bea8.webp",
    "Канал в древнем Лицзяне",
    173
  ],
  "SD": [
    "books/geography-images/a409b83b7d640f6f7fe2.webp",
    "Надпись «Первая из пяти священных гор»",
    195
  ],
  "XZ": [
    "books/geography-images/e23eb3988acf5585af9a.webp",
    "Дворец Потала на холме",
    190
  ],
  "HK": [
    "books/geography-images/d444f90b44b0f04ee2a6.webp",
    "Подсвеченный мост в Гонконге",
    149
  ],
  "MO": [
    "books/geography-images/295d59b4a775a912bde8.webp",
    "Фасад собора Святого Павла в Макао",
    151
  ],
  "TW": [
    "books/geography-images/e5ab3747df820169b165.webp",
    "Городской парк Тайбэя",
    153
  ],
  "GS": [
    "books/geography-images/0a9923db04287c18e46d.webp",
    "Фасад пещерного комплекса Могао",
    171
  ],
  "SX": [
    "books/geography-images/e1c88427c3bac14232a7.webp",
    "Стены и башни Пинъяо",
    175
  ],
  "GX": [
    "books/geography-images/39be52c5b03e96d40806.webp",
    "Карстовые пики Яншо на закате",
    182
  ],
  "HN": [
    "books/geography-images/7b898a9102c728f54154.webp",
    "Лесистые скалы Чжанцзяцзе",
    184
  ],
  "AH": [
    "books/geography-images/331fc2883ccf5e3d2b7d.webp",
    "Сосна на гранитном уступе Хуаншаня",
    201
  ],
  "JX": [
    "books/geography-images/464c71d83c224163d4ed.webp",
    "Водопад Саньдецюань",
    205
  ],
  "QH": [
    "books/geography-images/4a16889bdb8d88d4f0d5.webp",
    "Водоплавающая птица",
    97
  ]
};
  function placeLinks(names){
    return names.map(name => placeTopics[name] ? `<a href="books/geography.html#p${placeTopics[name]}">${esc(name)}</a>` : esc(name)).join(' · ');
  }
  function renderGuide(){
    const selected = provinceById(state.selectedProvince) || provinceById('YN');
    const map = `
      <div class="map-card">
        <div class="map-inline" id="guideMap"></div>
      </div>
      <div class="region-picker">
        <label for="regionPicker">Регион</label>
        <select id="regionPicker">
          ${data.provinces.map(p => `<option value="${p.id}"${state.selectedProvince === p.id ? ' selected' : ''}>${p.cn} · ${p.ru}</option>`).join('')}
        </select>
      </div>
      <label class="visit-control"><input type="checkbox" id="visitedRegion" ${isVisited(selected.id) ? 'checked' : ''}> Я был в этом регионе</label>`;

    const notes = window.TRAVEL_NOTES?.[selected.id] || [];
    const picture = regionPictures[selected.id];
    const detailFavBase = { id:`province:${selected.id}`, type:'регион', title:`${selected.ru} · ${selected.cn}`, raw:`${selected.intro} Города: ${selected.cities.join(', ')}. Места: ${selected.places.join(', ')}. Маршрут: ${selected.routes.join('; ')}.`, source:`Путеводитель · ${selected.ru}` };
    const side = `
      <div class="side-panel province-panel">
        <div class="province-head">
          <div>
            ${picture ? `<figure class="region-picture"><a href="books/geography.html#p${picture[2]}"><img src="${picture[0]}" alt="${esc(picture[1])}"></a><figcaption>${esc(picture[1])}</figcaption></figure>` : ''}
            <div class="province-cn-large">${selected.cn}</div>
            <div class="province-ru-large">${selected.ru}</div>
            <p>${selected.intro}</p>
            <div class="hero-underline small"></div>
          </div>
        </div>
        <nav class="guide-notes" aria-label="Заметки о путешествиях">
          ${notes.length ? `<details><summary>Заметки о регионе · ${notes.length}</summary>${notes.map(note=>`<a href="travel/${selected.id}.html#n${note.id}">${esc(note.title)}</a>`).join('')}</details>` : ''}
          <a href="travel/index.html">Все заметки о путешествиях</a>
        </nav>
        <div class="info-list">
          <div class="info-card">
            <div class="info-body">
              <div class="info-row"><h3>Города</h3>${makeFavoriteButton({...detailFavBase,id:`province-cities:${selected.id}`,title:`${selected.ru} · Города`,raw:`${selected.cities.join(' · ')}`,source:`Путеводитель · ${selected.ru}`})}</div>
              <p>${placeLinks(selected.cities)}</p>
            </div>
          </div>
          <div class="info-card">
            <div class="info-body">
              <div class="info-row"><h3>Достопримечательности</h3>${makeFavoriteButton({...detailFavBase,id:`province-places:${selected.id}`,title:`${selected.ru} · Достопримечательности`,raw:`${selected.places.join(' · ')}`,source:`Путеводитель · ${selected.ru}`})}</div>
              <p>${placeLinks(selected.places)}</p>
            </div>
          </div>
          <div class="info-card">
            <div class="info-body">
              <div class="info-row"><h3>Маршруты</h3>${makeFavoriteButton({...detailFavBase,id:`province-routes:${selected.id}`,title:`${selected.ru} · Маршруты`,raw:`${selected.routes.join(' · ')}`,source:`Путеводитель · ${selected.ru}`})}</div>
              <p>${selected.routes.join(' · ')}</p>
            </div>
          </div>
          ${selected.notes ? `<div class="info-card">
            <div class="info-body">
              <div class="info-row"><h3>Из блокнота</h3>${makeFavoriteButton({...detailFavBase,id:`province-notes:${selected.id}`,title:`${selected.ru} · Из блокнота`,raw:`${selected.notes.places.join(' · ')}. ${selected.notes.facts.join(' · ')}`,source:`Блокнот · ${selected.ru}`})}</div>
              <p>${selected.notes.places.join(' · ')}</p>
              ${selected.notes.facts.length ? `<ul class="note-facts">${selected.notes.facts.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
            </div>
          </div>` : ''}
        </div>

      </div>`;

    return pageChrome('Мой Китай','Личный атлас путешествий, культуры и открытий',map,side);
  }

  function renderLibrary(){
    const books = data.books.map(book => `
      <article class="book-card">
        <a class="book-link" href="?section=library&amp;book=${book.id}">
          <img src="${book.cover}" alt=""><div><h3>${esc(book.title)}</h3><span lang="zh">${esc(book.cn)}</span></div>
        </a>
        ${makeFavoriteButton({id:`book:${book.id}`, type:'книга', title:book.title, raw:book.note, source:'Библиотека'})}
      </article>`).join('');
    return `<section class="library-map" aria-labelledby="visitedMapTitle">
      <h1 id="visitedMapTitle">Карта посещённых регионов</h1>
      <p>Нажмите на регион, чтобы отметить посещение. Повторное нажатие снимает отметку.</p>
      <div class="map-inline" id="libMap"></div>
    </section>
    <section class="library-books"><h2>Книги и материалы</h2><div class="books-grid">${books}</div></section>`;
  }

  function renderBook(bookId){
    const book = data.books.find(b => b.id === bookId) || data.books[0];
    const sections = book.sections.map((s, idx) => `<div class="book-section" id="part-${idx}"><div class="book-number">${idx+1}</div><div class="book-section-copy"><div class="book-section-head"><h3>${s.title}</h3>${makeFavoriteButton({ id:`book-section:${book.id}:${idx}`, type:'фрагмент книги', title:`${book.title} · ${s.title}`, raw:s.text, source:`Библиотека · ${book.title}` })}</div><p>${s.text}</p></div></div>`).join('');
    const side = `
      <div class="side-panel book-side">
        <img src="${book.cover}" class="book-cover-large" alt="${esc(book.title)}" />
        <div class="book-side-copy">
          <div class="book-copy-row"><h2>${book.title}</h2>${makeFavoriteButton({ id:`book:${book.id}:summary`, type:'книга', title:book.title, raw:book.takeaway, source:`Библиотека · ${book.title}` })}</div>
          <div class="book-cn">${book.cn}</div>
          <small>${book.meta}</small>
          <p class="book-warning">${book.outdated}</p>
        </div>
      </div>`;
    const content = `
      <a class="back-btn" href="?section=library">← В Библиотеку</a>
      <div class="book-layout">
        ${book.id === 'book-culture' ? '<a class="back-btn" href="books/culture.html">Читать курс по культуре · 103 темы →</a>' : ''}
        ${book.id === 'book-history' ? '<a class="back-btn" href="books/history.html">Читать иллюстрированный курс по истории →</a>' : ''}
        ${book.id === 'book-geo' ? '<a class="back-btn" href="books/geography.html">Читать иллюстрированное содержание · 97 тем →</a>' : ''}
        <div class="book-takeaway-block"><h3>О книге</h3><p>${book.note}</p><div class="book-main-idea"><strong>Главное:</strong> ${book.takeaway}</div></div>
        <div class="book-sections">${sections}</div>
      </div>`;
    return pageChrome(book.title, 'Краткая компиляция по книге', content, side);
  }

  function renderTea(){
    const cards = data.tea.map(t => `<article class="content-card tea-card">
      <a class="row-link" href="tea.html#${t.id}"><h3>${esc(t.title)}</h3><small>${esc(t.subtitle)} · ${esc(t.rating)}</small><p class="excerpt">${esc(t.note)}</p></a>
      ${makeFavoriteButton({id:`tea:${t.id}`, type:'чай', title:t.title, raw:`${t.subtitle}. ${t.note}. ${t.favoriteHint}`, source:'Дао чая'})}</article>`).join('');
    return pageChrome('Дао чая','Дегустации и заметки',`<a class="back-btn" href="tea.html">Чайный путеводитель</a><div class="cards-grid">${cards}</div>`);
  }

  function renderTrips(){
    const groups = [['plan','Планы'],['past','Прошедшие поездки']].map(([status,title]) => {
      const rows = data.trips.filter(t => t.status === status).map(t => `<article id="${t.id}" class="content-card trip-card"><div>
        <h3>${esc(t.title)}</h3><small>${esc(t.dates)}</small><p>${esc(t.route)}</p><details><summary>О поездке</summary><p>${esc(t.summary)}</p></details>
        <a class="source-link" href="?section=guide&amp;province=${t.province}">${esc(provinceById(t.province).ru)} · Путеводитель</a></div>
        ${makeFavoriteButton({id:`trip:${t.id}`,type:'поездка',title:t.title,raw:`${t.route}. ${t.summary}`,source:'Поездки'})}</article>`).join('');
      return `<section><h2>${title}</h2><div class="cards-grid">${rows}</div></section>`;
    }).join('');
    return pageChrome('Поездки','Мои маршруты по Китаю',groups);
  }

  function sourceUrl(item){
    const [type,id,part] = item.id.split(':');
    if(type.startsWith('province') && provinceById(id)) return '?section=guide&province='+id;
    if(type === 'tea') return 'tea.html#'+encodeURIComponent(id);
    if(type === 'trip') return '?section=trips#'+encodeURIComponent(id);
    if(type.startsWith('book') && data.books.some(b=>b.id===id)) return '?section=library&book='+id+(type==='book-section'?'#part-'+Number(part):'');
    return '';
  }

  function renderReferences(){
    const favs = window.Favorites.all();
    const content = favs.length ? favs.map(item => `
      <article class="content-card reference-card" data-ref-id="${esc(item.id)}">
        <div class="content-row"><div><h3>${esc(item.title)}</h3><div class="book-cn">${esc(item.type || 'факт')}</div></div><button class="remove-fav" data-remove-fav="${esc(item.id)}">Удалить</button></div>
        <p>${esc(item.raw)}</p>
        ${item.pretty ? `<div class="ai-result">${esc(item.pretty)}</div>` : ''}
        <div class="ref-actions"><button class="ai-btn" data-ai="${esc(item.id)}">${item.pretty ? 'ИИ · переделать' : 'ИИ · оформить'}</button>${sourceUrl(item) ? `<a class="source-link" href="${esc(sourceUrl(item))}">${esc(item.source)}</a>` : esc(item.source)}</div>
      </article>`).join('') : `<div class="empty-state">Пока здесь пусто. Добавляй материалы в избранное внутри разделов — звёздочки спрятаны внутри карточек, а не на главной.</div>`;
    const basics = '<h2>Основы Китая</h2><div class="basic-links"><a href="books/culture.html#c4">Конфуций и его школа</a><a href="books/culture.html#c8">Лао-цзы, Чжуан-цзы и дао</a><a href="books/culture.html#c10">Буддизм в Китае</a></div>';
    return pageChrome('Справочники','Люди, учения и сохранённые материалы', basics+'<h2>Моё избранное</h2>'+content);
  }

  function render(){
    renderNav();
    let html = '';
    if(state.section === 'guide') html = renderGuide();
    if(state.section === 'library') html = state.currentBook ? renderBook(state.currentBook) : renderLibrary();
    if(state.section === 'tea') html = renderTea();
    if(state.section === 'trips') html = renderTrips();
    if(state.section === 'references') html = renderReferences();
    document.getElementById('main').innerHTML = html;
    bindPageEvents();
  }


  /* ===== карты из набора (SVG) ===== */
  const mapCache = {};
  function loadMap(kind){
    if (mapCache[kind]) return Promise.resolve(mapCache[kind]);
    return fetch('assets/maps/china-' + kind + '.svg')
      .then(r => r.ok ? r.text() : '')
      .then(t => { mapCache[kind] = t; return t; })
      .catch(() => '');
  }
  function applyVisited(root){
    root.querySelectorAll('[data-region]').forEach(function(p){
      p.dataset.visited = String(isVisited(p.dataset.region));
      p.setAttribute('aria-pressed',p.dataset.visited);
    });
  }
  function toggleVisited(id){
    if (isVisited(id)) state.visited = state.visited.filter(x => x !== id); else state.visited.push(id);
    saveVisited();
    document.querySelectorAll('[data-toggle-visited]').forEach(function(b){
      b.classList.toggle('active', isVisited(b.dataset.toggleVisited));
    });
    const root = document.querySelector('#libMap svg');
    if (root) applyVisited(root);
  }
  function mountMaps(){
    const g = document.getElementById('guideMap');
    if (g && !g.dataset.mounted){
      g.dataset.mounted = '1';
      loadMap('guide').then(function(svg){
        if (!svg) return;
        g.innerHTML = svg;
        const r = g.querySelector('svg');
        if (r){ r.removeAttribute('width'); r.removeAttribute('height'); r.style.width = '100%'; r.style.height = 'auto'; }
        g.querySelectorAll('[data-region]').forEach(function(p){
          p.style.cursor = 'pointer';
          p.addEventListener('click', function(){ location.assign('?section=guide&province='+encodeURIComponent(p.dataset.region)); });
        });
      });
    }
    const l = document.getElementById('libMap');
    if (l && !l.dataset.mounted){
      l.dataset.mounted = '1';
      loadMap('library').then(function(svg){
        if (!svg) return;
        l.innerHTML = svg;
        const r = l.querySelector('svg');
        if (r){ r.removeAttribute('width'); r.removeAttribute('height'); r.style.width = '100%'; r.style.height = 'auto'; }
        applyVisited(l);
        l.querySelectorAll('[data-region]').forEach(function(p){
          p.setAttribute('role','button');
          p.setAttribute('tabindex','0');
          p.style.cursor = 'pointer';
          p.addEventListener('click', () => toggleVisited(p.dataset.region));
          p.addEventListener('keydown', e => {
            if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleVisited(p.dataset.region); }
          });
        });
      });
    }
  }
  function bindPageEvents(){
    mountMaps();
    const picker = document.getElementById('regionPicker');
    if(picker) picker.onchange = () => location.assign('?section=guide&province='+encodeURIComponent(picker.value));
    const visited = document.getElementById('visitedRegion');
    if(visited) visited.onchange = () => toggleVisited(state.selectedProvince);
    document.querySelectorAll('.fav-btn').forEach(btn => btn.onclick = (e) => {
      e.stopPropagation();
      const payload = JSON.parse(btn.dataset.fav.replace(/&apos;/g, "'"));
      window.Favorites.toggle(payload);
      render();
    });
    document.querySelectorAll('[data-remove-fav]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.removeFav;
      const items = window.Favorites.all().filter(x => x.id !== id);
      localStorage.setItem('my-china-favorites-v2', JSON.stringify(items));
      render();
    });
    document.querySelectorAll('[data-ai]').forEach(btn => btn.onclick = async () => {
      if(state.aiBusy) return;
      const id = btn.dataset.ai;
      const items = window.Favorites.all();
      const item = items.find(x => x.id === id);
      if(!item) return;
      state.aiBusy = true;
      btn.textContent = 'ИИ…';
      try {
        item.pretty = await window.Favorites.beautify(item);
        localStorage.setItem('my-china-favorites-v2', JSON.stringify(items));
      } catch(err){
        state.aiBusy = false;
        btn.textContent = 'Повторить · ИИ недоступен';
        return;
      }
      state.aiBusy = false;
      render();
    });
  }

  function panelWidth(){
    const sb = document.getElementById('sidebar');
    if (!sb) return 0;
    const w = Math.round(sb.getBoundingClientRect().width);
    document.documentElement.style.setProperty('--panel-w', w + 'px');
    return w;
  }
  function openDrawer(){ panelWidth(); state.drawerOpen = true; document.getElementById('mobileMenuBtn').setAttribute('aria-expanded','true'); document.body.classList.add('drawer-open'); }
  function closeDrawer(){ state.drawerOpen = false; document.getElementById('mobileMenuBtn').setAttribute('aria-expanded','false'); document.body.classList.remove('drawer-open'); }

  document.getElementById('mobileMenuBtn').onclick = () => state.drawerOpen ? closeDrawer() : openDrawer();
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && state.drawerOpen) closeDrawer(); });
  document.getElementById('overlay').onclick = closeDrawer;

  /* Свайп панели — как в Тингли: тянем от левого края, закрываем движением влево */
  (function(){
    let drag = null;
    const sidebar = () => document.getElementById('sidebar');
    const narrow = () => window.innerWidth < 960;
    document.addEventListener('touchstart', function(e){
      if (!narrow()) return;
      const sb = sidebar(); if (!sb) return;
      const t = e.touches[0];
      const open = document.body.classList.contains('drawer-open');
      const onSidebar = e.target && e.target.closest && e.target.closest('#sidebar');
      if (open && onSidebar) drag = { x:t.clientX, y:t.clientY, mode:'close', armed:false };
      else if (!open && t.clientX < 24) drag = { x:t.clientX, y:t.clientY, mode:'open', armed:false };
    }, { passive:true });

    document.addEventListener('touchmove', function(e){
      if (!drag) return;
      const sb = sidebar(); if (!sb) return;
      const t = e.touches[0];
      const dx = t.clientX - drag.x, dy = Math.abs(t.clientY - drag.y);
      const w = sb.offsetWidth;
      if (!drag.armed) {
        if (Math.abs(dx) < 12 || Math.abs(dx) < dy * 1.4) return;
        drag.armed = true; sb.classList.add('dragging');
        document.body.classList.add('drawer-drag');
      }
      if (Math.abs(dx) < dy) return;
      if (drag.mode === 'close') sb.style.transform = 'translateX(' + Math.min(0, dx) + 'px)';
      else sb.style.transform = 'translateX(' + Math.max(-w, dx - w) + 'px)';
    }, { passive:true });

    document.addEventListener('touchend', function(e){
      if (!drag) return;
      const sb = sidebar();
      const dx = e.changedTouches[0].clientX - drag.x;
      const armed = drag.armed;
      if (sb){ sb.classList.remove('dragging'); sb.style.transform = ''; }
      document.body.classList.remove('drawer-drag');
      if (armed) {
        if (drag.mode === 'close' && dx < -55) closeDrawer();
        else if (drag.mode === 'open' && dx > 55) openDrawer();
      }
      drag = null;
    }, { passive:true });
  })();

  /* Обновление приложения: проверяем новую версию при возврате и предлагаем обновить */
  function swUpdateBar(){
    if (document.getElementById('swUpd')) return;
    const bar = document.createElement('div');
    bar.id = 'swUpd'; bar.className = 'update-bar';
    const label = document.createElement('span');
    label.textContent = 'Доступна новая версия';
    const go = document.createElement('button');
    go.textContent = 'Обновить';
    go.onclick = () => location.reload();
    const close = document.createElement('button');
    close.className = 'upd-close'; close.textContent = '×';
    close.setAttribute('aria-label', 'Скрыть');
    close.onclick = () => bar.remove();
    bar.appendChild(label); bar.appendChild(go); bar.appendChild(close);
    document.body.appendChild(bar);
  }
  window.swUpdateBar = swUpdateBar;

  if('serviceWorker' in navigator){
    let hadController = !!navigator.serviceWorker.controller, updating = false;
    navigator.serviceWorker.register('sw.js?v=' + window.APP_VER, { updateViaCache: 'none' }).then(reg => {
      const chk = () => {
        if (document.visibilityState !== 'visible' || updating) return;
        updating = true;
        if (!reg || !reg.update) { updating = false; return; }
        reg.update().catch(() => {}).then(() => { updating = false; });
      };
      document.addEventListener('visibilitychange', chk);
      window.addEventListener('focus', chk);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) { hadController = true; return; }
        swUpdateBar();
      });
    }).catch(() => {});
  }
  const params = new URLSearchParams(location.search);
  state.section = data.menu.find(m=>m.id===params.get('section'))?.id || 'guide';
  state.selectedProvince = provinceById(params.get('province'))?.id || 'YN';
  state.currentBook = data.books.find(b=>b.id===params.get('book'))?.id || null;
  render();
  if(location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
})();
