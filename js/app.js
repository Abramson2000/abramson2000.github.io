// app.js — логика интерфейса (v2, Supabase)
const DICT_LABELS = {
  manager: 'Менеджер',
  region: 'Регион',
  city: 'Город',
  sub: 'Суб / партнёр'
};

const state = { view: 'clinics', search: '', filters: { region: '', city: '', manager: '' }, moneySort: 'desc', moneySource: 'both', moneyYear: '', moneyFilter: 'all' };

// ---------- цвет выделения ----------
const ACCENT_OPTIONS = [
  { key: 'black',  label: 'Чёрный',     color: '#111111', dark: '#000000' },
  { key: 'blue',   label: 'Синий',      color: '#2563eb', dark: '#1d4ed8' },
  { key: 'red',    label: 'Красный',    color: '#dc2626', dark: '#b91c1c' },
  { key: 'green',  label: 'Зелёный',    color: '#16a34a', dark: '#15803d' },
  { key: 'purple', label: 'Фиолетовый', color: '#7c3aed', dark: '#6d28d9' },
  { key: 'orange', label: 'Оранжевый',  color: '#ea580c', dark: '#c2410c' }
];

function getAccent() {
  return localStorage.getItem('accent') || 'black';
}
function applyAccent() {
  const opt = ACCENT_OPTIONS.find(o => o.key === getAccent()) || ACCENT_OPTIONS[0];
  const r = document.documentElement.style;
  r.setProperty('--brand', opt.color);
  r.setProperty('--brand-dark', opt.dark);
}

// ---------- деньги ----------
const MONEY_YEARS = ['2021', '2022', '2023', '2024', '2025', '2026'];
const HUGEMED_YEARS = ['2025', '2026'];  // HugeMed продажи только с 2025
const YEAR_OPTIONS = MONEY_YEARS;
function curYear() { return String(new Date().getFullYear()); }
function moneyVal(c, year) {  // выбранный источник суммы: both | boston | hugemed
  if (state.moneySource === 'boston') return curYearSales(c, year);
  if (state.moneySource === 'hugemed') return curYearHM(c, year);
  return yearTotal(c, year);
}
function curYear() { return String(new Date().getFullYear()); }
function fmtMoney(n) {
  if (n == null || n === '') return '';
  const num = Number(n);
  if (!isFinite(num)) return '';
  return num.toLocaleString('ru-RU');
}
function curYearSales(c, year) {
  const y = year || state.moneyYear || curYear();
  const v = c['sales' + y];
  return (v == null || v === '') ? null : Number(v);
}
function curYearHM(c, year) {  // HugeMed
  const y = year || state.moneyYear || curYear();
  const v = c['hugemed' + y];
  return (v == null || v === '') ? null : Number(v);
}
function yearTotal(c, year) {  // Бостон + HugeMed
  const b = curYearSales(c, year), h = curYearHM(c, year);
  if (b == null && h == null) return null;
  return (b || 0) + (h || 0);
}

// ---------- счётчики записей на вкладках ----------
let tabCounts = {};
async function refreshCounts() {
  try {
    const [clinics, people] = await Promise.all([listClinics(), listPeople()]);
    tabCounts = {
      clinics: clinics.filter(c => (c.kind || 'hospital') === 'hospital').length,
      distributors: clinics.filter(c => c.kind === 'distributor').length,
      people: people.length,
      money: clinics.filter(c =>
        (c.kind || 'hospital') !== 'distributor' &&
        MONEY_YEARS.some(y => yearTotal(c, y) != null)
      ).length
    };
    paintCounts();
  } catch (_) {}
}
function paintCounts() {
  document.querySelectorAll('[data-cnt]').forEach(el => {
    const k = el.dataset.cnt;
    el.textContent = tabCounts[k] != null ? tabCounts[k] : '';
  });
}

// ---------- helpers ----------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2000);
}

// поверхностные ошибки — показываем тостом, чтобы видеть, что ломается
window.addEventListener('error', e => { try { toast('⚠️ ' + e.message); } catch(_){} });
window.addEventListener('unhandledrejection', e => {
  const r = e.reason || {};
  const m = r.message || r.error_description || r.error || String(r);
  try { toast('⚠️ ' + m); } catch(_){}
});

function tagsHtml(tags) {
  if (!tags || !tags.length) return '';
  return '<div class="row">' + tags.map(t => `<span class="tag">${esc(t)}</span>`).join('') + '</div>';
}

function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function datalistOptions(type) {
  const vals = await getDict(type);
  return vals.map(v => `<option value="${esc(v)}"></option>`).join('');
}

