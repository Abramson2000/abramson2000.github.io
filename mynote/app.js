/* MyNote — клиент. Всё, что связано с доступом, решает сервер; здесь только интерфейс. */
(function () {
  'use strict';

  const APP_VER = '1.0.2';
  const API = (location.hostname === 'abramson-crm.pages.dev' || location.hostname.endsWith('.abramson-crm.pages.dev') || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? '/api/mynote' : 'https://abramson-crm.pages.dev/api/mynote';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const esc = (s) => String(s == null ? '' : s);

  const state = {
    token: localStorage.getItem('mynote-token') || '',
    user: null,
    tree: [],
    page: null,
    path: [],
    files: [],
    edit: false,
    dirty: false,
    rev: 0,
    saveTimer: null,
    saving: false,
    view: 'page',       // page | favorites | trash | about
    open: new Set(JSON.parse(localStorage.getItem('mynote-open') || '[]')),
    filter: ''
  };

  /* ---------------- сеть ---------------- */

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const res = await fetch(API + path, Object.assign({}, opts, { headers }));
    if (res.status === 401 && state.token) { signOut(true); throw new Error('Нужен вход'); }
    let data = null;
    const ct = res.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) { try { data = await res.json(); } catch { data = null; } }
    if (!res.ok) {
      const err = new Error((data && data.error) || ('Ошибка ' + res.status));
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }

  function toast(msg, kind) {
    const t = el('div', 'toast' + (kind ? ' ' + kind : ''), msg);
    $('#toasts').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3200);
    setTimeout(() => t.remove(), 3700);
  }

  /* ---------------- вход ---------------- */

  function showAuth(msg, ok) {
    $('#auth').style.display = 'flex';
    $('#app').classList.remove('on');
    const m = $('#authMsg'); m.textContent = msg || ''; m.className = 'form-msg' + (ok ? ' ok' : '');
  }
  function showApp() {
    $('#auth').style.display = 'none';
    $('#app').classList.add('on');
    $('#userName').textContent = state.user ? state.user.name || state.user.email : '';
    $('#ava').textContent = (state.user ? (state.user.name || state.user.email) : '?').trim().charAt(0).toUpperCase();
  }

  let regMode = false;
  function setAuthMode(reg) {
    regMode = reg;
    $('#tabLogin').classList.toggle('on', !reg);
    $('#tabReg').classList.toggle('on', reg);
    $('#fName').style.display = reg ? 'block' : 'none';
    $('#btnAuth').textContent = reg ? 'Создать аккаунт' : 'Войти';
    $('#inPass').setAttribute('autocomplete', reg ? 'new-password' : 'current-password');
  }

  async function submitAuth(ev) {
    ev.preventDefault();
    const email = $('#inEmail').value.trim(), pass = $('#inPass').value, name = $('#inName').value.trim();
    $('#btnAuth').disabled = true;
    try {
      const d = await api(regMode ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pass, name }) });
      state.token = d.token; state.user = d.user;
      localStorage.setItem('mynote-token', d.token);
      showApp(); await loadTree(); route();
      toast(regMode ? 'Аккаунт создан' : 'Вы вошли', 'ok');
    } catch (e) {
      showAuth(e.message);
    } finally { $('#btnAuth').disabled = false; }
  }

  async function openAccess() {
    try {
      const d = await api('/auth/open', { method: 'POST', body: '{}' });
      state.token = d.token || '';
      state.user = d.user || null;
      state.open = state.open || new Set();
      if (state.token) localStorage.setItem('mynote-token', state.token);
      state.openLogin = true;
      return true;
    } catch (e) { return false; }
  }

  function signOut(quiet) {
    if (!quiet && state.token) api('/auth/logout', { method: 'POST' }).catch(() => {});
    state.token = ''; state.user = null; state.page = null; state.tree = [];
    localStorage.removeItem('mynote-token');
    $('#tree').innerHTML = '';
    if (!quiet) showAuth('Вы вышли из аккаунта', true);
    if (quiet) showAuth('Сеанс истёк — войдите заново');
  }

  /* ---------------- дерево ---------------- */

  async function loadTree() {
    const d = await api('/tree');
    state.tree = d.notebooks || [];
    renderTree();
  }

  function saveOpen() { localStorage.setItem('mynote-open', JSON.stringify(Array.from(state.open))); }

  function renderTree() {
    const host = $('#tree'); host.innerHTML = '';
    const f = state.filter.toLowerCase();
    if (!state.tree.length) {
      const li = el('li', 'node'); li.appendChild(el('div', 'line', 'Пока нет блокнотов — создайте первый.'));
      host.appendChild(li); return;
    }
    for (const nb of state.tree) {
      const li = el('li', 'node');
      const modeCls = nb.mode === 'shared' ? 'mode-shared' : (nb.mode === 'link' ? 'mode-link' : '');
      const line = el('div', 'line ' + modeCls);
      const tw = el('button', 'tw', state.open.has(nb.id) ? '▾' : '▸');
      tw.type = 'button';
      tw.onclick = (e) => { e.stopPropagation(); toggleOpen(nb.id); };
      line.appendChild(tw);
      line.appendChild(el('span', 'ttl nb-title', (nb.title || 'Блокнот')));
      line.appendChild(el('span', 'pill ' + nb.mode, nb.mode === 'private' ? 'Личный' : (nb.mode === 'link' ? 'По ссылке' : (nb.role === 'owner' ? 'Совместный' : 'Доступ ' + (nb.role === 'editor' ? 'редактора' : 'чтение')))));
      line.onclick = () => { toggleOpen(nb.id); };
      if (nb.role === 'owner') {
        const mb = el('button', 'icon-btn', '⋯'); mb.type = 'button'; mb.style.cssText = 'width:26px;height:26px;font-size:15px';
        mb.onclick = (e) => { e.stopPropagation(); notebookMenu(nb); };
        line.appendChild(mb);
      }
      li.appendChild(line);
      const kids = el('ul', 'kids');
      if (state.open.has(nb.id)) renderNodes(nb, nb.pages || [], '', kids, 0, f);
      li.appendChild(kids);
      host.appendChild(li);
    }
    $('#favCount').textContent = '';
  }

  function renderNodes(nb, pages, parentId, host, depth, f) {
    const kids = pages.filter(p => (p.parentId || '') === parentId).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    for (const p of kids) {
      const hasKids = pages.some(x => (x.parentId || '') === p.id);
      const li = el('li', 'node');
      const line = el('div', 'line');
      line.dataset.id = p.id; line.dataset.nb = nb.id;
      line.draggable = true;
      const tw = el('button', 'tw', hasKids ? (state.open.has(p.id) ? '▾' : '▸') : '');
      tw.type = 'button';
      if (hasKids) tw.onclick = (e) => { e.stopPropagation(); toggleOpen(p.id); };
      line.appendChild(tw);
      line.appendChild(el('span', 'ttl', p.title || 'Без названия'));
      if (p.fav) line.appendChild(el('span', 'fav', '★'));
      if (p.closed) line.appendChild(el('span', 'pill closed', 'закрыта'));
      const mb = el('button', 'icon-btn', '⋯'); mb.type = 'button'; mb.style.cssText = 'width:26px;height:26px;font-size:15px';
      mb.onclick = (e) => { e.stopPropagation(); pageMenu(nb, p); };
      line.appendChild(mb);
      line.onclick = () => openPage(p.id, nb.id);
      if (state.page && state.page.id === p.id) line.classList.add('on');
      if (state.view === 'page' && state.page && state.page.id === p.id) line.classList.add('on');

      // перетаскивание: внутрь / до / после
      line.ondragstart = (e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; };
      line.ondragover = (e) => {
        e.preventDefault();
        const r = line.getBoundingClientRect();
        const y = (e.clientY - r.top) / r.height;
        line.classList.remove('drop-into', 'drop-before', 'drop-after');
        line.classList.add(y < 0.28 ? 'drop-before' : (y > 0.72 ? 'drop-after' : 'drop-into'));
      };
      line.ondragleave = () => line.classList.remove('drop-into', 'drop-before', 'drop-after');
      line.ondrop = async (e) => {
        e.preventDefault();
        const src = e.dataTransfer.getData('text/plain');
        const mode = line.classList.contains('drop-into') ? 'into' : (line.classList.contains('drop-before') ? 'before' : 'after');
        line.classList.remove('drop-into', 'drop-before', 'drop-after');
        if (!src || src === p.id) return;
        await dropMove(nb, src, p, mode, pages);
      };
      li.appendChild(line);
      const sub = el('ul', 'kids');
      if (state.open.has(p.id)) renderNodes(nb, pages, p.id, sub, depth + 1, f);
      li.appendChild(sub);
      host.appendChild(li);
    }
  }

  async function dropMove(nb, srcId, target, mode, pages) {
    let parentId = '', sort = 1000;
    if (mode === 'into') parentId = target.id;
    else {
      parentId = target.parentId || '';
      const sibs = pages.filter(p => (p.parentId || '') === parentId && p.id !== srcId).sort((a, b) => (a.sort || 0) - (b.sort || 0));
      const idx = sibs.findIndex(s => s.id === target.id);
      const before = mode === 'before' ? sibs[idx - 1] : sibs[idx];
      const after = sibs[idx + 1] || null;
      sort = before && after ? (before.sort + after.sort) / 2 : (before ? before.sort + 500 : (after ? after.sort - 500 : 1000));
    }
    try {
      await api('/move/' + srcId, { method: 'POST', body: JSON.stringify({ notebookId: nb.id, parentId, sort }) });
      await loadTree();
      toast('Перенесено', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  function toggleOpen(id) {
    if (state.open.has(id)) state.open.delete(id); else state.open.add(id);
    saveOpen(); renderTree();
  }

  /* ---------------- меню страниц и блокнотов ---------------- */

  function modal(title, bodyNode, footNodes, wide) {
    const ov = el('div', 'overlay');
    const m = el('div', 'modal' + (wide ? ' wide' : ''));
    const h = el('h3', null, title);
    const b = el('div', 'body'); if (bodyNode) b.appendChild(bodyNode);
    const f = el('div', 'foot');
    const close = () => ov.remove();
    if (footNodes) footNodes.forEach(n => f.appendChild(n));
    $('.spacer') && 0;
    const sp = el('span', 'spacer'); f.appendChild(sp);
    const c = el('button', 'btn', 'Закрыть'); c.type = 'button'; c.onclick = close; f.appendChild(c);
    m.appendChild(h); m.appendChild(b); m.appendChild(f);
    ov.appendChild(m);
    ov.onclick = (e) => { if (e.target === ov) close(); };
    $('#modals').appendChild(ov);
    $$('.btn.primary', f).forEach(x => { x.id = 'dlgOk'; });
    return { ov, close, body: b, foot: f, modal: m };
  }

  function pageMenu(nb, p) {
    const box = el('div');
    const ul = el('ul', 'items');
    const canWrite = nb.role === 'owner' || nb.role === 'editor';
    const add = (label, fn, cls) => {
      const li = el('li'); const b = el('button', 'btn sm ' + (cls || ''), label); b.type = 'button';
      b.onclick = async () => { await fn(); };
      li.appendChild(b); ul.appendChild(li);
    };
    add(p.fav ? 'Убрать из избранного' : 'В избранное', async () => {
      await api('/pages/' + p.id, { method: 'PATCH', body: JSON.stringify({ fav: !p.fav }) });
      await loadTree(); toast('Готово', 'ok'); m.close();
    });
    if (canWrite) {
      add('Переместить…', async () => { m.close(); moveDialog(nb, p); });
      add('Переименовать', async () => {
        const name = prompt('Новое название', p.title); if (name == null) return;
        await api('/pages/' + p.id, { method: 'PATCH', body: JSON.stringify({ title: name }) });
        await loadTree(); if (state.page && state.page.id === p.id) { state.page.title = name; $('#pageTitle').textContent = name; }
        m.close();
      });
      if (nb.role === 'owner') add(p.closed ? 'Открыть для участников' : 'Закрыть для участников', async () => {
        await api('/pages/' + p.id, { method: 'PATCH', body: JSON.stringify({ closed: !p.closed }) });
        await loadTree(); toast(p.closed ? 'Страница открыта' : 'Страница закрыта (с потомками)', 'ok'); m.close();
      });
    }
    add('История версий', async () => { m.close(); versionsDialog(p); });
    if (canWrite) add('В корзину' + (p.title ? '' : ''), async () => {
      m.close();
      const conf = el('div');
      conf.appendChild(el('p', null, 'Страница «' + (p.title || 'Без названия') + '» и все её дочерние страницы уйдут в корзину (восстановить можно целиком).'));
      modal('Удалить ветку?', conf, [btn('В корзину', 'danger', async () => {
        const d = await api('/pages/' + p.id, { method: 'DELETE' });
        await loadTree(); state.page = null; renderPageEmpty();
        toast('В корзине: ' + (d.trashed || 1) + ' шт. Восстановить можно в «Корзине».', 'ok');
        document.querySelectorAll('.overlay').forEach(o => o.remove());
      })]);
    }, 'danger');
    const m = modal('Страница: ' + (p.title || 'Без названия'), box);
    box.appendChild(ul);
  }

  function notebookMenu(nb) {
    const box = el('div');
    const ul = el('ul', 'items');
    const mk = (label, fn, cls) => { const li = el('li'); const b = el('button', 'btn sm ' + (cls || ''), label); b.type = 'button'; b.onclick = async () => { await fn(); }; li.appendChild(b); ul.appendChild(li); };
    mk('Переименовать', async () => {
      const t = prompt('Название блокнота', nb.title); if (t == null) return;
      await api('/notebooks/' + nb.id, { method: 'PATCH', body: JSON.stringify({ title: t }) });
      await loadTree(); m.close();
    });
    mk('Новая страница', async () => {
      const d = await api('/pages', { method: 'POST', body: JSON.stringify({ notebookId: nb.id, title: 'Новая страница' }) });
      await loadTree(); openPage(d.id, nb.id); m.close();
    });
    mk('Доступ и ссылка…', async () => { m.close(); shareDialog(nb); });
    mk('Экспорт в ZIP', async () => { m.close(); exportNotebook(nb); });
    mk('Удалить блокнот', async () => {
      m.close();
      const conf = el('div');
      conf.appendChild(el('p', null, 'Блокнот «' + nb.title + '» и все его страницы уйдут в корзину.'));
      modal('Удалить блокнот?', conf, [btn('Удалить', 'danger', async () => {
        await api('/notebooks/' + nb.id, { method: 'DELETE' });
        await loadTree(); state.page = null; renderPageEmpty();
        document.querySelectorAll('.overlay').forEach(o => o.remove());
        toast('Блокнот в корзине', 'ok');
      })]);
    }, 'danger');
    const m = modal('Блокнот: ' + nb.title, box);
    box.appendChild(ul);
  }

  function btn(label, cls, fn) {
    const b = el('button', 'btn ' + (cls || ''), label); b.type = 'button'; b.onclick = async () => { try { await fn(); } catch (e) { toast(e.message, 'err'); } };
    return b;
  }

  /* ---------------- страница ---------------- */

  function renderPageEmpty() {
    $('#emptyState').classList.remove('hidden');
    $('#pageView').classList.add('hidden');
    $('#crumbs').innerHTML = '';
    $('#accessPill').textContent = ''; $('#accessPill').className = 'pill hidden';
  }

  async function openPage(id, nbId) {
    try {
      if (state.dirty) await saveNow(true);
      const d = await api('/pages/' + id);
      state.page = d.page; state.path = d.path; state.files = d.files || []; state.rev = d.page.rev;
      state.edit = false; state.dirty = false;
      state.view = 'page';
      try { localStorage.setItem('mynote-last', JSON.stringify({ id: id, nb: nbId || d.page.notebookId || '' })); } catch { /* ignore */ }
      // несохранённый черновик этой же ревизии — восстанавливаем и тихо досылаем
      let draft = null;
      try { draft = JSON.parse(localStorage.getItem('mynote-draft:' + id) || 'null'); } catch { draft = null; }
      if (draft && draft.rev === d.page.rev) {
        const nb = draft.body && draft.body.length ? draft.body : null;
        const nf = draft.fields && Object.keys(draft.fields).length ? draft.fields : null;
        if (nb || nf) {
          if (nb) state.page.body = JSON.stringify(nb);
          if (nf) state.page.fields = JSON.stringify(nf);
          state.dirty = true;
          renderPage(d);
          saveNow(true).then(() => toast('Восстановлены несохранённые правки', 'ok')).catch(() => {});
          renderTree();
          return;
        }
      }
      $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('on');
      renderPage(d);
      renderTree();
    } catch (e) { toast(e.message, 'err'); }
  }

  function renderPage(d) {
    const p = state.page, nb = d.notebook || {};
    $('#emptyState').classList.add('hidden');
    $('#pageView').classList.remove('hidden');
    // хлебные крошки
    const c = $('#crumbs'); c.innerHTML = '';
    (d.path || []).forEach((n, i) => {
      if (i) c.appendChild(el('span', 'sep', '/'));
      const s = el('span', 'c' + (i === d.path.length - 1 ? ' cur' : ''), n.title || 'Без названия');
      if (i !== d.path.length - 1) s.onclick = () => openPage(n.id);
      c.appendChild(s);
    });
    const pill = $('#accessPill');
    const role = nb.role || 'viewer';
    pill.className = 'pill ' + (nb.mode || 'private');
    pill.textContent = nb.mode === 'private' ? 'Личный' : (nb.mode === 'link' ? 'Доступ по ссылке' : (role === 'owner' ? 'Совместный' : (role === 'editor' ? 'Совместный · редактор' : 'Совместный · чтение')));
    // заголовок и мета
    const h = $('#pageTitle');
    h.textContent = p.title || '';
    h.contentEditable = 'false';
    $('#docMeta').innerHTML = '';
    $('#docMeta').appendChild(el('span', null, (p.kind === 'place' ? 'Место' : 'Страница') + ' · изменено ' + fmtDate(p.updated)));
    if (p.fav) $('#docMeta').appendChild(el('span', null, '★ в избранном'));
    if (p.closed) $('#docMeta').appendChild(el('span', 'small', 'закрыта для участников'));
    renderCover(p);
    renderBody(d);
    updateEditUi();
  }

  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function renderCover(p) {
    const box = $('#coverBox'); box.innerHTML = '';
    if (!p.cover) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const f = (state.files || []).find(x => x.id === p.cover);
    const img = el('img'); img.alt = (f && f.caption) || '';
    img.src = API + '/files/' + p.cover + (state.token ? '?t=' + encodeURIComponent(state.token) : '');
    img.onerror = () => { box.classList.add('hidden'); };
    box.appendChild(img);
    if (f && f.caption) { const cap = el('div', 'small muted', f.caption); cap.style.marginTop = '6px'; box.appendChild(cap); }
  }

  /* ---------------- содержимое и редактор ---------------- */

  function parseBlocks(raw) {
    let b = raw;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = []; } }
    if (!Array.isArray(b)) b = [];
    return b.length ? b : [{ t: 'p', text: '' }];
  }

  function inlineToDom(text, host) {
    // поддержка **жирный**, *курсив*, `код`, [текст](ссылка)
    const s = String(text == null ? '' : text);
    let i = 0;
    const push = (txt) => { if (txt) host.appendChild(document.createTextNode(txt)); };
    while (i < s.length) {
      const rest = s.slice(i);
      let m;
      if ((m = /^\*\*([\s\S]+?)\*\*/.exec(rest))) { const b = el('b'); b.textContent = m[1]; host.appendChild(b); i += m[0].length; continue; }
      if ((m = /^\*([^*\n]+)\*/.exec(rest))) { const b = el('i'); b.textContent = m[1]; host.appendChild(b); i += m[0].length; continue; }
      if ((m = /^`([^`]+)`/.exec(rest))) { const b = el('code'); b.textContent = m[1]; host.appendChild(b); i += m[0].length; continue; }
      if ((m = /^\[([^\]\n]*)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/.exec(rest))) {
        const a = el('a'); a.textContent = m[1]; a.href = m[2]; a.target = '_blank'; a.rel = 'noopener noreferrer';
        host.appendChild(a); i += m[0].length; continue;
      }
      // до следующего спецсимвола
      const next = s.slice(i + 1).search(/[*`\[]/);
      const chunk = next < 0 ? s.slice(i) : s.slice(i, i + 1 + next);
      push(chunk); i += chunk.length;
    }
  }

  function domToInline(node) {
    let out = '';
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { out += n.nodeValue.replace(/\u00a0/g, ' '); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase();
      if (tag === 'button' || n.classList && n.classList.contains('icon-btn')) return;
      if (tag === 'br') { out += '\n'; return; }
      const inner = domToInline(n);
      if (!inner) return;
      if (tag === 'b' || tag === 'strong') out += '**' + inner + '**';
      else if (tag === 'i' || tag === 'em') out += '*' + inner + '*';
      else if (tag === 'code') out += '`' + inner + '`';
      else if (tag === 'a') { const href = n.getAttribute('href') || ''; out += /^(https?:|mailto:)/i.test(href) ? '[' + inner + '](' + href + ')' : inner; }
      else if (tag === 'div' || tag === 'p') out += (out && !out.endsWith('\n') ? '\n' : '') + inner;
      else out += inner;
    });
    return out;
  }

  function renderBody(d) {
    const wrap = $('#placeWrap'); wrap.innerHTML = '';
    const p = state.page;
    const editable = state.edit && (d.notebook.role !== 'viewer');
    const body = el('div'); body.id = 'docBody'; body.contentEditable = editable ? 'true' : 'false';
    body.spellcheck = true;

    const tb = toolbar();
    wrap.appendChild(tb);

    const grid = el('div', p.kind === 'place' ? 'place-grid' : '');
    const mainCol = el('div');
    mainCol.appendChild(body);
    grid.appendChild(mainCol);

    for (const b of parseBlocks(p.body)) body.appendChild(blockNode(b, editable, d));

    if (p.kind === 'place') grid.appendChild(sideColumn(d));
    wrap.appendChild(grid);

    if (!parseBlocks(p.body).length && !editable) mainCol.appendChild(el('p', 'muted', 'Пустая страница.'));
  }

  function blockNode(b, editable, d) {
    const t = b.t || 'p';
    if (t === 'img') {
      const f = (state.files || []).find(x => x.id === b.id);
      const fig = el('figure', 'imgblock');
      if (f) {
        const img = el('img'); img.src = API + '/files/' + b.id + (state.token ? '?t=' + encodeURIComponent(state.token) : ''); img.alt = f.caption || f.name;
        fig.appendChild(img);
      } else {
        fig.appendChild(el('div', 'muted small', 'Изображение недоступно'));
      }
      const cap = el('figcaption', null, f ? (f.caption || f.name) : '');
      if (editable) {
        cap.contentEditable = 'true'; cap.dataset.captionOf = b.id;
        cap.onblur = async () => {
          const v = cap.textContent.trim();
          try { await api('/files/' + b.id, { method: 'PATCH', body: JSON.stringify({ caption: v }) }); const ff = state.files.find(x => x.id === b.id); if (ff) ff.caption = v; }
          catch (e) { toast(e.message, 'err'); }
        };
      }
      if (cap.textContent) fig.appendChild(cap);
      if (editable) fig.appendChild(blockTools(() => removeBlock(fig)));
      return fig;
    }
    if (t === 'file') {
      const f = (state.files || []).find(x => x.id === b.id);
      const box = el('div', 'fileblock');
      box.appendChild(el('span', null, '📎'));
      box.appendChild(el('span', 'fname', f ? f.name : 'Вложение недоступно'));
      if (f) box.appendChild(el('span', 'small muted', fmtSize(f.size)));
      if (f) {
        const dl = el('a', 'btn sm', 'Скачать'); dl.href = API + '/files/' + f.id + '?dl=1' + (state.token ? '&t=' + encodeURIComponent(state.token) : ''); dl.setAttribute('download', f.name);
        box.appendChild(dl);
      }
      if (editable) box.appendChild(blockTools(() => removeBlock(box)));
      return box;
    }
    if (t === 'pagelink') {
      const a = el('div', 'pagelink', '→ ' + (b.title || 'Страница'));
      a.onclick = () => openPage(b.id);
      return a;
    }
    if (t === 'table') {
      const tbl = el('table');
      (b.rows || []).forEach((row, ri) => {
        const tr = el('tr');
        row.forEach((cell) => {
          const td = el(ri === 0 ? 'th' : 'td');
          if (editable) { td.contentEditable = 'true'; }
          inlineToDom(cell, td);
          tr.appendChild(td);
        });
        tbl.appendChild(tr);
      });
      const holder = el('div'); holder.appendChild(tbl);
      if (editable) {
        const tools = el('div', 'row small'); tools.style.marginTop = '4px';
        tools.appendChild(btn('+ строка', 'sm', () => { const tr = el('tr'); const cols = tbl.rows[0] ? tbl.rows[0].cells.length : 2; for (let i = 0; i < cols; i++) { const td = el('td'); td.contentEditable = 'true'; tr.appendChild(td); } tbl.appendChild(tr); }));
        tools.appendChild(btn('+ столбец', 'sm', () => { Array.from(tbl.rows).forEach(r => { const c = el(r.parentNode.tagName === 'THEAD' ? 'th' : 'td'); c.contentEditable = 'true'; r.appendChild(c); }); }));
        tools.appendChild(btn('Удалить таблицу', 'sm danger', () => holder.remove()));
        holder.appendChild(tools);
      }
      return holder;
    }
    if (t === 'hr') { const hr = el('hr'); const h2 = el('div'); h2.appendChild(hr); if (editable) h2.appendChild(blockTools(() => h2.remove())); return h2; }
    if (t === 'check') {
      const row = el('div', 'chk' + (b.done ? ' done' : ''));
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!b.done;
      if (!editable) cb.disabled = true;
      const span = el('span'); span.contentEditable = editable ? 'true' : 'false';
      inlineToDom(b.text, span);
      row.appendChild(cb); row.appendChild(span);
      if (editable) row.appendChild(blockTools(() => row.remove()));
      return row;
    }
    if (t === 'ul' || t === 'ol') {
      const list = el(t);
      (b.items || []).forEach(it => { const li = el('li'); inlineToDom(it, li); if (editable) li.contentEditable = 'true'; list.appendChild(li); });
      const holder = el('div'); holder.appendChild(list);
      if (editable) holder.appendChild(blockTools(() => holder.remove()));
      return holder;
    }
    const map = { p: 'p', h1: 'h1', h2: 'h2', h3: 'h3', quote: 'blockquote', code: 'pre' };
    const node = el(map[t] || 'p');
    node.dataset.t = t === 'code' ? 'code' : (map[t] === 'p' ? 'p' : t);
    if (editable) node.contentEditable = 'true';
    if (t === 'code' && !editable) { node.textContent = b.text || ''; }
    else inlineToDom(b.text || '', node);
    if (t === 'code') node.style.whiteSpace = 'pre-wrap';
    if (t === 'p') node.style.whiteSpace = 'pre-wrap';
    const h = el('div'); h.appendChild(node);
    if (editable) { h.style.position = 'relative'; h.appendChild(blockToolsInline(() => h.remove())); }
    return h;
  }

  function blockTools(onDel) {
    const d = el('button', 'icon-btn', '✕'); d.type = 'button'; d.title = 'Удалить блок';
    d.style.cssText = 'width:24px;height:24px;font-size:12px;color:#a06';
    d.onclick = () => onDel();
    const wrap = el('span'); wrap.style.cssText = 'margin-left:6px';
    wrap.appendChild(d);
    return wrap;
  }
  function blockToolsInline(onDel) {
    const d = el('button', 'icon-btn', '✕'); d.type = 'button'; d.title = 'Удалить блок';
    d.style.cssText = 'position:absolute;right:-30px;top:2px;width:22px;height:22px;font-size:11px;opacity:.35';
    d.onmouseenter = () => { d.style.opacity = '1'; }; d.onmouseleave = () => { d.style.opacity = '.35'; };
    d.onclick = (e) => { e.preventDefault(); onDel(); };
    return d;
  }
  function removeBlock(node) { node.remove(); markDirty(); }

  function fmtSize(n) { n = n || 0; return n > 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : (n > 1024 ? Math.round(n / 1024) + ' КБ' : n + ' Б'); }

  function sideColumn(d) {
    let f = {}; try { f = JSON.parse(state.page.fields || '{}'); } catch { f = {}; }
    const editable = state.edit && d.notebook.role !== 'viewer';
    const col = el('div');
    const card = (title, key, ph) => {
      const box = el('div', 'place-side');
      box.appendChild(el('h4', null, title));
      const v = el('div', 'val');
      if (editable) {
        v.contentEditable = 'true'; v.dataset.field = key;
        v.textContent = f[key] || '';
        if (!f[key]) v.classList.add('empty');
      } else {
        v.dataset.field = key;
        v.textContent = f[key] || ph || '—';
        if (!f[key]) v.classList.add('empty');
      }
      box.appendChild(v);
      return box;
    };
    col.appendChild(card('Адрес', 'address', 'не указан'));
    const map = el('div', 'place-side');
    map.appendChild(el('h4', null, 'Карта'));
    const link = f.map || '';
    const a = el('a', null, link || 'ссылка не указана');
    if (link) { a.href = /^(https?:)/.test(link) ? link : 'https://' + link; a.target = '_blank'; a.rel = 'noopener'; }
    if (!link) a.className = 'empty';
    if (editable) { a.contentEditable = 'true'; a.dataset.field = 'map'; a.textContent = link; }
    map.appendChild(a);
    col.appendChild(map);
    col.appendChild(card('Как добраться', 'route', '—'));
    col.appendChild(card('Время на посещение', 'time', '—'));
    col.appendChild(card('Практические сведения', 'facts', '—'));
    col.appendChild(card('Личные заметки', 'notes', '—'));
    col.appendChild(card('Источники', 'sources', '—'));
    return col;
  }

  function toolbar() {
    const tb = el('div'); tb.id = 'toolbar';
    const add = (label, title, fn, id) => {
      const b = el('button', null, label); b.type = 'button'; b.title = title; if (id) b.id = id;
      b.onmousedown = (e) => e.preventDefault();
      b.onclick = () => { try { fn(); } catch (e) { toast(e.message, 'err'); } };
      tb.appendChild(b); return b;
    };
    const sep = () => tb.appendChild(el('span', 'sep'));
    add('H1', 'Заголовок 1', () => cmd('formatBlock', 'h1'));
    add('H2', 'Заголовок 2', () => cmd('formatBlock', 'h2'));
    add('H3', 'Заголовок 3', () => cmd('formatBlock', 'h3'));
    add('Т', 'Обычный текст', () => cmd('formatBlock', 'p'));
    sep();
    add('Ж', 'Жирный', () => cmd('bold'));
    add('К', 'Курсив', () => cmd('italic'));
    sep();
    add('•', 'Список', () => cmd('insertUnorderedList'));
    add('1.', 'Нумерованный список', () => cmd('insertOrderedList'));
    add('☑', 'Чек-лист', () => insertChecklist());
    sep();
    add('🔗', 'Ссылка', () => {
      const url = prompt('Адрес ссылки (https://…)'); if (!url) return;
      if (!/^(https?:|mailto:)/i.test(url)) return toast('Нужна ссылка http(s):// или mailto:', 'err');
      const txt = String(window.getSelection() || '').trim();
      if (txt) cmd('createLink', url); else document.execCommand('insertHTML', false, '<a href="' + url.replace(/"/g, '') + '" target="_blank" rel="noopener">' + url + '</a>');
    });
    add('↗', 'Ссылка на страницу MyNote', () => pageLinkDialog());
    sep();
    add('🖼', 'Фотография', () => uploadPick('photo'));
    add('📎', 'Вложение (PDF, DOCX, XLSX)', () => uploadPick('file'));
    sep();
    add('▦', 'Таблица', () => insertTable());
    add('—', 'Разделитель', () => { const body = $('#docBody'); const hr = el('hr'); body.appendChild(hr); markDirty(); });
    const st = el('span'); st.id = 'saveState'; st.textContent = ''; tb.appendChild(st);
    return tb;
  }

  function cmd(name, val) {
    const body = $('#docBody'); body.focus();
    document.execCommand(name, false, val == null ? null : val);
    markDirty();
  }
  function insertChecklist() {
    const body = $('#docBody');
    const row = el('div', 'chk');
    const cb = el('input'); cb.type = 'checkbox';
    const span = el('span'); span.contentEditable = 'true'; span.textContent = '';
    row.appendChild(cb); row.appendChild(span); row.appendChild(blockTools(() => row.remove()));
    const sel = window.getSelection();
    const anchor = sel && sel.anchorNode ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement) : null;
    const cur = anchor ? anchor.closest('#docBody > *') : null;
    if (cur && cur.nextSibling) body.insertBefore(row, cur.nextSibling); else body.appendChild(row);
    span.focus(); markDirty();
  }
  function insertTable() {
    const body = $('#docBody');
    const rows = 3, cols = 3;
    const tbl = el('table');
    for (let r = 0; r < rows; r++) {
      const tr = el('tr');
      for (let c = 0; c < cols; c++) { const cell = el(r === 0 ? 'th' : 'td'); cell.contentEditable = 'true'; tr.appendChild(cell); }
      tbl.appendChild(tr);
    }
    const holder = el('div'); holder.appendChild(tbl);
    const tools = el('div', 'row small'); tools.style.marginTop = '4px';
    tools.appendChild(btn('+ строка', 'sm', () => { const tr = el('tr'); const n = tbl.rows[0].cells.length; for (let i = 0; i < n; i++) { const td = el('td'); td.contentEditable = 'true'; tr.appendChild(td); } tbl.appendChild(tr); markDirty(); }));
    tools.appendChild(btn('+ столбец', 'sm', () => { Array.from(tbl.rows).forEach(r => { const c = el('td'); c.contentEditable = 'true'; r.appendChild(c); }); markDirty(); }));
    tools.appendChild(btn('Удалить', 'sm danger', () => { holder.remove(); markDirty(); }));
    holder.appendChild(tools);
    body.appendChild(holder); markDirty();
  }

  function uploadPick(kind) {
    if (!state.page) return;
    const inp = el('input'); inp.type = 'file';
    inp.accept = kind === 'photo' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf';
    inp.onchange = async () => {
      const file = inp.files && inp.files[0]; if (!file) return;
      const st = $('#saveState'); if (st) { st.textContent = 'Загружается…'; st.className = 'wait'; }
      const fd = new FormData(); fd.append('file', file); fd.append('pageId', state.page.id); fd.append('kind', kind);
      try {
        const d = await api('/files', { method: 'POST', body: fd });
        state.files.push(d.file);
        const body = $('#docBody');
        if (kind === 'photo') {
          const fig = el('figure', 'imgblock');
          const img = el('img'); img.src = API + '/files/' + d.file.id + '?t=' + encodeURIComponent(state.token); img.alt = d.file.name;
          fig.appendChild(img);
          const cap = el('figcaption'); cap.contentEditable = 'true'; cap.dataset.captionOf = d.file.id;
          fig.appendChild(cap); fig.appendChild(blockTools(() => fig.remove()));
          body.appendChild(fig);
        } else {
          const box = el('div', 'fileblock');
          box.appendChild(el('span', null, '📎'));
          box.appendChild(el('span', 'fname', d.file.name));
          box.appendChild(el('span', 'small muted', fmtSize(d.file.size)));
          const a = el('a', 'btn sm', 'Скачать'); a.href = API + '/files/' + d.file.id + '?dl=1&t=' + encodeURIComponent(state.token); a.setAttribute('download', d.file.name);
          box.appendChild(a); box.appendChild(blockTools(() => box.remove()));
          body.appendChild(box);
        }
        setSave('Сохранено', 'ok');
        markDirty();
      } catch (e) { toast(e.message, 'err'); setSave('Ошибка загрузки', 'err'); }
    };
    inp.click();
  }

  async function pageLinkDialog() {
    const box = el('div');
    const inp = el('input'); inp.type = 'search'; inp.placeholder = 'Название страницы';
    const list = el('div');
    box.appendChild(inp); box.appendChild(list);
    const m = modal('Ссылка на страницу', box);
    const draw = async () => {
      list.innerHTML = '';
      const q = inp.value.trim();
      const hits = q ? (await api('/search?q=' + encodeURIComponent(q))).hits : allPagesFlat();
      hits.slice(0, 40).forEach(h => {
        const b = el('button', 'btn sm', h.title || 'Без названия'); b.type = 'button'; b.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0';
        b.onclick = () => {
          const body = $('#docBody');
          const holder = el('div'); const a = el('div', 'pagelink', '→ ' + (h.title || 'Страница')); a.onclick = () => openPage(h.id);
          holder.appendChild(a);
          body.appendChild(holder); m.close(); markDirty();
        };
        list.appendChild(b);
      });
      if (!hits.length) list.appendChild(el('div', 'muted small', 'Ничего не найдено'));
    };
    inp.oninput = () => { draw().catch(e => toast(e.message, 'err')); };
    draw().catch(e => toast(e.message, 'err'));
  }

  function allPagesFlat() {
    const out = [];
    (state.tree || []).forEach(nb => (nb.pages || []).forEach(p => out.push({ id: p.id, title: p.title })));
    return out;
  }

  function markDirty() {
    if (!state.edit) return;
    state.dirty = true;
    setSave('Сохраняется…', 'wait');
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => saveNow(false), 1200);
  }
  function setSave(txt, cls) { const st = $('#saveState'); if (!st) return; st.textContent = txt; st.className = cls || ''; }

  function collectBody() {
    const body = $('#docBody');
    const blocks = [];
    const kids = Array.from(body.childNodes);
    for (const row0 of kids) {
      // голый текст прямо в редакторе (набор без обёртки) — это абзац
      if (row0.nodeType === 3) {
        const t = row0.nodeValue.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
        t.split('\n').map(x => x.trim()).filter(Boolean).forEach(x => blocks.push({ t: 'p', text: x }));
        continue;
      }
      if (row0.nodeType !== 1) continue;
      const row = row0;
      // блоки-обёртки
      const inner = (row.children.length === 1 && row.children[0].tagName && ['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'UL', 'OL'].includes(row.children[0].tagName) && !row.classList.contains('chk')) ? row.children[0] : row;
      const tag = inner.tagName;
      if (tag === 'P' || tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'BLOCKQUOTE' || tag === 'PRE') {
        const t = tag === 'P' ? 'p' : (tag === 'H1' ? 'h1' : (tag === 'H2' ? 'h2' : (tag === 'H3' ? 'h3' : (tag === 'BLOCKQUOTE' ? 'quote' : 'code'))));
        if (tag === 'PRE') { blocks.push({ t: 'code', text: inner.innerText.replace(/\s+$/, '') }); continue; }
        const txt = domToInline(inner).replace(/\n+/g, '\n').replace(/^\n+|\n+$/g, '');
        const parts = txt.split('\n');
        parts.forEach(part => blocks.push({ t, text: part }));
        continue;
      }
      if (tag === 'UL' || tag === 'OL') {
        const items = Array.from(inner.children).map(li => domToInline(li).replace(/\n+/g, ' '));
        blocks.push({ t: tag === 'UL' ? 'ul' : 'ol', items });
        continue;
      }
      if (row.classList.contains('chk')) {
        const span = row.querySelector('span');
        const cb = row.querySelector('input');
        blocks.push({ t: 'check', text: span ? domToInline(span) : '', done: cb && cb.checked ? 1 : 0 });
        continue;
      }
      if (row.classList.contains('imgblock')) {
        const img = row.querySelector('img');
        const cap = row.querySelector('figcaption');
        const id = img ? (img.src.match(/\/files\/([^?]+)/) || [])[1] : '';
        if (id) blocks.push({ t: 'img', id, caption: cap ? cap.textContent.trim() : '' });
        continue;
      }
      if (row.classList.contains('fileblock')) {
        const a = row.querySelector('a[href*="/files/"]');
        const id = a ? (a.getAttribute('href').match(/\/files\/([^?]+)/) || [])[1] : '';
        const f = state.files.find(x => x.id === id);
        if (id) blocks.push({ t: 'file', id, name: f ? f.name : '', size: f ? f.size : 0, mime: f ? f.mime : '' });
        continue;
      }
      if (row.querySelector('table')) {
        const tbl = row.querySelector('table');
        const rows = Array.from(tbl.rows).map(r => Array.from(r.cells).map(c => domToInline(c).replace(/\n+/g, ' ')));
        blocks.push({ t: 'table', rows });
        continue;
      }
      if (row.classList.contains('pagelink')) {
        blocks.push({ t: 'pagelink', id: '', title: row.textContent.replace(/^→\s*/, '') });
        continue;
      }
      if (tag === 'HR' || (row.children.length === 1 && row.children[0].tagName === 'HR')) { blocks.push({ t: 'hr' }); continue; }
      if (tag === 'DIV' || tag === 'FIGURE') {
        const txt = domToInline(row).replace(/\u00a0/g, ' ');
        txt.split('\n').forEach(part => { const s = part.trim(); if (s) blocks.push({ t: 'p', text: s }); });
      }
    }
    return blocks.filter(b => true);
  }

  function collectFields() {
    const f = {};
    $$('#placeWrap [data-field]').forEach(n => { f[n.dataset.field] = n.textContent.trim(); });
    return f;
  }

  async function saveNow(silent) {
    if (!state.page) return;
    clearTimeout(state.saveTimer);
    const id = state.page.id;
    const payload = {
      rev: state.rev,
      title: ($('#pageTitle').textContent || '').trim(),
      body: state.edit ? collectBody() : undefined,
      fields: state.edit ? collectFields() : undefined
    };
    Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
    state.saving = true;
    setSave('Сохраняется…', 'wait');
    try {
      const d = await api('/pages/' + id, { method: 'PATCH', body: JSON.stringify(payload) });
      state.rev = d.rev; state.dirty = false;
      state.page.title = payload.title;
      localStorage.removeItem('mynote-draft:' + id);
      setSave('Сохранено', 'ok');
      await loadTree();
      const cur = (state.tree || []).find(nb => (nb.pages || []).some(p => p.id === id));
      if (cur) {
        const item = cur.pages.find(p => p.id === id);
        if (item) {
          const sel = document.querySelector('.tree .line.on');
          if (sel) sel.querySelector('.ttl').textContent = item.title;
        }
      }
    } catch (e) {
      if (e.status === 409 && e.data && e.data.conflict) {
        state.dirty = true;
        setSave('Конфликт версий', 'err');
        conflictDialog(e.data);
      } else {
        state.dirty = true;
        saveDraft();
        setSave(navigator.onLine === false ? 'Нет сети — ожидает отправки' : 'Ошибка сохранения', 'err');
        if (!silent) toast(e.message, 'err');
      }
    } finally { state.saving = false; }
  }

  function saveDraft() {
    if (!state.page) return;
    try {
      localStorage.setItem('mynote-draft:' + state.page.id, JSON.stringify({
        t: Date.now(), title: ($('#pageTitle').textContent || ''), body: state.edit ? collectBody() : [], fields: state.edit ? collectFields() : {}, rev: state.rev
      }));
    } catch { /* переполнение — не критично */ }
  }

  function conflictDialog(data) {
    const box = el('div');
    box.appendChild(el('p', null, 'Кто-то сохранил свою версию этой страницы раньше вас. Ваши правки не отправлены.'));
    box.appendChild(el('p', 'small muted', 'Серверная версия: изменена ' + fmtDate(data.server && data.server.updated_at) + ', ревизия ' + (data.server && data.server.rev)));
    box.appendChild(el('p', 'small muted', 'Ничего не потеряется: можно сохранить свою версию отдельной копией и разобраться спокойно.'));
    modal('Страница изменена кем-то ещё', box, [
      btn('Сохранить мою как копию', 'primary', async () => {
        const d = await api('/pages', { method: 'POST', body: JSON.stringify({ notebookId: state.page.notebookId, parentId: state.page.parentId, title: ($('#pageTitle').textContent || 'Копия') + ' (моя версия)', body: collectBody(), fields: collectFields() }) });
        await loadTree(); document.querySelectorAll('.overlay').forEach(o => o.remove());
        toast('Ваша версия сохранена отдельной страницей', 'ok');
        openPage(d.id);
      }),
      btn('Открыть серверную версию', '', async () => {
        document.querySelectorAll('.overlay').forEach(o => o.remove());
        state.dirty = false; localStorage.removeItem('mynote-draft:' + state.page.id);
        await openPage(state.page.id);
        toast('Показана серверная версия. Ваш черновик остался в браузере.', 'ok');
      })
    ]);
  }

  /* ---------------- режим правки ---------------- */

  let editSnapshot = null;
  function toggleEdit(force) {
    if (!state.page) return;
    const d = { notebook: { role: currentRole() } };
    const want = force != null ? force : !state.edit;
    if (want && currentRole() === 'viewer') { toast('У вас доступ только на чтение', 'err'); return; }
    state.edit = want;
    if (want) {
      editSnapshot = { title: $('#pageTitle').textContent, body: state.page.body, fields: state.page.fields };
      renderBody({ notebook: d.notebook, path: state.path });
      $('#pageTitle').contentEditable = 'true';
      $('#pageTitle').oninput = markDirty;
      $('#docBody').oninput = markDirty;
      $('#docBody').addEventListener('paste', onPaste);
      $('#docBody').focus();
    } else {
      $('#pageTitle').contentEditable = 'false';
      $('#pageTitle').oninput = null;
      $('#docBody').oninput = null;
      $('#docBody').removeEventListener('paste', onPaste);
      if (state.dirty) saveNow(false);
      renderBody({ notebook: d.notebook, path: state.path });
    }
    updateEditUi();
  }

  function currentRole() {
    const nb = (state.tree || []).find(n => (n.pages || []).some(p => state.page && p.id === state.page.id));
    if (nb) return nb.role;
    return state.page && state.page.role ? state.page.role : 'viewer';
  }

  function updateEditUi() {
    const b = $('#btnEdit');
    b.textContent = state.edit ? 'Готово' : 'Редактировать';
    b.classList.toggle('primary', state.edit);
    const tb = $('#toolbar'); if (tb) tb.classList.toggle('on', !!state.edit);
    $('#btnMobileEdit').textContent = state.edit ? '✓' : '✎';
  }

  function onPaste(ev) {
    const dt = ev.clipboardData; if (!dt) return;
    const files = dt.files && dt.files.length ? Array.from(dt.files) : [];
    if (files.length) {
      ev.preventDefault();
      files.forEach(f => uploadBlob(f));
      return;
    }
    const text = dt.getData('text/plain');
    if (text) { ev.preventDefault(); document.execCommand('insertText', false, text); markDirty(); }
  }

  async function uploadBlob(file) {
    const kind = /^image\//.test(file.type) ? 'photo' : 'file';
    const fd = new FormData(); fd.append('file', file); fd.append('pageId', state.page.id); fd.append('kind', kind);
    const st = $('#saveState'); if (st) { st.textContent = 'Загружается…'; st.className = 'wait'; }
    try {
      const d = await api('/files', { method: 'POST', body: fd });
      state.files.push(d.file);
      const body = $('#docBody');
      if (kind === 'photo') {
        const fig = el('figure', 'imgblock'); const img = el('img'); img.src = API + '/files/' + d.file.id + '?t=' + encodeURIComponent(state.token);
        fig.appendChild(img); const cap = el('figcaption'); cap.contentEditable = 'true'; cap.dataset.captionOf = d.file.id;
        fig.appendChild(cap); fig.appendChild(blockTools(() => fig.remove())); body.appendChild(fig);
      } else {
        const box = el('div', 'fileblock'); box.appendChild(el('span', null, '📎')); box.appendChild(el('span', 'fname', d.file.name));
        const a = el('a', 'btn sm', 'Скачать'); a.href = API + '/files/' + d.file.id + '?dl=1&t=' + encodeURIComponent(state.token);
        box.appendChild(a); box.appendChild(blockTools(() => box.remove())); body.appendChild(box);
      }
      setSave('Сохранено', 'ok'); markDirty();
    } catch (e) { toast(e.message, 'err'); setSave('Ошибка загрузки', 'err'); }
  }

  /* ---------------- перемещение ---------------- */

  function moveDialog(nb, p) {
    const box = el('div');
    const nbSel = el('select');
    (state.tree || []).forEach(n => {
      if (!(n.role === 'owner' || n.role === 'editor')) return;
      const o = el('option', null, n.title); o.value = n.id; if (n.id === nb.id) o.selected = true; nbSel.appendChild(o);
    });
    const parSel = el('select');
    const fill = () => {
      parSel.innerHTML = '';
      const target = (state.tree || []).find(n => n.id === nbSel.value);
      const o0 = el('option', null, '— верхний уровень —'); o0.value = ''; parSel.appendChild(o0);
      const walk = (parentId, depth) => (target.pages || []).filter(x => (x.parentId || '') === parentId).sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach(x => {
        if (x.id === p.id) return;
        const o = el('option', null, '— '.repeat(depth) + (x.title || 'Без названия')); o.value = x.id; parSel.appendChild(o);
        walk(x.id, depth + 1);
      });
      walk('', 0);
    };
    fill();
    nbSel.onchange = fill;
    box.appendChild(el('div', 'small muted', 'В какой блокнот и к какому родителю перенести страницу «' + (p.title || '') + '»:'));
    const l1 = el('label', 'field'); l1.appendChild(el('span', null, 'Блокнот')); l1.appendChild(nbSel);
    const l2 = el('label', 'field'); l2.appendChild(el('span', null, 'Родительская страница')); l2.appendChild(parSel);
    box.appendChild(l1); box.appendChild(l2);
    const fromNb = nb;
    const toMode = () => {
      const t = state.tree.find(n => n.id === nbSel.value);
      return t ? t.mode : 'private';
    };
    box.appendChild(el('p', 'small muted', 'После переноса доступ определяется целевым блокнотом: «' + (fromNb.mode === 'private' ? 'личный' : fromNb.mode === 'link' ? 'по ссылке' : 'совместный') + '» → «' + (toMode() === 'private' ? 'личный' : toMode() === 'link' ? 'по ссылке' : 'совместный') + '».'));
    modal('Переместить страницу', box, [
      btn('Перенести', 'primary', async () => {
        await api('/move/' + p.id, { method: 'POST', body: JSON.stringify({ notebookId: nbSel.value, parentId: parSel.value, sort: 1000 }) });
        await loadTree(); document.querySelectorAll('.overlay').forEach(o => o.remove());
        toast('Перенесено', 'ok');
        if (state.page && state.page.id === p.id) openPage(p.id);
      })
    ]);
  }

  /* ---------------- доступ и ссылки ---------------- */

  async function shareDialog(nb) {
    const box = el('div');
    const m = modal('Доступ к блокноту «' + nb.title + '»', box, [], true);
    const draw = async () => {
      box.innerHTML = '';
      const d = await api('/share/' + nb.id);
      box.appendChild(el('h4', 'section-title', 'Режим блокнота'));
      const modes = [
        ['private', 'Личный', 'Только вы после входа.'],
        ['link', 'Просмотр по ссылке', 'Кто угодно по непредсказуемой ссылке (её можно отозвать).'],
        ['shared', 'Совместный', 'Приглашённые пользователи с ролями «Читатель» или «Редактор».']
      ];
      modes.forEach(([val, t, sub]) => {
        const row = el('label', 'row');
        row.style.cssText = 'align-items:flex-start;margin:8px 0;cursor:pointer';
        const r = el('input'); r.type = 'radio'; r.name = 'nbmode'; r.value = val; r.checked = nb.mode === val; r.style.cssText = 'width:auto;margin-top:3px';
        r.onchange = async () => { await api('/notebooks/' + nb.id, { method: 'PATCH', body: JSON.stringify({ mode: val }) }); nb.mode = val; await loadTree(); draw(); };
        const col = el('div'); col.appendChild(el('div', null, t)); col.appendChild(el('div', 'small muted', sub));
        row.appendChild(r); row.appendChild(col); box.appendChild(row);
      });

      box.appendChild(el('h4', 'section-title', 'Ссылка для чтения'));
      if (d.link) {
        const u = location.origin + '/mynote/#/l/' + d.link;
        const row = el('div', 'row');
        const inp = el('input'); inp.type = 'text'; inp.value = u; inp.readOnly = true;
        row.appendChild(inp);
        row.appendChild(btn('Скопировать', 'sm', async () => { try { await navigator.clipboard.writeText(u); toast('Ссылка скопирована', 'ok'); } catch { inp.select(); document.execCommand('copy'); toast('Скопировано', 'ok'); } }));
        row.appendChild(btn('Отозвать', 'sm danger', async () => { await api('/link/' + nb.id, { method: 'DELETE' }); toast('Ссылка отозвана', 'ok'); draw(); }));
        box.appendChild(row);
        box.appendChild(el('p', 'small muted', 'Роль по ссылке: ' + (d.link_role === 'editor' ? 'редактор' : 'только чтение') + '. Отзыв действует и для вложений.'));
      } else {
        box.appendChild(btn('Создать ссылку', 'sm', async () => { await api('/link/' + nb.id, { method: 'POST', body: JSON.stringify({ role: 'viewer' }) }); draw(); }));
      }

      box.appendChild(el('h4', 'section-title', 'Участники'));
      const ul = el('ul', 'items');
      (d.acl || []).forEach(a => {
        const li = el('li');
        li.appendChild(el('span', 'grow trunc', (a.name || a.email) + ' — ' + (a.role === 'editor' ? 'Редактор' : 'Читатель')));
        const sel = el('select'); sel.style.cssText = 'width:auto';
        ['viewer', 'editor'].forEach(r => { const o = el('option', null, r === 'editor' ? 'Редактор' : 'Читатель'); o.value = r; if (a.role === r) o.selected = true; sel.appendChild(o); });
        sel.onchange = async () => { await api('/share/' + nb.id, { method: 'POST', body: JSON.stringify({ email: a.email, role: sel.value }) }); toast('Роль обновлена', 'ok'); draw(); };
        li.appendChild(sel);
        li.appendChild(btn('Убрать', 'sm danger', async () => { await api('/share/' + nb.id + '?user=' + encodeURIComponent(a.user_id), { method: 'DELETE' }); toast('Доступ отозван', 'ok'); draw(); }));
        ul.appendChild(li);
      });
      (d.invited || []).forEach(i => {
        const li = el('li');
        li.appendChild(el('span', 'grow trunc', i.email + ' — приглашение (' + (i.role === 'editor' ? 'редактор' : 'чтение') + '), аккаунта пока нет'));
        li.appendChild(btn('Убрать', 'sm danger', async () => { await api('/share/' + nb.id + '?email=' + encodeURIComponent(i.email), { method: 'DELETE' }); draw(); }));
        ul.appendChild(li);
      });
      if (!(d.acl || []).length && !(d.invited || []).length) ul.appendChild(el('li', 'muted small', 'Пока никого.'));
      box.appendChild(ul);

      const add = el('div', 'row');
      const em = el('input'); em.type = 'email'; em.placeholder = 'e-mail участника';
      const rl = el('select'); rl.style.cssText = 'width:auto';
      ['viewer', 'editor'].forEach(r => { const o = el('option', null, r === 'editor' ? 'Редактор' : 'Читатель'); o.value = r; rl.appendChild(o); });
      add.appendChild(em); add.appendChild(rl);
      add.appendChild(btn('Добавить', 'sm primary', async () => {
        if (!em.value.trim()) return;
        const res = await api('/share/' + nb.id, { method: 'POST', body: JSON.stringify({ email: em.value.trim(), role: rl.value }) });
        toast(res.attached ? 'Доступ выдан' : 'Приглашение сохранено (сообщения людям не отправляются)', 'ok');
        draw();
      }));
      box.appendChild(add);
      box.appendChild(el('p', 'small muted', 'Права наследуются вниз по дереву. Владелец может закрыть отдельную страницу — она и её потомки не видны остальным.'));
    };
    try { await draw(); } catch (e) { toast(e.message, 'err'); }
    void m;
  }

  function versionsDialog(p) {
    const box = el('div');
    const m = modal('История версий: ' + (p.title || 'Без названия'), box, [], true);
    const draw = async () => {
      const d = await api('/versions/' + p.id);
      box.innerHTML = '';
      const ul = el('ul', 'items');
      (d.versions || []).forEach(v => {
        const li = el('li');
        li.appendChild(el('span', 'grow trunc', fmtDate(v.created_at) + ' · ' + (v.author_name || '—') + ' · ревизия ' + v.rev + (v.note ? ' (' + v.note + ')' : '')));
        li.appendChild(btn('Посмотреть', 'sm', async () => {
          const one = await api('/versions/' + p.id + '/' + v.id);
          const prev = el('div');
          prev.appendChild(el('div', 'small muted', 'Заголовок: ' + (one.version.title || '')));
          const body = el('div');
          parseBlocks(one.version.body).forEach(b => {
            const n = blockNode(b, false, { notebook: { role: 'viewer' } });
            body.appendChild(n);
          });
          body.style.cssText = 'max-height:40vh;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:8px';
          prev.appendChild(body);
          const cur = $('#modals .overlay:last-child .modal .body');
          modal('Версия от ' + fmtDate(v.created_at), prev, [btn('Восстановить эту версию', 'primary', async () => {
            await api('/versions/' + p.id + '/' + v.id + '/restore', { method: 'POST' });
            document.querySelectorAll('.overlay').forEach(o => o.remove());
            toast('Версия восстановлена (текущая сохранена в истории)', 'ok');
            openPage(p.id);
          })], true);
          void cur;
        }));
        ul.appendChild(li);
      });
      if (!(d.versions || []).length) ul.appendChild(el('li', 'muted small', 'История пуста.'));
      box.appendChild(ul);
    };
    draw().catch(e => toast(e.message, 'err'));
    void m;
  }

  async function exportNotebook(nb) {
    try {
      toast('Собираю архив…');
      const res = await fetch(API + '/export/' + nb.id, { headers: { Authorization: 'Bearer ' + state.token } });
      if (!res.ok) throw new Error('Не удалось собрать архив');
      const blob = await res.blob();
      const a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'mynote-' + (nb.title || 'notebook') + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      toast('Архив скачан', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ---------------- прочие экраны ---------------- */

  async function showFavorites() {
    state.view = 'favorites';
    const d = await api('/favorites');
    const box = el('div');
    const ul = el('ul', 'items');
    (d.favorites || []).forEach(f => {
      const li = el('li');
      const b = el('button', 'btn sm', f.title || 'Без названия'); b.type = 'button';
      b.onclick = () => openPage(f.id);
      li.appendChild(b); li.appendChild(el('span', 'small muted grow', f.notebook)); ul.appendChild(li);
    });
    if (!(d.favorites || []).length) ul.appendChild(el('li', 'muted small', 'Пока ничего не отмечено.'));
    box.appendChild(ul);
    modal('Избранное', box, [], true);
  }

  async function showTrash() {
    const d = await api('/trash');
    const box = el('div');
    const ul = el('ul', 'items');
    (d.pages || []).forEach(p => {
      const li = el('li');
      li.appendChild(el('span', 'grow trunc', (p.title || 'Без названия') + ' · ' + fmtDate(p.deleted_at)));
      li.appendChild(btn('Восстановить', 'sm', async () => {
        await api('/restore/' + p.id, { method: 'POST' });
        await loadTree(); document.querySelectorAll('.overlay').forEach(o => o.remove());
        toast('Восстановлено', 'ok');
      }));
      ul.appendChild(li);
    });
    if (!(d.pages || []).length) ul.appendChild(el('li', 'muted small', 'Корзина пуста.'));
    box.appendChild(ul);
    modal('Корзина', box, [], true);
  }

  function showAbout() {
    const box = el('div');
    const kv = el('div', 'kv');
    [['Приложение', 'MyNote'], ['Версия', APP_VER], ['Хранение', 'серверное (D1 + файловое хранилище)'], ['Данные', 'доступ проверяется на сервере для каждой операции']].forEach(([k, v]) => {
      kv.appendChild(el('div', 'muted', k)); kv.appendChild(el('div', null, v));
    });
    box.appendChild(kv);
    box.appendChild(el('p', 'small muted', 'MyNote — личный блокнот: блокноты, вложенные страницы, места для поездок. Совместное одновременное редактирование одного текста пока не реализовано: при конфликте сохраняются обе редакции.'));
    modal('О программе', box, [btn('Сменить пароль', 'sm', () => passwordDialog())]);
  }

  function passwordDialog() {
    const box = el('div');
    const a = el('input'); a.type = 'password'; a.placeholder = 'текущий пароль';
    const b = el('input'); b.type = 'password'; b.placeholder = 'новый пароль (от 6 символов)';
    const l1 = el('label', 'field'); l1.appendChild(el('span', null, 'Текущий пароль')); l1.appendChild(a);
    const l2 = el('label', 'field'); l2.appendChild(el('span', null, 'Новый пароль')); l2.appendChild(b);
    box.appendChild(l1); box.appendChild(l2);
    box.appendChild(el('p', 'small muted', 'После смены пароля все сеансы сбрасываются — нужно войти заново.'));
    modal('Смена пароля', box, [btn('Сохранить', 'primary', async () => {
      await api('/auth/password', { method: 'POST', body: JSON.stringify({ current: a.value, password: b.value }) });
      document.querySelectorAll('.overlay').forEach(o => o.remove());
      toast('Пароль изменён, войдите заново', 'ok');
      signOut(true);
    })]);
  }

  function newPageDialog(nb, presetParent) {
    const box = el('div');
    const t = el('input'); t.type = 'text'; t.value = ''; t.placeholder = 'Например: Императорский дворец';
    const l = el('label', 'field'); l.appendChild(el('span', null, 'Название')); l.appendChild(t);
    const kinds = el('div', 'row');
    let kind = 'page';
    const mkKind = (val, label, hint) => {
      const b = el('button', 'btn sm' + (val === kind ? ' primary' : ''), label); b.type = 'button'; b.style.cssText = 'flex:1;flex-direction:column;align-items:flex-start;padding:8px 10px;height:auto';
      b.onclick = () => { kind = val; $$('.modal .body .row button').forEach(x => x.classList.remove('primary')); b.classList.add('primary'); };
      const col = el('div'); col.appendChild(el('div', null, label)); col.appendChild(el('div', 'small muted', hint));
      b.textContent = ''; b.appendChild(col);
      return b;
    };
    kinds.appendChild(mkKind('page', 'Обычная страница', 'свободный текст, списки, фото'));
    kinds.appendChild(mkKind('place', 'Место', 'адрес, карта, история, заметки'));
    box.appendChild(l); box.appendChild(el('div', 'small muted', 'Что создать:')); box.appendChild(kinds);
    const parentNote = el('p', 'small muted');
    const pagesIn = nb.pages || [];
    let parentId = presetParent || ((state.page && pagesIn.some(p => p.id === state.page.id)) ? state.page.id : '');
    const refreshParentNote = () => {
      const pp = pagesIn.find(p => p.id === parentId);
      parentNote.textContent = pp ? ('Будет вложена в «' + (pp.title || 'Без названия') + '».') : ('Будет на верхнем уровне блокнота «' + nb.title + '».');
    };
    refreshParentNote();
    const parSel = el('select');
    const o0 = el('option', null, '— верхний уровень —'); o0.value = ''; parSel.appendChild(o0);
    const walk = (pid, depth) => pagesIn.filter(x => (x.parentId || '') === pid).sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach(x => {
      const o = el('option', null, '— '.repeat(depth) + (x.title || 'Без названия')); o.value = x.id; parSel.appendChild(o); walk(x.id, depth + 1);
    });
    walk('', 0);
    parSel.value = parentId;
    parSel.onchange = () => { parentId = parSel.value; refreshParentNote(); };
    const lp = el('label', 'field'); lp.appendChild(el('span', null, 'Внутри страницы')); lp.appendChild(parSel);
    box.appendChild(lp); box.appendChild(parentNote);
    const m = modal('Новая страница', box, [btn('Создать', 'primary', async () => {
      const d = await api('/pages', { method: 'POST', body: JSON.stringify({ notebookId: nb.id, parentId, title: t.value.trim() || (kind === 'place' ? 'Новое место' : 'Новая страница'), kind }) });
      m.close(); await loadTree(); state.open.add(nb.id); saveOpen(); renderTree(); openPage(d.id);
    })]);
    setTimeout(() => t.focus(), 60);
    t.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const ok = $('#dlgOk'); if (ok) ok.click(); } };
  }

  function userMenu() {
    const box = el('div');
    const ul = el('ul', 'items');
    const mk = (label, fn, cls) => { const li = el('li'); const b = el('button', 'btn sm ' + (cls || ''), label); b.type = 'button'; b.onclick = async () => { await fn(); }; li.appendChild(b); ul.appendChild(li); };
    if (!state.openLogin) {
      mk('Сменить пароль', () => { document.querySelectorAll('.overlay').forEach(o => o.remove()); passwordDialog(); });
      mk('Выйти', async () => { document.querySelectorAll('.overlay').forEach(o => o.remove()); signOut(false); }, 'danger');
    }
    box.appendChild(ul);
    const m = modal('Аккаунт', box, []);
    box.insertBefore(el('div', 'small muted', state.user ? state.user.email : ''), ul);
    void m;
  }

  /* ---------------- ссылка «просмотр по ссылке» ---------------- */

  async function openLink(token) {
    const d = await api('/pub/' + token);
    $('#auth').style.display = 'none';
    $('#app').classList.add('on');
    $('#userName').textContent = 'Гость (по ссылке)';
    $('#ava').textContent = 'Г';
    $('#sidebar').classList.remove('open');
    $('#tree').innerHTML = '';
    const li = el('li', 'node');
    li.appendChild(el('div', 'line', 'Блокнот: ' + (d.notebook.title || '')));
    const ul = el('ul', 'kids');
    (d.pages || []).forEach(p => {
      const i2 = el('li'); const line = el('div', 'line'); line.appendChild(el('span', 'ttl', p.title || 'Без названия'));
      line.onclick = async () => {
        const pd = await api('/pub/' + token + '/' + p.id);
        const fake = { id: pd.page.id, notebookId: d.notebook.id, parentId: pd.page.parentId, title: pd.page.title, kind: pd.page.kind, body: pd.page.body, fields: pd.page.fields, cover: pd.page.cover, rev: 0, updated: pd.page.updated };
        state.page = fake; state.path = [{ id: p.id, title: p.title }]; state.files = []; state.edit = false;
        $('#emptyState').classList.add('hidden'); $('#pageView').classList.remove('hidden');
        $('#crumbs').innerHTML = ''; $('#crumbs').appendChild(el('span', 'c cur', p.title));
        $('#accessPill').className = 'pill link'; $('#accessPill').textContent = 'Доступ по ссылке';
        $('#pageTitle').textContent = p.title; $('#docMeta').textContent = 'Только чтение';
        renderCover(fake);
        const wrap = $('#placeWrap'); wrap.innerHTML = '';
        const grid = el('div', fake.kind === 'place' ? 'place-grid' : '');
        const col = el('div'); const body = el('div'); body.id = 'docBody'; body.contentEditable = 'false'; col.appendChild(body); grid.appendChild(col);
        parseBlocks(fake.body).forEach(b => body.appendChild(blockNode(b, false, { notebook: { role: 'viewer' } })));
        if (fake.kind === 'place') { const sd = sideColumn({ notebook: { role: 'viewer' } }); grid.appendChild(sd); }
        wrap.appendChild(grid);
      };
      i2.appendChild(line); ul.appendChild(i2);
    });
    li.appendChild(ul);
    $('#tree').appendChild(li);
    $('#btnEdit').classList.add('hidden'); $('#btnShare').classList.add('hidden');
    document.querySelectorAll('.sb-actions').forEach(n => n.classList.add('hidden'));
  }

  /* ---------------- маршрутизация и старт ---------------- */

  async function route() {
    const h = location.hash || '';
    const m = /^#\/l\/(.+)$/.exec(h);
    if (m) { try { await openLink(m[1]); } catch (e) { showAuth('Ссылка недействительна: ' + e.message); } return; }
    if (!state.page) renderPageEmpty();
  }

  function bind() {
    $('#tabLogin').onclick = () => setAuthMode(false);
    $('#tabReg').onclick = () => setAuthMode(true);
    $('#authForm').onsubmit = submitAuth;
    $('#btnCollapse').onclick = () => { $('#sidebar').classList.toggle('collapsed'); localStorage.setItem('mynote-collapsed', $('#sidebar').classList.contains('collapsed') ? '1' : ''); };
    $('#btnMenu').onclick = () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('on'); };
    $('#scrim').onclick = () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('on'); };
    $('#btnEdit').onclick = () => toggleEdit();
    $('#btnMobileEdit').onclick = () => toggleEdit();
    $('#btnShare').onclick = () => { const nb = (state.tree || []).find(n => (n.pages || []).some(p => state.page && p.id === state.page.id)); if (nb) shareDialog(nb); };
    $('#btnMobileShare').onclick = () => $('#btnShare').click();
    $('#btnMore').onclick = () => {
      const nb = (state.tree || []).find(n => (n.pages || []).some(p => state.page && p.id === state.page.id));
      if (!state.page || !nb) return;
      const p = (nb.pages || []).find(x => x.id === state.page.id);
      pageMenu(nb, p || { id: state.page.id, title: state.page.title, fav: state.page.fav, closed: state.page.closed });
    };
    $('#btnUser').onclick = userMenu;
    $('#navFav').onclick = () => showFavorites().catch(e => toast(e.message, 'err'));
    $('#navTrash').onclick = () => showTrash().catch(e => toast(e.message, 'err'));
    $('#navAbout').onclick = showAbout;
    $('#btnNewNotebook').onclick = async () => {
      const box = el('div');
      const t = el('input'); t.type = 'text'; t.value = 'Новый блокнот';
      const l = el('label', 'field'); l.appendChild(el('span', null, 'Название')); l.appendChild(t);
      box.appendChild(l);
      box.appendChild(el('p', 'small muted', 'Блокнот — независимое пространство: личный, по ссылке или совместный.'));
      const m = modal('Новый блокнот', box, [btn('Создать', 'primary', async () => {
        const d = await api('/notebooks', { method: 'POST', body: JSON.stringify({ title: t.value.trim() || 'Новый блокнот' }) });
        m.close(); await loadTree(); state.open.add(d.id); saveOpen(); renderTree();
        toast('Блокнот создан', 'ok');
      })]);
      setTimeout(() => { t.focus(); t.select(); }, 60);
      t.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const ok = $('#dlgOk'); if (ok) ok.click(); } };
    };
    $('#btnNewPage').onclick = async () => {
      const nb = (state.tree || []).find(n => n.role === 'owner' || n.role === 'editor') || (state.tree || [])[0];
      if (!nb) { toast('Сначала создайте блокнот', 'err'); return; }
      newPageDialog(nb);
    };
    $('#searchInp').oninput = (e) => { state.filter = e.target.value.trim(); renderTree(); };
    $('#searchInp').onkeydown = async (e) => {
      if (e.key !== 'Enter') return;
      const q = e.target.value.trim(); if (!q) return;
      const d = await api('/search?q=' + encodeURIComponent(q));
      const box = el('div');
      const ul = el('ul', 'items');
      (d.hits || []).forEach(h => {
        const li = el('li');
        const b = el('button', 'btn sm', h.title || 'Без названия'); b.type = 'button'; b.onclick = () => { document.querySelectorAll('.overlay').forEach(o => o.remove()); openPage(h.id); };
        li.appendChild(b);
        const col = el('div', 'grow');
        col.appendChild(el('div', 'small muted', h.notebook + ' · ' + fmtDate(h.updated)));
        col.appendChild(el('div', 'small', h.snippet || ''));
        li.appendChild(col); ul.appendChild(li);
      });
      if (!(d.hits || []).length) ul.appendChild(el('li', 'muted small', 'Ничего не найдено.'));
      box.appendChild(ul);
      modal('Поиск: ' + q, box, [], true);
    };
    window.addEventListener('online', () => { if (state.dirty) saveNow(true); });
    window.addEventListener('beforeunload', (e) => { if (state.dirty) { saveDraft(); e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('hashchange', () => route());
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (state.edit) saveNow(false); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); toggleEdit(); }
      if (e.key === 'Escape') { const ov = document.querySelectorAll('.overlay'); if (ov.length) ov[ov.length - 1].remove(); }
    });
    if (localStorage.getItem('mynote-collapsed')) $('#sidebar').classList.add('collapsed');
  }

  async function boot() {
    bind();
    if (location.hash.startsWith('#/l/')) { await route(); return; }
    if (!state.token && !(await openAccess())) { showAuth(); return; }
    try {
      const d = await api('/me');
      state.user = d.user;
      showApp();
      await loadTree();
      await route();
      if (location.hash.startsWith('#/l/')) return;
      if (!state.page) {
        let last = null;
        try { last = JSON.parse(localStorage.getItem('mynote-last') || 'null'); } catch { last = null; }
        let openId = null, openNb = null;
        if (last && last.id) {
          const nb = (state.tree || []).find(n => (n.pages || []).some(x => x.id === last.id));
          if (nb) { openId = last.id; openNb = nb.id; }
        }
        if (!openId) {
          const first = (state.tree || []).find(nb => (nb.pages || []).length);
          if (first && first.pages.length) { const p = first.pages.find(x => !x.parentId) || first.pages[0]; openId = p.id; openNb = first.id; }
        }
        if (openId) { state.open.add(openNb); saveOpen(); openPage(openId, openNb); }
      }
    } catch (e) {
      if (e.status === 401) {
        localStorage.removeItem('mynote-token'); state.token = '';
        if (!state.retried) { state.retried = true; return boot(); }
        showAuth('Сеанс истёк — войдите заново'); return;
      }
      showAuth('Не удалось связаться с сервером: ' + e.message);
    }
  }

  window.__mn = { state: state, parseBlocks: parseBlocks, renderBody: renderBody, blockNode: blockNode, collectBody: collectBody, openPage: openPage, loadTree: loadTree, api: api };

  document.addEventListener('DOMContentLoaded', () => { boot().catch(e => console.error(e)); });
})();
