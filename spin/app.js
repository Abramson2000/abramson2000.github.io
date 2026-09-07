// ============ СПИН-курс в каркасе «Лаборатории продаж» ============
const L = SPIN_DATA.lessons;
const quiz = SPIN_DATA.quizBank;      // S/P/I/N
const say = SPIN_DATA.stBank;         // F/A/B
const need = SPIN_DATA.needBank || []; // H/E
const ch = SPIN_DATA.chBank || [];     // T/D/C/R — ходы Challenger
const sol = SPIN_DATA.solBank || [];   // R/I/V/W/X — продажи решений
const cons = SPIN_DATA.consBank || []; // E/R/C/G/X — стратегические продажи
const cheat = SPIN_DATA.cheatSections;
const cases = SPIN_DATA.cases;
const EXTRA_ALL = SPIN_DATA.extra || []; // все доп-уроки: выжимки книг
let EXTRA = [];                        // видимые текущему пользователю
let curExtra = null;                   // индекс открытого доп-урока (или null = основной урок)
// уроки с only:'boss' видит только владелец (abramson@crm.ru); остальные скрыты
const refreshExtra = () => { EXTRA = EXTRA_ALL.filter((x) => !x.only || (x.only === 'boss' && USER && USER.email === 'abramson@crm.ru')); };
// курс MEDDPICC — квалификация сделки (8 элементов + риски)
const MED = (SPIN_DATA.meddicc && SPIN_DATA.meddicc.lessons) || [];
const SPICED = (SPIN_DATA.spiced && SPIN_DATA.spiced.lessons) || []; // курс 1а — расширение СПИН
let curMed = null;                     // индекс открытого MEDDPICC-урока (или null = основной урок)
let curSpiced = null;                  // индекс открытого SPICED-урока (курс 1а)

// ===== Курсы внутри программы «Навыки продаж» =====
const COURSES = [
  { name: 'Курс 1 · СПИН-продажи', tag: 'СПИН', from: 0, to: 8 },
  { name: 'Курс 2 · Продажа через вызов', tag: 'ВЫЗОВ', from: 8, to: 10 },
  { name: 'Курс 3 · Продажи решений', tag: 'РЕШЕНИЯ', from: 10, to: 12 },
  { name: 'Курс 4 · Консультативные продажи', tag: 'КОНСУЛЬТАТИВНЫЕ', from: 12, to: L.length },
].filter((g) => g.from < L.length);
function courseOf(i) {
  const g = COURSES.find((c) => i >= c.from && i < c.to) || COURSES[COURSES.length - 1];
  return { g, num: i - g.from + 1, len: g.to - g.from, idx: COURSES.indexOf(g) };
}
function doneInOf(g) { // сколько уроков группы пройдено
  return L.slice(g.from, g.to).filter((ll, k) => S.done.includes(g.from + k)).length;
}
function spicedSectionHtml() { // html секции «Курс 1а · SPICED» (карточки уроков)
  const sd = SPICED.length ? SPICED.filter((ll, k) => S.spicedDone.includes(k)).length : 0;
  return `
  <div class="section-title-row" style="margin-top:26px"><div><h2>Курс 1а · SPICED — расширение СПИН</h2><p>Диагностика сделки · ${SPICED.length} ${pluralN(SPICED.length, ['урок', 'урока', 'уроков'])} · Winning by Design · пройдено ${sd} из ${SPICED.length} — открывается свободно</p></div></div>
  <div class="module-grid">
  ${SPICED.map((ll, si) => {
    const d = S.spicedDone.includes(si);
    const parts = (ll.practice ? ll.practice.length : 0) || ll.blocks.length;
    const desc = ll.intro.length > 90 ? ll.intro.slice(0, 90) + '…' : ll.intro;
    return `<article class="module-card method-card current ${d ? 'completed' : ''}" data-spiced="${si}" tabindex="0" role="button" title="Урок курса SPICED — открыть">
      <div class="module-number">${si + 1}</div>
      <div class="module-icon">${d ? '✓' : '↗'}</div>
      <span class="status-label">${d ? 'ИЗУЧЕН' : 'УРОК ' + (si + 1)}</span>
      <h3>${esc(ll.title)}</h3>
      <p>${esc(desc)}</p>
      <div class="module-footer"><span>${esc(ll.mins)} · ${parts} раздела</span><strong>${d ? '100%' : '→'}</strong></div>
      <div class="module-progress"><i style="width:${d ? 100 : 0}%"></i></div>
    </article>`;
  }).join('')}
  </div>`;
}
function pluralN(n, forms) { // forms: [1, 2, 5] → «1 курс», «2 курса», «5 курсов»
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

// ===== вход и прогресс =====
const SUPABASE_URL = 'https://mkehzkobjxnjobkqeiwt.supabase.co';
const SUPABASE_ANON = 'sb_publishable_4RVlpOkywKmEjsnKsHpRiA_q_Af-f0v';
let LS_KEY = 'spin-lab-v1';
let USER = null; // { id, email, name }
let SB = null;

const S = {
  tab: 'program',
  lesson: 0,
  pTab: 'trainer',   // внутри Практики: 'trainer' | 'cases'
  done: [],            // индексы уроков
  practiced: [],       // уроки, где практика «Проверь себя» отвечена до конца
  xp: 0,
  correct: 0,
  attempts: 0,
  extraDone: [],        // прочитанные выжимки книг (локально, не в облаке)
  medDone: [],           // изученные уроки MEDDPICC (локально, не в облаке)
  spicedDone: [],        // изученные уроки SPICED — курс 1а (локально, не в облаке)
  // тренажёр
  tMode: null, tIdx: 0, tPick: null, tScore: 0, tOrder: [],
  // кейс
  cIdx: null, cScene: 0, cPick: null, cPicks: [],
  cDone: [],            // пройденные кейсы (разбор доведён до конца) — локально
};
function loadState() {
  try {
    const r = JSON.parse(localStorage.getItem(LS_KEY)) || {};
    S.lesson = r.lesson || 0; S.done = r.done || []; S.practiced = r.practiced || [];
    S.xp = r.xp || 0; S.correct = r.correct || 0; S.attempts = r.attempts || 0;
    S.cDone = r.cDone || [];
    if (['program', 'theory', 'practice', 'cheat', 'progress'].includes(r.tab)) S.tab = r.tab;
  } catch (e) {}
}
let _syncT = null;
let _cloudReady = false; // облако загружено (cloudLoad завершён) — только после этого шлём save
S.sync = 'off';        // 'off' | 'saving' | 'saved' | 'error'
S.syncAt = null;       // время последней успешной синхронизации
S.dirty = false;       // есть несохранённые изменения

function syncPayload() {
  return { lesson: S.lesson, done: S.done, practiced: S.practiced, xp: S.xp, correct: S.correct, attempts: S.attempts, cDone: S.cDone, tab: S.tab, name: USER ? USER.name : '', email: USER ? USER.email : '' };
}
function save() {
  // без входа прогресс не сохраняется — ни локально, ни на сервере
  if (!USER) return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(syncPayload())); } catch (e) {}
  S.dirty = true;
  if (S.sync !== 'saving') setSync('saving');
  clearTimeout(_syncT);
  _syncT = setTimeout(() => { if (S.dirty && _cloudReady) cloudSave(); }, 500);
}
function loadExtra() {
  try { S.extraDone = JSON.parse(localStorage.getItem('spin-extra:' + USER.id)) || []; }
  catch (e) { S.extraDone = []; }
}
function saveExtra() {
  try { localStorage.setItem('spin-extra:' + USER.id, JSON.stringify(S.extraDone)); } catch (e) {}
}
function loadMed() {
  try { S.medDone = JSON.parse(localStorage.getItem('spin-med:' + USER.id)) || []; }
  catch (e) { S.medDone = []; }
}
function saveMed() {
  try { localStorage.setItem('spin-med:' + USER.id, JSON.stringify(S.medDone)); } catch (e) {}
}
function loadSpiced() {
  try { S.spicedDone = JSON.parse(localStorage.getItem('spin-spiced:' + USER.id)) || []; }
  catch (e) { S.spicedDone = []; }
}
function saveSpiced() {
  try { localStorage.setItem('spin-spiced:' + USER.id, JSON.stringify(S.spicedDone)); } catch (e) {}
}
function setSync(st) {
  S.sync = st;
  if (st === 'saved') S.syncAt = new Date();
  updateSyncUI();
}
function updateSyncUI() {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (S.sync === 'saving') { el.textContent = 'сохранение…'; el.className = 'sync-chip saving'; }
  else if (S.sync === 'saved') { el.textContent = 'сохранено на сервере' + (S.syncAt ? ' в ' + S.syncAt.toTimeString().slice(0, 5) : ''); el.className = 'sync-chip saved'; }
  else if (S.sync === 'error') { el.textContent = 'нет связи — прогресс в этом устройстве'; el.className = 'sync-chip error'; }
  else { el.textContent = 'сохранение выключено'; el.className = 'sync-chip off'; }
}
function flushSave() {
  // немедленная отправка при уходе со страницы/сворачивании
  clearTimeout(_syncT);
  if (!S.dirty || !_cloudReady) return;
  cloudSave();
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
    else if (document.visibilityState === 'visible' && _cloudReady && USER) cloudLoad(); // вернулись — подтянуть свежее с сервера
  });
  window.addEventListener('pagehide', flushSave);
}
async function cloudSave() {
  if (!USER || !SB || !_cloudReady) return;
  try {
    const { data: s } = await SB.auth.getSession();
    const token = s && s.session && s.session.access_token;
    if (!token) { setSync('off'); return; }
    const r = await fetch('/api/spin-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', token, data: syncPayload() })
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.ok) { S.dirty = false; setSync('saved'); }
    else { setSync('error'); S.dirty = true; setTimeout(() => { if (S.dirty) cloudSave(); }, 4000); }
  } catch (e) {
    setSync('error'); S.dirty = true;
    setTimeout(() => { if (S.dirty) cloudSave(); }, 4000);
  }
}
async function cloudLoad() {
  if (!USER || !SB) return;
  try {
    const { data: s } = await SB.auth.getSession();
    const token = s && s.session && s.session.access_token;
    if (!token) { _cloudReady = true; setSync('off'); return; }
    const r = await fetch('/api/spin-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', token })
    });
    const j = await r.json().catch(() => null);
    const local = syncPayload();
    const cloud = j && j.data;
    if (cloud && cloud.xp > local.xp) {
      // облако строго новее — берём его
      S.lesson = cloud.lesson || 0; S.done = cloud.done || []; S.practiced = cloud.practiced || [];
      S.xp = cloud.xp || 0; S.correct = cloud.correct || 0; S.attempts = cloud.attempts || 0;
      try { localStorage.setItem(LS_KEY, JSON.stringify(syncPayload())); } catch (e) {}
      if (local.xp > 0) toast('Прогресс загружен с сервера: ' + cloud.xp + ' XP');
    } else if (local.xp > 0 && (!cloud || cloud.xp < local.xp)) {
      // локальный прогресс новее облачного (облако пустое или старое) — поднимем на сервер
      S.dirty = true;
      toast('Прогресс этого устройства отправлен на сервер');
    }
    // равные или оба пустые — ничего не делаем
    updateSyncUI();
  } catch (e) {} finally {
    _cloudReady = true;
    if (S.dirty) cloudSave(); else setSync('saved');
  }
}
function userName(user) {
  // сначала имя из профиля (user_metadata.name), иначе из email
  const meta = (user && user.user_metadata) || {};
  if (meta.name && meta.name.trim()) return meta.name.trim();
  const raw = ((user && user.email) || '').split('@')[0] || '';
  if (!raw) return 'Гость';
  return raw[0].toUpperCase() + raw.slice(1);
}
function boot(user) {
  USER = { id: user.id, email: user.email || '', name: userName(user) };
  LS_KEY = 'spin-lab-v1:' + USER.id;
  refreshExtra();
  loadState();
  loadExtra();
  loadMed();
  loadSpiced();
  $('loginScreen').classList.add('hidden');
  $('appShell').style.display = '';
  $('profileName').textContent = USER.name;
  $('profileAvatar').textContent = USER.name.slice(0, 1).toUpperCase();
  const ma = $('mobileAvatar');
  if (ma) ma.textContent = USER.name.slice(0, 1).toUpperCase();
  syncChrome();
  switchTab(S.tab);
  cloudLoad().then(() => { syncChrome(); switchTab(S.tab); });
}
async function initAuth() {
  SB = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON)
    : null;
  if (!SB) { alert('Не удалось загрузить модуль входа. Обновите страницу.'); return; }
  try {
    const { data } = await SB.auth.getSession();
    if (data && data.session && data.session.user) { boot(data.session.user); return; }
  } catch (e) {}
  $('loginScreen').classList.remove('hidden');
  $('appShell').style.display = 'none';
}
function bindLogin() {
  const doLogin = async () => {
    const raw = $('loginEmail').value.trim();
    const email = (raw.includes('@') ? raw : raw + '@crm.ru').toLowerCase();
    const password = $('loginPass').value;
    const err = $('loginErr');
    if (!email || !password) { err.textContent = 'Введите логин и пароль'; return; }
    const btn = $('loginBtn');
    btn.disabled = true; btn.textContent = 'Вход…'; err.textContent = '';
    try {
      const { data, error } = await SB.auth.signInWithPassword({ email, password });
      if (error) throw error;
      boot(data.user);
    } catch (e) {
      const msg = (e && e.message) || String(e);
      err.textContent = /fetch|network|Failed to fetch|load failed|ECONN|timeout/i.test(msg)
        ? 'Нет связи с базой. Проверьте интернет.'
        : 'Неверный логин или пароль';
      btn.disabled = false; btn.textContent = 'Войти';
    }
  };
  $('loginBtn').addEventListener('click', doLogin);
  $('loginPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  $('logoutBtn').addEventListener('click', async () => {
    flushSave();
    try { await SB.auth.signOut(); } catch (e) {}
    location.reload();
  });
  // клик по профилю (аватар/имя/XP) → вкладка прогресса; chevron ⎋ — выход
  const profBtn = document.querySelector('.profile-button');
  if (profBtn) profBtn.addEventListener('click', (e) => { if (e.target.closest('#logoutBtn')) return; switchTab('progress'); });
  const xpPill = document.querySelector('.xp-pill');
  if (xpPill) xpPill.addEventListener('click', () => switchTab('progress'));
  const mobAv = $('mobileAvatar');
  if (mobAv) mobAv.addEventListener('click', () => switchTab('progress'));
}
const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TYPE_META = {
  S: { n: 'Ситуационный', d: 'факты и контекст' },
  P: { n: 'Проблемный', d: 'недовольство, скрытая потребность' },
  I: { n: 'Извлекающий', d: 'последствия проблемы' },
  N: { n: 'Направляющий', d: 'клиент сам называет ценность' },
  F: { n: 'Характеристика', d: 'факт о продукте' },
  A: { n: 'Преимущество', d: 'как продукт помогает' },
  B: { n: 'Выгода', d: 'закрывает его названную потребность' },
  H: { n: 'Скрытая', d: 'проблема, недовольство, трудность' },
  E: { n: 'Явная', d: 'желание или нужда в решении' },
};
const CH_META = {
  T: { n: 'Обучает', d: 'новая перспектива, коммерческое обучение' },
  D: { n: 'Адаптирует', d: 'под роль и человека, готовит команду' },
  C: { n: 'Контролирует', d: 'ведёт процесс, сроки, деньги' },
  R: { n: 'Угождает', d: 'Строитель Отношений — комфорт вместо пользы' },
};
const SOL_META = {
  R: { n: 'Диагноз', d: 'причины проблемы и их цена' },
  I: { n: 'Влияние', d: 'тянет боль на организацию, Pain Chain' },
  V: { n: 'Видение', d: 'образ решения с ценностью' },
  W: { n: 'Власть', d: 'доступ к ЛПР, контроль процесса' },
  X: { n: 'Рецепт до диагноза', d: 'продукт раньше времени — ошибка' },
};
const CONSULT_META = {
  E: { n: 'Стратег', d: 'рекомендации, тренды, вызов статус-кво' },
  R: { n: 'Уровень 1 · Решения', d: 'адаптация УТП под ситуацию клиента' },
  C: { n: 'Уровень 2 · Коммуникация', d: 'эмпатия, «свой» на каждом этаже' },
  G: { n: 'Уровень 3 · Сопровождение', d: 'ведёт до результата, надёжность' },
  X: { n: 'Сбыт с конвейера', d: 'каталог и цена вместо стратегии — ошибка' },
};
const BANK_BY_MODE = { spin: quiz, need: need, say: say, challenger: ch, solution: sol, consult: cons };
const LETTERS_BY_MODE = { spin: ['S', 'P', 'I', 'N'], need: ['H', 'E'], say: ['F', 'A', 'B'], challenger: ['T', 'D', 'C', 'R'], solution: ['R', 'I', 'V', 'W', 'X'], consult: ['E', 'R', 'C', 'G', 'X'] };
const META_BY_MODE = { spin: TYPE_META, need: TYPE_META, say: TYPE_META, challenger: CH_META, solution: SOL_META, consult: CONSULT_META };