async function clinicSelectOptions(selectedId) {
  const clinics = await listClinics();
  return clinics
    .map(c => `<option value="${c.id}" ${String(c.id) === String(selectedId) ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('');
}

// ---------- auth ----------
let CURRENT_ROLE = null; // 'admin' | 'manager' | 'guest' | null

function showLogin() {
  document.body.classList.add('logged-out');
}
function showApp() {
  document.body.classList.remove('logged-out');
}

async function bootstrap() {
  if (!sb) {  // SDK не загрузился — понятное сообщение вместо краха
    toast('⚠️ Не удалось загрузить библиотеку Supabase. Обнови страницу.');
    showLogin();
    return;
  }
  // определяем роль текущего пользователя (таблица user_managers)
  CURRENT_ROLE = 'manager';
  let user = null;
  try {
    const { data: { user: u } } = await sb.auth.getUser();
    user = u;
  } catch (_) {}
  if (!user) { showLogin(); return; }  // нет валидной сессии — показываем экран входа
  try {
    const { data: am } = await sb.from('user_managers').select('*').eq('email', user.email).maybeSingle();
    if (am) CURRENT_ROLE = am.role;
  } catch (_) {}
  setPeopleSource(CURRENT_ROLE);
  const isGuest = CURRENT_ROLE === 'guest';
  const readOnly = isGuest || CURRENT_ROLE === 'viewer';
  document.getElementById('fab').classList.toggle('hidden', readOnly);
  // деньги — только для тех, у кого есть доступ (гость видит анализ, но не деньги)
  document.querySelectorAll('.money-tab').forEach(t => t.classList.toggle('hidden', isGuest));
  if (isGuest && state.view === 'money') state.view = 'clinics';
  showApp();
  applyAccent();
  document.getElementById('brandVersion').textContent = 'v78';
  document.getElementById('footerVersion').textContent = 'v78';
  updateFiltersUI();
  render();
  refreshCounts();
}

async function init() {
  applyAccent();
  // вход через Supabase: без сессии показываем экран логина
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showLogin(); return; }
  await bootstrap();
}

async function doLogin() {
  // простой логин: вводишь Abramson — приложение само добавит @crm.ru
  const raw = document.getElementById('loginEmail').value.trim();
  const email = (raw.includes('@') ? raw : raw + '@crm.ru').toLowerCase();
  const password = document.getElementById('loginPass').value;
  const err = document.getElementById('loginErr');
  if (!email || !password) { err.textContent = 'Введи email и пароль'; return; }
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Вход…'; err.textContent = '';
  try {
    await signIn(email, password);
    await bootstrap();
  } catch (e) {
    err.textContent = 'Неверный email или пароль';
  } finally {
    btn.disabled = false; btn.textContent = 'Войти';
  }
}

// кнопка входа + Enter
if (document.getElementById('loginBtn')) {
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('loginEmail').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

// авто-переключение при смене сессии
if (sb) {
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') { bootstrap(); }
    else if (event === 'SIGNED_OUT') { showLogin(); }
  });
} else {
  showLogin();
}

// ---------- navigation ----------
function setActiveTab(view) {
  document.querySelectorAll('.tab').forEach(b => {
    const v = b.dataset.view;
    b.classList.toggle('active', v === view || (v === 'analysis' && ['analysis', 'money', 'calls', 'visits'].includes(view)));
  });
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    let v = btn.dataset.view === 'back' ? 'clinics' : btn.dataset.view;
    if (v === 'money' && CURRENT_ROLE === 'guest') v = 'visits';  // без доступа к деньгам — сразу на Визиты
    state.view = v;
    setActiveTab(state.view);
    state.search = '';
    document.getElementById('globalSearch').value = '';
    updateFiltersUI();
    render();
  });
});

// ---------- фильтры ----------
async function updateFiltersUI() {
  const bar = document.getElementById('filters');
  const fab = document.getElementById('fab');
  const menuViews = ['analysis', 'calls', 'visits'];
  fab.classList.toggle('hidden', menuViews.includes(state.view));
  // мобильная нижняя плашка: в анализе своя (Деньги/Звонки/Визиты), в остальном — главная
  const inAnalysis = ['analysis', 'money', 'calls', 'visits'].includes(state.view);
  const mainBar = document.getElementById('tabbar-main');
  const anBar = document.getElementById('tabbar-analysis');
  if (mainBar) mainBar.classList.toggle('hidden', inAnalysis);
  if (anBar) anBar.classList.toggle('hidden', !inAnalysis);
  if (state.view === 'clinics' || state.view === 'distributors' || state.view === 'money') {
    bar.classList.remove('hidden');
    await populateFilters();
    document.getElementById('f_year').classList.toggle('hidden', state.view !== 'money');
  } else {
    bar.classList.add('hidden');
  }
}

async function populateFilters() {
  const [regions, cities, managers] = await Promise.all([
    getDict('region'), getDict('city'), getDict('manager')
  ]);
  fillSelect('f_region', regions, 'Регионы');
  fillSelect('f_city', cities, 'Города');
  fillSelect('f_manager', managers, 'Менеджеры');
  fillSelect('f_year', YEAR_OPTIONS, 'Годы');
}

function fillSelect(id, values, emptyLabel) {
  const sel = document.getElementById(id);
  const cur = sel.value;
  sel.innerHTML = `<option value="">${emptyLabel}</option>` +
    values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sel.value = cur;
}

['f_region', 'f_city', 'f_manager', 'f_year'].forEach(id => {
  document.getElementById(id).addEventListener('change', e => {
    if (id === 'f_year') { state.moneyYear = e.target.value; render(); return; }
    state.filters[id.replace('f_', '')] = e.target.value;
    render();
  });
});

document.getElementById('fab').addEventListener('click', async () => {
  if (CURRENT_ROLE === 'guest' || CURRENT_ROLE === 'viewer') return;
  try {
    if (state.view === 'clinics') await openClinicForm(null, 'hospital');
    else if (state.view === 'distributors') await openClinicForm(null, 'distributor');
    else if (state.view === 'money') await openClinicForm(null, 'hospital');
    else if (state.view === 'people') await openPersonForm();
    else if (state.view === 'analysis' || state.view === 'calls' || state.view === 'visits') return;
    else addDictPrompt();
  } catch (e) { toast('⚠️ ' + e.message); }
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

document.getElementById('globalSearch').addEventListener('input', e => {
  state.search = e.target.value.trim().toLowerCase();
  render();
});

// ---------- render ----------
async function render() {
  hideHover();
  setActiveTab(state.view);
  if (state.view === 'clinics') await renderOrgList('hospital');
  else if (state.view === 'distributors') await renderOrgList('distributor');
  else if (state.view === 'money') await renderMoney();
  else if (state.view === 'people') await renderPeople();
  else if (state.view === 'analysis') renderAnalysis();
  else if (state.view === 'calls') renderCalls();
  else if (state.view === 'visits') renderVisits();
  else await renderDicts();
}

// ---------- анализ: лист подразделов ----------
function renderAnalysis() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="analysis-sheet">
    <div class="sheet-item" data-goto="money">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>
      <span>Деньги</span>
    </div>
    <div class="sheet-item" data-goto="calls">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <span>Звонки</span>
    </div>
    <div class="sheet-item" data-goto="visits">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      <span>Визиты</span>
    </div>
    <div class="sheet-item sheet-back" data-goto="back">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
      <span>Контакты</span>
    </div>
  </div>`;
  view.querySelectorAll('.sheet-item').forEach(el => el.addEventListener('click', () => {
    const g = el.dataset.goto;
    state.view = g === 'back' ? 'clinics' : g;
    render();
  }));
}

function renderCalls() {
  document.getElementById('view').innerHTML = '<div class="empty">Звонков пока нет</div>';
}

function renderVisits() {
  document.getElementById('view').innerHTML = '<div class="empty">Визитов пока нет</div>';
}

async function renderOrgList(kind) {
  const view = document.getElementById('view');
  const emptyWord = kind === 'distributor' ? 'Дистрибьюторов' : 'Клиник';
  let clinics = await listClinics();
  clinics = clinics.filter(c => (c.kind || 'hospital') === kind);
  const s = state.search;
  const f = state.filters;
  clinics = clinics.filter(c =>
    (!s ||
      (c.name || '').toLowerCase().includes(s) ||
      (c.city || '').toLowerCase().includes(s) ||
      (c.region || '').toLowerCase().includes(s) ||
      (c.manager || '').toLowerCase().includes(s) ||
      (c.tags || []).some(t => t.toLowerCase().includes(s))) &&
    (!f.region || c.region === f.region) &&
    (!f.city || c.city === f.city) &&
    (!f.manager || c.manager === f.manager)
  );
  const active = s || f.type || f.region || f.city || f.manager;
  if (!clinics.length) {
    view.innerHTML = `<div class="empty">${active ? 'Ничего не найдено' : emptyWord + ' пока нет. Нажми ＋'}</div>`;
    return;
  }
  clinics.sort((a, b) => (b.markedDel ? 1 : 0) - (a.markedDel ? 1 : 0) || (a.name || '').localeCompare(b.name || '', 'ru'));
  view.innerHTML = '<div class="list">' + clinics.map(c => {
    const loc = [c.region, c.city].filter(Boolean).join(' / ');
    return `<div class="card list-row${c.markedDel ? ' marked-del' : ''}" data-id="${c.id}" data-kind="clinic">
      <div class="list-row-top">
        <span class="list-row-name">${esc(c.name)}</span>
        ${c.markedDel ? '<span class="mark-badge">на удалении</span>' : ''}
      </div>
      <div class="list-row-sub">${loc ? esc(loc) : '—'}</div>
    </div>`;
  }).join('') + '</div>';
  view.querySelectorAll('.list-row').forEach(row => {
    row.addEventListener('mouseenter', () => showHoverCard(row));
    row.addEventListener('mouseleave', hideHover);
  });
}

async function renderMoney() {
  const view = document.getElementById('view');
  let clinics = await listClinics();
  const s = state.search;
  const f = state.filters;
  const year = state.moneyYear || curYear();
  const trendOn = !!state.moneyYear;
  clinics = clinics.filter(c =>
    c.kind !== 'distributor' &&
    (!s ||
      (c.name || '').toLowerCase().includes(s) ||
      (c.city || '').toLowerCase().includes(s) ||
      (c.region || '').toLowerCase().includes(s) ||
      (c.manager || '').toLowerCase().includes(s)) &&
    (!f.region || c.region === f.region) &&
    (!f.city || c.city === f.city) &&
    (!f.manager || c.manager === f.manager)
  );
  // сортировка: по сумме (вверх/вниз) или по алфавиту; 0₽-бейджи — в середине (только при выбранном годе), пустые — вниз по алфавиту
  const mode = state.moneySort;  // 'desc' | 'asc' | 'name'
  const mf = state.moneyFilter || 'all';
  const showPills = trendOn || mf !== 'all';
  if (mf !== 'all') {
    const py = String(Number(year) - 1);
    clinics = clinics.filter(c => {
      const v = moneyVal(c, year), p = moneyVal(c, py);
      if (mf === 'up') return v != null && p != null && v > p;
      if (mf === 'down') return p != null && p !== 0 && (v == null || v < p);
      if (mf === 'new') return v != null && (p == null || p === 0);
      return true;
    });
    // пустые карточки (нет продаж ни в этом, ни в прошлом году) — скрываем при включённом фильтре
    clinics = clinics.filter(c => {
      const v = moneyVal(c, year), p = moneyVal(c, String(Number(year) - 1));
      return v != null || (p != null && p !== 0);
    });
  } else if (trendOn) {
    // выбран год: прячем карточки, где нет ни суммы, ни «0 ₽» — нет никакой информации
    clinics = clinics.filter(c => {
      const v = moneyVal(c, year), p = moneyVal(c, String(Number(year) - 1));
      return v != null || (p != null && p !== 0);
    });
  }
  clinics.sort((a, b) => {
    if (mode === 'name') return (a.name || '').localeCompare(b.name || '', 'ru');
    const av = moneyVal(a, year), bv = moneyVal(b, year);
    const ap = moneyVal(a, String(Number(year) - 1)), bp = moneyVal(b, String(Number(year) - 1));
    const az = trendOn && av == null && ap != null && ap !== 0;  // бейдж 0₽ только при выбранном годе
    const bz = trendOn && bv == null && bp != null && bp !== 0;
    const ta = av != null ? 0 : (az ? 1 : 2);
    const tb = bv != null ? 0 : (bz ? 1 : 2);
    if (ta !== tb) return ta - tb;
    if (ta === 0) return mode === 'asc' ? av - bv : bv - av;
    return (a.name || '').localeCompare(b.name || '', 'ru');
  });
  clinics.sort((a, b) => (b.markedDel ? 1 : 0) - (a.markedDel ? 1 : 0));  // помеченные на удаление — первыми
  const src = state.moneySource;
  const total = clinics.reduce((sum, c) => sum + (moneyVal(c, year) || 0), 0);
  const bTotal = clinics.reduce((sum, c) => sum + (curYearSales(c, year) || 0), 0);
  const hTotal = clinics.reduce((sum, c) => sum + (curYearHM(c, year) || 0), 0);
  const splitLabel = src === 'boston' ? `Boston ${fmtMoney(bTotal)}`
    : src === 'hugemed' ? `HugeMed ${fmtMoney(hTotal)}`
    : `Boston ${fmtMoney(bTotal)} · HugeMed ${fmtMoney(hTotal)}`;
  const sortLabel = mode === 'name' ? 'А-Я' : (mode === 'asc' ? '↑ по сумме' : '↓ по сумме');
  const sortTitle = mode === 'name' ? 'Сортировка по алфавиту (нажми для смены)' : `Сортировка по сумме: ${mode === 'asc' ? 'по возрастанию' : 'по убыванию'} (нажми для смены)`;
  view.innerHTML = `<div class="money-total-line">Итого ${year}: <b>${fmtMoney(total)} ₽</b>
      <span class="money-split">${splitLabel}</span>
      <select id="money-src" class="sort-toggle" title="Какие продажи считать">
        <option value="both"${src === 'both' ? ' selected' : ''}>Все</option>
        <option value="boston"${src === 'boston' ? ' selected' : ''}>Boston</option>
        <option value="hugemed"${src === 'hugemed' ? ' selected' : ''}>HugeMed</option>
      </select>
      <select id="money-filter" class="sort-toggle" title="Фильтр по динамике">
        <option value="all"${mf === 'all' ? ' selected' : ''}>Все</option>
        <option value="up"${mf === 'up' ? ' selected' : ''}>Рост</option>
        <option value="down"${mf === 'down' ? ' selected' : ''}>Падение</option>
        <option value="new"${mf === 'new' ? ' selected' : ''}>Новый</option>
      </select>
      <button class="sort-toggle" id="money-sort" title="${sortTitle}">${sortLabel}</button>
      <span class="money-cnt">${clinics.length}</span>
    </div>`
    + (clinics.length
      ? '<div class="list">' + clinics.map(c => {
      const loc = [c.region, c.city].filter(Boolean).join(' / ');
      const money = fmtMoney(moneyVal(c, year));
      const hm = curYearHM(c, year);
      const split = (src === 'both' && hm != null && hm !== 0) ? ` · ХМ ${fmtMoney(hm)}` : '';
      let trend = '';
      const prevVal = moneyVal(c, String(Number(year) - 1));
      if (showPills && money) {
        const prev = prevVal;
        const cur = moneyVal(c, year);
        trend = (prev != null && cur != null) ? (cur > prev ? 'money-up' : (cur < prev ? 'money-down' : 'money-flat')) : 'money-flat';
      }
      const curVal = moneyVal(c, year);
      const zeroBadge = showPills && (curVal == null || curVal === 0) && prevVal != null && prevVal !== 0
        ? `<span class="list-row-money money-zero">0 ₽</span>` : '';
      return `<div class="card list-row${c.markedDel ? ' marked-del' : ''}" data-id="${c.id}" data-kind="clinic">
        <div class="list-row-top">
          <span class="list-row-name">${esc(c.name)}</span>
          ${c.markedDel ? '<span class="mark-badge">на удалении</span>' : ''}
          ${money ? `<span class="list-row-money ${trend}">${money} ₽</span>` : zeroBadge}
        </div>
        <div class="list-row-sub">${loc ? esc(loc) : '—'}${split}</div>
      </div>`;
      }).join('') + '</div>'
      : '<div class="empty">Ничего не найдено</div>');
  view.querySelectorAll('.list-row').forEach(row => {
    row.addEventListener('mouseenter', () => showHoverCard(row));
    row.addEventListener('mouseleave', hideHover);
  });
  document.getElementById('money-sort').addEventListener('click', () => {
    state.moneySort = mode === 'desc' ? 'asc' : (mode === 'asc' ? 'name' : 'desc');
    renderMoney();
  });
  document.getElementById('money-src').addEventListener('change', e => {
    state.moneySource = e.target.value;
    renderMoney();
  });
  document.getElementById('money-filter').addEventListener('change', e => {
    state.moneyFilter = e.target.value;
    renderMoney();
  });
}

function telHref(phone) {
  const first = String(phone || '').split(/[,;]/)[0];
  let d = first.replace(/[^\d+]/g, '');
  if (/^8\d{10}$/.test(d)) d = '+7' + d.slice(1);
  return d;
}
function formatPhone(phone) {
  if (!phone) return '';
  return String(phone).split(/[,;]\s*/).map(seg => {
    let d = seg.replace(/\D/g, '');
    let digits = d;
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) digits = digits.slice(1);
    if (digits.length === 10) {
      return `8 (${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,8)}-${digits.slice(8,10)}`;
    }
    return seg.trim();
  }).join(', ');
}
function telLink(phone) {
  if (!phone) return '';
  return `<a class="tel" href="tel:${telHref(phone)}">${esc(formatPhone(phone))}</a>`;
}

