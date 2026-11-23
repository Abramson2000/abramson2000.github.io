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
    guide: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg>`,
    library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5A2.5 2.5 0 0 1 6.5 3z"/></svg>`,
    tea: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2c0 2-1 3-1 4 0 1.2.8 2 2 2"/><path d="M12 2c0 2-1 3-1 4 0 1.2.8 2 2 2"/><path d="M4 10h10a4 4 0 0 1 0 8H8a4 4 0 0 1-4-4v-4z"/><path d="M14 11h3a3 3 0 0 1 0 6h-1"/></svg>`,
    plane: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 19 20-7-20-7 5 7-5 7z"/><path d="M7 12h15"/></svg>`,
    help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 5.7 1.3c-.7 1-1.8 1.5-2.4 2.2-.3.3-.4.7-.4 1.5"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`,
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
      <button class="nav-item ${state.section === item.id ? 'active' : ''}" data-nav="${item.id}">
        <span class="nav-icon">${icons[item.icon]}</span>
        <span>${item.title}</span>
      </button>`).join('');
    nav.querySelectorAll('[data-nav]').forEach(btn => btn.onclick = () => {
      state.section = btn.dataset.nav;
      state.currentBook = null;
      if(state.section !== 'guide') state.selectedProvince = state.selectedProvince || 'YN';
      closeDrawer();
      render();
    });
  }

  function pageChrome(title, subtitle, content, side){
    return `
      <div class="topbar">
        <div class="topbar-spacer"></div>
        <div class="topbar-actions"><span class="top-icon">${icons.bell}</span><span class="top-avatar"><img src="assets/brand/logo-main.png" alt="avatar" /></span></div>
      </div>
      <section class="hero-copy ${state.section === 'library' ? 'library-copy' : ''}">
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <div class="hero-underline"></div>
      </section>
      <section class="content-layout">
        <div class="content-main">${content}</div>
        <div class="content-side">${side}</div>
      </section>
    `;
  }

  function renderGuide(){
    const selected = provinceById(state.selectedProvince) || provinceById('YN');
    const map = `
      <div class="map-card">
        <img src="assets/guide/china-relief-map.webp" class="china-map" alt="Карта Китая" />
      </div>
      <div class="region-picker">
        <label for="regionPicker">Регион</label>
        <select id="regionPicker">
          ${data.provinces.map(p => `<option value="${p.id}"${state.selectedProvince === p.id ? ' selected' : ''}>${p.cn} · ${p.ru}</option>`).join('')}
        </select>
      </div>`;

    const detailFavBase = { id:`province:${selected.id}`, type:'регион', title:`${selected.ru} · ${selected.cn}`, raw:`${selected.intro} Города: ${selected.cities.join(', ')}. Места: ${selected.places.join(', ')}. Маршрут: ${selected.routes.join('; ')}.`, source:`Путеводитель · ${selected.ru}` };
    const side = `
      <div class="side-panel province-panel">
        <div class="province-head">
          <div>
            <div class="province-cn-large">${selected.cn}</div>
            <div class="province-ru-large">${selected.ru}</div>
            <p>${selected.intro}</p>
            <div class="hero-underline small"></div>
          </div>
          <img src="assets/guide/china-relief-map.png" class="province-cover" alt="${selected.ru}" />
        </div>
        <div class="info-list">
          <div class="info-card">
            <div class="info-thumb thumb-city"></div>
            <div class="info-body">
              <div class="info-row"><h3>Города</h3>${makeFavoriteButton({...detailFavBase,id:`province-cities:${selected.id}`,title:`${selected.ru} · Города`,raw:`${selected.cities.join(' · ')}`,source:`Путеводитель · ${selected.ru}`})}</div>
              <p>${selected.cities.join(' · ')}</p>
            </div>
          </div>
          <div class="info-card">
            <div class="info-thumb thumb-place"></div>
            <div class="info-body">
              <div class="info-row"><h3>Достопримечательности</h3>${makeFavoriteButton({...detailFavBase,id:`province-places:${selected.id}`,title:`${selected.ru} · Достопримечательности`,raw:`${selected.places.join(' · ')}`,source:`Путеводитель · ${selected.ru}`})}</div>
              <p>${selected.places.join(' · ')}</p>
            </div>
          </div>
          <div class="info-card">
            <div class="info-thumb thumb-route"></div>
            <div class="info-body">
              <div class="info-row"><h3>Маршруты</h3>${makeFavoriteButton({...detailFavBase,id:`province-routes:${selected.id}`,title:`${selected.ru} · Маршруты`,raw:`${selected.routes.join(' · ')}`,source:`Путеводитель · ${selected.ru}`})}</div>
              <p>${selected.routes.join(' · ')}</p>
            </div>
          </div>
        </div>
      </div>`;

    return pageChrome('Мой Китай','Личный атлас путешествий, культуры и открытий',map,side);
  }

  function renderLibrary(){
    const books = data.books.map(book => `
      <button class="book-card" data-book="${book.id}">
        <img src="${book.cover}" alt="${esc(book.title)}" />
        <div class="book-copy">
          <div class="book-copy-row"><h3>${book.title}</h3>${makeFavoriteButton({ id:`book:${book.id}`, type:'книга', title:book.title, raw:book.note, source:'Библиотека' })}</div>
          <div class="book-cn">${book.cn}</div>
          <p>${book.note}</p>
          <small>${book.meta}</small>
        </div>
      </button>`).join('');

    const map = `
      <div class="map-card library-map-card">
        <img src="assets/guide/china-relief-map.webp" class="china-map grayscale" alt="Атлас регионов" />
      </div>
      <div class="visited-panel">
        <div class="panel-header"><h3>Посещённые регионы</h3><p>Меняй отметки прямо здесь — карта обновляется сразу.</p></div>
        <div class="visited-grid">
          ${data.provinces.map(p => `<button class="visit-chip ${isVisited(p.id) ? 'active' : ''}" data-toggle-visited="${p.id}"><span>${p.cn}</span><small>${p.ru}</small></button>`).join('')}
        </div>
      </div>
      <div class="books-block">
        <div class="panel-header"><h3>Книги и материалы</h3><p>Первые компиляции для библиотеки.</p></div>
        <div class="books-grid">${books}</div>
      </div>`;

    const side = `
      <div class="side-panel library-side">
        <div class="atlas-hero">
          <div>
            <h2>Атлас посещённых регионов</h2>
            <p>Личная библиотека превращается в карту путешествий по Китаю.</p>
            <div class="hero-underline small"></div>
          </div>
        </div>
        <div class="feature-list">
          <div class="feature-item"><span class="feature-icon">${icons.guide}</span><div><h4>Отмечайте регионы</h4><p>Фиксируй, где уже был, и строй карту своих поездок.</p></div></div>
          <div class="feature-item"><span class="feature-icon">${icons.bookStack}</span><div><h4>Изучайте регионы</h4><p>Статьи, книги и заметки о каждом уголке страны.</p></div></div>
          <div class="feature-item"><span class="feature-icon">${icons.picture}</span><div><h4>Дополняйте коллекцию</h4><p>Сохраняй впечатления, полезные факты и маршруты.</p></div></div>
        </div>
      </div>`;

    return pageChrome('Библиотека','Личный атлас посещённых регионов',map,side);
  }

  function renderBook(bookId){
    const book = data.books.find(b => b.id === bookId) || data.books[0];
    const sections = book.sections.map((s, idx) => `<div class="book-section"><div class="book-number">${idx+1}</div><div class="book-section-copy"><div class="book-section-head"><h3>${s.title}</h3>${makeFavoriteButton({ id:`book-section:${book.id}:${idx}`, type:'фрагмент книги', title:`${book.title} · ${s.title}`, raw:s.text, source:`Библиотека · ${book.title}` })}</div><p>${s.text}</p></div></div>`).join('');
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
      <button class="back-btn" id="backToLibrary">← Назад в Библиотеку</button>
      <div class="book-layout">
        <div class="book-takeaway-block"><h3>О книге</h3><p>${book.note}</p><div class="book-main-idea"><strong>Главное:</strong> ${book.takeaway}</div></div>
        <div class="book-sections">${sections}</div>
      </div>`;
    return pageChrome(book.title, 'Краткая компиляция по книге', content, side);
  }

  function renderTea(){
    const cards = data.tea.map(t => `<article class="content-card tea-card"><div class="content-row"><div><h3>${t.title}</h3><div class="book-cn">${t.subtitle}</div></div>${makeFavoriteButton({ id:`tea:${t.id}`, type:'чай', title:t.title, raw:`${t.subtitle}. ${t.note}. ${t.favoriteHint}`, source:'Дао чая' })}</div><p>${t.note}</p><div class="tag-row"><span class="tag">${t.rating}</span><span class="tag">${t.favoriteHint}</span></div></article>`).join('');
    const side = `<div class="side-panel"><img src="assets/sections/tea.svg" class="section-image" alt="Дао чая" /><div class="side-text"><h2>Дао чая</h2><p>Чайный профиль, дегустации и заметки по любимым чаям.</p></div></div>`;
    return pageChrome('Дао чая','Любимые чаи, дегустации и ориентиры для покупок', `<div class="cards-grid">${cards}</div>`, side);
  }

  function renderTrips(){
    const cards = data.trips.map(trip => `<article class="content-card trip-card"><div class="content-row"><div><h3>${trip.title}</h3><div class="book-cn">${trip.dates}</div></div>${makeFavoriteButton({ id:`trip:${trip.id}`, type:'поездка', title:trip.title, raw:`${trip.route}. ${trip.summary}`, source:'Поездки' })}</div><p class="trip-route">${trip.route}</p><p>${trip.summary}</p><div class="tag-row"><span class="tag ${trip.status === 'plan' ? 'tag-plan' : 'tag-done'}">${trip.status === 'plan' ? 'План' : 'Был'}</span></div></article>`).join('');
    const side = `<div class="side-panel"><img src="assets/sections/trips.svg" class="section-image" alt="Поездки" /><div class="side-text"><h2>Поездки</h2><p>Маршруты, планы и уже пройденные оси по Китаю.</p></div></div>`;
    return pageChrome('Поездки','Маршруты, которые уже были и ещё впереди', `<div class="cards-grid">${cards}</div>`, side);
  }

  function renderReferences(){
    const favs = window.Favorites.all();
    const content = favs.length ? favs.map(item => `
      <article class="content-card reference-card" data-ref-id="${esc(item.id)}">
        <div class="content-row"><div><h3>${esc(item.title)}</h3><div class="book-cn">${esc(item.type || 'факт')}</div></div><button class="remove-fav" data-remove-fav="${esc(item.id)}">Удалить</button></div>
        <p>${esc(item.raw)}</p>
        ${item.pretty ? `<div class="ai-result">${esc(item.pretty)}</div>` : ''}
        <div class="ref-actions"><button class="ai-btn" data-ai="${esc(item.id)}">${item.pretty ? 'ИИ · переделать' : 'ИИ · оформить'}</button><span class="ref-source">${esc(item.source || '')}</span></div>
      </article>`).join('') : `<div class="empty-state">Пока здесь пусто. Добавляй материалы в избранное внутри разделов — звёздочки спрятаны внутри карточек, а не на главной.</div>`;
    const side = `<div class="side-panel"><div class="side-text"><h2>Справочники</h2><p>Сюда попадает всё избранное. Исходный факт не меняется, а ИИ создаёт отдельную красивую формулировку.</p></div></div>`;
    return pageChrome('Справочники','Избранные материалы и ИИ-оформление', content, side);
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

  function bindPageEvents(){
    document.querySelectorAll('[data-province]').forEach(btn => btn.onclick = () => { state.selectedProvince = btn.dataset.province; render(); });
    const picker = document.getElementById('regionPicker');
    if (picker) picker.onchange = e => { state.selectedProvince = e.target.value; render(); };
    document.querySelectorAll('[data-book]').forEach(btn => btn.onclick = () => { state.currentBook = btn.dataset.book; render(); });
    const back = document.getElementById('backToLibrary');
    if(back) back.onclick = () => { state.currentBook = null; render(); };
    document.querySelectorAll('[data-toggle-visited]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.toggleVisited;
      if(isVisited(id)) state.visited = state.visited.filter(x => x !== id); else state.visited.push(id);
      saveVisited();
      render();
    });
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
        item.pretty = item.pretty || 'ИИ пока недоступен. Но логика уже подключена к production endpoint.';
        localStorage.setItem('my-china-favorites-v2', JSON.stringify(items));
      }
      state.aiBusy = false;
      render();
    });
  }

  function openDrawer(){ state.drawerOpen = true; document.body.classList.add('drawer-open'); }
  function closeDrawer(){ state.drawerOpen = false; document.body.classList.remove('drawer-open'); }

  document.getElementById('mobileMenuBtn').onclick = () => state.drawerOpen ? closeDrawer() : openDrawer();
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

  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js?v=' + window.APP_VER).catch(() => {}); }
  render();
})();