function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), 2200); }
function addXp(n) { S.xp += n; save(); syncChrome(); }
// Уровни — как в играх: первые даются легко, дальше каждый следующий дороже.
// Всего XP нужно для уровня L: 50·(L−1)·(L+2)/2  →  L2=100, L3=250, L4=450, L5=700, L6=1000…
function lvlNeed(l) { return (50 * (l - 1) * (l + 2)) / 2; }
function levelFromXp(xp) { let l = 1; while (lvlNeed(l + 1) <= xp) l++; return l; }
function level() { return levelFromXp(S.xp); }
function syncChrome() {
  $('xpValue').textContent = S.xp;
  $('profileLevel').textContent = level();
  const xs = $('profileXpSmall');
  if (xs) xs.textContent = S.xp;
}

// ============ Вкладки ============
function switchTab(tab) {
  S.tab = tab;
  if (USER) { try { const r = JSON.parse(localStorage.getItem(LS_KEY)) || {}; r.tab = tab; localStorage.setItem(LS_KEY, JSON.stringify(r)); } catch (e) {} }
  document.querySelectorAll('.nav-item, .mobile-nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  $(tab).classList.add('active');
  renderTab(tab);
  window.scrollTo({ top: 0 });
}
function renderTab(tab) {
  if (tab === 'program') renderProgram();
  else if (tab === 'theory') renderTheory();
  else if (tab === 'practice') renderPractice();
  else if (tab === 'cheat') renderCheatPage();
  else if (tab === 'progress') renderProgress();
}
document.querySelectorAll('.nav-item, .mobile-nav button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button') {
    e.preventDefault(); e.target.click();
  }
});