async function renderPeople() {
  const view = document.getElementById('view');
  let people = await listPeople();
  const s = state.search;
  if (s) {
    people = people.filter(p =>
      (p.fullName || '').toLowerCase().includes(s) ||
      (p.position || '').toLowerCase().includes(s) ||
      (p.city || '').toLowerCase().includes(s) ||
      (p.region || '').toLowerCase().includes(s) ||
      (p.phone || '').toLowerCase().includes(s) ||
      (p.email || '').toLowerCase().includes(s) ||
      (p.tags || []).some(t => t.toLowerCase().includes(s))
    );
  }
  if (!people.length) {
    view.innerHTML = `<div class="empty">${s ? 'Ничего не найдено' : 'Людей пока нет. Нажми ＋'}</div>`;
    return;
  }
  const clinicMap = {};
  const clinics = await listClinics();
  clinics.forEach(c => clinicMap[c.id] = c.name);

  people.sort((a, b) => (b.markedDel ? 1 : 0) - (a.markedDel ? 1 : 0) || (a.fullName || '').localeCompare(b.fullName || '', 'ru'));
  let html = '<div class="list">';
  for (const p of people) {
    const org = p.clinicId ? clinicMap[p.clinicId] : '';
    const sub = [org, p.position].filter(Boolean).join(' / ');
    html += `<div class="card list-row${p.markedDel ? ' marked-del' : ''}" data-id="${p.id}" data-kind="person">
      <div class="list-row-top">
        <span class="list-row-name">${esc(p.fullName)}</span>
        ${p.markedDel ? '<span class="mark-badge">на удалении</span>' : ''}
      </div>
      <div class="list-row-sub">${esc(sub || '—')}</div>
    </div>`;
  }
  view.innerHTML = html + '</div>';
  view.querySelectorAll('.list-row').forEach(row => {
    row.addEventListener('mouseenter', () => showHoverCard(row));
    row.addEventListener('mouseleave', hideHover);
  });
}

async function renderDicts() {
  const view = document.getElementById('view');
  const types = ['manager', 'region', 'city'];
  const accent = getAccent();
  // текущий пользователь (для блока «Аккаунт»)
  let me = null;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data: am } = await sb.from('user_managers').select('*').eq('email', user.email).maybeSingle();
      me = { email: user.email, manager: am ? am.manager : null, role: am ? am.role : null };
    }
  } catch (_) {}
  let html = `<div class="detail-block">
      <div class="k">Аккаунт</div>
      <div class="account-row">
        <span class="account-info">${me ? esc(me.email.replace(/@crm\.ru$/, '')) + (me.manager ? ' · ' + esc(me.manager) : '') : '—'}</span>
        <button class="btn ghost" id="logoutBtn">${me ? 'Выйти' : 'Войти'}</button>
      </div>
    </div>
    <div class="detail-block">
      <div class="k">Цвет выделения</div>
      <div class="accent-picker">
        ${ACCENT_OPTIONS.map(o => `
          <div class="swatch ${accent === o.key ? 'active' : ''}" data-accent="${o.key}">
            <span class="dot" style="background:${o.color}"></span>${o.label}
          </div>`).join('')}
      </div>
    </div>`;
  for (const t of types) {
    const vals = await getDict(t);
    const canDictEdit = CURRENT_ROLE === 'admin' || CURRENT_ROLE === 'manager';
    html += `<details class="dict"${vals.length ? '' : ' open'}>
      <summary>
        <span>${DICT_LABELS[t]}</span>
        <span class="count">${vals.length}</span>
        <span class="chev">▾</span>
      </summary>
      <div class="dict-body">
        <div class="chips">
          ${vals.length ? vals.map(v => `<span class="chip">${esc(v)} ${canDictEdit ? `<span class="x" data-dict="${t}" data-val="${esc(v)}">✕</span>` : ''}</span>`).join('') : '<span class="sub" style="color:var(--muted)">пусто</span>'}
        </div>
        ${canDictEdit ? `<div class="add-row">
          <input type="text" placeholder="Добавить" data-add="${t}" />
          <button class="btn" data-add-btn="${t}">＋</button>
        </div>` : ''}
      </div>
    </details>`;
  }
  view.innerHTML = html;
  const lo = document.getElementById('logoutBtn');
  if (lo) lo.addEventListener('click', async () => {
    if (!me) { showLogin(); return; }
    try { await sb.auth.signOut(); } catch (_) {} showLogin();
  });
  view.querySelectorAll('.swatch').forEach(s => {
    s.addEventListener('click', () => {
      localStorage.setItem('accent', s.dataset.accent);
      applyAccent();
      renderDicts();
    });
  });
}