// ============ ПРОГРАММА ============
function renderProgram() {
  refreshExtra();
  curExtra = null; // выход в программу закрывает режим доп-урока
  curMed = null;   // выход в программу закрывает режим MEDDPICC-урока
  curSpiced = null; // выход в программу закрывает режим SPICED-урока (курс 1а)
  const doneN = S.done.length;
  const spicedN = SPICED.filter((x, k) => S.spicedDone.includes(k)).length; // курс 1а входит в общий счёт
  const totalAll = L.length + SPICED.length;
  const next = L.findIndex((l, i) => !S.done.includes(i));
  const cur = next === -1 ? 0 : next;
  const pct = Math.round(((doneN + spicedN) / totalAll) * 100);
  const l = L[cur];
  const intro = (l.intro.length > 130 ? l.intro.slice(0, 130) + '…' : l.intro);
  const practiceN = l.practice ? l.practice.length : 0;
  const groups = COURSES;
  // «Курс 1а · SPICED» встраивается в маршрут сразу после Курса 1 (СПИН),
  // перед Курсом 2 (ВЫЗОВ): рендерим группы с разрезом по индексу СПИН
  const moduleGroupsHtml = groups.map((g, gi) => {
    const html = `
    <div class="section-title-row" style="margin-top:${g.from ? '26px' : '0'}"><div><h2>${g.name}</h2><p>${g.to - g.from} ${pluralN(g.to - g.from, ['урок', 'урока', 'уроков'])} · пройдено ${doneInOf(g)} из ${g.to - g.from}</p></div></div>
    <div class="module-grid">
    ${L.slice(g.from, g.to).map((ll, gi) => {
      const i = g.from + gi;
      const done = S.done.includes(i);
      const isCur = i === cur && !done;
      const open = done || isCur;
      const icon = done ? '✓' : isCur ? '↗' : '🔒';
      const status = done ? 'ЗАВЕРШЁН' : isCur ? 'ТЕКУЩИЙ' : 'ЗАБЛОКИРОВАН';
      const desc = (ll.intro.length > 90 ? ll.intro.slice(0, 90) + '…' : ll.intro);
      const parts = (ll.practice ? ll.practice.length : 0) || ll.blocks.length;
      return `<article class="module-card ${done ? 'completed' : isCur ? 'current' : 'locked'}" ${open ? `data-open="${i}" tabindex="0" role="button"` : ''} title="${open ? '' : 'Откроется после прохождения текущего урока'}">
        <div class="module-number">${String(gi + 1).padStart(2, '0')}</div>
        <div class="module-icon">${icon}</div>
        <span class="status-label">${status}</span>
        <h3>${esc(ll.title)}</h3>
        <p>${esc(desc)}</p>
        <div class="module-footer"><span>${esc(ll.mins)} · ${parts} раздела</span><strong>${done ? '100%' : '0%'}</strong></div>
        <div class="module-progress"><i style="width:${done ? 100 : 0}%"></i></div>
      </article>`;
    }).join('')}
    </div>`;
    // после Курса 1 (СПИН, gi===0) встраиваем курс 1а — SPICED
    const spicedBlock = (gi === 0 && SPICED.length) ? spicedSectionHtml() : '';
    return html + spicedBlock;
  }).join('');

  const co = courseOf(cur);
  const allDone = doneN >= L.length && L.length > 0;
  const METHODS = SPIN_DATA.methods || [];
  const FINALE = SPIN_DATA.finale;
  // метод-карточки: СПИН → SPICED (курс 1а) → ВЫЗОВ/РЕШЕНИЯ/КОНСУЛЬТ → MEDDPICC → ПРОАКТИВ(скоро)
  const _methodEntries = [];
  METHODS.forEach((m, mi) => {
    if (mi === 1 && SPICED.length) _methodEntries.push({ t: 'spiced' });   // сразу после СПИН
    if (m.soon && MED.length) _methodEntries.push({ t: 'med' });           // перед «скоро»-карточкой
    _methodEntries.push({ t: 'm', mi });
  });
  $('programBody').innerHTML = `
  <div class="page-heading">
    <div>
      <p class="eyebrow">ПРОГРАММА ОБУЧЕНИЯ</p>
      <h1 id="program-title">Навыки продаж</h1>
      <p>${L.length + SPICED.length} ${pluralN(L.length + SPICED.length, ['урок', 'урока', 'уроков'])} · ${COURSES.length + (MED.length ? 1 : 0) + (SPICED.length ? 1 : 0)} ${pluralN(COURSES.length + (MED.length ? 1 : 0) + (SPICED.length ? 1 : 0), ['курс', 'курса', 'курсов'])}</p>
    </div>
  </div>

  <article class="about-card">
    <div class="about-mark">?</div>
    <div class="about-copy">
      <h2>О чём эта программа</h2>
      <p>Большинство продавцов учатся на своих ошибках — годами. Эта программа даёт системный навык: как строить разговор так, чтобы клиент сам захотел купить. В основе — пять проверенных мировых методологий продаж, и каждая отвечает на вопрос «что делать, когда…». Короткие уроки-теория, практика с проверкой, тренажёр реакций и разборы реальных ситуаций — всё на материале сложных продаж: оборудование, медицина, решения, которые зреют месяцами.</p>
    </div>
  </article>

  <article class="continue-card">
    <div class="continue-copy">
      <div class="lesson-meta"><span class="module-tag">${next === -1 ? 'КУРС ПРОЙДЕН' : 'КУРС ' + (co.idx + 1) + ' · УРОК ' + co.num}</span><span>${next === -1 ? L.length + ' из ' + L.length + ' уроков' : 'из ' + co.len + ' уроков курса'}</span></div>
      <h2>${esc(next === -1 ? 'Вы прошли весь курс. Повторите любой урок или идите в разборы.' : l.title)}</h2>
      <p>${esc(next === -1 ? 'Курс пройден — теперь закрепите навык в тренажёре и разборах.' : intro)}</p>
      <div class="continue-actions">
        <button class="primary-button" data-open="${next === -1 ? 0 : cur}">${next === -1 ? 'Повторить с начала' : 'Продолжить урок'} <span>→</span></button>
        <span class="duration">◷ ${esc(l.mins)}</span>
      </div>
    </div>
    <div class="continue-visual" aria-hidden="true">
      <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
      <div class="speech-card speech-one">«Как вы решаете<br>эту задачу сегодня?»</div>
      <div class="speech-card speech-two">Продаёт тот,<br>кто спрашивает</div>
      <span class="big-number">${String(co.num).padStart(2, '0')}</span>
    </div>
  </article>

  <div class="section-title-row"><div><h2>Методы продаж</h2><p>Коротко о каждом — подробно в курсах ниже</p></div></div>
  <div class="module-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    ${_methodEntries.map((e) => {
      if (e.t === 'spiced') {
        const _sd = SPICED.filter((ll, k) => S.spicedDone.includes(k)).length;
        const _all = SPICED.length && _sd >= SPICED.length;
        const _md = SPIN_DATA.spiced || {};
        return `
        <article class="module-card method-card ${_all ? 'completed' : 'current'}" data-spicedgo="1" tabindex="0" role="button" title="Курс 1а SPICED — открыть">
          <div class="module-icon">${esc(_md.icon || '1А')}</div>
          <span class="status-label">${_all ? 'ПРОЙДЕН' : esc(_md.tag || 'КУРС 1А')}</span>
          <h3>${esc(_md.title || 'SPICED — расширение СПИН')}</h3>
          <p>${esc(_md.short || '')}</p>
          <div class="method-when"><strong>Когда:</strong> ${esc(_md.when || '')}</div>
          <div class="module-footer"><span>${_sd} из ${SPICED.length} ${pluralN(SPICED.length, ['урок', 'урока', 'уроков'])}</span><strong>→</strong></div>
          <div class="module-progress"><i style="width:${SPICED.length ? Math.round((_sd / SPICED.length) * 100) : 0}%"></i></div>
        </article>`;
      }
      if (e.t === 'med') {
        const _sd = MED.filter((ll, k) => S.medDone.includes(k)).length;
        const _all = MED.length && _sd >= MED.length;
        const _md = SPIN_DATA.meddicc || {};
        return `
        <article class="module-card method-card ${_all ? 'completed' : 'current'}" data-medgo="1" tabindex="0" role="button" title="Курс MEDDPICC — открыть">
          <div class="module-icon">${esc(_md.icon || 'M')}</div>
          <span class="status-label">${_all ? 'ПРОЙДЕН' : esc(_md.tag || 'MEDDPICC')}</span>
          <h3>${esc(_md.title || 'MEDDPICC: квалификация сделки')}</h3>
          <p>${esc(_md.short || '')}</p>
          <div class="method-when"><strong>Когда:</strong> ${esc(_md.when || '')}</div>
          <div class="module-footer"><span>${_sd} из ${MED.length} ${pluralN(MED.length, ['урок', 'урока', 'уроков'])}</span><strong>→</strong></div>
          <div class="module-progress"><i style="width:${MED.length ? Math.round((_sd / MED.length) * 100) : 0}%"></i></div>
        </article>`;
      }
      const m = METHODS[e.mi];
      const mi = e.mi;
      const mc = m.open != null ? courseOf(m.open).g : null;
      const doneIn = mc ? L.slice(mc.from, mc.to).filter((ll, k) => S.done.includes(mc.from + k)).length : 0;
      const len = mc ? mc.to - mc.from : 0;
      const allM = mc && doneIn >= len;
      return `
      <article class="module-card method-card ${m.soon ? 'locked' : 'current'} ${allM ? 'completed' : ''}" ${m.soon ? '' : `data-open="${m.open}" tabindex="0" role="button"`} ${m.soon ? 'title="Курс скоро появится — книга в работе"' : ''}>
        <div class="module-icon">${m.soon ? '🔒' : m.icon}</div>
        <span class="status-label">${m.soon ? 'СКОРО' : allM ? 'ПРОЙДЕН' : esc(m.tag)}</span>
        <h3>${esc(m.title)}</h3>
        <p>${esc(m.short)}</p>
        <div class="method-when"><strong>Когда:</strong> ${esc(m.when)}</div>
        <div class="module-footer"><span>${m.soon ? 'книга в работе' : `${doneIn} из ${len} ${pluralN(len, ['урок', 'урока', 'уроков'])}`}</span><strong>${m.soon ? '' : '→'}</strong></div>
        ${mc ? `<div class="module-progress"><i style="width:${len ? Math.round((doneIn / len) * 100) : 0}%"></i></div>` : ''}
      </article>`;
    }).join('')}
  </div>

  ${EXTRA.length ? `
  <div class="section-title-row" style="margin-top:26px"><div><h2>Дополнительно</h2><p>Выжимки книг — короткие уроки сверх программы</p></div></div>
  <div class="module-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    ${EXTRA.map((x, xi) => {
      const rd = S.extraDone.includes(xi);
      const parts = (x.practice ? x.practice.length : 0) || x.blocks.length;
      const desc = x.intro.length > 100 ? x.intro.slice(0, 100) + '…' : x.intro;
      return `
      <article class="module-card method-card current ${rd ? 'completed' : ''}" data-extra="${xi}" tabindex="0" role="button" title="Выжимка книги — открыть">
        <div class="module-icon">📘</div>
        <span class="status-label">${rd ? 'ПРОЧИТАНО' : 'КНИГА'}</span>
        <h3>${esc(x.title)}</h3>
        <p>${esc(desc)}</p>
        <div class="module-footer"><span>${esc(x.mins)} · ${parts} раздела</span><strong>→</strong></div>
        ${rd ? `<div class="module-progress"><i style="width:100%"></i></div>` : ''}
      </article>`;
    }).join('')}
  </div>` : ''}

  <div class="section-title-row">
    <div><h2>Маршрут обучения</h2><p><span id="completedCount">${doneN + spicedN}</span> из ${totalAll} уроков пройдено</p></div>
    <div class="overall-progress"><span id="overallPercent">${pct}%</span><div><i id="overallBar" style="width:${pct}%"></i></div></div>
  </div>
  ${moduleGroupsHtml}
  ${allDone && FINALE ? `
  <div class="section-title-row" style="margin-top:34px"><div><h2>${esc(FINALE.title)}</h2><p>После всех курсов — как выбирать метод</p></div></div>
  <article class="finale-card">
    <p class="finale-intro">${esc(FINALE.intro)}</p>
    ${FINALE.rows.map((r) => `
      <div class="finale-row">
        <div class="finale-sit"><span>Ситуация</span>${esc(r.s)}</div>
        <div class="finale-m">${esc(r.m)}</div>
        <div class="finale-why"><span>Почему</span>${esc(r.why)}</div>
      </div>
    `).join('')}
    ${FINALE.note ? `<div class="example-block"><div class="example-label">ВАЖНО</div><div class="coach-note"><p>${esc(FINALE.note)}</p></div></div>` : ''}
  </article>
  ` : ''}
  `;

  $('programBody').querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.jump)));
  $('programBody').querySelectorAll('[data-cheat]').forEach((b) => b.addEventListener('click', () => switchTab('cheat')));
  $('programBody').querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { S.lesson = +b.dataset.open; curExtra = null; curMed = null; curSpiced = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-extra]').forEach((b) => b.addEventListener('click', () => { curExtra = +b.dataset.extra; curMed = null; curSpiced = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-med]').forEach((b) => b.addEventListener('click', () => { curMed = +b.dataset.med; curExtra = null; curSpiced = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-spiced]').forEach((b) => b.addEventListener('click', () => { curSpiced = +b.dataset.spiced; curMed = null; curExtra = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-medgo]').forEach((b) => b.addEventListener('click', () => { const n = MED.findIndex((x, k) => !S.medDone.includes(k)); curMed = n === -1 ? 0 : n; curSpiced = null; curExtra = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-spicedgo]').forEach((b) => b.addEventListener('click', () => { const n = SPICED.findIndex((x, k) => !S.spicedDone.includes(k)); curSpiced = n === -1 ? 0 : n; curMed = null; curExtra = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('.module-card.locked:not(.method-card)').forEach((b) => b.addEventListener('click', () => toast('Сначала пройдите текущий урок — этот откроется после его практики')));
  $('programBody').querySelectorAll('.method-card.locked').forEach((b) => b.addEventListener('click', () => toast('Курс скоро появится — книга в работе')));
}

// ============ ТЕОРИЯ (уроки) ============
function renderTheory() {
  refreshExtra();
  if (curMed !== null && curMed >= MED.length) { curMed = null; }  // открытый MED-урок стал недоступен — сброс
  if (curExtra !== null && curExtra >= EXTRA.length) { curExtra = null; } // открытый урок стал невидим — сброс
  if (curSpiced !== null && curSpiced >= SPICED.length) { curSpiced = null; } // открытый SPICED-урок стал недоступен — сброс
  const mode = curSpiced !== null ? 'spiced' : curMed !== null ? 'med' : curExtra !== null ? 'extra' : 'main';
  const i = mode === 'spiced' ? curSpiced : mode === 'med' ? curMed : mode === 'extra' ? curExtra : S.lesson;
  const l = mode === 'spiced' ? SPICED[i] : mode === 'med' ? MED[i] : mode === 'extra' ? EXTRA[i] : L[i];
  const done = mode === 'spiced' ? S.spicedDone.includes(i) : mode === 'med' ? S.medDone.includes(i) : mode === 'extra' ? false : S.done.includes(i);
  const free = mode !== 'main'; // у выжимок, MEDDPICC и SPICED практика не блокирует следующий шаг
  const hasP = !(l.practice && l.practice.length) || (free ? true : S.practiced.includes(i)); // практика пройдена (или её нет) — можно дальше
  pState = { i: 0, pick: null, score: 0 }; // практика урока всегда начинается с первого вопроса

  const curT = L.findIndex((x, k) => !S.done.includes(k));
  let railItems = '';
  if (mode === 'spiced') {
    railItems = `<div class="lesson-group-label"><span>Курс 1а · SPICED</span>ДИАГНОСТИКА</div>` + SPICED.map((ll, ei) => {
      const d = S.spicedDone.includes(ei);
      return `<button class="lesson-item ${ei === i ? 'active' : d ? 'done' : ''}" data-spiced="${ei}" title="Урок расширения СПИН">
        <span>${ei + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${d ? '<b>✓</b>' : ''}
      </button>`;
    }).join('');
  } else if (mode === 'med') {
    railItems = `<div class="lesson-group-label"><span>Курс MEDDPICC</span>КВАЛИФИКАЦИЯ</div>` + MED.map((ll, ei) => {
      const d = S.medDone.includes(ei);
      return `<button class="lesson-item ${ei === i ? 'active' : d ? 'done' : ''}" data-med="${ei}" title="Урок квалификации сделки">
        <span>${ei + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${d ? '<b>✓</b>' : ''}
      </button>`;
    }).join('');
  } else if (mode === 'extra') {
    railItems = `<div class="lesson-group-label"><span>Книги</span>ВЫЖИМКИ</div>` + EXTRA.map((ll, ei) => {
      return `<button class="lesson-item ${ei === i ? 'active' : ''}" data-extra="${ei}" title="Выжимка книги">
        <span>${ei + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${S.extraDone.includes(ei) ? '<b>✓</b>' : ''}
      </button>`;
    }).join('');
  } else {
    railItems = COURSES.map((g, gi) => {
      const label = `<div class="lesson-group-label"><span>Курс ${COURSES.indexOf(g) + 1}</span>${g.tag}</div>`;
      const items = L.slice(g.from, g.to).map((ll, gi) => {
        const j = g.from + gi;
        const done = S.done.includes(j);
        const locked = !done && curT !== -1 && j > curT;
        return `<button class="lesson-item ${j === i ? 'active' : done ? 'done' : locked ? 'locked' : ''}" data-lesson="${j}" ${locked ? 'data-locked="1"' : ''} title="${locked ? 'Откроется после урока ' + (curT + 1) : ''}">
          <span>${gi + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${done ? '<b>✓</b>' : locked ? '<b>🔒</b>' : ''}
        </button>`;
      }).join('');
      const spicedRail = (gi === 0 && SPICED.length) ? `<div class="lesson-group-label"><span>Курс 1а</span>SPICED</div>` + SPICED.map((ll, ei) => {
        const d = S.spicedDone.includes(ei);
        return `<button class="lesson-item ${d ? 'done' : ''}" data-spiced="${ei}" title="Урок расширения СПИН — открыть">
          <span>${ei + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${d ? '<b>✓</b>' : ''}
        </button>`;
      }).join('') : '';
      return label + items + spicedRail;
    }).join('');
  }
  // Шпаргалки теперь — отдельная вкладка (внизу), дубль в списке уроков не нужен

  const co = mode === 'main' ? courseOf(i) : null;
  const kicker = mode === 'spiced' ? 'КУРС 1А · SPICED · УРОК ' + (i + 1) + ' ИЗ ' + SPICED.length : mode === 'med' ? 'КУРС MEDDPICC · УРОК ' + (i + 1) + ' ИЗ ' + MED.length : mode === 'extra' ? 'ДОПОЛНИТЕЛЬНО · ВЫЖИМКА ИЗ КНИГИ' : 'КУРС ' + (co.idx + 1) + ' · УРОК ' + co.num + ' ИЗ ' + co.len;
  const railTitle = mode === 'spiced' ? 'Расширение СПИН' : mode === 'med' ? 'Квалификация сделки' : mode === 'extra' ? 'Выжимки книг' : 'Уроки курсов';
  const railEyebrow = mode === 'spiced' ? 'SPICED · КУРС 1А' : mode === 'med' ? 'MEDDPICC' : mode === 'extra' ? 'ДОПОЛНИТЕЛЬНО' : 'ПРОГРАММА';
  $('theoryBody').innerHTML = `
    <aside class="lesson-rail">
      <button class="back-link" data-jump="program">← К программе</button>
      <p class="eyebrow">${railEyebrow}</p>
      <h3>${railTitle}</h3>
      <div class="lesson-list">${railItems}</div>
    </aside>
    <article class="lesson-content">
      <div class="lesson-kicker"><span>${kicker}</span><span>◷ ${esc(l.mins)}</span></div>
      <h1 id="theory-title">${esc(l.title)}</h1>
      <p class="lead">${esc(l.intro)}</p>
      ${l.book ? `<p style="font-size:13px;opacity:.7;margin-top:10px">📖 По книге: ${esc(l.book)}</p>` : ''}
      ${l.blocks.map((b, bi) => `
        <h2 class="content-heading">${esc(b.h)}</h2>
        ${b.p.map((par) => `<p>${esc(par)}</p>`).join('')}
        ${b.ex ? `<div class="example-block"><div class="example-label">ПРИМЕР</div><div class="coach-note"><p>${esc(b.ex)}</p></div></div>` : ''}
      `).join('')}
      <h2 class="content-heading">Запомнить</h2>
      <div class="question-levels">
        ${l.remember.map((r, ri) => `<div class="level-card"><span>!</span><div><p>${esc(r)}</p></div></div>`).join('')}
      </div>
      ${practiceHtml(l, i, done)}
      <div class="lesson-footer">
        ${mode === 'spiced'
          ? `<label class="complete-check"><input type="checkbox" id="lessonComplete" ${done ? 'checked' : ''} /><span></span>${done ? 'Урок изучен ✓' : 'Урок изучен'}</label>
             ${i + 1 < SPICED.length
               ? `<button class="primary-button" id="nextBtn" data-spicednext="${i + 1}">Следующий урок <span>→</span></button>`
               : `<button class="primary-button" id="nextBtn" data-jump="program">К программе <span>→</span></button>`}`
          : mode === 'med'
          ? `<label class="complete-check"><input type="checkbox" id="lessonComplete" ${done ? 'checked' : ''} /><span></span>${done ? 'Урок изучен ✓' : 'Урок изучен'}</label>
             ${i + 1 < MED.length
               ? `<button class="primary-button" id="nextBtn" data-mednext="${i + 1}">Следующий урок <span>→</span></button>`
               : `<button class="primary-button" id="nextBtn" data-jump="program">К программе <span>→</span></button>`}`
          : mode === 'extra'
          ? `<label class="complete-check"><input type="checkbox" id="lessonComplete" ${S.extraDone.includes(i) ? 'checked' : ''} /><span></span>${S.extraDone.includes(i) ? 'Прочитано ✓' : 'Отметить прочитанным'}</label>
             <button class="primary-button" id="nextBtn" data-jump="program">К программе <span>→</span></button>`
          : `<label class="complete-check"><input type="checkbox" id="lessonComplete" ${done ? 'checked' : ''} /><span></span>${done ? 'Урок пройден ✓' : 'Урок изучен'}</label>
             ${i + 1 < L.length
               ? `<button class="primary-button" id="nextBtn" data-next="${i + 1}" ${hasP ? '' : 'disabled'}>Следующий урок <span>→</span></button>`
               : `<button class="primary-button" id="nextBtn" data-jump="progress" ${hasP ? '' : 'disabled'}>К прогрессу <span>→</span></button>`}`}
      </div>
      ${mode === 'main' ? (hasP ? '' : '<p class="next-hint">Сначала ответьте на все вопросы практики «Проверь себя» — тогда откроется следующий урок.</p>') : ''}
    </article>`;

  $('theoryBody').querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.jump)));
  $('theoryBody').querySelectorAll('[data-spiced]').forEach((b) => b.addEventListener('click', () => { curSpiced = +b.dataset.spiced; curMed = null; curExtra = null; window.scrollTo({ top: 0 }); renderTheory(); }));
  $('theoryBody').querySelectorAll('[data-med]').forEach((b) => b.addEventListener('click', () => { curMed = +b.dataset.med; curExtra = null; curSpiced = null; window.scrollTo({ top: 0 }); renderTheory(); }));
  $('theoryBody').querySelectorAll('[data-extra]').forEach((b) => b.addEventListener('click', () => { curExtra = +b.dataset.extra; curMed = null; curSpiced = null; window.scrollTo({ top: 0 }); renderTheory(); }));
  $('theoryBody').querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.locked) { toast('Сначала пройдите текущий урок — этот откроется после его практики'); return; }
    S.lesson = +b.dataset.lesson; curExtra = null; curMed = null; curSpiced = null; window.scrollTo({ top: 0 }); renderTheory();
  }));
  const cheatBtn = $('theoryBody').querySelector('[data-cheat]');
  if (cheatBtn) cheatBtn.addEventListener('click', () => switchTab('cheat'));
  const nxt = $('theoryBody').querySelector('[data-next]');
  if (nxt) nxt.addEventListener('click', () => { S.lesson = +nxt.dataset.next; curExtra = null; curMed = null; curSpiced = null; window.scrollTo({ top: 0 }); renderTheory(); });
  const mn = $('theoryBody').querySelector('[data-mednext]');
  if (mn) mn.addEventListener('click', () => { curMed = +mn.dataset.mednext; curExtra = null; curSpiced = null; window.scrollTo({ top: 0 }); renderTheory(); });
  const sn = $('theoryBody').querySelector('[data-spicednext]');
  if (sn) sn.addEventListener('click', () => { curSpiced = +sn.dataset.spicednext; curExtra = null; curMed = null; window.scrollTo({ top: 0 }); renderTheory(); });
  const chk = $('lessonComplete');
  if (chk) chk.addEventListener('change', () => {
    if (mode === 'spiced') {
      if (chk.checked && !S.spicedDone.includes(i)) { S.spicedDone.push(i); toast('Урок изучен — можно идти дальше'); }
      else if (!chk.checked && S.spicedDone.includes(i)) { S.spicedDone = S.spicedDone.filter((x) => x !== i); }
      saveSpiced(); renderTheory(); return;
    }
    if (mode === 'med') {
      if (chk.checked && !S.medDone.includes(i)) { S.medDone.push(i); toast('Урок изучен — можно идти дальше'); }
      else if (!chk.checked && S.medDone.includes(i)) { S.medDone = S.medDone.filter((x) => x !== i); }
      saveMed(); renderTheory(); return;
    }
    if (mode === 'extra') {
      if (chk.checked && !S.extraDone.includes(i)) { S.extraDone.push(i); toast('Выжимка прочитана ✓'); }
      else if (!chk.checked && S.extraDone.includes(i)) { S.extraDone = S.extraDone.filter((x) => x !== i); }
      saveExtra(); renderTheory(); return;
    }
    if (chk.checked && !S.done.includes(i)) { S.done.push(i); addXp(30); toast('Урок пройден · +30 XP'); }
    else if (!chk.checked && S.done.includes(i)) { S.done = S.done.filter((x) => x !== i); S.xp = Math.max(0, S.xp - 30); toast('Урок снят · −30 XP'); }
    save(); syncChrome(); renderTheory();
  });
  bindPractice(i, done, mode);
}