// ---------- forms ----------
async function openClinicForm(id, presetKind) {
  const c = id ? await getClinic(id) : {};
  // менеджер по умолчанию = текущий пользователь (для новых клиник)
  let myManager = null;
  if (!id && CURRENT_ROLE !== 'guest' && CURRENT_ROLE !== 'viewer') {
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: am } = await sb.from('user_managers').select('manager').eq('email', user.email).maybeSingle();
        if (am) myManager = am.manager;
      }
    } catch (_) {}
  }
  const kind = c.kind || presetKind || 'hospital';
  const [managers, regions, cities] = await Promise.all([
    datalistOptions('manager'),
    datalistOptions('region'), datalistOptions('city')
  ]);
  const linkOptions = await clinicSelectOptions(c.linkedClinicId);

  openModal(id ? 'Редактировать организацию' : (kind === 'distributor' ? 'Новый дистрибьютор' : 'Новая клиника'), `
    <div class="field"><label>Вид *</label>
      <select id="f_kind">
        <option value="hospital"${kind === 'hospital' ? ' selected' : ''}>Больница</option>
        <option value="distributor"${kind === 'distributor' ? ' selected' : ''}>Дистрибьютор</option>
      </select>
    </div>
    <div class="field"><label>Название *</label><input id="f_name" value="${esc(c.name)}" /></div>
    <div class="row2">
      <div class="field"><label>Регион *</label><input id="fm_region" list="dl_region" value="${esc(c.region)}" /><datalist id="dl_region">${regions}</datalist></div>
      <div class="field"><label>Город</label><input id="fm_city" list="dl_city" value="${esc(c.city)}" /><datalist id="dl_city">${cities}</datalist></div>
    </div>
    <div class="field"><label>Менеджер</label><input id="fm_manager" list="dl_manager" value="${esc(c.manager || myManager || '')}" /><datalist id="dl_manager">${managers}</datalist></div>
    ${salesFormFields(c)}
    <div class="field"><label>Связь (другая клиника/суб)</label>
      <select id="f_link"><option value="">— нет —</option>${linkOptions}</select>
    </div>
    <div class="field"><label>Комментарии / ситуация</label><textarea id="f_situation">${esc(c.situation)}</textarea></div>
    <div class="field"><label>Метки (через запятую)</label><input id="f_tags" value="${esc((c.tags || []).join(', '))}" /></div>
    <button class="btn" id="f_save" data-id="${c.id || ''}">Сохранить</button>
    ${id ? `<div class="btn-row"><button class="btn ghost" id="f_delete">${CURRENT_ROLE === 'admin' ? 'Удалить' : (c.markedDel ? 'Снять пометку на удаление' : 'Пометить на удаление')}</button></div>` : ''}
  `);

  document.getElementById('f_save').addEventListener('click', () => saveClinic(id));
  if (id) document.getElementById('f_delete').addEventListener('click', () => deleteClinic(id));
}

function parseTags(s) {
  return (s || '').split(',').map(t => t.trim()).filter(Boolean);
}

function readMoney(id) {
  const raw = (document.getElementById(id).value || '').trim().replace(/\s/g, '');
  if (raw === '') return null;
  const n = Number(raw);
  return isFinite(n) ? n : NaN;
}

function salesFormFields(c) {
  const boston = MONEY_YEARS.map((y) =>
    `<div class="money-cell"><label>${y}</label><input id="f_sales${y}" type="text" inputmode="numeric" value="${c['sales' + y] != null ? c['sales' + y] : ''}" placeholder="—" /></div>`
  ).join('');
  const hm = HUGEMED_YEARS.map((y) =>
    `<div class="money-cell"><label>${y}</label><input id="f_hm${y}" type="text" inputmode="numeric" value="${c['hugemed' + y] != null ? c['hugemed' + y] : ''}" placeholder="—" /></div>`
  ).join('');
  return `<div class="field"><label>Boston (₽)</label><div class="money-grid">${boston}</div></div>`
    + (hm ? `<div class="field"><label>HugeMed (₽)</label><div class="money-grid">${hm}</div></div>` : '');
}

async function saveClinic(id) {
  const name = document.getElementById('f_name').value.trim();
  if (!name) { toast('Название обязательно'); return; }
  const kind = document.getElementById('f_kind').value;
  const region = document.getElementById('fm_region').value.trim();
  if (!region) { toast('Регион обязателен'); return; }
  const city = document.getElementById('fm_city').value.trim();
  const manager = document.getElementById('fm_manager').value.trim();
  const situation = document.getElementById('f_situation').value.trim();
  const tags = parseTags(document.getElementById('f_tags').value);
  const linkedClinicId = document.getElementById('f_link').value ? Number(document.getElementById('f_link').value) : null;
  const sales = MONEY_YEARS.map(y => readMoney('f_sales' + y));
  const hms = HUGEMED_YEARS.map(y => readMoney('f_hm' + y));
  if (sales.some(v => Number.isNaN(v)) || hms.some(v => Number.isNaN(v))) { toast('Некорректное число в продажах'); return; }

  await addDictValues('region', [region]);
  await addDictValues('city', [city]);
  await addDictValues('manager', [manager]);

  const row = { name, region, city, manager, situation, tags, linkedClinicId, kind };
  MONEY_YEARS.forEach((y, i) => { row['sales' + y] = sales[i]; });
  HUGEMED_YEARS.forEach((y, i) => { row['hugemed' + y] = hms[i]; });
  if (id) await updateClinic(id, row);
  else await addClinic(row);

  closeModal(); toast('Сохранено'); render(); updateFiltersUI(); refreshCounts();
}

async function openPersonForm(id, presetClinicId) {
  const p = id ? await getPerson(id) : (presetClinicId != null ? { clinicId: presetClinicId } : {});
  const clinicOptions = await clinicSelectOptions(p.clinicId);

  openModal(id ? 'Редактировать человека' : 'Новый человек', `
    <div class="field"><label>ФИО *</label><input id="f_fullName" value="${esc(p.fullName)}" /></div>
    <div class="field"><label>Должность</label><input id="f_position" value="${esc(p.position)}" /></div>
    <div class="field"><label>Учреждение (клиника) *</label>
      <select id="f_clinic"><option value="">— выберите —</option>${clinicOptions}</select>
    </div>
    <div class="row2">
      <div class="field"><label>Телефон</label><input id="f_phone" value="${esc(p.phone)}" /></div>
      <div class="field"><label>Почта</label><input id="f_email" value="${esc(p.email)}" /></div>
    </div>
    <div class="field"><label>Комментарии / ситуация</label><textarea id="f_situation">${esc(p.situation)}</textarea></div>
    <div class="field"><label>Метки (через запятую)</label><input id="f_tags" value="${esc((p.tags || []).join(', '))}" /></div>
    <button class="btn" id="f_save" data-id="${p.id || ''}">Сохранить</button>
    ${id ? `<div class="btn-row"><button class="btn ghost" id="f_delete">${CURRENT_ROLE === 'admin' ? 'Удалить' : (p.markedDel ? 'Снять пометку на удаление' : 'Пометить на удаление')}</button></div>` : ''}
  `);

  document.getElementById('f_save').addEventListener('click', () => savePerson(id));
  if (id) document.getElementById('f_delete').addEventListener('click', () => deletePerson(id));
}