// практика урока (по одному вопросу)
let pState = { i: 0, pick: null, score: 0 };
function practiceHtml(l, i, done) {
  if (!l.practice || !l.practice.length) return '';
  const q = l.practice[pState.i] || l.practice[0];
  if (!q) return '';
  const total = l.practice.length;
  const n = pState.i + 1;
  return `
    <h2 class="content-heading">Проверь себя · ${n} из ${total}</h2>
    <div class="question-levels" id="pArea">
      <div class="level-card" style="grid-template-columns:1fr;gap:10px">
        <p style="font-weight:800;color:var(--ink);font-size:17px">${esc(q.q)}</p>
        <div id="pOpts">
          ${q.options.map((o, oi) => `<button class="answer-option" data-p="${oi}" ${pState.pick !== null ? 'disabled' : ''}><span>${String.fromCharCode(65 + oi)}</span><p>${esc(o.label)}</p></button>`).join('')}
        </div>
        <div id="pFb"></div>
      </div>
    </div>`;
}
function bindPractice(lessonIdx, done, mode) {
  const l = mode === 'spiced' ? SPICED[lessonIdx] : mode === 'med' ? MED[lessonIdx] : mode === 'extra' ? EXTRA[lessonIdx] : L[lessonIdx];
  if (!l.practice || !l.practice.length) return;
  const q = l.practice[pState.i] || l.practice[0];
  const total = l.practice.length;
  const last = pState.i + 1 >= total;
  document.querySelectorAll('#pOpts .answer-option').forEach((b) => b.addEventListener('click', () => {
    if (pState.pick !== null) return;
    const oi = +b.dataset.p;
    const o = q.options[oi];
    pState.pick = oi;
    S.attempts++; if (o.good) { S.correct++; }
    if (last && mode === 'main' && !S.practiced.includes(lessonIdx)) {
      S.practiced.push(lessonIdx);
      toast('Практика пройдена — следующий урок открыт');
    }
    save();
    if (last && mode === 'main') {
      // разблокировать переход к следующему уроку
      const nb = document.getElementById('nextBtn');
      if (nb) nb.disabled = false;
      const nh = document.querySelector('.next-hint');
      if (nh) nh.remove();
    }
    b.classList.add(o.good ? 'correct' : 'wrong');
    document.querySelectorAll('#pOpts .answer-option').forEach((x, xi) => { if (xi !== oi && !o.good) x.classList.add(xi === q.options.findIndex((z) => z.good) ? 'correct' : 'dim'); });
    $('pFb').innerHTML = `<div class="feedback-area"><div class="feedback-tip"><strong>${o.good ? '✓ Верно' : '✗ Не совсем'}</strong><p>${esc(o.fb)}</p></div><button class="primary-button" id="pNext">${last ? 'Показать итог' : 'Дальше →'}</button></div>`;
    $('pNext').addEventListener('click', () => {
      if (last) {
        const goodN = l.practice.filter((x) => true).length;
        const verdict = pState.score >= goodN ? '' : '';
        $('pArea').outerHTML = `
          <div class="question-levels" id="pDone">
            <div class="level-card" style="grid-template-columns:1fr;gap:6px;text-align:center">
              <h3 style="font-size:26px">${mode === 'main' ? 'Практика урока ' + (lessonIdx + 1) + ' завершена' : 'Практика завершена'}</h3>
              <p>${mode === 'med' ? 'Разберите фидбеки выше — и отметьте урок изученным.' : mode === 'extra' ? 'Выжимка усвоена — можно отметить её прочитанной выше.' : 'Разберите фидбеки выше — и отметьте урок пройденным.'}</p>
            </div>
          </div>`;
      } else { pState.i++; pState.pick = null; const html = practiceHtml(l, lessonIdx, done); const area = document.getElementById('pArea'); area.outerHTML = html.replace('id="pArea"', 'id="pArea"'); bindPractice(lessonIdx, done, mode); }
    });
    const goodIdx = q.options.findIndex((z) => z.good);
    document.querySelectorAll('#pOpts .answer-option').forEach((x, xi) => { if (xi !== oi && xi === goodIdx && !o.good) x.classList.add('correct'); });
  }));
  pState.pick = null;
}