async function savePerson(id) {
  const fullName = document.getElementById('f_fullName').value.trim();
  if (!fullName) { toast('ФИО обязательно'); return; }
  const clinicId = document.getElementById('f_clinic').value ? Number(document.getElementById('f_clinic').value) : null;
  if (!clinicId) { toast('Выберите учреждение (клинику)'); return; }
  const clinic = await getClinic(clinicId);
  const region = clinic ? (clinic.region || '') : '';
  const city = clinic ? (clinic.city || '') : '';
  const phone = document.getElementById('f_phone').value.trim();
  const email = document.getElementById('f_email').value.trim();
  const position = document.getElementById('f_position').value.trim();
  const situation = document.getElementById('f_situation').value.trim();
  const tags = parseTags(document.getElementById('f_tags').value);

  const row = { fullName, position, region, city, clinicId, phone, email, situation, tags };
  if (id) await updatePerson(id, row);
  else await addPerson(row);

  closeModal(); toast('Сохранено'); render(); updateFiltersUI(); refreshCounts();
}

// ---------- detail ----------
function commentField(table, id, situation) {
  const editable = CURRENT_ROLE !== 'guest' && CURRENT_ROLE !== 'viewer';
  return `<div class="detail-block">
      <div class="k">Комментарии / ситуация</div>
      <div class="v comment-field" ${editable ? 'contenteditable="true" spellcheck="false"' : ''} data-table="${table}" data-id="${id}">${esc(situation)}</div>
    </div>`;
}

function readComment(field) {
  const t = (field.innerText != null) ? field.innerText : field.textContent;
  return String(t || '').replace(/\u00A0/g, ' ').replace(/\r\n?/g, '\n').trim();
}

function clinicDetailBody(c, linked, contacts) {
  const moneyRows = MONEY_YEARS.map(y => {
    const b = c['sales' + y], h = c['hugemed' + y];
    const parts = [];
    if (b != null) parts.push(`Boston ${fmtMoney(b)}`);
    if (h != null) parts.push(`ХМ ${fmtMoney(h)}`);
    return `<div class="v">${y}: ${parts.length ? parts.join(' · ') : '—'}</div>`;
  }).join('');
  const sortedContacts = [...contacts].sort((a, b) => (b.markedDel ? 1 : 0) - (a.markedDel ? 1 : 0));
  return `
    ${c.markedDel ? `<div class="detail-block mark-banner">⛔ Помечена на удаление</div>` : ''}
    <div class="detail-block"><div class="k">Продажи (₽) — Boston / HugeMed</div>${moneyRows}</div>
    ${[['Регион', c.region], ['Город', c.city], ['Менеджер', c.manager], ['Связь', linked ? linked.name : null]]
      .filter(([k, v]) => v).map(([k, v]) => `<div class="detail-block"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('')}
    ${commentField('clinics', c.id, c.situation)}
    ${tagsHtml(c.tags)}
    <div class="detail-block">
      <div class="k">Люди (${contacts.length})</div>
      ${sortedContacts.length ? sortedContacts.map(p => `<div class="v contact-row${p.markedDel ? ' marked-del-row' : ''}" data-person="${p.id}">${esc(p.fullName)}${p.position ? ' — ' + esc(p.position) : ''}${p.phone ? ' · ' + telLink(p.phone) : ''}${p.markedDel ? ' <span class="mark-badge">на удалении</span>' : ''}</div>`).join('') : '<div class="v" style="color:var(--muted)">нет</div>'}
    </div>
  `;
}

function personDetailBody(p, clinic) {
  return `
    ${[['Учреждение', clinic ? clinic.name : null], ['Должность', p.position], ['Почта', p.email]]
      .filter(([k, v]) => v).map(([k, v]) => `<div class="detail-block"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('')}
    ${p.phone ? `<div class="detail-block"><div class="k">Телефон</div><div class="v">${telLink(p.phone)}</div></div>` : ''}
    ${commentField('people', p.id, p.situation)}
    ${tagsHtml(p.tags)}
  `;
}

// ---------- hover-превью (десктоп) ----------
let hoverSeq = 0;
let hoverTimer = null;
let hoverPinned = false;

function hideHover() {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    if (hoverPinned) return;
    document.getElementById('hoverCard').classList.add('hidden');
  }, 160);
}

async function showHoverCard(row) {
  const id = Number(row.dataset.id);
  const kind = row.dataset.kind || 'clinic';
  const seq = ++hoverSeq;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(async () => {
    const panel = document.getElementById('hoverCard');
    let inner;
    if (kind === 'person') {
      const p = await getPerson(id);
      if (!p || seq !== hoverSeq) return;
      const clinic = p.clinicId ? await getClinic(p.clinicId) : null;
      if (seq !== hoverSeq) return;
      inner = `<h3>${esc(p.fullName)}</h3>` + personDetailBody(p, clinic);
    } else {
      const c = await getClinic(id);
      if (!c || seq !== hoverSeq) return;
      const linked = c.linkedClinicId ? await getClinic(c.linkedClinicId) : null;
      const contacts = await peopleByClinic(id);
      if (seq !== hoverSeq) return;
      inner = `<h3>${esc(c.name)}</h3>` + clinicDetailBody(c, linked, contacts);
    }
    panel.innerHTML = inner;
    const r = row.getBoundingClientRect();
    const pw = 380;
    let left = r.right + 12;
    if (left + pw > window.innerWidth - 12) left = Math.max(12, r.left - pw - 12);
    panel.style.top = Math.max(12, r.top) + 'px';
    panel.style.left = left + 'px';
    panel.classList.remove('hidden');
  }, 200);
}

{
  const panel = document.getElementById('hoverCard');
  panel.addEventListener('mouseenter', () => { hoverPinned = true; clearTimeout(hoverTimer); });
  panel.addEventListener('mouseleave', () => { hoverPinned = false; const f = panel.querySelector('.comment-field:focus'); if (f) f.blur(); panel.classList.add('hidden'); });
}

// инлайн-редактирование комментариев: контент-редактируемое поле, сохранение по blur
document.addEventListener('focusin', e => {
  const field = e.target.closest('.comment-field[contenteditable]');
  if (!field) return;
  field._orig = readComment(field);
});
document.addEventListener('focusout', async e => {
  const field = e.target.closest('.comment-field[contenteditable]');
  if (!field) return;
  const text = readComment(field);
  if (text === field._orig) return;
  await setSituation(field.dataset.table, Number(field.dataset.id), text);
  toast('Сохранено');
});

async function showClinic(id) {
  const c = await getClinic(id);
  if (!c) return;
  const linked = c.linkedClinicId ? await getClinic(c.linkedClinicId) : null;
  const contacts = await peopleByClinic(id);
  const canEdit = CURRENT_ROLE !== 'guest' && CURRENT_ROLE !== 'viewer';

  openModal(c.name, clinicDetailBody(c, linked, contacts) + `
    <div class="btn-row">
      ${canEdit ? '<button class="btn" id="d_edit">Редактировать</button>' : ''}
      <button class="btn ghost" id="d_close">Закрыть</button>
    </div>
    ${canEdit ? '<button class="btn ghost" id="d_add_person" style="margin-top:10px">＋ Добавить человека</button>' : ''}
  `);
  if (canEdit) document.getElementById('d_edit').addEventListener('click', () => openClinicForm(id));
  document.getElementById('d_close').addEventListener('click', closeModal);
  document.querySelectorAll('.contact-row').forEach(el => {
    el.addEventListener('click', (e) => { if (e.target.closest('a.tel')) return; closeModal(); showPerson(Number(el.dataset.person)); });
  });
  if (canEdit) document.getElementById('d_add_person').addEventListener('click', () => { closeModal(); openPersonForm(null, id); });
}

async function showPerson(id) {
  const p = await getPerson(id);
  if (!p) return;
  const clinic = p.clinicId ? await getClinic(p.clinicId) : null;
  const canEdit = CURRENT_ROLE !== 'guest' && CURRENT_ROLE !== 'viewer';

  openModal(p.fullName, personDetailBody(p, clinic) + `
    <div class="btn-row">
      ${canEdit ? '<button class="btn" id="d_edit">Редактировать</button>' : ''}
      <button class="btn ghost" id="d_close">Закрыть</button>
    </div>
  `);
  if (canEdit) document.getElementById('d_edit').addEventListener('click', () => openPersonForm(id));
  document.getElementById('d_close').addEventListener('click', closeModal);
}

// ---------- delete ----------
async function deleteClinic(id) {
  if (CURRENT_ROLE !== 'admin') {
    const c = await getClinic(id);
    const target = !c.markedDel;
    if (!confirm(target ? 'Пометить клинику на удаление?' : 'Снять пометку на удаление?')) return;
    await setClinicMarked(id, target);
    closeModal(); toast(target ? 'Помечена на удаление' : 'Пометка снята'); render(); updateFiltersUI(); refreshCounts();
    return;
  }
  if (!confirm('Удалить клинику?')) return;
  await removeClinic(id);
  await clearPeopleClinic(id);
  closeModal(); toast('Удалено'); render(); updateFiltersUI(); refreshCounts();
}

async function deletePerson(id) {
  if (CURRENT_ROLE !== 'admin') {
    const p = await getPerson(id);
    const target = !p.markedDel;
    if (!confirm(target ? 'Пометить человека на удаление?' : 'Снять пометку на удаление?')) return;
    await setPersonMarked(id, target);
    closeModal(); toast(target ? 'Помечен на удаление' : 'Пометка снята'); render(); refreshCounts();
    return;
  }
  if (!confirm('Удалить человека?')) return;
  await removePerson(id);
  closeModal(); toast('Удалено'); render(); refreshCounts();
}

// ---------- dicts ----------
function addDictPrompt() {
  openModal('Добавить в справочник', `
    <div class="field"><label>Справочник</label>
      <select id="d_type">
        ${['manager', 'region', 'city'].map(t => `<option value="${t}">${DICT_LABELS[t]}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Значение</label><input id="d_value" /></div>
    <button class="btn" id="d_save">Добавить</button>
  `);
  document.getElementById('d_save').addEventListener('click', async () => {
    const type = document.getElementById('d_type').value;
    const value = document.getElementById('d_value').value.trim();
    if (!value) { toast('Введите значение'); return; }
    await addDictValue(type, value);
    closeModal(); toast('Добавлено'); render();
  });
}

// делегирование кликов по view
document.getElementById('view').addEventListener('click', async e => {
  if (e.target.closest('a.tel')) return;
  const card = e.target.closest('.card');
  if (card) {
    hideHover();
    const { id, kind } = card.dataset;
    if (kind === 'clinic') showClinic(Number(id));
    else showPerson(Number(id));
    return;
  }
  const addBtn = e.target.closest('[data-add-btn]');
  if (addBtn) {
    const type = addBtn.dataset.addBtn;
    const input = document.querySelector(`input[data-add="${type}"]`);
    const value = (input.value || '').trim();
    if (!value) { toast('Введите значение'); return; }
    await addDictValue(type, value);
    toast('Добавлено'); renderDicts();
    return;
  }
  const x = e.target.closest('.chip .x');
  if (x) {
    const { dict, val } = x.dataset;
    await deleteDictValue(dict, val);
    toast('Удалено'); renderDicts();
  }
});

// ---------- init ----------
init();