// шпаргалка как «урок 99»
// ============ ПРАКТИКА (тренажёр + кейсы) ============
function renderPractice() {
  const b = $('practiceBody');
  b.innerHTML = `
    <div class="practice-head">
      <div class="seg-control">
        <button class="${S.pTab === 'trainer' ? 'active' : ''}" data-ptab="trainer">Тренажёр</button>
        <button class="${S.pTab === 'cases' ? 'active' : ''}" data-ptab="cases">Кейсы</button>
      </div>
    </div>
    <div id="practiceContent"></div>`;
  b.querySelectorAll('[data-ptab]').forEach((x) => x.addEventListener('click', () => { S.pTab = x.dataset.ptab; renderPractice(); }));
  if (S.pTab === 'cases') renderCases(); else renderTrainer();
}

// ============ ШПАРГАЛКИ ============
function renderCheatPage() {
  const b = $('cheatBody');
  b.innerHTML = `
    <div class="page-heading">
      <p class="eyebrow">ШПАРГАЛКИ</p>
      <h1 id="cheat-title">Шпаргалки</h1>
      <p>Только самое нужное — освежить перед встречей. Нажмите на памятку, чтобы раскрыть. Подробности — в уроках курсов.</p>
    </div>
    <div class="cheat-list">
      ${cheat.map((c, ci) => `
        <div class="cheat-item">
          <button class="cheat-row" data-cheat-idx="${ci}" aria-expanded="false">
            <span class="cheat-num">${ci + 1}</span>
            <span class="cheat-row-main"><strong>${esc(c.title)}</strong><small>${c.items.length} ${pluralN(c.items.length, ['пункт', 'пункта', 'пунктов'])} · ${esc(c.intro || '')}</small></span>
            <span class="cheat-chevron">▾</span>
          </button>
          <div class="cheat-body" id="cheatBody-${ci}" hidden>
            <div class="question-levels">
              ${c.items.map((it, ii) => `<div class="level-card"><span>${ii + 1}</span><div><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></div></div>`).join('')}
            </div>
            ${c.note ? `<div class="example-block"><div class="example-label">ВАЖНО</div><div class="coach-note"><p>${esc(c.note)}</p></div></div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>`;
  b.querySelectorAll('[data-cheat-idx]').forEach((row) => row.addEventListener('click', () => {
    const idx = row.dataset.cheatIdx;
    const body = document.getElementById('cheatBody-' + idx);
    const opening = body.hidden;
    // закрываем все, открываем одну
    b.querySelectorAll('.cheat-body').forEach((x) => { x.hidden = true; });
    b.querySelectorAll('.cheat-row').forEach((r) => { r.classList.remove('open'); r.setAttribute('aria-expanded', 'false'); });
    if (opening) {
      body.hidden = false;
      row.classList.add('open');
      row.setAttribute('aria-expanded', 'true');
      body.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }));
}

// ============ ТРЕНАЖЁР ============
function renderTrainer() {
  const b = $('practiceContent');
  // выбор режима
  if (!S.tMode) {
    const modeCourse = { spin: 0, say: 0, need: 0, challenger: 1, solution: 2, consult: 3 };
    const modeCard = {
      spin:   { icon: 'S', n: 'Вопросы СПИН', l: `${quiz.length} РЕПЛИК`, d: 'Ситуационный, проблемный, извлекающий или направляющий — определите тип вопроса (уроки 2–5).' },
      say:    { icon: 'B', n: 'Типы высказываний', l: `${say.length} РЕПЛИК`, d: 'Характеристика, преимущество или выгода — это тоже СПИН: продаёт только выгода, характеристика разжигает торг (урок 6).' },
      need:   { icon: '?', n: 'Потребности клиента', l: `${need.length} РЕПЛИК`, d: 'Скрытая или явная? Вся механика СПИН — превратить скрытую потребность в явную (урок 3).' },
      challenger: { icon: 'C', n: 'Продажа через вызов', l: `${ch.length} РЕПЛИК`, d: 'Обучает, адаптирует, контролирует или угождает — ходы курса 2 (уроки 9–10).' },
      solution: { icon: 'S', n: 'Продажи решений', l: `${sol.length} РЕПЛИК`, d: 'Диагноз, влияние, видение, власть — или рецепт до диагноза? Курс 3, уроки 11–12.' },
      consult: { icon: '✦', n: 'Консультативные продажи', l: `${cons.length} РЕПЛИК`, d: 'Стратег, Решения, Коммуникация, Сопровождение — или сбыт с конвейера? Курс 4, уроки 13–14.' },
    };
    const modeKeys = Object.keys(modeCard);
    b.innerHTML = `
      <div class="page-heading">
        <p class="eyebrow">ТРЕНАЖЁР</p>
        <h1 id="trainer-title">Тренируйте реакцию</h1>
        <p>Тренажёр привязан к курсам программы: каждый режим отрабатывает навыки из уроков. Начните с курса 1 — СПИН.</p>
      </div>
      ${COURSES.map((c, ci) => {
        const ms = modeKeys.filter((m) => modeCourse[m] === ci);
        if (!ms.length) return '';
        return `
        <div class="section-title-row" style="margin-top:${ci ? '30px' : '22px'}">
          <div><h2>${esc(c.name)}</h2><p>уроки ${c.from + 1}–${c.to} · режимы этого курса</p></div>
        </div>
        <div class="module-grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
          ${ms.map((m) => {
            const k = modeCard[m];
            return `<article class="module-card current" data-mode="${m}">
              <div class="module-icon">${k.icon}</div>
              <span class="status-label">${k.l}</span>
              <h3>${k.n}</h3>
              <p>${k.d}</p>
              <div class="module-footer"><span>~5 мин</span><strong>→</strong></div>
            </article>`;
          }).join('')}
        </div>`;
      }).join('')}`;
    b.querySelectorAll('[data-mode]').forEach((x) => x.addEventListener('click', () => { S.tMode = x.dataset.mode; S.tOrder = shuffle(BANK_BY_MODE[x.dataset.mode] || quiz); S.tIdx = 0; S.tScore = 0; S.tPick = null; renderTrainer(); }));
    return;
  }
  const bank = BANK_BY_MODE[S.tMode] || quiz;
  const meta = shuffle(LETTERS_BY_MODE[S.tMode] || ['S', 'P', 'I', 'N']);
  const tmeta = META_BY_MODE[S.tMode] || TYPE_META;
  if (S.tIdx >= S.tOrder.length) {
    // итог
    const pct = Math.round((S.tScore / S.tOrder.length) * 100);
    const verdict = pct >= 85 ? 'Отличная реакция. Идите в кейсы!' : pct >= 60 ? 'Неплохо. Повторите теорию и попробуйте ещё раз.' : 'Пока рано. Вернитесь к урокам.';
    b.innerHTML = `
      <div class="page-heading"><p class="eyebrow">ТРЕНАЖЁР · ИТОГ</p><h1>${S.tScore} из ${S.tOrder.length}</h1><p>${pct}% верных · ${verdict}</p></div>
      <div class="feedback-actions">
        <button class="primary-button" id="tAgain">Ещё раз</button>
        <button class="secondary-button" id="tMode">Другой режим</button>
      </div>`;
    $('tAgain').addEventListener('click', () => { S.tOrder = shuffle(bank); S.tIdx = 0; S.tScore = 0; S.tPick = null; renderTrainer(); });
    $('tMode').addEventListener('click', () => { S.tMode = null; renderTrainer(); });
    return;
  }
  const q = S.tOrder[S.tIdx];
  const ui = ({ spin: { eyebrow: 'ВОПРОСЫ СПИН', title: 'Что это за приём?', sub: 'Определите тип и увидите разбор.', chip: 'тип вопроса', who: 'Вопрос клиенту', sub2: 'определите приём', ask: 'Какой это тип вопроса СПИН?', avatar: 'В' }, need: { eyebrow: 'ПОТРЕБНОСТИ КЛИЕНТА', title: 'Что говорит клиент?', sub: 'Скрытая потребность или явная? Определите и увидите разбор.', chip: 'тип потребности', who: 'Высказывание покупателя', sub2: 'оцените потребность', ask: 'Клиент выражает скрытую или явную потребность?', avatar: 'К' }, challenger: { eyebrow: 'ПРОДАЖА ЧЕРЕЗ ВЫЗОВ', title: 'Что это за ход?', sub: 'Обучает, адаптирует, контролирует — или угождает? Определите и увидите разбор.', chip: 'стиль хода', who: 'Действие продавца', sub2: 'определите стиль', ask: 'Что это за ход?', avatar: 'Ч' }, solution: { eyebrow: 'ПРОДАЖИ РЕШЕНИЙ', title: 'Диагноз или рецепт?', sub: 'Причина, влияние, видение, власть — или продукт раньше времени?', chip: 'этап продажи', who: 'Действие продавца', sub2: 'определите этап', ask: 'Что делает продавец?', avatar: 'S' }, consult: { eyebrow: 'КОНСУЛЬТАТИВНЫЕ ПРОДАЖИ', title: 'Стратег или сбыт?', sub: 'Рекомендация, Решение, Коммуникация, Сопровождение — или каталог?', chip: 'уровень хода', who: 'Действие продавца', sub2: 'определите уровень', ask: 'Что делает продавец?', avatar: 'К' }, say: { eyebrow: 'ТИПЫ ВЫСКАЗЫВАНИЙ', title: 'Что это за приём?', sub: 'Определите тип и увидите разбор.', chip: 'тип высказывания', who: 'Реплика продавца', sub2: 'определите приём', ask: 'Это характеристика, преимущество или выгода?', avatar: 'К' } })[S.tMode] || { eyebrow: 'ТРЕНАЖЁР', title: 'Что это за приём?', sub: '', chip: '', who: '', sub2: '', ask: '', avatar: '?' };
  b.innerHTML = `
    <div class="trainer-header">
      <div><p class="eyebrow">${ui.eyebrow}</p><h1 id="trainer-title">${ui.title}</h1><p>${ui.sub}</p></div>
      <div style="display:flex;align-items:center;gap:14px">
        <div class="round-indicator"><strong>${S.tIdx + 1}</strong><span>/ ${S.tOrder.length} · ✓ ${S.tScore}</span></div>
        <button class="mode-switch" id="tSwitch">Сменить режим</button>
      </div>
    </div>
    <div class="trainer-grid">
      <article class="scenario-card">
        <div class="scenario-top"><span class="case-chip">РЕПЛИКА</span><span>${ui.chip}</span></div>
        <div class="client-profile"><span class="avatar large">${ui.avatar}</span><div><strong>${ui.who}</strong><p>${ui.sub2}</p></div></div>
        <blockquote id="clientPhrase">«${esc(q.q)}»</blockquote>
        <div class="context-box"><span>Вопрос</span><p>${ui.ask}</p></div>
      </article>
      <article class="answers-card">
        <div id="answerArea">
          <p class="answer-prompt">Ваш ответ:</p>
          ${meta.map((t, ti) => `<button class="answer-option" data-t="${t}" ${S.tPick ? 'disabled' : ''}><span>${String.fromCharCode(65 + ti)}</span><p><strong>${tmeta[t].n}</strong> — ${tmeta[t].d}</p></button>`).join('')}
        </div>
        <div id="feedbackArea" class="feedback-area hidden" aria-live="polite"></div>
      </article>
    </div>`;
  b.querySelectorAll('[data-t]').forEach((btn) => btn.addEventListener('click', () => {
    if (S.tPick) return;
    S.tPick = btn.dataset.t;
    S.attempts++;
    const ok = S.tPick === q.type;
    if (ok) { S.correct++; S.tScore++; }
    save(); syncChrome();
    btn.classList.add(ok ? 'correct' : 'wrong');
    b.querySelectorAll('[data-t]').forEach((x) => { if (x.dataset.t === q.type) x.classList.add('correct'); if (x.dataset.t !== S.tPick && x.dataset.t !== q.type) x.classList.add('dim'); });
    const fa = $('feedbackArea');
    fa.classList.remove('hidden');
    fa.innerHTML = `<div class="feedback-icon">${ok ? '✓' : '✗'}</div><h2>${ok ? 'Верно' : 'Это ' + tmeta[q.type].n.toLowerCase()}</h2><p>${esc(q.why)}</p><div class="feedback-actions"><button class="primary-button" id="tNext">${S.tIdx + 1 >= S.tOrder.length ? 'Итог' : 'Дальше →'}</button></div>`;
    $('tNext').addEventListener('click', () => { S.tIdx++; S.tPick = null; renderTrainer(); });
  }));
  const ts = $('tSwitch');
  if (ts) ts.addEventListener('click', () => { S.tMode = null; S.tIdx = 0; S.tPick = null; renderTrainer(); });
}

function shuffle(a) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

// ============ РАЗБОРЫ (кейсы) ============
const gradeMeta = { good: { t: 'Хороший ход', pts: 2 }, ok: { t: 'Приемлемо', pts: 1 }, bad: { t: 'Ошибка', pts: 0 } };
function renderCases() {
  const b = $('practiceContent');
  if (S.cIdx === null) {
    b.innerHTML = `
      <div class="page-heading">
        <p class="eyebrow">КЕЙСЫ · СИМУЛЯЦИИ ВСТРЕЧ</p>
        <h1 id="cases-title">Симуляции встреч</h1>
        <p>Живой диалог с клиентом: реплика за репликой, разбор каждого хода. Хороший ход — 2, приемлемый — 1, ошибка — 0.</p>
      </div>
      <div class="cases-grid">
        ${cases.map((c, i) => {
        const cd = S.cDone.includes(i);
        return `
        <article class="case-card ${cd ? 'completed' : ''} ${i === 0 ? 'featured' : ''}">
          <div class="case-card-top"><span>${String(i + 1).padStart(2, '0')}</span><span class="difficulty ${i === 0 ? 'medium' : 'hard'}">${i === 0 ? 'СРЕДНИЙ' : 'ПРОДВИНУТЫЙ'}</span></div>
          <h2>${esc(c.title)}</h2>
          <p>${esc(c.setup.slice(0, 110))}…</p>
          <div class="case-tags"><span>${esc(c.clientName)}</span><span>${c.scenes.length} шагов</span>${cd ? '<span class="case-done">✓ ПРОЙДЕН</span>' : ''}</div>
          <button class="case-open" data-case="${i}">${cd ? 'Повторить разбор' : 'Начать разбор'} <span>↗</span></button>
        </article>`;
      }).join('')}
      </div>`;
    b.querySelectorAll('[data-case]').forEach((x) => x.addEventListener('click', () => { S.cIdx = +x.dataset.case; S.cScene = 0; S.cPicks = []; S.cPick = null; renderCases(); }));
    return;
  }
  const c = cases[S.cIdx];
  if (S.cScene >= c.scenes.length) {
    if (!S.cDone.includes(S.cIdx)) { S.cDone.push(S.cIdx); save(); } // разбор доведён до конца — помечаем пройденным
    const score = S.cPicks.reduce((s, p) => s + gradeMeta[p.grade].pts, 0);
    const max = c.scenes.length * 2;
    const verdict = [...c.verdicts].sort((a, z) => z.min - a.min).find((v) => score >= v.min) || c.verdicts[c.verdicts.length - 1];
    b.innerHTML = `
      <div class="page-heading"><p class="eyebrow">РАЗБОР ЗАВЕРШЁН</p><h1>${score} из ${max}</h1><p>${esc(c.title)}</p></div>
      <article class="case-card" style="background:var(--lime-soft)">
        <h2>${esc(verdict.title)}</h2>
        <p>${esc(verdict.text)}</p>
      </article>
      <div class="module-grid" style="grid-template-columns:repeat(${Math.min(3, c.scenes.length)},1fr);margin-top:16px">
        ${S.cPicks.map((p, i) => `<div class="module-card" style="min-height:0;padding:16px"><span class="status-label" style="margin:0">ХОД ${i + 1}</span><p style="margin-top:6px"><b style="color:${p.grade === 'good' ? 'var(--green)' : p.grade === 'ok' ? '#8b6510' : '#aa4d32'}">${gradeMeta[p.grade].t}</b><br>${esc(p.label.slice(0, 60))}…</p></div>`).join('')}
      </div>
      <div class="feedback-actions">
        <button class="primary-button" id="cAgain">Ещё раз</button>
        <button class="secondary-button" id="cList">Другие разборы</button>
      </div>`;
    $('cAgain').addEventListener('click', () => { S.cScene = 0; S.cPicks = []; S.cPick = null; renderCases(); });
    $('cList').addEventListener('click', () => { S.cIdx = null; renderCases(); });
    return;
  }
  const scene = c.scenes[S.cScene];
  const isClient = scene.speaker === 'client';
  const who = isClient ? c.clientName : 'Вы';
  const initials = isClient ? c.clientName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : 'ВЫ';
  b.innerHTML = `
    <div class="trainer-header">
      <div><p class="eyebrow">${esc(c.title)}</p><h1 id="cases-title">${isClient ? 'Реплика клиента' : 'Ваш ход'}</h1><p>шаг ${S.cScene + 1} из ${c.scenes.length} · ${esc(c.clientName)}</p></div>
      <div class="round-indicator"><strong>${S.cScene + 1}</strong><span>/ ${c.scenes.length}</span></div>
    </div>
    <div class="trainer-grid">
      <article class="scenario-card">
        <div class="scenario-top"><span class="case-chip">${esc(c.clientName)}</span><span>${isClient ? 'ответьте ему' : 'контекст'}</span></div>
        <div class="client-profile"><span class="avatar large">${initials}</span><div><strong>${who}</strong><p>${isClient ? esc(c.role.slice(0, 60) + '…') : esc(c.role.slice(0, 60) + '…')}</p></div></div>
        <blockquote id="clientPhrase">${esc(scene.line)}</blockquote>
        ${S.cScene === 0 ? `<div class="context-box"><span>Контекст</span><p>${esc(c.setup)}</p></div>` : ''}
      </article>
      <article class="answers-card">
        <div id="answerArea">
          <p class="answer-prompt">Что вы ответите?</p>
          ${scene.options.map((o, oi) => `<button class="answer-option" data-o="${oi}" ${S.cPick !== null ? 'disabled' : ''}><span>${String.fromCharCode(65 + oi)}</span><p>${esc(o.label)}</p></button>`).join('')}
        </div>
        <div id="feedbackArea" class="feedback-area hidden" aria-live="polite"></div>
      </article>
    </div>`;
  b.querySelectorAll('[data-o]').forEach((btn) => btn.addEventListener('click', () => {
    if (S.cPick !== null) return;
    const oi = +btn.dataset.o;
    const o = scene.options[oi];
    S.cPick = oi;
    S.cPicks.push({ label: o.label, grade: o.grade });
    if (o.grade === 'good') addXp(20);
    btn.classList.add(o.grade === 'bad' ? 'wrong' : 'correct');
    b.querySelectorAll('[data-o]').forEach((x, xi) => { if (xi !== oi && o.grade !== 'good' && scene.options[xi].grade === 'good') x.classList.add('correct'); });
    const fa = $('feedbackArea');
    fa.classList.remove('hidden');
    fa.innerHTML = `<div class="feedback-tip" style="border-left-color:${o.grade === 'bad' ? '#d8795e' : 'var(--green)'}"><strong>${gradeMeta[o.grade].t} · +${gradeMeta[o.grade].pts} · ${esc(o.tag)}</strong><p>${esc(o.fb)}</p></div><div class="feedback-actions"><button class="primary-button" id="cNext">${S.cScene + 1 >= c.scenes.length ? 'Итог встречи' : 'Дальше →'}</button></div>`;
    $('cNext').addEventListener('click', () => { S.cScene++; S.cPick = null; renderCases(); });
  }));
}

// ============ ПРОГРЕСС ============
// режим начальника: видит прогресс команды (только abramson@crm.ru)
const BOSS_EMAIL = 'abramson@crm.ru';
const isBoss = () => !!(USER && USER.email === BOSS_EMAIL);
async function loadTeam() {
  const el = $('teamList');
  if (!el) return;
  try {
    const { data: s } = await SB.auth.getSession();
    const token = s && s.session && s.session.access_token;
    if (!token) { el.innerHTML = '<div class="team-empty">Нет доступа к серверу</div>'; return; }
    const r = await fetch('/api/spin-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'team', token })
    });
    const res = await r.json();
    if (!res.ok || !res.team) { el.innerHTML = '<div class="team-empty">Нет доступа к прогрессу команды</div>'; return; }
    if (!res.team.length) { el.innerHTML = '<div class="team-empty">Пока никто из команды не начал заниматься</div>'; return; }
    el.innerHTML = res.team.map((m) => {
      const rawNm = (m.name || (m.email ? m.email.split('@')[0] : '') || 'Участник');
      const nm = rawNm.charAt(0).toUpperCase() + rawNm.slice(1);
      const doneN = (m.done || []).length;
      const pracN = (m.practiced || []).length;
      const lvl = levelFromXp(m.xp || 0);
      const pct = Math.min(100, Math.round((doneN / L.length) * 100));
      const nxtI = L.findIndex((_, k) => !(m.done || []).includes(k));
      const status = nxtI === -1 ? 'Курс завершён ✓'
        : (doneN === 0 && pracN === 0 && !(m.xp || 0)) ? 'Ещё не начинал(а)'
        : 'Урок ' + (nxtI + 1) + ' · ' + L[nxtI].title;
      const act = agoLabel(m.updatedAt);
      return `<article class="team-card">
        <span class="avatar team-avatar">${esc(nm.slice(0, 1))}</span>
        <div class="team-info">
          <strong>${esc(nm)}</strong>
          ${m.email ? `<small>${esc(m.email)}</small>` : '<small>без e-mail в профиле</small>'}
          <span class="team-now">${status}</span>
          <div class="skill-track"><i style="width:${pct}%"></i></div>
        </div>
        <div class="team-nums">
          <b>${doneN} из ${L.length}</b>
          <span>уроков · уровень ${lvl}</span>
          <span>${m.xp || 0} XP</span>
          <span>${pracN ? 'практика: ' + pracN + ' уроков' : 'практика: —'}</span>
          ${act ? `<span>${act}</span>` : ''}
        </div>
      </article>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div class="team-empty">Не удалось загрузить</div>';
  }
}
function agoLabel(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60e3) return 'в сети';
  if (diff < 3600e3) return Math.round(diff / 60e3) + ' мин назад';
  if (diff < 86400e3) return Math.round(diff / 3600e3) + ' ч назад';
  if (diff < 7 * 86400e3) return Math.round(diff / 86400e3) + ' дн назад';
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
function renderProgress() {
  const doneN = S.done.length;
  const spicedN = SPICED.filter((x, k) => S.spicedDone.includes(k)).length; // курс 1а входит в общий счёт
  const medN = MED.filter((x, k) => S.medDone.includes(k)).length;
  const totalAll = L.length + SPICED.length;
  const boss = isBoss();
  const pct = S.attempts ? Math.round((S.correct / S.attempts) * 100) : 0;
  const xp = S.xp;
  const lvl = level();
  const nextLvl = lvlNeed(lvl + 1);
  const toNext = Math.max(0, nextLvl - xp);
  const skills = [
    { n: 'Ситуационные вопросы', l: 1, v: S.done.includes(1) ? 84 : 0 },
    { n: 'Проблемные вопросы', l: 2, v: S.done.includes(2) ? 78 : 0 },
    { n: 'Извлекающие вопросы', l: 3, v: S.done.includes(3) ? 86 : 0 },
    { n: 'Направляющие вопросы', l: 4, v: S.done.includes(4) ? 72 : 0 },
    { n: 'Выгоды и возражения', l: 5, v: S.done.includes(5) || S.done.includes(6) ? 66 : 0 },
    { n: 'Challenger: вызов', l: 9, v: S.done.includes(9) || S.done.includes(10) ? 70 : 0 },
    { n: 'Продажи решений', l: 11, v: S.done.includes(11) || S.done.includes(12) ? 70 : 0 },
    { n: 'Консультативные продажи', l: 13, v: S.done.includes(13) || S.done.includes(14) ? 70 : 0 },
  ];
  const skillLabel = (v) => v === 0 ? 'Не начато' : v > 60 ? 'Уверенный уровень' : v > 40 ? 'Хорошая база' : 'Требует практики';
  const next = L.findIndex((l, i) => !S.done.includes(i));
  const jumpSpiced = next === -1 && spicedN < SPICED.length;   // основная пройдена — остался курс 1а
  const jumpMed = next === -1 && !jumpSpiced && medN < MED.length; // остался MEDDPICC
  const allDone = next === -1 && !jumpSpiced && !jumpMed;
  const rec = next !== -1 ? 'Следующий шаг — урок «' + L[next].title + '».'
    : jumpSpiced ? 'Основная программа пройдена. Остался курс 1а SPICED — расширение СПИН: ' + (SPICED.length - spicedN) + ' из ' + SPICED.length + ' уроков.'
    : jumpMed ? 'Курс 1а пройден. Остался MEDDPICC — квалификация сделки: ' + (MED.length - medN) + ' из ' + MED.length + ' уроков.'
    : 'Всё пройдено — закрепите навык в кейсах.';
  $('progressBody').innerHTML = `
    <div class="page-heading split-heading">
      <div><p class="eyebrow">ВАШ РЕЗУЛЬТАТ</p><h1 id="progress-title">Прогресс обучения</h1><p>Что уже получается и на чём сосредоточиться дальше.</p></div>
      <div class="level-badge"><span>УРОВЕНЬ</span><strong>${String(lvl).padStart(2, '0')}</strong></div>
    </div>
    <div class="stats-grid">
      <article><span class="stat-icon">✓</span><strong id="statLessons">${doneN + spicedN}</strong><p>уроков пройдено</p><small>из ${totalAll} в программе</small></article>
      <article><span class="stat-icon">↗</span><strong id="statAccuracy">${pct}%</strong><p>точность ответов</p><small>в тренировках</small></article>
      <article><span class="stat-icon">⚡</span><strong id="statXp">${xp}</strong><p>очков опыта</p><small>ещё ${toNext} до уровня ${lvl + 1}</small></article>
      <article class="accent-stat"><span class="stat-icon">✦</span><strong>${S.correct}</strong><p>верных ответов</p><small>всего</small></article>
    </div>
    ${boss ? `<div class="team-block">
      <div class="section-title-row" style="margin-top:26px"><div><h2>Прогресс команды</h2><p>режим начальника · кто сколько прошёл</p></div><button class="secondary-button" id="teamRefresh" type="button">Обновить ↻</button></div>
      <div id="teamList" class="team-grid"><div class="team-empty">Загрузка…</div></div>
    </div>` : ''}
    <div class="section-title-row" style="margin-top:26px"><div><h2>Курсы программы</h2><p>${COURSES.length + (SPICED.length ? 1 : 0) + (MED.length ? 1 : 0)} ${pluralN(COURSES.length + (SPICED.length ? 1 : 0) + (MED.length ? 1 : 0), ['курс', 'курса', 'курсов'])} по методологиям продаж</p></div></div>
    <div class="course-progress-grid">
      ${COURSES.map((g) => {
        const doneIn = L.slice(g.from, g.to).filter((ll, k) => S.done.includes(g.from + k)).length;
        const full = doneIn === g.to - g.from;
        const cpct = Math.round((doneIn / (g.to - g.from)) * 100);
        return `<article class="course-progress-card ${full ? 'completed' : ''}">
          <div class="course-progress-head"><strong>${g.name}</strong><span>${doneIn} из ${g.to - g.from} ${full ? '✓' : ''}</span></div>
          <div class="skill-track"><i style="width:${cpct}%"></i></div>
        </article>`;
      }).join('')}
      ${SPICED.length ? (() => {
        const doneIn = S.spicedDone.length;
        const full = doneIn === SPICED.length;
        const cpct = Math.round((doneIn / SPICED.length) * 100);
        const nxtSp = SPICED.findIndex((x, k) => !S.spicedDone.includes(k));
        return `<article class="course-progress-card ${full ? 'completed' : ''}" style="cursor:pointer" data-spicedgo="${nxtSp === -1 ? 0 : nxtSp}" title="Курс 1а SPICED — открыть">
          <div class="course-progress-head"><strong>Курс 1а · SPICED — расширение СПИН</strong><span>${doneIn} из ${SPICED.length} ${full ? '✓' : ''}</span></div>
          <div class="skill-track"><i style="width:${cpct}%"></i></div>
        </article>`;
      })() : ''}
      ${MED.length ? (() => {
        const doneIn = S.medDone.length;
        const full = doneIn === MED.length;
        const cpct = Math.round((doneIn / MED.length) * 100);
        const nxtMed = MED.findIndex((x, k) => !S.medDone.includes(k));
        return `<article class="course-progress-card ${full ? 'completed' : ''}" style="cursor:pointer" data-medgo="${nxtMed === -1 ? 0 : nxtMed}" title="Курс MEDDPICC — открыть">
          <div class="course-progress-head"><strong>MEDDPICC · квалификация сделки</strong><span>${doneIn} из ${MED.length} ${full ? '✓' : ''}</span></div>
          <div class="skill-track"><i style="width:${cpct}%"></i></div>
        </article>`;
      })() : ''}
    </div>
    <div class="progress-lower">
      <article class="account-card">
        <div class="card-heading"><div><span class="eyebrow">АККАУНТ И СИНХРОНИЗАЦИЯ</span><h2 id="accName">${USER ? esc(USER.name) : 'Гость'}</h2></div></div>
        <div class="account-row">
          <span class="avatar large" id="accAvatar">${USER ? esc(USER.name.slice(0, 1).toUpperCase()) : '?'}</span>
          <div class="account-info">
            <strong id="accEmail">${USER ? esc(USER.email) : 'не вошли'}</strong>
            <span class="sync-chip off" id="syncStatus">…</span>
          </div>
        </div>
        <p class="account-hint">Прогресс привязан к аккаунту и хранится на сервере: откройте курс с любого устройства под тем же логином — всё на месте. Гостевой режим прогресс не сохраняет.</p>
        <div class="feedback-actions">
          <button class="primary-button" id="accSwitch">Сменить аккаунт <span>↗</span></button>
          <button class="secondary-button" id="accLogout">Выйти</button>
        </div>
      </article>
      <article class="skill-map">
        <div class="card-heading"><div><span class="eyebrow">КАРТА НАВЫКОВ</span><h2>Ваш профиль продавца</h2></div><span class="updated">обновляется автоматически</span></div>
        ${skills.map((sk) => `<div class="skill-row"><div><strong>${sk.n}</strong><span>${skillLabel(sk.v)}</span></div><div class="skill-track"><i style="width:${sk.v}%"></i></div><b>${sk.v === 0 ? '—' : sk.v}</b></div>`).join('')}
      </article>
      <article class="recommendation-card">
        <span class="eyebrow">РЕКОМЕНДАЦИЯ</span>
        <div class="recommendation-icon">↗</div>
        <h2>${allDone ? 'Повторите пройденное' : 'Продолжайте курс'}</h2>
        <p>${rec}</p>
        <button class="dark-button" data-jump="${allDone ? 'practice' : 'theory'}" data-jt="${next !== -1 ? 'main' : jumpSpiced ? 'spiced' : jumpMed ? 'med' : 'main'}">${next !== -1 ? 'К следующему уроку' : jumpSpiced ? 'К курсу 1а SPICED' : jumpMed ? 'К MEDDPICC' : 'К кейсам'} <span>→</span></button>
      </article>
    </div>`;
  $('progressBody').querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.jump === 'theory') {
      const jt = b.dataset.jt || 'main';
      if (jt === 'spiced') { const n = SPICED.findIndex((x, k) => !S.spicedDone.includes(k)); curSpiced = n === -1 ? 0 : n; curMed = null; curExtra = null; }
      else if (jt === 'med') { const n = MED.findIndex((x, k) => !S.medDone.includes(k)); curMed = n === -1 ? 0 : n; curSpiced = null; curExtra = null; }
      else { S.lesson = next; curMed = null; curExtra = null; curSpiced = null; }
    }
    if (b.dataset.jump === 'practice') S.pTab = 'cases';
    switchTab(b.dataset.jump);
  }));
  $('progressBody').querySelectorAll('[data-medgo]').forEach((b) => b.addEventListener('click', () => { curMed = +b.dataset.medgo; curSpiced = null; switchTab('theory'); }));
  $('progressBody').querySelectorAll('[data-spicedgo]').forEach((b) => b.addEventListener('click', () => { curSpiced = +b.dataset.spicedgo; curMed = null; switchTab('theory'); }));
  const doLogout = async () => {
    flushSave();
    try { if (SB) await SB.auth.signOut(); } catch (e) {}
    location.reload();
  };
  const accSwitch = $('accSwitch');
  const accLogout = $('accLogout');
  if (accSwitch) accSwitch.addEventListener('click', doLogout);
  if (accLogout) accLogout.addEventListener('click', doLogout);
  if (boss) {
    loadTeam();
    const tr = $('teamRefresh');
    if (tr) tr.addEventListener('click', loadTeam);
  }
  updateSyncUI();
}

// ============ Старт ============
bindLogin();
initAuth();
