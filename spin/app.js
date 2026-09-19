// ============ СПИН-курс в каркасе «Лаборатории продаж» ============
const L = SPIN_DATA.lessons;
const quiz = SPIN_DATA.quizBank;      // S/P/I/N
const say = SPIN_DATA.stBank;         // F/A/B
const need = SPIN_DATA.needBank || []; // H/E
const ch = SPIN_DATA.chBank || [];     // T/D/C/R — ходы Challenger
const sol = SPIN_DATA.solBank || [];   // R/I/V/W/X — продажи решений
const cons = SPIN_DATA.consBank || []; // E/R/C/G/X — стратегические продажи
const cheat = SPIN_DATA.cheatSections;
// Умные кавычки: не оборачиваем текст, который уже оформлен кавычками (начинается с «/„ или содержит « внутри),
// и не ставим точку перед закрывающей кавычкой — финальная точка убирается.
function quoteSmart(t) {
  const s = esc(String(t == null ? '' : t)).trim();
  if (!s) return s;
  if (s.startsWith('«') || s.startsWith('„') || s.includes('«')) return s;
  return '«' + s.replace(/\.+$/, '') + '»';
}
const cases = SPIN_DATA.cases;
const EXTRA_ALL = SPIN_DATA.extra || []; // все доп-уроки: выжимки книг
let EXTRA = [];                        // видимые текущему пользователю
let curExtra = null;                   // индекс открытого доп-урока (или null = основной урок)
let curXb = 0;                            // индекс открытого блока-урока доп-курса (поуроковый режим)
// уроки с only:'boss' видит только владелец (abramson@crm.ru); остальные скрыты
const refreshExtra = () => { EXTRA = EXTRA_ALL.filter((x) => !x.only || (x.only === 'boss' && USER && USER.email === 'abramson@crm.ru')); };
// ситуации «Удалённых продаж» для тренажёра: кексы курса x4 с номером урока
function x4Situations() {
  const x = EXTRA_ALL.find((e) => e.id === 'x4');
  if (!x || !x.blocks) return [];
  const out = [];
  x.blocks.forEach((bl, bi) => (bl.practice || []).forEach((k) => out.push({ q: k.q, options: k.options, ln: bi + 1, lt: bl.h })));
  return out;
}
// курс MEDDPICC — квалификация сделки (8 элементов + риски)
const MED = (SPIN_DATA.meddicc && SPIN_DATA.meddicc.lessons) || [];
const SPICED = (SPIN_DATA.spiced && SPIN_DATA.spiced.lessons) || []; // курс 1а — расширение СПИН
const PRO = (SPIN_DATA.proactive && SPIN_DATA.proactive.lessons) || []; // курс 5 — Проактивные продажи (Skip Miller)
const PRO_TRAINER = (SPIN_DATA.proactive && SPIN_DATA.proactive.trainer) || []; // 15 готовых ситуаций из мастер-курса
let curMed = null;                     // индекс открытого MEDDPICC-урока (или null = основной урок)
let curSpiced = null;                  // индекс открытого SPICED-урока (курс 1а)
let curPro = null;                      // индекс открытого ProActive-урока (курс 5)

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
  <div class="section-title-row" style="margin-top:26px"><div><h2>Курс 1а · SPICED — расширение СПИН</h2><p>Диагностика сделки · ${SPICED.length} ${pluralN(SPICED.length, ['урок', 'урока', 'уроков'])} · Winning by Design · пройдено ${sd} из ${SPICED.length} · уроки открываются по порядку</p></div></div>
  ${cloudHtml(SPIN_DATA.spiced)}
  <div class="module-grid">
  ${SPICED.map((ll, si) => {
    const d = S.spicedDone.includes(si);
    const open = seqOk(S.spicedDone, si);
    const parts = (ll.practice ? ll.practice.length : 0) || ll.blocks.length;
    const desc = ll.intro.length > 90 ? ll.intro.slice(0, 90) + '…' : ll.intro;
    return `<article class="module-card method-card ${d ? 'completed' : open ? 'current' : 'locked'}" ${open ? `data-spiced="${si}"` : 'data-seq-locked="1"'} tabindex="0" role="button" title="${open ? 'Урок курса SPICED — открыть' : 'Пройдите предыдущий урок — этот откроется после него'}">
      <div class="module-number">${si + 1}</div>
      <div class="module-icon">${d ? '✓' : open ? '↗' : '🔒'}</div>
      <span class="status-label">${d ? 'ИЗУЧЕН' : open ? 'УРОК ' + (si + 1) : 'ЗАБЛОКИРОВАН'}</span>
      <h3>${esc(ll.title)}</h3>
      <p>${esc(desc)}</p>
      <div class="module-footer"><span>${esc(ll.mins)} · ${parts} раздела</span><strong>${d ? '100%' : '→'}</strong></div>
      <div class="module-progress"><i style="width:${d ? 100 : 0}%"></i></div>
    </article>`;
  }).join('')}
  </div>`;
}
function medSectionHtml() { // html секции «Курс 1B · MEDDPICC» (карточки уроков квалификации)
  const md = MED.length ? MED.filter((ll, k) => S.medDone.includes(k)).length : 0;
  return `
  <div class="section-title-row" style="margin-top:26px"><div><h2>Курс 1B · MEDDPICC — квалификация сделки</h2><p>Проверка сделки · ${MED.length} ${pluralN(MED.length, ['урок', 'урока', 'уроков'])} · квалификация перед переговорами · пройдено ${md} из ${MED.length}</p></div></div>
  ${cloudHtml(SPIN_DATA.meddicc)}
  <div class="module-grid">
  ${MED.map((ll, mi) => {
    const d = S.medDone.includes(mi);
    const open = seqOk(S.medDone, mi);
    const parts = (ll.practice ? ll.practice.length : 0) || ll.blocks.length;
    const desc = ll.intro.length > 90 ? ll.intro.slice(0, 90) + '…' : ll.intro;
    return `<article class="module-card method-card ${d ? 'completed' : open ? 'current' : 'locked'}" ${open ? `data-med="${mi}"` : 'data-seq-locked="1"'} tabindex="0" role="button" title="${open ? 'Урок курса MEDDPICC — открыть' : 'Пройдите предыдущий урок — этот откроется после него'}">
      <div class="module-number">${mi + 1}</div>
      <div class="module-icon">${d ? '✓' : open ? '↗' : '🔒'}</div>
      <span class="status-label">${d ? 'ИЗУЧЕН' : open ? 'УРОК ' + (mi + 1) : 'ЗАБЛОКИРОВАН'}</span>
      <h3>${esc(ll.title)}</h3>
      <p>${esc(desc)}</p>
      <div class="module-footer"><span>${esc(ll.mins)} · ${parts} раздела</span><strong>${d ? '100%' : '→'}</strong></div>
      <div class="module-progress"><i style="width:${d ? 100 : 0}%"></i></div>
    </article>`;
  }).join('')}
  </div>`;
}
function proSectionHtml() { // html секции «Курс 5 · Проактивные продажи» (карточки уроков)
  const pd = PRO.length ? PRO.filter((ll, k) => S.proDone.includes(k)).length : 0;
  return `
  <div class="section-title-row" style="margin-top:26px"><div><h2>Курс 5 · Проактивные продажи — Skip Miller</h2><p>Управление сделкой · ${PRO.length} ${pluralN(PRO.length, ['урок', 'урока', 'уроков'])} · I-Date, квалификация, две параллельные продажи · пройдено ${pd} из ${PRO.length}</p></div></div>
  ${cloudHtml(SPIN_DATA.proactive)}
  <div class="module-grid">
  ${PRO.map((ll, pi) => {
    const d = S.proDone.includes(pi);
    const open = seqOk(S.proDone, pi);
    const parts = (ll.practice ? ll.practice.length : 0) || ll.blocks.length;
    const desc = ll.intro.length > 90 ? ll.intro.slice(0, 90) + '…' : ll.intro;
    return `<article class="module-card method-card ${d ? 'completed' : open ? 'current' : 'locked'}" ${open ? `data-pro="${pi}"` : 'data-seq-locked="1"'} tabindex="0" role="button" title="${open ? 'Урок курса Проактивные продажи — открыть' : 'Пройдите предыдущий урок — этот откроется после него'}">
      <div class="module-number">${pi + 1}</div>
      <div class="module-icon">${d ? '✓' : open ? '↗' : '🔒'}</div>
      <span class="status-label">${d ? 'ИЗУЧЕН' : open ? 'УРОК ' + (pi + 1) : 'ЗАБЛОКИРОВАН'}</span>
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
const REVIEW_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('review') === '1'; // ?review=1 — режим проверки: все уроки открыты без входа
function seqOk(doneArr, ei) { // урок ei доступен, если пройдены все предыдущие (цепочка)
  if (REVIEW_MODE) return true;
  const m = doneArr.length ? Math.max.apply(null, doneArr) : -1;
  return ei <= m + 1;
}
function seqNextLocked(doneArr, ei) { // следующий за ei заблокирован, пока ei не отмечен
  if (REVIEW_MODE) return false;
  return !doneArr.includes(ei);
}

// «вытянутое облако» — описание метода под названием курса, перед уроками
const CLOUD_COLORS = { S: '#3a7d2e', C: '#5b8c2a', K: '#2e7d5b', P: '#6f8f2a', M: '#4c7d33', '1А': '#33853a', '1A': '#33853a', '📘': '#7a9a3a' };
function cloudHtml(m) {
  if (!m) return '';
  const icon = String(m.icon || '?').trim();
  const color = CLOUD_COLORS[icon] || '#2b4c7e';
  return `<div class="cloud-m">
    <div class="cloud-ico" style="background:${color}">${esc(icon)}</div>
    <div class="cloud-body">
      <span class="cloud-tag">${esc(m.tag || '')}</span>
      <p class="cloud-title">${esc(m.title || '')}</p>
      <p class="cloud-short">${esc(m.short || '')}</p>
      ${m.when ? `<p class="cloud-when"><b>Когда:</b> ${esc(m.when)}</p>` : ''}
    </div>
  </div>`;
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
  pTab: null,     // внутри Практики: 'selfcheck' | 'trainer' | 'cases' (null = дефолт по роли)
  done: [],            // индексы уроков
  practiced: [],       // уроки, где практика «Проверь себя» отвечена до конца
  spPracticed: [],     // практики уроков курса 1а SPICED (до конца)
  medPracticed: [],    // практики уроков курса 1B MEDDPICC (до конца)
  proPracticed: [],    // практики уроков курса 5 ProActive (до конца)
  xp: 0,
  correct: 0,
  attempts: 0,
  extraDone: [],        // прочитанные выжимки книг (локально, не в облаке)
  medDone: [],           // изученные уроки MEDDPICC (локально, не в облаке)
  spicedDone: [],        // изученные уроки SPICED — курс 1а (локально, не в облаке)
  proDone: [],           // изученные уроки ProActive — курс 5 (локально, не в облаке)
  xDone: {},             // доп-курсы (x4): пройденные уроки { id: [индексы уроков] } (локально + облако)
  scStat: {},            // практики «Проверь себя»: { id: { a: [отвеченные вопросы], r: [верные] } } (локально + облако)
  // тренажёр
  tMode: null, tIdx: 0, tPick: null, tScore: 0, tOrder: [], tOrderIdx: [], tRev: false,
  trn: {},               // прогресс тренажёра по режимам: { mode: { ord:[индексы], i, sc, done, wrong:[] } } (локально + облако)
  // кейс
  cIdx: null, cScene: 0, cPick: null, cPicks: [],
  cDone: [],            // пройденные кейсы (разбор доведён до конца) — локально
};
function loadState() {
  try {
    const r = JSON.parse(localStorage.getItem(LS_KEY)) || {};
    S.lesson = r.lesson || 0; S.done = r.done || []; S.practiced = r.practiced || [];
    S.spPracticed = r.spPracticed || []; S.medPracticed = r.medPracticed || []; S.proPracticed = r.proPracticed || [];
    S.xp = r.xp || 0; S.correct = r.correct || 0; S.attempts = r.attempts || 0;
    S.cDone = r.cDone || [];
    if (r.scs && typeof r.scs === 'object') S.scStat = r.scs;
    if (r.trn && typeof r.trn === 'object') S.trn = r.trn;
    if (r.xd && typeof r.xd === 'object') S.xDone = r.xd;
    if (['program', 'theory', 'practice', 'cheat', 'progress'].includes(r.tab)) S.tab = r.tab;
    // вернуться на то же место в теории: открытый доп-курс и его урок
    curExtra = (typeof r.extra === 'number' && r.extra >= 0) ? r.extra : null;
    curXb = (typeof r.xb === 'number' && r.xb >= 0) ? r.xb : 0;
  } catch (e) {}
}
let _syncT = null;
let _cloudReady = false; // облако загружено (cloudLoad завершён) — только после этого шлём save
S.sync = 'off';        // 'off' | 'saving' | 'saved' | 'error'
S.syncAt = null;       // время последней успешной синхронизации
S.dirty = false;       // есть несохранённые изменения

function syncPayload() {
  return { lesson: S.lesson, done: S.done, practiced: S.practiced, spPracticed: S.spPracticed, medPracticed: S.medPracticed, proPracticed: S.proPracticed, spicedDone: S.spicedDone, medDone: S.medDone, proDone: S.proDone, xd: S.xDone, xp: S.xp, correct: S.correct, attempts: S.attempts, cDone: S.cDone, scs: S.scStat, trn: S.trn, tab: S.tab, extra: (typeof curExtra === 'number' ? curExtra : null), xb: curXb || 0, name: USER ? USER.name : '', email: USER ? USER.email : '' };
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
function loadPro() {
  try { S.proDone = JSON.parse(localStorage.getItem('spin-pro:' + USER.id)) || []; }
  catch (e) { S.proDone = []; }
}
function savePro() {
  try { localStorage.setItem('spin-pro:' + USER.id, JSON.stringify(S.proDone)); } catch (e) {}
}
// ===== доп-курсы (x4): пройденные уроки + возврат на место =====
function loadXDone() {
  try { const r = localStorage.getItem('spin-xdone:' + USER.id); if (r) S.xDone = JSON.parse(r) || {}; } catch (e) {}
}
function saveXDone() {
  try { localStorage.setItem('spin-xdone:' + USER.id, JSON.stringify(S.xDone || {})); } catch (e) {}
}
function mergeXDone(a, b) { // объединение отметок уроков из двух источников
  const out = {};
  const keys = Object.keys(a || {}).concat(Object.keys(b || {}));
  keys.forEach((k) => {
    const arr = [].concat(Array.isArray(a && a[k]) ? a[k] : [], Array.isArray(b && b[k]) ? b[k] : []).map(Number).filter((n) => !isNaN(n));
    out[k] = Array.from(new Set(arr)).sort((p, q) => p - q);
  });
  return out;
}
function openXMod(spec) { // открыть доп-курс на конкретном курсе (модуле)
  const p = String(spec).split(':').map(Number);
  const xi = p[0], mi = p[1];
  const x = EXTRA[xi];
  if (!x) return;
  const mods = xMods(x);
  const m = mods[mi];
  if (!m) return;
  curExtra = xi;
  curMed = null; curSpiced = null; curPro = null;
  const e = xEntry(x);
  curXb = m.items.some((it) => it.bi === e) ? e : xModResume(x, m);
  save();
  switchTab('theory');
  window.scrollTo({ top: 0 });
}
function xDoneArr(id) { if (!Array.isArray(S.xDone[id])) S.xDone[id] = []; return S.xDone[id]; }
function xIsDone(id, bi) { return xDoneArr(id).includes(bi); }
function xToggleDone(id, bi, on) {
  const arr = xDoneArr(id);
  const at = arr.indexOf(bi);
  if (on && at === -1) arr.push(bi);
  else if (!on && at !== -1) arr.splice(at, 1);
  arr.sort((p, q) => p - q);
  saveXDone(); save();
}
function xProgress(x) { // прогресс доп-курса: сколько уроков пройдено
  const total = (x && x.blocks) ? x.blocks.length : 0;
  const done = (x && x.blocks) ? xDoneArr(x.id).filter((i) => i < total).length : 0;
  return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0, full: total > 0 && done >= total };
}
function xResume(xi) { // куда вернуться в курсе: первый непройденный урок
  const x = EXTRA[xi];
  if (!x || !x.blocks || !x.blocks.length) return 0;
  for (let i = 0; i < x.blocks.length; i++) if (!xIsDone(x.id, i)) return i;
  return x.blocks.length - 1;
}
// ——— разделение доп-курса на курсы по модулям ———
const X_MOD_NAMES = { 1: 'Звонок', 2: 'Переписка', 3: 'Порядок в работе', 4: 'Стенд на выставке', 5: 'Приёмы и смысл' };
function xMods(x) {
  const out = [];
  (x && x.blocks ? x.blocks : []).forEach((bl, bi) => {
    const m = /^Модуль\s*(\d+)\s*·\s*Урок\s*(\d+)\.\s*(.*)$/.exec(String(bl.h || ''));
    const num = m ? +m[1] : (out.length ? out[out.length - 1].num : 1);
    const title = m ? m[3] : String(bl.h || '');
    let cur = out[out.length - 1];
    if (!cur || cur.num !== num) {
      cur = { num: num, name: X_MOD_NAMES[num] || ('Курс ' + num), items: [] };
      out.push(cur);
    }
    cur.items.push({ bi: bi, title: title, lesson: m ? +m[2] : bi + 1 });
  });
  return out;
}
function xModProgress(x, mod) {
  const total = mod.items.length;
  const done = mod.items.filter((it) => xIsDone(x.id, it.bi)).length;
  return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0, full: total > 0 && done >= total };
}
function xModResume(x, mod) {
  const it = mod.items.find((i) => !xIsDone(x.id, i.bi));
  return it ? it.bi : mod.items[0].bi;
}
function xActiveMod(x) { // курс, в котором человек сейчас — первый с непройденными уроками
  const mods = xMods(x);
  if (!mods.length) return null;
  for (const m of mods) if (!xModProgress(x, m).full) return m;
  return mods[mods.length - 1];
}
function xModOf(x, bi) { // в каком курсе лежит урок
  const mods = xMods(x);
  for (const m of mods) if (m.items.some((i) => i.bi === bi)) return m;
  return mods[0] || null;
}
function xEntry(x) { // то самое место: последний открытый урок, иначе первый непройденный
  const n = (x && x.blocks) ? x.blocks.length : 0;
  if (!n) return 0;
  const last = (typeof curXb === 'number' && curXb >= 0 && curXb < n) ? curXb : -1;
  const first = xResume(EXTRA.indexOf(x));
  if (last >= 0 && !xIsDone(x.id, last)) return last;
  if (!xIsDone(x.id, first)) return first;
  return last >= 0 ? last : first;
}
function setSync(st) {
  S.sync = st;
  if (st === 'saved') S.syncAt = new Date();
  updateSyncUI();
}
// «не отправлено» — отметка на устройстве: если сохранение не ушло, пробуем снова при каждом запуске/возврате в сеть
function pendKey() { return 'spin-pending-v1:' + (USER ? USER.id : 'anon'); }
function pendSet(on) { try { if (on) localStorage.setItem(pendKey(), String(Date.now())); else localStorage.removeItem(pendKey()); } catch (e) {} }
function hasPending() { try { return !!localStorage.getItem(pendKey()); } catch (e) { return false; } }
function sigOf(o) { // «отпечаток» прогресса: по нему понимаем, разошлись ли устройство и сервер
  o = o || {};
  return JSON.stringify([o.lesson || 0, o.done || [], o.practiced || [], o.spPracticed || [], o.medPracticed || [], o.proPracticed || [], o.spicedDone || [], o.medDone || [], o.proDone || [], o.xp || 0, o.cDone || [], canonMap(o.xd), canonScs(o.scs), canonTrn(o.trn)]);
}
function canonMap(m) { // стабильный порядок ключей и значений — иначе сравнение врёт
  const out = {};
  Object.keys(m || {}).sort().forEach((k) => { out[k] = (Array.isArray(m[k]) ? m[k].slice() : []).map(Number).sort((a, b) => a - b); });
  return out;
}
function canonTrn(t) {
  const out = {};
  Object.keys(t || {}).sort().forEach((k) => {
    const v = t[k] || {};
    out[k] = { ord: (v.ord || []).map(Number), i: +(v.i || 0), sc: +(v.sc || 0), done: !!v.done, wrong: (v.wrong || []).map(Number).sort((a, b) => a - b) };
  });
  return out;
}
function canonScs(m) {
  const out = {};
  Object.keys(m || {}).sort().forEach((k) => {
    const v = m[k] || {};
    out[k] = { a: (v.a || []).map(Number).sort((a, b) => a - b), r: (v.r || []).map(Number).sort((a, b) => a - b) };
  });
  return out;
}
function mergeScs(x, y) { // ответы на практики объединяем по курсам
  const out = {};
  Object.keys(Object.assign({}, x || {}, y || {})).forEach((id) => {
    const A = (x || {})[id] || {}, B = (y || {})[id] || {};
    out[id] = { a: uniArr(A.a, B.a), r: uniArr(A.r, B.r) };
  });
  return canonScs(out);
}
function scStatOf(id) { const v = (S.scStat || {})[id] || {}; return { a: v.a || [], r: v.r || [] }; }
function mergeTrn(x, y) { // прогресс тренажёра: берём более продвинутый прогон, ошибочные вопросы складываем
  const out = {};
  Object.keys(Object.assign({}, x || {}, y || {})).forEach((m) => {
    const A = (x || {})[m] || {}, B = (y || {})[m] || {};
    const aw = Array.isArray(A.wrong) ? A.wrong : [], bw = Array.isArray(B.wrong) ? B.wrong : [];
    const Ai = Number(A.i) || 0, Bi = Number(B.i) || 0;
    const ahead = Bi > Ai ? B : A; // у кого дальше пройдено — с того и продолжаем
    out[m] = {
      ord: (ahead.ord && ahead.ord.length ? ahead.ord : (A.ord || B.ord || [])).map(Number),
      i: Math.max(Ai, Bi),
      sc: Math.max(Number(A.sc) || 0, Number(B.sc) || 0),
      done: !!(A.done || B.done),
      wrong: uniArr(aw, bw)
    };
  });
  return canonTrn(out);
}
function uniArr(a, b) { return Array.from(new Set([].concat(a || [], b || []).map(Number))).sort((x, y) => x - y); }
function updateSyncUI() {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (S.sync === 'saving') { el.textContent = 'сохранение…'; el.className = 'sync-chip saving'; }
  else if (S.sync === 'saved') { el.textContent = 'сохранено на сервере' + (S.syncAt ? ' в ' + S.syncAt.toTimeString().slice(0, 5) : ''); el.className = 'sync-chip saved'; }
  else if (S.sync === 'error') { el.textContent = hasPending() ? 'не отправлено — отправим, как появится связь' : 'нет связи — прогресс в этом устройстве'; el.className = 'sync-chip error'; }
  else if (S.sync === 'noauth') { el.textContent = 'вход истёк — войдите заново, чтобы синхронизировать'; el.className = 'sync-chip error'; }
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
// облачный прогресс: на crmuro.ru (GitHub Pages) нет /api/* — ходим на CF Pages напрямую
let _spinApiRemote = false; // после первого 404 (GitHub Pages) сразу используем pages.dev
async function spinApi(body) {
  const tries = _spinApiRemote
    ? ['https://abramson-crm.pages.dev/api/spin-progress']
    : ['/api/spin-progress', 'https://abramson-crm.pages.dev/api/spin-progress'];
  let last;
  for (const u of tries) {
    try {
      const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) return r;
      last = new Error('HTTP ' + r.status);
      last.status = r.status;
      if (r.status === 404 || r.status === 405) _spinApiRemote = true;
    } catch (e) { last = e; }
  }
  throw last;
}
async function cloudSave() {
  if (!USER || !SB || !_cloudReady) return;
  try {
    const { data: s } = await SB.auth.getSession();
    const token = s && s.session && s.session.access_token;
    if (!token) { setSync('noauth'); return; }
    const r = await spinApi({ action: 'save', token, data: syncPayload() });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.ok) { S.dirty = false; pendSet(false); setSync('saved'); }
    else if (r.status === 401 || r.status === 403) { setSync('noauth'); S.dirty = true; pendSet(true); }
    else { setSync('error'); S.dirty = true; pendSet(true); setTimeout(() => { if (S.dirty) cloudSave(); }, 4000); }
  } catch (e) {
    if (e && (e.status === 401 || e.status === 403)) setSync('noauth');
    else setSync('error');
    S.dirty = true; pendSet(true);
    setTimeout(() => { if (S.dirty) cloudSave(); }, 4000);
  }
}
function xpBackfill() { // одноразовая компенсация XP за пройденное до введения наград за практики/отметки
  try {
    if (!USER) return;
    const KEY = 'spin-xp-backfill:' + USER.id;
    if (localStorage.getItem(KEY)) return;
    let bonus = 0;
    bonus += (S.practiced || []).length * 5;    // практики «Проверь себя» основных уроков
    bonus += (S.spPracticed || []).length * 5;  // практики курса 1а SPICED
    bonus += (S.medPracticed || []).length * 5; // практики курса 1B MEDDPICC
    bonus += (S.proPracticed || []).length * 5;  // практики курса 5 ProActive
    (S.extraDone || []).forEach((ei) => {       // выжимки книг: отметка «прочитано» + практика
      bonus += 30;
      const x = EXTRA_ALL[ei];
      if (x && x.practice) bonus += x.practice.length * 5;
    });
    bonus += (S.spicedDone || []).length * 30;  // отметки «урок изучен» SPICED
    bonus += (S.medDone || []).length * 30;     // отметки «урок изучен» MEDDPICC
    bonus += (S.proDone || []).length * 30;     // отметки «урок изучен» ProActive
    localStorage.setItem(KEY, '1');
    if (bonus > 0) {
      S.xp += bonus;
      save();
      toast('Компенсация за пройденное ранее: +' + bonus + ' XP');
    }
  } catch (e) {}
}
async function cloudLoad() {
  if (!USER || !SB) return;
  let loadErr = 0;
  try {
    const { data: s } = await SB.auth.getSession();
    const token = s && s.session && s.session.access_token;
    if (!token) { _cloudReady = true; setSync('noauth'); return; }
    const r = await spinApi({ action: 'get', token });
    const j = await r.json().catch(() => null);
    const local = syncPayload();
    const cloud = j && j.data;
    if (cloud) {
      const cx = Number(cloud.xp) || 0, lx = Number(local.xp) || 0;
      if (cx > lx) {
        // на сервере свежее (например, учился с телефона) — забираем И объединяем с тем, что есть здесь
        S.lesson = Math.max(Number(local.lesson) || 0, Number(cloud.lesson) || 0);
        S.done = uniArr(local.done, cloud.done);
        S.practiced = uniArr(local.practiced, cloud.practiced);
        S.spPracticed = uniArr(local.spPracticed, cloud.spPracticed);
        S.medPracticed = uniArr(local.medPracticed, cloud.medPracticed);
        S.proPracticed = uniArr(local.proPracticed, cloud.proPracticed);
        S.spicedDone = uniArr(local.spicedDone, cloud.spicedDone);
        S.medDone = uniArr(local.medDone, cloud.medDone);
        S.proDone = uniArr(local.proDone, cloud.proDone);
        S.xp = cx;
        S.correct = Math.max(Number(local.correct) || 0, Number(cloud.correct) || 0);
        S.attempts = Math.max(Number(local.attempts) || 0, Number(cloud.attempts) || 0);
        if (typeof cloud.extra === 'number' && cloud.extra >= 0) curExtra = cloud.extra;
        if (typeof cloud.xb === 'number' && cloud.xb >= 0) curXb = cloud.xb;
        curMed = null; curSpiced = null; curPro = null;
        S.cDone = uniArr(local.cDone, cloud.cDone);
        S.scStat = mergeScs(local.scs, cloud.scs);
        S.trn = mergeTrn(local.trn, cloud.trn);
        try { localStorage.setItem(LS_KEY, JSON.stringify(syncPayload())); } catch (e) {}
        syncChrome();
        toast('Прогресс подтянут с сервера: ' + cx + ' XP' + (lx && lx !== cx ? ' (было ' + lx + ')' : ''));
        // если объединение богаче сервера — вернём обратно, чтобы ничего не потерялось
        if (sigOf(syncPayload()) !== sigOf(cloud)) S.dirty = true;
      } else if (lx > cx) {
        // на этом устройстве больше — отправляем наверх
        S.dirty = true;
        toast('Прогресс этого устройства отправлен на сервер');
      }
    }
    // доп-курс x4: отметки уроков — объединяем локальные и облачные (не теряем ни те, ни другие)
    const xdm = mergeXDone(local.xd, cloud && cloud.xd);
    if (JSON.stringify(xdm) !== JSON.stringify(S.xDone || {})) { S.xDone = xdm; saveXDone(); S.dirty = true; }
    // прогресс тренажёра — тоже объединяем (берём более продвинутый прогон, ошибки складываем)
    const trm = mergeTrn(local.trn, cloud && cloud.trn);
    if (JSON.stringify(canonTrn(trm)) !== JSON.stringify(canonTrn(S.trn || {}))) { S.trn = trm; S.dirty = true; }
    // равные или оба пустые — ничего не делаем
    updateSyncUI();
  } catch (e) { loadErr = (e && e.status) || -1; } finally {
    _cloudReady = true;
    xpBackfill();
    if (hasPending()) S.dirty = true;
    if (S.dirty) cloudSave();
    else if (loadErr === 401 || loadErr === 403) setSync('noauth');
    else if (loadErr) setSync('error');
    else setSync('saved');
  }
}
// русские фамилии для логинов CRM (если в профиле supabase имя не заполнено)
const RU_NAMES = { abramson: 'Abramson', skokova: 'Скокова', osechkina: 'Осечкина', mazaeva: 'Мазаева' };
function userName(user) {
  // сначала имя из профиля (user_metadata.name), иначе из email
  const meta = (user && user.user_metadata) || {};
  if (meta.name && meta.name.trim()) return meta.name.trim();
  const raw = ((user && user.email) || '').split('@')[0] || '';
  if (!raw) return 'Гость';
  const ru = RU_NAMES[raw.toLowerCase()];
  if (ru) return ru;
  return raw[0].toUpperCase() + raw.slice(1);
}
function boot(user) {
  USER = { id: user.id, email: user.email || '', name: userName(user) };
  LS_KEY = 'spin-lab-v1:' + USER.id;
  try { localStorage.setItem('spin-user', JSON.stringify(USER)); } catch (e) {} // для офлайн-входа (авиарежим)
  refreshExtra();
  loadState();
  loadExtra();
  loadMed();
  loadSpiced();
  loadPro();
  loadXDone();
  scBackfill();
  $('loginScreen').classList.add('hidden');
  $('appShell').style.display = '';
  $('profileName').textContent = USER.name;
  $('profileAvatar').textContent = USER.name.slice(0, 1).toUpperCase();
  const ma = $('mobileAvatar');
  if (ma) ma.textContent = USER.name.slice(0, 1).toUpperCase();
  syncChrome();
  initOffline();
  switchTab(S.tab);
  cloudLoad().then(() => { scBackfill(); syncChrome(); switchTab(S.tab); });
}
async function initAuth() {
  SB = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON)
    : null;
  if (!SB) { alert('Не удалось загрузить модуль входа. Обновите страницу.'); return; }
  // режим проверки: ?review=1 — просмотр всех уроков без входа (прогресс не сохраняется)
  if (REVIEW_MODE) {
    boot({ id: 'reviewer', email: 'review@crm.ru', name: 'Проверка' });
    return;
  }
  try {
    const { data } = await SB.auth.getSession();
    if (data && data.session && data.session.user) { boot(data.session.user); return; }
  } catch (e) {}
  // нет сети/сессии — пробуем офлайн-вход последнего пользователя этого устройства (авиарежим)
  try {
    const saved = JSON.parse(localStorage.getItem('spin-user'));
    if (saved && saved.id && !navigator.onLine) { boot(saved); return; }
  } catch (e) {}
  $('loginScreen').classList.remove('hidden');
  $('appShell').style.display = 'none';
}
function bindLogin() {
  // модалка «Работает в полёте» (офлайн-режим)
  const openModal = () => { const m = $('offlineModal'); if (m) m.classList.remove('hidden'); offlineRefreshStatus(); };
  const closeModal = () => { const m = $('offlineModal'); if (m) m.classList.add('hidden'); };
  const hint = $('offlineHintBtn');
  if (hint) hint.addEventListener('click', openModal);
  const ok = $('offlineModalOk');
  if (ok) ok.addEventListener('click', closeModal);
  const x = $('offlineModalClose');
  if (x) x.addEventListener('click', closeModal);
  const ov = $('offlineModal');
  if (ov) ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
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
    try { localStorage.removeItem('spin-user'); } catch (e) {} // офлайн-вход больше не действует
    location.reload();
  });
  // клик по профилю (аватар/имя/XP) → вкладка прогресса; chevron ⎋ — выход
  const profBtn = document.querySelector('.profile-button');
  if (profBtn) profBtn.addEventListener('click', (e) => { if (e.target.closest('#logoutBtn')) return; switchTab('progress'); });
  const xpPill = document.querySelector('.xp-pill');
  if (xpPill) xpPill.addEventListener('click', () => switchTab('progress'));
  const pill = $('offlinePill');
  if (pill) pill.addEventListener('click', openModal);
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('#offCardBtn, #offlineDl') : null;
    if (b) offlineDownload();
  });
}
// ===== офлайн: скачивание приложения на устройство + статус =====
function swPost(msg, onProgress) {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) return resolve(null);
    const send = (sw) => {
      if (!sw) return resolve(null);
      let ch;
      try { ch = new MessageChannel(); } catch (e) { return resolve(null); }
      ch.port1.onmessage = (e) => {
        const d = e.data || {};
        if (d.type === 'progress') { if (onProgress) onProgress(d); return; }
        resolve(d);
      };
      try { sw.postMessage(msg, [ch.port2]); } catch (e) { return resolve(null); }
      setTimeout(() => resolve(null), 30000);
    };
    navigator.serviceWorker.ready
      .then((reg) => send(reg.active || navigator.serviceWorker.controller))
      .catch(() => send(navigator.serviceWorker.controller));
  });
}
function offlineCardHtml() {
  return `
  <article class="quick-extra qe-offline" id="offCard">
    <span class="qe-ic">✈️</span>
    <div class="qe-copy">
      <p class="qe-kicker">ОФЛАЙН-РЕЖИМ · БЕЗ ИНТЕРНЕТА</p>
      <strong id="offCardTitle">Скачать приложение на устройство</strong>
      <div class="qe-bar"><i id="offCardBar" style="width:0%"></i></div>
    </div>
    <span class="qe-meta" id="offCardMeta">проверяю…</span>
    <button class="qe-btn" id="offCardBtn" type="button">Скачать</button>
  </article>`;
}
async function offlineRefreshStatus() {
  const el = $('offlineDlStatus');
  const btn = $('offlineDl');
  const r = await swPost({ type: 'status' });
  const pill = $('offlinePill');
  if (pill) pill.classList.toggle('ready', !!(r && r.ready));
  const ct = $('offCardTitle'), cm = $('offCardMeta'), cb = $('offCardBar'), cbtn = $('offCardBtn');
  if (ct) {
    if (!r) {
      ct.textContent = 'Проверить не удалось — нужен интернет';
      if (cm) cm.textContent = '';
      if (cbtn) { cbtn.textContent = 'Проверить'; cbtn.classList.remove('ok'); cbtn.disabled = false; }
    } else if (r.ready) {
      ct.textContent = 'Скачано — работает без интернета';
      if (cm) cm.textContent = r.total + ' из ' + r.total;
      if (cb) cb.style.width = '100%';
      if (cbtn) { cbtn.textContent = 'Обновить'; cbtn.classList.add('ok'); cbtn.disabled = false; }
    } else {
      ct.textContent = 'Скачать приложение на устройство';
      if (cm) cm.textContent = r.have + ' из ' + r.total;
      if (cb) cb.style.width = Math.round((r.have / r.total) * 100) + '%';
      if (cbtn) { cbtn.textContent = 'Скачать'; cbtn.classList.remove('ok'); cbtn.disabled = false; }
    }
  }
  if (!el) return;
  if (!r) { el.textContent = 'Проверить не удалось — откройте приложение с интернетом и обновите страницу.'; return; }
  if (r.ready) {
    el.textContent = 'Всё загружено: ' + r.total + ' из ' + r.total + ' файлов. Можно в полёт.';
    if (btn) { btn.textContent = 'Уже скачано'; btn.disabled = false; }
  } else {
    el.textContent = 'Загружено ' + r.have + ' из ' + r.total + ' файлов.';
    if (btn) { btn.textContent = 'Скачать для офлайна (' + (r.total - r.have) + ')'; btn.disabled = false; }
  }
}
async function offlineDownload() {
  const el = $('offlineDlStatus');
  const btn = $('offlineDl');
  if (btn) { btn.disabled = true; btn.textContent = 'Скачиваю…'; }
  const r = await swPost({ type: 'precache' }, (d) => {
    if (el) el.textContent = 'Скачиваю… ' + d.done + ' из ' + d.total + (d.failed ? ' · ошибок: ' + d.failed : '');
  });
  if (!r) {
    if (el) el.textContent = 'Не получилось: нет доступа к сервис-воркеру. Обновите страницу при интернете.';
    if (btn) { btn.disabled = false; btn.textContent = 'Скачать для офлайна'; }
    return;
  }
  const bad = (r.failed && r.failed.length) || 0;
  if (bad) {
    if (el) el.textContent = 'Скачано ' + r.ok + ' из ' + r.total + '. Не дались: ' + bad + ' файл(ов) — попробуйте ещё раз при хорошей связи.';
    if (btn) { btn.disabled = false; btn.textContent = 'Докачать'; }
    offlineRefreshStatus();
  } else {
    if (el) el.textContent = 'Всё загружено: ' + r.total + ' из ' + r.total + ' файлов. Можно в полёт.';
    if (btn) { btn.disabled = false; btn.textContent = 'Уже скачано'; }
    offlineRefreshStatus();
  }
}
function initOffline() {
  window.addEventListener('offline', () => toast('Нет сети — работаем офлайн'));
  window.addEventListener('online', () => { toast('Сеть вернулась — синхронизирую прогресс'); if (_cloudReady && USER) cloudLoad(); });
}
const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TYPE_META = {
  S: { n: 'Ситуационный', d: 'факты и контекст' },
  P: { n: 'Болевой', d: 'недовольство, скрытая потребность' },
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
  else if (tab === 'progress') {
    renderProgress();
    // зашли в «Прогресс» — раз в полминуты сверяемся с сервером (если тут нет неотправленного)
    if (USER && _cloudReady && !S.dirty && Date.now() - ((S.syncAt && S.syncAt.getTime()) || 0) > 30000) cloudLoad().then(() => renderProgress());
  }
}
document.querySelectorAll('.nav-item, .mobile-nav button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button') {
    e.preventDefault(); e.target.click();
  }
});

// ============ ПРОГРАММА ============
// Ротация иллюстрации на первом экране (карточка «Продолжить урок»)
const HERO_SHOTS = ['./hero-1.jpg?v=crs84', './hero-2.jpg?v=crs84', './hero-3.jpg?v=crs84', './hero-4.jpg?v=crs84', './hero-5.jpg?v=crs84', './hero-6.jpg?v=crs84', './hero-7.jpg?v=crs84', './hero-8.jpg?v=crs84', './hero-9.jpg?v=crs84', './hero-10.jpg?v=crs84'];
let heroOrder = [], heroPos = 0, heroTimer = null;
function shuffleHero() { // перемешивание без повторов подряд
  const a = HERO_SHOTS.map((_, i) => i);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function heroNext() {
  if (heroPos >= heroOrder.length) {
    const last = heroOrder.length ? heroOrder[heroOrder.length - 1] : -1;
    heroOrder = shuffleHero();
    if (heroOrder.length > 1 && heroOrder[0] === last) heroOrder.push(heroOrder.shift()); // не та же картинка дважды подряд
    heroPos = 0;
  }
  return HERO_SHOTS[heroOrder[heroPos++]];
}
function stopHeroRotation() { if (heroTimer) { clearInterval(heroTimer); heroTimer = null; } }
function startHeroRotation() {
  stopHeroRotation();
  heroTimer = setInterval(() => {
    const el = $('continueHero');
    if (!el) { stopHeroRotation(); return; }
    el.style.opacity = '0';
    setTimeout(() => { el.src = heroNext(); el.style.opacity = '1'; }, 550);
  }, 8000);
}

function renderProgram() {
  refreshExtra();
  curExtra = null; // выход в программу закрывает режим доп-урока
  // позицию curXb НЕ сбрасываем: это «где я остановился» — из неё строится быстрый доступ
  curMed = null;   // выход в программу закрывает режим MEDDPICC-урока
  curSpiced = null; // выход в программу закрывает режим SPICED-урока (курс 1а)
  curPro = null;    // выход в программу закрывает режим ProActive-урока (курс 5)
  const doneN = S.done.length;
  const spicedN = SPICED.filter((x, k) => S.spicedDone.includes(k)).length; // курс 1а входит в общий счёт
  const medN = MED.filter((x, k) => S.medDone.includes(k)).length; // курс 1B MEDDPICC — тоже в общем счёте
  const proN = PRO.filter((x, k) => S.proDone.includes(k)).length; // курс 5 ProActive — в общем счёте
  const totalAll = L.length + SPICED.length + MED.length + PRO.length;
  let next = L.findIndex((l, i) => !S.done.includes(i));
  const spicedFull = SPICED.length > 0 && spicedN >= SPICED.length; // «Курс 1а» пройден целиком — открывает Курс 2
  const gateFrom = COURSES.length > 1 ? COURSES[1].from : L.length; // уроки Курса 2+ — только после SPICED
  const spIdx = SPICED.findIndex((x, k) => !S.spicedDone.includes(k)); // первый неоткрытый урок SPICED (-1 = все открыты)
  if (!spicedFull && next !== -1 && next >= gateFrom) next = -2; // Курс 1 пройден, но Курс 1а нет → ведём в SPICED
  const cur = next === -1 || next === -2 ? 0 : next;
  const pct = Math.round(((doneN + spicedN + medN + proN) / totalAll) * 100);
  const l = L[cur];
  const intro = (l.intro.length > 130 ? l.intro.slice(0, 130) + '…' : l.intro);
  const practiceN = l.practice ? l.practice.length : 0;
  const groups = COURSES;
  const METHODS = SPIN_DATA.methods || [];
  // ветка «сначала Курс 1а»: урок для continue-карточки
  const spCur = spIdx === -1 ? 0 : spIdx;
  const sl = next === -2 ? (SPICED[spCur] || null) : null;
  // «Курс 1а · SPICED» встраивается в маршрут сразу после Курса 1 (СПИН),
  // перед Курсом 2 (ВЫЗОВ): рендерим группы с разрезом по индексу СПИН
  const moduleGroupsHtml = groups.map((g, gi) => {
    const mCloud = METHODS.find((m) => !m.soon && m.open != null && courseOf(m.open).idx === gi); // облако метода — после названия курса
    const html = `
    <div class="section-title-row" style="margin-top:${g.from ? '26px' : '0'}"><div><h2>${g.name}</h2><p>${g.to - g.from} ${pluralN(g.to - g.from, ['урок', 'урока', 'уроков'])} · пройдено ${doneInOf(g)} из ${g.to - g.from}</p></div></div>
    ${cloudHtml(mCloud)}
    <div class="module-grid">
    ${L.slice(g.from, g.to).map((ll, gi) => {
      const i = g.from + gi;
      const done = S.done.includes(i);
      const gated = !spicedFull && g.from >= gateFrom; // курс за SPICED-гейтом (Курс 2+)
      const isCur = i === cur && !done && !gated;
      const open = done || isCur || REVIEW_MODE;
      const icon = done ? '✓' : (isCur || REVIEW_MODE) ? '↗' : '🔒';
      const status = done ? 'ЗАВЕРШЁН' : (isCur || REVIEW_MODE) ? 'ТЕКУЩИЙ' : 'ЗАБЛОКИРОВАН';
      const desc = (ll.intro.length > 90 ? ll.intro.slice(0, 90) + '…' : ll.intro);
      const parts = (ll.practice ? ll.practice.length : 0) || ll.blocks.length;
      return `<article class="module-card ${done ? 'completed' : isCur ? 'current' : 'locked'}" ${open ? `data-open="${i}" tabindex="0" role="button"` : ''} title="${open ? '' : gated ? 'Пройдите Курс 1а · SPICED — и Курс 2 откроется' : 'Откроется после прохождения текущего урока'}">
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
    const medBlock = (gi === 0 && MED.length) ? medSectionHtml() : ''; // «Курс 1B · MEDDPICC» — сразу после SPICED
    return html + spicedBlock + medBlock;
  }).join('');
  const proBlock = (PRO.length) ? proSectionHtml() : ''; // «Курс 5 · Проактивные продажи» — в конце маршрута, перед финалом

  const co = courseOf(cur);
  const allDone = doneN >= L.length && L.length > 0;
  const FINALE = SPIN_DATA.finale;
  // «Скоро в программе»: методы, которые ещё добавляются (книги в работе)
  const soonMethods = PRO.length ? [] : METHODS.filter((m) => m.soon); // ProActive реализован — «Скоро» больше не показываем
  const extraCtlHtml = soonMethods.length ? `
  <div class="section-title-row" style="margin-top:26px"><div><h2>Скоро в программе</h2><p>Методы, которые добавляются</p></div></div>
  <div class="module-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    ${soonMethods.map((m) => `<article class="module-card method-card locked" title="Курс скоро появится — книга в работе">
      <div class="module-icon">🔒</div>
      <span class="status-label">СКОРО</span>
      <h3>${esc(m.title)}</h3>
      <p>${esc(m.short)}</p>
      <div class="method-when"><strong>Когда:</strong> ${esc(m.when || '')}</div>
      <div class="module-footer"><span>книга в работе</span></div>
    </article>`).join('')}
  </div>` : '';
  // «Дополнительно» — курсы по темам + выжимки книг, в самый конец страницы
  const extraBooksHtml = EXTRA.length ? `
  <div class="section-title-row" style="margin-top:26px"><div><h2>Дополнительно</h2><p>Курсы сверх программы — разбиты по темам</p></div></div>
  ${EXTRA.map((x, xi) => {
      const pr = (x.course && x.blocks) ? xProgress(x) : null;
      const mods = (x.course && x.blocks && x.blocks.length) ? xMods(x) : [];
      if (mods.length > 1) {
        const courseName = esc(String(x.title).split(':')[0]);
        return `
      <div class="extra-course" style="margin-top:18px">
        <div class="section-title-row"><div><h3 style="margin:0;font-size:17px;letter-spacing:-.02em">${courseName}</h3><p>${mods.length} ${pluralN(mods.length, ['курс', 'курса', 'курсов'])} · пройдено ${pr.done} из ${pr.total} уроков</p></div></div>
        <div class="module-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
          ${mods.map((m, mi) => {
            const mp = xModProgress(x, m);
            const first = String((m.items[0] || {}).title || '');
            const ftxt = first.length > 58 ? first.slice(0, 58) + '…' : first;
            return `
            <article class="module-card method-card current ${mp.full ? 'completed' : ''}" data-xmod="${xi}:${mi}" tabindex="0" role="button" title="Открыть курс — ${esc(m.name)}">
              <div class="module-icon">${mp.full ? '✓' : '🎓'}</div>
              <span class="status-label">${mp.full ? 'ПРОЙДЕН' : 'КУРС ' + (mi + 1)}</span>
              <h3>Модуль ${m.num} · ${esc(m.name)}</h3>
              <p>${m.items.length} ${pluralN(m.items.length, ['урок', 'урока', 'уроков'])} · ${esc(ftxt)}</p>
              <div class="module-footer"><span>${mp.done} из ${mp.total} уроков</span><strong>→</strong></div>
              ${mp.done ? `<div class="module-progress"><i style="width:${mp.pct}%"></i></div>` : ''}
            </article>`;
          }).join('')}
        </div>
      </div>`;
      }
      const rd = pr ? pr.full : S.extraDone.includes(xi);
      const parts = (x.practice ? x.practice.length : 0) || (x.blocks ? x.blocks.length : 0);
      const desc = x.intro.length > 100 ? x.intro.slice(0, 100) + '…' : x.intro;
      const foot = pr ? `${pr.done} из ${pr.total} уроков` : `${esc(x.mins)} · ${parts} раздела`;
      return `
      <div class="module-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:14px">
      <article class="module-card method-card current ${rd ? 'completed' : ''}" data-extra="${xi}" tabindex="0" role="button" title="${x.course ? 'Открыть курс' : 'Выжимка книги — открыть'}">
        <div class="module-icon">${x.course ? '🎓' : '📘'}</div>
        <span class="status-label">${rd ? 'ПРОЙДЕН' : x.course ? 'КУРС' : 'КНИГА'}</span>
        <h3>${esc(x.title)}</h3>
        <p>${esc(desc)}</p>
        <div class="module-footer"><span>${foot}</span><strong>→</strong></div>
        ${pr && pr.done ? `<div class="module-progress"><i style="width:${pr.pct}%"></i></div>` : ''}
      </article>
      </div>`;
    }).join('')}` : '';
  // быстрый доступ к доп-курсу (x4) — прямо с главного экрана, без долгой прокрутки
  const x4i = EXTRA.findIndex((x) => x.course && x.blocks && x.blocks.length > 1);
  const x4c = x4i >= 0 ? EXTRA[x4i] : null;
  const x4pr = x4c ? xProgress(x4c) : null;
  const x4entry = x4c ? xEntry(x4c) : 0;                      // урок, на котором остановился
  const x4cur = x4c ? xModOf(x4c, x4entry) : null;           // и курс, в котором этот урок
  const x4rs = x4entry;
  const x4clean = (h) => esc(String(h).replace(/^Модуль\s*\d+\s*·\s*Урок\s*\d+\.\s*/i, ''));
  const x4QuickHtml = x4c ? `
  <article class="quick-extra" data-xgo="${x4i}" role="button" tabindex="0" title="Открыть дополнительный курс">
    <span class="qe-ic">🎓</span>
    <div class="qe-copy">
      <p class="qe-kicker">ДОПОЛНИТЕЛЬНО${x4cur ? ' · КУРС ' + x4cur.num + ' · ' + esc(x4cur.name.toUpperCase()) : ''}</p>
      <strong>Урок ${x4rs + 1} из ${x4c.blocks.length}. ${x4clean(x4c.blocks[x4rs].h)}</strong>
      <div class="qe-bar"><i style="width:${x4pr.pct}%"></i></div>
    </div>
    <span class="qe-meta">${x4pr.done} из ${x4pr.total} · ${x4pr.pct}%</span>
    <button class="primary-button" data-xgo="${x4i}">${x4pr.done ? 'Продолжить' : 'Начать курс'} <span>→</span></button>
  </article>` : '';
  $('programBody').innerHTML = `
  <div class="page-heading">
    <div>
      <p class="eyebrow">ПРОГРАММА ОБУЧЕНИЯ</p>
      <h1 id="program-title">Навыки продаж</h1>
      <p>${totalAll} ${pluralN(totalAll, ['урок', 'урока', 'уроков'])} · ${COURSES.length + (MED.length ? 1 : 0) + (SPICED.length ? 1 : 0) + (PRO.length ? 1 : 0)} ${pluralN(COURSES.length + (MED.length ? 1 : 0) + (SPICED.length ? 1 : 0) + (PRO.length ? 1 : 0), ['курс', 'курса', 'курсов'])}</p>
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
      <div class="lesson-meta"><span class="module-tag">${next === -1 ? 'КУРС ПРОЙДЕН' : next === -2 ? 'КУРС 1А · SPICED · УРОК ' + (spCur + 1) : 'КУРС ' + (co.idx + 1) + ' · УРОК ' + co.num}</span><span>${next === -1 ? L.length + ' из ' + L.length + ' уроков' : next === -2 ? 'из ' + SPICED.length + ' уроков курса' : 'из ' + co.len + ' уроков курса'}</span></div>
      <h2>${esc(next === -1 ? 'Вы прошли весь курс. Повторите любой урок или идите в разборы.' : next === -2 ? sl.title : l.title)}</h2>
      <p>${esc(next === -1 ? 'Курс пройден — теперь закрепите навык в тренажёре и разборах.' : next === -2 ? (sl.intro.length > 160 ? sl.intro.slice(0, 160) + '…' : sl.intro) : intro)}</p>
      <div class="continue-actions">
        <button class="primary-button" ${next === -2 ? `data-spiced="${spCur}"` : `data-open="${next === -1 ? 0 : cur}"`}>${next === -1 ? 'Повторить с начала' : 'Продолжить урок'} <span>→</span></button>
        <span class="duration">◷ ${esc(next === -2 ? sl.mins : l.mins)}</span>
      </div>
    </div>
    <div class="continue-visual" aria-hidden="true">
      <img id="continueHero" class="continue-hero" src="${heroNext()}" alt="" />
    </div>
  </article>

  ${x4QuickHtml}
  ${offlineCardHtml()}

  <div class="section-title-row">
    <div><h2>Маршрут обучения</h2><p><span id="completedCount">${doneN + spicedN + medN + proN}</span> из ${totalAll} уроков пройдено</p></div>
    <div class="overall-progress"><span id="overallPercent">${pct}%</span><div><i id="overallBar" style="width:${pct}%"></i></div></div>
  </div>
  ${moduleGroupsHtml}
  ${proBlock}
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
  ${extraCtlHtml}
  ${extraBooksHtml}
  `;

  $('programBody').querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.jump)));
  $('programBody').querySelectorAll('[data-cheat]').forEach((b) => b.addEventListener('click', () => switchTab('cheat')));
  $('programBody').querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.open;
    curPro = null;
    const sFull = SPICED.length > 0 && SPICED.every((x, k) => S.spicedDone.includes(k));
    const gFrom = COURSES.length > 1 ? COURSES[1].from : L.length;
    if (!REVIEW_MODE && !sFull && i >= gFrom) { toast('Сначала пройдите Курс 1а · SPICED — потом откроется Курс 2'); return; }
    S.lesson = i; curExtra = null; curMed = null; curSpiced = null; switchTab('theory');
  }));
  $('programBody').querySelectorAll('[data-extra]').forEach((b) => b.addEventListener('click', () => { curExtra = +b.dataset.extra; curXb = xResume(curExtra); curMed = null; curSpiced = null; curPro = null; save(); switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-xgo]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); const xi = +b.dataset.xgo; curExtra = xi; curXb = xEntry(EXTRA[xi]); curMed = null; curSpiced = null; curPro = null; save(); switchTab('theory'); window.scrollTo({ top: 0 }); }));
  $('programBody').querySelectorAll('[data-xmod]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); openXMod(b.dataset.xmod); }));
  $('programBody').querySelectorAll('[data-med]').forEach((b) => b.addEventListener('click', () => { curMed = +b.dataset.med; curExtra = null; curSpiced = null; curPro = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-spiced]').forEach((b) => b.addEventListener('click', () => { curSpiced = +b.dataset.spiced; curMed = null; curExtra = null; curPro = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-pro]').forEach((b) => b.addEventListener('click', () => { curPro = +b.dataset.pro; curMed = null; curExtra = null; curSpiced = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-medgo]').forEach((b) => b.addEventListener('click', () => { const n = MED.findIndex((x, k) => !S.medDone.includes(k)); curMed = n === -1 ? 0 : n; curSpiced = null; curExtra = null; curPro = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-progo]').forEach((b) => b.addEventListener('click', () => { const n = PRO.findIndex((x, k) => !S.proDone.includes(k)); curPro = n === -1 ? 0 : n; curMed = null; curExtra = null; curSpiced = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('[data-spicedgo]').forEach((b) => b.addEventListener('click', () => { const n = SPICED.findIndex((x, k) => !S.spicedDone.includes(k)); curSpiced = n === -1 ? 0 : n; curMed = null; curExtra = null; switchTab('theory'); }));
  $('programBody').querySelectorAll('.module-card.locked:not(.method-card)').forEach((b) => b.addEventListener('click', () => toast('Сначала пройдите текущий урок — этот откроется после его практики')));
  $('programBody').querySelectorAll('.method-card.locked:not([data-seq-locked])').forEach((b) => b.addEventListener('click', () => toast('Курс скоро появится — книга в работе')));
  $('programBody').querySelectorAll('[data-seq-locked]').forEach((b) => b.addEventListener('click', () => toast('Сначала пройдите предыдущий урок — этот откроется после него')));
  startHeroRotation();
  offlineRefreshStatus();
}

// ============ ТЕОРИЯ (уроки) ============
function renderTheory() {
  refreshExtra();
  if (curMed !== null && curMed >= MED.length) { curMed = null; }  // открытый MED-урок стал недоступен — сброс
  if (curExtra !== null && curExtra >= EXTRA.length) { curExtra = null; } // открытый урок стал невидим — сброс
  // curXb не сбрасываем — помним, где человек остановился в доп-курсе
  if (curSpiced !== null && curSpiced >= SPICED.length) { curSpiced = null; } // открытый SPICED-урок стал недоступен — сброс
  if (curPro !== null && curPro >= PRO.length) { curPro = null; } // открытый ProActive-урок стал недоступен — сброс
  // последовательность: если открытый урок больше недоступен по цепочке — откатываем на первый доступный непройденный
  if (curSpiced !== null && !seqOk(S.spicedDone, curSpiced)) { curSpiced = Math.min((S.spicedDone.length ? Math.max.apply(null, S.spicedDone) : -1) + 1, SPICED.length - 1); }
  if (curMed !== null && !seqOk(S.medDone, curMed)) { curMed = Math.min((S.medDone.length ? Math.max.apply(null, S.medDone) : -1) + 1, MED.length - 1); }
  if (curPro !== null && !seqOk(S.proDone, curPro)) { curPro = Math.min((S.proDone.length ? Math.max.apply(null, S.proDone) : -1) + 1, PRO.length - 1); }
  const mode = curSpiced !== null ? 'spiced' : curMed !== null ? 'med' : curExtra !== null ? 'extra' : curPro !== null ? 'pro' : 'main';
  const i = mode === 'spiced' ? curSpiced : mode === 'med' ? curMed : mode === 'extra' ? curExtra : mode === 'pro' ? curPro : S.lesson;
  const l = mode === 'spiced' ? SPICED[i] : mode === 'med' ? MED[i] : mode === 'extra' ? EXTRA[i] : mode === 'pro' ? PRO[i] : L[i];
  const xMode = mode === 'extra' && !!l.course && l.blocks && l.blocks.length > 1; // поуроковый режим доп-курса
  if (xMode && curXb >= l.blocks.length) curXb = 0;
  const xb = xMode ? curXb : 0;
  const done = mode === 'spiced' ? S.spicedDone.includes(i) : mode === 'med' ? S.medDone.includes(i) : mode === 'extra' ? false : mode === 'pro' ? S.proDone.includes(i) : S.done.includes(i);
  const free = mode !== 'main'; // у выжимок, MEDDPICC, SPICED и ProActive практика не блокирует следующий шаг
  const hasP = !(l.practice && l.practice.length) || (free ? true : S.practiced.includes(i)); // практика пройдена (или её нет) — можно дальше
  pState = { i: 0, pick: null, score: 0 }; // практика урока всегда начинается с первого вопроса

  const curT = L.findIndex((x, k) => !S.done.includes(k));
  let railItems = '';
  if (mode === 'spiced') {
    railItems = `<div class="lesson-group-label"><span>Курс 1а · SPICED</span>ДИАГНОСТИКА</div>` + SPICED.map((ll, ei) => {
      const d = S.spicedDone.includes(ei);
      const open = seqOk(S.spicedDone, ei);
      const locked = !d && !open;
      return `<button class="lesson-item ${ei === i ? 'active' : d ? 'done' : locked ? 'locked' : ''}" data-spiced="${ei}" ${locked ? 'data-locked="1"' : ''} title="${locked ? 'Откроется после урока ' + ((S.spicedDone.length ? Math.max.apply(null, S.spicedDone) : 0) + 1) : 'Урок расширения СПИН'}">
        <span>${ei + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${d ? '<b>✓</b>' : locked ? '<b>🔒</b>' : ''}
      </button>`;
    }).join('');
  } else if (mode === 'med') {
    railItems = `<div class="lesson-group-label"><span>Курс MEDDPICC</span>КВАЛИФИКАЦИЯ</div>` + MED.map((ll, ei) => {
      const d = S.medDone.includes(ei);
      const open = seqOk(S.medDone, ei);
      const locked = !d && !open;
      return `<button class="lesson-item ${ei === i ? 'active' : d ? 'done' : locked ? 'locked' : ''}" data-med="${ei}" ${locked ? 'data-locked="1"' : ''} title="${locked ? 'Откроется после урока ' + ((S.medDone.length ? Math.max.apply(null, S.medDone) : 0) + 1) : 'Урок квалификации сделки'}">
        <span>${ei + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${d ? '<b>✓</b>' : locked ? '<b>🔒</b>' : ''}
      </button>`;
    }).join('');
  } else if (mode === 'pro') {
    railItems = `<div class="lesson-group-label"><span>Курс 5 · ProActive</span>УПРАВЛЕНИЕ СДЕЛКОЙ</div>` + PRO.map((ll, ei) => {
      const d = S.proDone.includes(ei);
      const open = seqOk(S.proDone, ei);
      const locked = !d && !open;
      return `<button class="lesson-item ${ei === i ? 'active' : d ? 'done' : locked ? 'locked' : ''}" data-pro="${ei}" ${locked ? 'data-locked="1"' : ''} title="${locked ? 'Откроется после урока ' + ((S.proDone.length ? Math.max.apply(null, S.proDone) : 0) + 1) : 'Урок Проактивных продаж'}">
        <span>${ei + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${d ? '<b>✓</b>' : locked ? '<b>🔒</b>' : ''}
      </button>`;
    }).join('');
  } else if (mode === 'extra') {
    if (xMode) {
      const shr = (h) => esc(String(h).replace(/^Модуль\s*\d+\s*·\s*Урок\s*\d+\.\s*/i, ''));
      const xmods = xMods(l);
      railItems = xmods.map((m) => {
        const head = `<div class="lesson-group-label"><span>Курс ${m.num}</span>${esc(m.name).toUpperCase()}</div>`;
        return head + m.items.map((it) => {
          const dd = xIsDone(l.id, it.bi);
          return `<button class="lesson-item ${it.bi === xb ? 'active' : ''} ${dd ? 'done' : ''}" data-xb="${it.bi}" title="Урок ${it.bi + 1}"><span>${it.lesson}</span><div><strong>${shr(it.title)}</strong><small>${it.lesson} из ${l.blocks.length}</small></div>${dd ? '<b>✓</b>' : ''}</button>`;
        }).join('');
      }).join('');
    } else {
      railItems = `<div class="lesson-group-label"><span>Extra</span>ДОПОЛНИТЕЛЬНО</div>` + EXTRA.map((ll, ei) => {
        return `<button class="lesson-item ${ei === i ? 'active' : ''}" data-extra="${ei}" title="${ll.course ? 'Открыть курс' : 'Выжимка книги'}">
          <span>${ei + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${S.extraDone.includes(ei) ? '<b>✓</b>' : ''}
        </button>`;
      }).join('');
    }
  } else {
    railItems = COURSES.map((g, gi) => {
      const label = `<div class="lesson-group-label"><span>Курс ${COURSES.indexOf(g) + 1}</span>${g.tag}</div>`;
      const items = L.slice(g.from, g.to).map((ll, gi) => {
        const j = g.from + gi;
        const done = S.done.includes(j);
        const sFull = SPICED.length > 0 && SPICED.every((x, k) => S.spicedDone.includes(k));
        const gFrom = COURSES.length > 1 ? COURSES[1].from : L.length;
        const locked = !REVIEW_MODE && !done && ((curT !== -1 && j > curT) || (!sFull && j >= gFrom));
        return `<button class="lesson-item ${j === i ? 'active' : done ? 'done' : locked ? 'locked' : ''}" data-lesson="${j}" ${locked ? 'data-locked="1"' : ''} title="${locked ? (curT !== -1 && j > curT ? 'Откроется после урока ' + (curT + 1) : 'Пройдите Курс 1а · SPICED — и Курс 2 откроется') : ''}">
          <span>${gi + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${done ? '<b>✓</b>' : locked ? '<b>🔒</b>' : ''}
        </button>`;
      }).join('');
      const spicedRail = (gi === 0 && SPICED.length) ? `<div class="lesson-group-label"><span>Курс 1а</span>SPICED</div>` + SPICED.map((ll, ei) => {
        const d = S.spicedDone.includes(ei);
        const open = seqOk(S.spicedDone, ei);
        const locked = !d && !open;
        return `<button class="lesson-item ${d ? 'done' : locked ? 'locked' : ''}" data-spiced="${ei}" ${locked ? 'data-locked="1"' : ''} title="${locked ? 'Откроется после урока ' + ((S.spicedDone.length ? Math.max.apply(null, S.spicedDone) : 0) + 1) : 'Урок расширения СПИН — открыть'}">
          <span>${ei + 1}</span><div><strong>${esc(ll.title)}</strong><small>${esc(ll.mins)}</small></div>${d ? '<b>✓</b>' : locked ? '<b>🔒</b>' : ''}
        </button>`;
      }).join('') : '';
      return label + items + spicedRail;
    }).join('');
  }
  // Шпаргалки теперь — отдельная вкладка (внизу), дубль в списке уроков не нужен

  const co = mode === 'main' ? courseOf(i) : null;
  const kicker = mode === 'spiced' ? 'КУРС 1А · SPICED · УРОК ' + (i + 1) + ' ИЗ ' + SPICED.length : mode === 'med' ? 'КУРС MEDDPICC · УРОК ' + (i + 1) + ' ИЗ ' + MED.length : mode === 'extra' ? (xMode ? 'ДОПОЛНИТЕЛЬНО · УЧЕБНЫЙ КУРС · УРОК ' + (xb + 1) + ' ИЗ ' + l.blocks.length : (EXTRA[i].course ? 'ДОПОЛНИТЕЛЬНО · УЧЕБНЫЙ КУРС' : 'ДОПОЛНИТЕЛЬНО · ВЫЖИМКА ИЗ КНИГИ')) : mode === 'pro' ? 'КУРС 5 · ПРОАКТИВНЫЕ ПРОДАЖИ · УРОК ' + (i + 1) + ' ИЗ ' + PRO.length : 'КУРС ' + (co.idx + 1) + ' · УРОК ' + co.num + ' ИЗ ' + co.len;
  const railTitle = mode === 'spiced' ? 'Расширение СПИН' : mode === 'med' ? 'Квалификация сделки' : mode === 'extra' ? 'Дополнительные уроки' : mode === 'pro' ? 'Проактивные продажи' : 'Уроки курсов';
  const railEyebrow = mode === 'spiced' ? 'SPICED · КУРС 1А' : mode === 'med' ? 'MEDDPICC' : mode === 'extra' ? 'ДОПОЛНИТЕЛЬНО' : mode === 'pro' ? 'PROACTIVE · КУРС 5' : 'ПРОГРАММА';
  $('theoryBody').innerHTML = `
    <aside class="lesson-rail">
      <button class="back-link" data-jump="program">← К программе</button>
      <p class="eyebrow">${railEyebrow}</p>
      <h3>${railTitle}</h3>
      <div class="lesson-list">${railItems}</div>
    </aside>
    <article class="lesson-content">
      <div class="lesson-kicker"><span>${kicker}</span><span>◷ ${esc(l.mins)}</span></div>
      <h1 id="theory-title">${xMode ? esc(l.blocks[xb].h) : esc(l.title)}</h1>
      ${xMode ? '' : `<p class="lead">${esc(l.intro)}</p>`}
      ${l.book && !xMode ? `<p style="font-size:13px;opacity:.7;margin-top:10px">${l.course ? '📚 Источники курса' : '📖 По книге'}: ${esc(l.book)}</p>` : ''}
      ${xMode ? (function () { const b = l.blocks[xb]; return `
        ${b.p.map((par) => `<p>${esc(par)}</p>`).join('')}
        ${b.ex ? `<div class="example-block"><div class="example-label">ПРИМЕР</div><div class="coach-note"><p>${esc(b.ex)}</p></div></div>` : ''}
        ${(b.practice && b.practice.length) ? blockPracticeHtml(l, xb, b) : ''}`; })()
      : l.blocks.map((b, bi) => `
        <h2 class="content-heading">${esc(b.h)}</h2>
        ${b.p.map((par) => `<p>${esc(par)}</p>`).join('')}
        ${b.ex ? `<div class="example-block"><div class="example-label">ПРИМЕР</div><div class="coach-note"><p>${esc(b.ex)}</p></div></div>` : ''}
        ${(l.course && b.practice && b.practice.length) ? blockPracticeHtml(l, bi, b) : ''}
      `).join('')}
      ${xMode ? (xb < l.remember.length ? `<h2 class="content-heading">Запомнить</h2>
      <div class="question-levels">
        <div class="level-card"><span>!</span><div><p>${esc(l.remember[xb])}</p></div></div>
      </div>` : '')
      : `<h2 class="content-heading">Запомнить</h2>
      <div class="question-levels">
        ${l.remember.map((r, ri) => `<div class="level-card"><span>!</span><div><p>${esc(r)}</p></div></div>`).join('')}
      </div>`}
      ${practiceHtml(l, i, done)}
      <div class="lesson-footer">
        ${mode === 'spiced'
          ? `<label class="complete-check"><input type="checkbox" id="lessonComplete" ${done ? 'checked' : ''} /><span></span>${done ? 'Урок изучен ✓' : 'Урок изучен'}</label>
             ${i + 1 < SPICED.length
               ? `<button class="primary-button" id="nextBtn" data-spicednext="${i + 1}" ${done ? '' : 'disabled'}>Следующий урок <span>→</span></button>`
               : `<button class="primary-button" id="nextBtn" data-jump="program">К программе <span>→</span></button>`}
             ${i + 1 < SPICED.length && !done ? '<p class="next-hint">Сначала отметьте этот урок изученным — и откроется следующий.</p>' : ''}`
          : mode === 'med'
          ? `<label class="complete-check"><input type="checkbox" id="lessonComplete" ${done ? 'checked' : ''} /><span></span>${done ? 'Урок изучен ✓' : 'Урок изучен'}</label>
             ${i + 1 < MED.length
               ? `<button class="primary-button" id="nextBtn" data-mednext="${i + 1}" ${done ? '' : 'disabled'}>Следующий урок <span>→</span></button>`
               : `<button class="primary-button" id="nextBtn" data-jump="program">К программе <span>→</span></button>`}
             ${i + 1 < MED.length && !done ? '<p class="next-hint">Сначала отметьте этот урок изученным — и откроется следующий.</p>' : ''}`
          : mode === 'pro'
          ? `<label class="complete-check"><input type="checkbox" id="lessonComplete" ${done ? 'checked' : ''} /><span></span>${done ? 'Урок изучен ✓' : 'Урок изучен'}</label>
             ${i + 1 < PRO.length
               ? `<button class="primary-button" id="nextBtn" data-pronext="${i + 1}" ${done ? '' : 'disabled'}>Следующий урок <span>→</span></button>`
               : `<button class="primary-button" id="nextBtn" data-jump="program">К программе <span>→</span></button>`}
             ${i + 1 < PRO.length && !done ? '<p class="next-hint">Сначала отметьте этот урок изученным — и откроется следующий.</p>' : ''}`
          : mode === 'extra'
          ? (xMode
             ? `<label class="complete-check"><input type="checkbox" id="lessonComplete" ${xIsDone(l.id, xb) ? 'checked' : ''} /><span></span>${xIsDone(l.id, xb) ? 'Урок изучен ✓' : 'Урок изучен'}</label>
                ${xb + 1 < l.blocks.length
                ? `<button class="primary-button" id="nextBtn" data-xbnext="1">Следующий урок <span>→</span></button>`
                : `<button class="primary-button" id="nextBtn" data-jump="program">К программе <span>→</span></button>`}`
             : `<label class="complete-check"><input type="checkbox" id="lessonComplete" ${S.extraDone.includes(i) ? 'checked' : ''} /><span></span>${S.extraDone.includes(i) ? 'Изучено ✓' : 'Отметить изученным'}</label>
             <button class="primary-button" id="nextBtn" data-jump="program">К программе <span>→</span></button>`)
          : `<label class="complete-check"><input type="checkbox" id="lessonComplete" ${done ? 'checked' : ''} /><span></span>${done ? 'Урок пройден ✓' : 'Урок изучен'}</label>
             ${i + 1 < L.length
               ? `<button class="primary-button" id="nextBtn" data-next="${i + 1}" ${hasP ? '' : 'disabled'}>Следующий урок <span>→</span></button>`
               : `<button class="primary-button" id="nextBtn" data-jump="progress" ${hasP ? '' : 'disabled'}>К прогрессу <span>→</span></button>`}`}
      </div>
      ${mode === 'main' ? (hasP ? '' : '<p class="next-hint">Сначала ответьте на все вопросы практики «Проверь себя» — тогда откроется следующий урок.</p>') : ''}
    </article>`;

  $('theoryBody').querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.jump)));
  $('theoryBody').querySelectorAll('[data-spiced]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.locked) { toast('Сначала пройдите предыдущий урок — этот откроется после него'); return; } curSpiced = +b.dataset.spiced; curMed = null; curExtra = null; curPro = null; window.scrollTo({ top: 0 }); renderTheory(); }));
  $('theoryBody').querySelectorAll('[data-med]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.locked) { toast('Сначала пройдите предыдущий урок — этот откроется после него'); return; } curMed = +b.dataset.med; curExtra = null; curSpiced = null; curPro = null; window.scrollTo({ top: 0 }); renderTheory(); }));
  $('theoryBody').querySelectorAll('[data-extra]').forEach((b) => b.addEventListener('click', () => { curExtra = +b.dataset.extra; curXb = xResume(curExtra); curMed = null; curSpiced = null; curPro = null; save(); window.scrollTo({ top: 0 }); renderTheory(); }));
  $('theoryBody').querySelectorAll('[data-pro]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.locked) { toast('Сначала пройдите предыдущий урок — этот откроется после него'); return; } curPro = +b.dataset.pro; curMed = null; curExtra = null; curSpiced = null; window.scrollTo({ top: 0 }); renderTheory(); }));
  $('theoryBody').querySelectorAll('[data-xb]').forEach((b) => b.addEventListener('click', () => { curXb = Math.max(0, +b.dataset.xb); save(); window.scrollTo({ top: 0 }); renderTheory(); }));
  const xbn = $('theoryBody').querySelector('[data-xbnext]');
  if (xbn) xbn.addEventListener('click', () => { curXb++; save(); window.scrollTo({ top: 0 }); renderTheory(); });
  $('theoryBody').querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.locked) { toast('Сначала пройдите текущий урок — этот откроется после его практики'); return; }
    S.lesson = +b.dataset.lesson; curExtra = null; curMed = null; curSpiced = null; curPro = null; window.scrollTo({ top: 0 }); renderTheory();
  }));
  const cheatBtn = $('theoryBody').querySelector('[data-cheat]');
  if (cheatBtn) cheatBtn.addEventListener('click', () => switchTab('cheat'));
  const nxt = $('theoryBody').querySelector('[data-next]');
  if (nxt) nxt.addEventListener('click', () => { S.lesson = +nxt.dataset.next; curExtra = null; curMed = null; curSpiced = null; curPro = null; window.scrollTo({ top: 0 }); renderTheory(); });
  const mn = $('theoryBody').querySelector('[data-mednext]');
  if (mn) mn.addEventListener('click', () => { if (!seqOk(S.medDone, +mn.dataset.mednext)) { toast('Сначала отметьте текущий урок изученным'); return; } curMed = +mn.dataset.mednext; curExtra = null; curSpiced = null; curPro = null; window.scrollTo({ top: 0 }); renderTheory(); });
  const sn = $('theoryBody').querySelector('[data-spicednext]');
  if (sn) sn.addEventListener('click', () => { if (!seqOk(S.spicedDone, +sn.dataset.spicednext)) { toast('Сначала отметьте текущий урок изученным'); return; } curSpiced = +sn.dataset.spicednext; curExtra = null; curMed = null; curPro = null; window.scrollTo({ top: 0 }); renderTheory(); });
  const pn = $('theoryBody').querySelector('[data-pronext]');
  if (pn) pn.addEventListener('click', () => { if (!seqOk(S.proDone, +pn.dataset.pronext)) { toast('Сначала отметьте текущий урок изученным'); return; } curPro = +pn.dataset.pronext; curExtra = null; curMed = null; curSpiced = null; window.scrollTo({ top: 0 }); renderTheory(); });
  const chk = $('lessonComplete');
  if (chk) chk.addEventListener('change', () => {
    if (mode === 'spiced') {
      if (chk.checked && !S.spicedDone.includes(i)) { S.spicedDone.push(i); addXp(30); toast('Урок изучен · +30 XP'); }
      else if (!chk.checked && S.spicedDone.includes(i)) { S.spicedDone = S.spicedDone.filter((x) => x !== i); S.xp = Math.max(0, S.xp - 30); toast('Урок снят · −30 XP'); }
      saveSpiced(); renderTheory(); return;
    }
    if (mode === 'med') {
      if (chk.checked && !S.medDone.includes(i)) { S.medDone.push(i); addXp(30); toast('Урок изучен · +30 XP'); }
      else if (!chk.checked && S.medDone.includes(i)) { S.medDone = S.medDone.filter((x) => x !== i); S.xp = Math.max(0, S.xp - 30); toast('Урок снят · −30 XP'); }
      saveMed(); renderTheory(); return;
    }
    if (mode === 'pro') {
      if (chk.checked && !S.proDone.includes(i)) { S.proDone.push(i); addXp(30); toast('Урок изучен · +30 XP'); }
      else if (!chk.checked && S.proDone.includes(i)) { S.proDone = S.proDone.filter((x) => x !== i); S.xp = Math.max(0, S.xp - 30); toast('Урок снят · −30 XP'); }
      savePro(); renderTheory(); return;
    }
    if (mode === 'extra' && xMode) {
      xToggleDone(l.id, xb, chk.checked);
      if (chk.checked) { addXp(30); toast('Урок изучен · +30 XP'); }
      else { S.xp = Math.max(0, S.xp - 30); toast('Урок снят · −30 XP'); }
      renderTheory(); return;
    }
    if (mode === 'extra') {
      if (chk.checked && !S.extraDone.includes(i)) { S.extraDone.push(i); addXp(30); toast('Выжимка прочитана · +30 XP'); }
      else if (!chk.checked && S.extraDone.includes(i)) { S.extraDone = S.extraDone.filter((x) => x !== i); S.xp = Math.max(0, S.xp - 30); toast('Выжимка снята · −30 XP'); }
      saveExtra(); renderTheory(); return;
    }
    if (chk.checked && !S.done.includes(i)) { S.done.push(i); addXp(30); toast('Урок пройден · +30 XP'); }
    else if (!chk.checked && S.done.includes(i)) { S.done = S.done.filter((x) => x !== i); S.xp = Math.max(0, S.xp - 30); toast('Урок снят · −30 XP'); }
    save(); syncChrome(); renderTheory();
  });
  bindPractice(i, done, mode);
  bindBlockPractice(l);
}

// мини-практика после урока-блока курса (extra с course:true): по одному вопросу за раз
let bpState = {}; // { [blockIdx]: { i, pick } }
function blockPracticeHtml(l, bi, b) {
  const qs = b.practice;
  const st = bpState[bi] || (bpState[bi] = { i: 0, pick: null });
  if (st.i >= qs.length) {
    return `<div class="question-levels" style="margin:18px 0"><div class="level-card" style="grid-template-columns:1fr;gap:6px;text-align:center"><h3 style="font-size:18px">✓ Практика урока ${bi + 1} пройдена</h3><p style="font-size:13px;opacity:.7">Ответы разобраны выше — листайте к следующему уроку.</p></div></div>`;
  }
  const q = qs[st.i];
  return `
    <div class="question-levels" style="margin:18px 0" id="bpArea-${bi}">
      <div class="level-card" style="grid-template-columns:1fr;gap:10px">
        <p style="font-size:12px;opacity:.6;font-weight:800;letter-spacing:.08em">ПРОВЕРЬ СЕБЯ · УРОК ${bi + 1} · ВОПРОС ${st.i + 1} ИЗ ${qs.length}</p>
        <p style="font-weight:800;color:var(--ink);font-size:16px">${esc(q.q)}</p>
        <div id="bpOpts-${bi}">
          ${q.options.map((o, oi) => `<button class="answer-option" data-bp="${bi}" data-p="${oi}" ${st.pick !== null ? 'disabled' : ''}><span>${String.fromCharCode(65 + oi)}</span><p>${esc(o.label)}</p></button>`).join('')}
        </div>
        <div id="bpFb-${bi}"></div>
      </div>
    </div>`;
}
function bindBlockPractice(l) {
  if (!l || !l.course || !l.blocks) return;
  document.querySelectorAll('[data-bp]').forEach((btn) => btn.addEventListener('click', () => {
    const bi = +btn.dataset.bp;
    const b = l.blocks[bi];
    if (!b || !b.practice) return;
    const st = bpState[bi] || (bpState[bi] = { i: 0, pick: null });
    if (st.pick !== null) return;
    const oi = +btn.dataset.p;
    const q = b.practice[st.i];
    const o = q.options[oi];
    st.pick = oi;
    S.attempts++; if (o.good) { S.correct++; addXp(5); }
    save();
    btn.classList.add(o.good ? 'correct' : 'wrong');
    document.querySelectorAll('#bpOpts-' + bi + ' .answer-option').forEach((x, xi) => { if (xi !== oi && !o.good) x.classList.add(xi === q.options.findIndex((z) => z.good) ? 'correct' : 'dim'); });
    const fb = document.getElementById('bpFb-' + bi);
    const last = st.i + 1 >= b.practice.length;
    fb.innerHTML = `<div class="feedback-area"><div class="feedback-tip"><strong>${o.good ? '✓ Верно' : '✗ Не совсем'}</strong><p>${esc(o.fb)}</p></div><button class="primary-button" id="bpNext-${bi}">${last ? 'К следующему уроку ↓' : 'Дальше →'}</button></div>`;
    document.getElementById('bpNext-' + bi).addEventListener('click', () => {
      if (last) { delete bpState[bi]; bpState[bi] = { i: b.practice.length, pick: null }; }
      else { bpState[bi] = { i: st.i + 1, pick: null }; }
      const area = document.getElementById('bpArea-' + bi);
      if (area) { const html = blockPracticeHtml(l, bi, b); area.outerHTML = html.replace('id="bpArea-' + bi + '"', 'id="bpArea-' + bi + '"'); bindBlockPractice(l); }
    });
  }));
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
  const l = mode === 'spiced' ? SPICED[lessonIdx] : mode === 'med' ? MED[lessonIdx] : mode === 'extra' ? EXTRA[lessonIdx] : mode === 'pro' ? PRO[lessonIdx] : L[lessonIdx];
  if (!l.practice || !l.practice.length) return;
  const q = l.practice[pState.i] || l.practice[0];
  const total = l.practice.length;
  const last = pState.i + 1 >= total;
  document.querySelectorAll('#pOpts .answer-option').forEach((b) => b.addEventListener('click', () => {
    if (pState.pick !== null) return;
    const oi = +b.dataset.p;
    const o = q.options[oi];
    pState.pick = oi;
    S.attempts++; if (o.good) { S.correct++; addXp(5); }
    if (last && mode === 'main' && !S.practiced.includes(lessonIdx)) {
      S.practiced.push(lessonIdx);
      toast('Практика пройдена — следующий урок открыт');
    }
    if (last && mode === 'spiced' && !S.spPracticed.includes(lessonIdx)) S.spPracticed.push(lessonIdx);
    if (last && mode === 'med' && !S.medPracticed.includes(lessonIdx)) S.medPracticed.push(lessonIdx);
    if (last && mode === 'pro' && !S.proPracticed.includes(lessonIdx)) S.proPracticed.push(lessonIdx);
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
              <p>${mode === 'med' ? 'Разберите фидбеки выше — и отметьте урок изученным.' : mode === 'extra' ? 'Материал усвоен — можно отметить его изученным выше.' : 'Разберите фидбеки выше — и отметьте урок пройденным.'}</p>
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
  const tab = S.pTab || ((USER && USER.email === BOSS_EMAIL) ? 'selfcheck' : 'trainer');
  S.pTab = tab;
  b.innerHTML = `
    <div class="practice-head">
      <div class="seg-control">
        <button class="${tab === 'selfcheck' ? 'active' : ''}" data-ptab="selfcheck">Проверь себя</button>
        <button class="${tab === 'trainer' ? 'active' : ''}" data-ptab="trainer">Тренажёр</button>
        <button class="${tab === 'cases' ? 'active' : ''}" data-ptab="cases">Кейсы</button>
      </div>
    </div>
    <div id="practiceContent"></div>`;
  b.querySelectorAll('[data-ptab]').forEach((x) => x.addEventListener('click', () => { S.pTab = x.dataset.ptab; renderPractice(); }));
  if (tab === 'cases') renderCases(); else if (tab === 'selfcheck') renderSelfCheck(); else renderTrainer();
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
// Банк вопросов режима (индексы — стабильные, по ним и храним прогресс)
function trainerBank(mode) { return mode === 'proact' ? PRO_TRAINER : mode === 'remote' ? x4Situations() : (BANK_BY_MODE[mode] || quiz); }
function trnOf(mode) { return (S.trn || {})[mode] || null; }
function trnSave(mode) { // сохраняем текущее положение прогона
  if (!USER || !mode) return;
  if (!S.trn) S.trn = {};
  const st = S.trn[mode] || (S.trn[mode] = { ord: [], i: 0, sc: 0, done: false, wrong: [] });
  const rec = { ord: (S.tOrderIdx || []).slice(), i: S.tIdx, sc: S.tScore, done: S.tOrderIdx.length > 0 && S.tIdx >= S.tOrderIdx.length };
  if (S.tRev) st.rv = rec; // прогон по ошибкам — не затирает основной прогресс
  else { st.ord = rec.ord; st.i = rec.i; st.sc = rec.sc; st.done = rec.done; }
  save();
}
function trnNote(mode, idx, ok) { // фиксируем ошибку / убираем её, если ответил верно
  if (!S.trn) S.trn = {};
  const st = S.trn[mode] || (S.trn[mode] = { ord: [], i: 0, sc: 0, done: false, wrong: [] });
  if (!Array.isArray(st.wrong)) st.wrong = [];
  if (ok) st.wrong = st.wrong.filter((k) => k !== idx);
  else if (!st.wrong.includes(idx)) st.wrong.push(idx);
}
function trnPos(mode) { // сколько пройдено в режиме
  const st = trnOf(mode); const tot = trainerBank(mode).length || 1;
  const ansN = st ? Math.min(Number(st.i) || 0, tot) : 0;
  return { st: st, tot: tot, ansN: ansN, wr: st && Array.isArray(st.wrong) ? st.wrong.length : 0, done: !!(st && st.done) };
}
function trnClass(mode) { const p = trnPos(mode); return p.ansN > 0 ? (' ' + (p.done ? 'practiced' : 'answered')) : ''; }
function trnFoot(mode, def) {
  const p = trnPos(mode);
  if (!p.ansN) return def;
  const tail = p.wr ? '' : ' · ошибок нет';
  return p.done ? `<span class="sc-done-txt">Пройдено ${p.ansN} из ${p.tot} · ✓ ${p.st.sc || 0}${tail}</span><strong>Ещё раз ↻</strong>`
                : `<span>Остановился на ${p.ansN} из ${p.tot} · ✓ ${p.st.sc || 0}${tail}</span><strong>Продолжить →</strong>`;
}
function trnWrongBtn(mode) { const p = trnPos(mode); return p.wr ? `<button class="sc-badge retry" data-retry="1">ОШИБКИ: ${p.wr} · ПОВТОРИТЬ</button>` : ''; }
function trnStart(mode, opts) {
  opts = opts || {};
  const bank = trainerBank(mode);
  if (!bank.length) return;
  S.tMode = mode; S.tPick = null;
  if (opts.rev) { // прогон только по ошибкам
    const st = trnOf(mode) || {};
    let w = ((st.wrong) || []).filter((k) => k >= 0 && k < bank.length);
    if (!w.length) w = bank.map((z, i) => i);
    S.tOrderIdx = w.slice(); S.tIdx = 0; S.tScore = 0; S.tRev = true;
  } else if (opts.resume) { // продолжаем с места остановки
    const st = trnOf(mode) || {};
    let ord = ((st.ord) || []).filter((k) => k >= 0 && k < bank.length);
    const seen = new Set(ord); bank.forEach((z, i) => { if (!seen.has(i)) ord.push(i); });
    S.tOrderIdx = ord; S.tIdx = Math.min(Number(st.i) || 0, ord.length); S.tScore = Number(st.sc) || 0; S.tRev = false;
  } else { // с начала
    S.tOrderIdx = shuffle(bank.map((z, i) => i)); S.tIdx = 0; S.tScore = 0; S.tRev = false;
  }
  S.tOrder = S.tOrderIdx.map((i) => bank[i]);
  renderTrainer();
}
function renderTrainer() {
  const b = $('practiceContent');
  // выбор режима
  if (!S.tMode) {
    const modeCourse = { spin: 0, say: 0, need: 0, challenger: 1, solution: 2, consult: 3 };
    const modeCard = {
      spin:   { icon: 'S', n: 'Вопросы СПИН', l: `${quiz.length} РЕПЛИК`, d: 'Ситуационный, болевой, извлекающий или направляющий — определите тип вопроса (уроки 2–5).' },
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
        <p style="margin-top:6px"><strong>Прогресс каждого режима сохраняется</strong> — можно закрыть приложение и вернуться к тому же вопросу. Неверные ответы копятся отдельно: на карточке появится жёлтая кнопка <strong>«ОШИБКИ · ПОВТОРИТЬ»</strong> — прогон только по ним.</p>
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
            const p = trnPos(m);
            return `<article class="module-card current${trnClass(m)}" data-mode="${m}">
              <div class="module-icon">${k.icon}</div>
              <span class="status-label">${k.l}${p.st && p.st.sc ? ' · ✓ ' + p.st.sc : ''}</span>
              <h3>${k.n}</h3>
              <p>${k.d}</p>
              ${p.ansN ? `<div class="sc-track"><i class="sc-fill ${p.done ? 'ok' : ''}" style="width:${Math.round((p.ansN / p.tot) * 100)}%"></i></div>` : ''}
              <div class="module-footer">${trnFoot(m, '<span>не начат · ошибок нет</span><strong>Начать →</strong>')}</div>
              ${trnWrongBtn(m)}
            </article>`;
          }).join('')}
        </div>`;
      }).join('')}
      ${PRO_TRAINER.length ? `
      <div class="section-title-row" style="margin-top:30px">
        <div><h2>Курс 5 · Проактивные продажи</h2><p>готовые ситуации из мастер-курса · выберите правильное действие</p></div>
      </div>
      <div class="module-grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
        <article class="module-card current${trnClass('proact')}" data-mode="proact">
          <div class="module-icon">P</div>
          <span class="status-label">${PRO_TRAINER.length} СИТУАЦИЙ${trnPos('proact').st && trnPos('proact').st.sc ? ' · ✓ ' + trnPos('proact').st.sc : ''}</span>
          <h3>Ситуации ProActive</h3>
          <p>Врач просит «информацию», заведующий хочет «в следующем году», клиент «подумает» — ваше действие?</p>
          <div class="module-footer">${trnFoot('proact', '<span>не начат · ошибок нет</span><strong>Начать →</strong>')}</div>
          ${trnWrongBtn('proact')}
        </article>
      </div>` : ''}
      ${EXTRA.some((e) => e.id === 'x4') && x4Situations().length ? `
      <div class="section-title-row" style="margin-top:30px">
        <div><h2>Дополнительно · Удалённые продажи</h2><p>готовые ситуации из курса: звонок, переписка, стенд · выберите правильное действие</p></div>
      </div>
      <div class="module-grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
        <article class="module-card current${trnClass('remote')}" data-mode="remote">
          <div class="module-icon">У</div>
          <span class="status-label">${x4Situations().length} СИТУАЦИЙ${trnPos('remote').st && trnPos('remote').st.sc ? ' · ✓ ' + trnPos('remote').st.sc : ''}</span>
          <h3>Ситуации удалённых продаж</h3>
          <p>Секретарь «не даёт номера», врач говорит «дорого», партнёр тянет с ответом — ваше действие?</p>
          <div class="module-footer">${trnFoot('remote', '<span>не начат · ошибок нет</span><strong>Начать →</strong>')}</div>
          ${trnWrongBtn('remote')}
        </article>
      </div>` : ''}`;
    b.querySelectorAll('[data-mode]').forEach((x) => x.addEventListener('click', (e) => {
      const m = x.dataset.mode;
      if (e.target.closest('[data-retry]')) { trnStart(m, { rev: true }); toast('Повторяем только ошибки'); return; }
      const st = trnOf(m);
      if (st && st.i > 0 && !st.done) { trnStart(m, { resume: true }); toast('Продолжаем с места остановки'); }
      else trnStart(m);
    }));
    return;
  }
  // режимы «Ситуации» (ProActive / Удалённые продажи): задания с вариантами, +5 XP за верный
  const SIT_META = {
    proact: { eyebrow: 'СИТУАЦИИ PROACTIVE', sub: 'Готовые ситуации из мастер-курса · выберите действие и увидите разбор.', chip: 'Курс 5 · ProActive', ok: 'Отличная реакция. Так и работайте с клиникой!', mid: 'Неплохо. Повторите уроки курса 5 и попробуйте ещё раз.', low: 'Пока рано. Вернитесь к урокам 1–12 Курса 5.' },
    remote: { eyebrow: 'СИТУАЦИИ · УДАЛЁННЫЕ ПРОДАЖИ', sub: 'Ситуации из курса: звонок, переписка, стенд · выберите действие и увидите разбор.', chip: 'Удалённые продажи', ok: 'Отличная реакция. Так и работайте с клиникой!', mid: 'Неплохо. Повторите уроки курса и попробуйте ещё раз.', low: 'Пока рано. Вернитесь к урокам курса.' },
  };
  const SIT_BANK = S.tMode === 'proact' ? PRO_TRAINER : S.tMode === 'remote' ? x4Situations() : [];
  if ((S.tMode === 'proact' && PRO_TRAINER.length) || (S.tMode === 'remote' && SIT_BANK.length)) {
    const sm = SIT_META[S.tMode];
    if (S.tIdx >= S.tOrder.length) {
      trnSave(S.tMode);
      const pct = Math.round((S.tScore / S.tOrder.length) * 100);
      const verdict = pct >= 85 ? sm.ok : pct >= 60 ? sm.mid : sm.low;
      const st = trnOf(S.tMode) || {};
      const wr = (st.wrong || []).length;
      b.innerHTML = `
        <div class="page-heading"><p class="eyebrow">${sm.eyebrow}${S.tRev ? ' · РАБОТА НАД ОШИБКАМИ' : ''} · ИТОГ</p><h1>${S.tScore} из ${S.tOrder.length}</h1><p>${pct}% верных · ${verdict}</p></div>
        <p class="answer-prompt" style="margin:0 0 12px">${wr ? 'Осталось ошибок: ' + wr : 'Ошибок нет — идём дальше.'}</p>
        <div class="feedback-actions">
          ${wr ? `<button class="primary-button" id="tWrong">Повторить ошибки (${wr})</button>` : ''}
          <button class="${wr ? 'secondary-button' : 'primary-button'}" id="tAgain">Пройти заново</button>
          <button class="secondary-button" id="tMode">Другой режим</button>
        </div>`;
      const tw = $('tWrong');
      if (tw) tw.addEventListener('click', () => trnStart(S.tMode, { rev: true }));
      $('tAgain').addEventListener('click', () => trnStart(S.tMode));
      $('tMode').addEventListener('click', () => { S.tRev = false; S.tMode = null; renderTrainer(); });
      return;
    }
    const q = S.tOrder[S.tIdx];
    const picked = S.tPick;
    b.innerHTML = `
      <div class="trainer-header">
        <div><p class="eyebrow">${sm.eyebrow}</p><h1 id="trainer-title">Что вы сделаете?</h1><p>${sm.sub}</p></div>
        <div style="display:flex;align-items:center;gap:14px">
          <div class="round-indicator"><strong>${S.tIdx + 1}</strong><span>/ ${S.tOrder.length} · ✓ ${S.tScore}</span></div>
          <button class="mode-switch" id="tSwitch">Сменить режим</button>
        </div>
      </div>
      <div class="trainer-grid">
        <article class="scenario-card">
          <div class="scenario-top"><span class="case-chip">СИТУАЦИЯ</span><span>${sm.chip}${q.ln ? ' · Урок ' + q.ln : ''}</span></div>
          <blockquote id="clientPhrase">${quoteSmart(q.q)}</blockquote>
        </article>
        <article class="answers-card">
          <div id="answerArea">
            <p class="answer-prompt">Ваше действие:</p>
            ${q.options.map((o, oi) => `<button class="answer-option" data-oi="${oi}" ${picked !== null ? 'disabled' : ''}><span>${String.fromCharCode(65 + oi)}</span><p>${esc(o.label)}</p></button>`).join('')}
          </div>
          <div id="feedbackArea" class="feedback-area hidden" aria-live="polite"></div>
        </article>
      </div>`;
    b.querySelectorAll('[data-oi]').forEach((btn) => btn.addEventListener('click', () => {
      if (S.tPick !== null) return;
      S.tPick = +btn.dataset.oi;
      S.attempts++;
      const o = q.options[S.tPick];
      const ok = !!o.good;
      if (ok) { S.correct++; S.tScore++; addXp(5); toast('Верно · +5 XP'); } else { save(); syncChrome(); }
      trnNote(S.tMode, S.tOrderIdx[S.tIdx], ok);
      btn.classList.add(ok ? 'correct' : 'wrong');
      q.options.forEach((x, xi) => { if (x.good) b.querySelectorAll('[data-oi]')[xi].classList.add('correct'); });
      const fa = $('feedbackArea');
      fa.classList.remove('hidden');
      fa.innerHTML = `<div class="feedback-icon">${ok ? '✓' : '✗'}</div><h2>${ok ? 'Верно' : 'Неверно'}</h2><p>${esc(o.fb)}</p><div class="feedback-actions"><button class="primary-button" id="tNext">${S.tIdx + 1 >= S.tOrder.length ? 'Итог' : 'Дальше →'}</button></div>`;
      $('tNext').addEventListener('click', () => { S.tIdx++; trnSave(S.tMode); S.tPick = null; renderTrainer(); });
    }));
    const ts0 = $('tSwitch');
    if (ts0) ts0.addEventListener('click', () => { trnSave(S.tMode); S.tRev = false; S.tMode = null; S.tPick = null; renderTrainer(); });
    return;
  }
  const bank = BANK_BY_MODE[S.tMode] || quiz;
  const meta = shuffle(LETTERS_BY_MODE[S.tMode] || ['S', 'P', 'I', 'N']);
  const tmeta = META_BY_MODE[S.tMode] || TYPE_META;
  if (S.tIdx >= S.tOrder.length) {
    // итог
    trnSave(S.tMode);
    const pct = Math.round((S.tScore / S.tOrder.length) * 100);
    const verdict = pct >= 85 ? 'Отличная реакция. Идите в кейсы!' : pct >= 60 ? 'Неплохо. Повторите теорию и попробуйте ещё раз.' : 'Пока рано. Вернитесь к урокам.';
    const st = trnOf(S.tMode) || {};
    const wr = (st.wrong || []).length;
    b.innerHTML = `
      <div class="page-heading"><p class="eyebrow">ТРЕНАЖЁР${S.tRev ? ' · РАБОТА НАД ОШИБКАМИ' : ''} · ИТОГ</p><h1>${S.tScore} из ${S.tOrder.length}</h1><p>${pct}% верных · ${verdict}</p></div>
      <p class="answer-prompt" style="margin:0 0 12px">${wr ? 'Осталось ошибок: ' + wr : 'Ошибок нет — идём дальше.'}</p>
      <div class="feedback-actions">
        ${wr ? `<button class="primary-button" id="tWrong">Повторить ошибки (${wr})</button>` : ''}
        <button class="${wr ? 'secondary-button' : 'primary-button'}" id="tAgain">Пройти заново</button>
        <button class="secondary-button" id="tMode">Другой режим</button>
      </div>`;
    const tw = $('tWrong');
    if (tw) tw.addEventListener('click', () => trnStart(S.tMode, { rev: true }));
    $('tAgain').addEventListener('click', () => trnStart(S.tMode));
    $('tMode').addEventListener('click', () => { S.tRev = false; S.tMode = null; renderTrainer(); });
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
        <blockquote id="clientPhrase">${quoteSmart(q.q)}</blockquote>
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
    trnNote(S.tMode, S.tOrderIdx[S.tIdx], ok);
    save(); syncChrome();
    btn.classList.add(ok ? 'correct' : 'wrong');
    b.querySelectorAll('[data-t]').forEach((x) => { if (x.dataset.t === q.type) x.classList.add('correct'); if (x.dataset.t !== S.tPick && x.dataset.t !== q.type) x.classList.add('dim'); });
    const fa = $('feedbackArea');
    fa.classList.remove('hidden');
    fa.innerHTML = `<div class="feedback-icon">${ok ? '✓' : '✗'}</div><h2>${ok ? 'Верно' : 'Это ' + tmeta[q.type].n.toLowerCase()}</h2><p>${esc(q.why)}</p><div class="feedback-actions"><button class="primary-button" id="tNext">${S.tIdx + 1 >= S.tOrder.length ? 'Итог' : 'Дальше →'}</button></div>`;
    $('tNext').addEventListener('click', () => { S.tIdx++; trnSave(S.tMode); S.tPick = null; renderTrainer(); });
  }));
  const ts = $('tSwitch');
  if (ts) ts.addEventListener('click', () => { trnSave(S.tMode); S.tRev = false; S.tMode = null; S.tPick = null; renderTrainer(); });
}

function shuffle(a) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

// ============ РАЗБОРЫ (кейсы) ============
const gradeMeta = { good: { t: 'Хороший ход', pts: 2 }, ok: { t: 'Приемлемо', pts: 1 }, bad: { t: 'Ошибка', pts: 0 } };
// уровень кейса берём из данных (easy / medium / hard)
const CASE_LVL_RU = { easy: 'НАЧАЛЬНЫЙ', medium: 'СРЕДНИЙ', hard: 'ПРОДВИНУТЫЙ' };
const CASE_LVL_RANK = { easy: 0, medium: 1, hard: 2 };
function caseOrder() { // показываем от простого к сложному, внутри уровня — по порядку
  return cases.map((c, i) => i).sort((a, b) => (CASE_LVL_RANK[cases[a].level] ?? 1) - (CASE_LVL_RANK[cases[b].level] ?? 1) || a - b);
}
function casesSummary() {
  const n = { easy: 0, medium: 0, hard: 0 };
  cases.forEach((c) => { n[c.level] = (n[c.level] || 0) + 1; });
  const p = [];
  if (n.easy) p.push(n.easy + ' ' + pluralN(n.easy, ['начальный', 'начальных', 'начальных']));
  if (n.medium) p.push(n.medium + ' ' + pluralN(n.medium, ['средний', 'средних', 'средних']));
  if (n.hard) p.push(n.hard + ' ' + pluralN(n.hard, ['продвинутый', 'продвинутых', 'продвинутых']));
  return cases.length + ' ' + pluralN(cases.length, ['разбор', 'разбора', 'разборов']) + ': ' + p.join(', ') + '. Идём от простого к сложному.';
}
function renderCases() {
  const b = $('practiceContent');
  if (S.cIdx === null) {
    b.innerHTML = `
      <div class="page-heading">
        <p class="eyebrow">КЕЙСЫ · СИМУЛЯЦИИ ВСТРЕЧ</p>
        <h1 id="cases-title">Симуляции встреч</h1>
        <p>Живой диалог с клиентом: реплика за репликой, разбор каждого хода. Хороший ход — 2, приемлемый — 1, ошибка — 0. ${casesSummary()}</p>
      </div>
      <div class="cases-grid">
        ${caseOrder().map((i, pos) => {
        const c = cases[i];
        const cd = S.cDone.includes(i);
        const lv = CASE_LVL_RU[c.level] || CASE_LVL_RU.medium;
        return `
        <article class="case-card ${cd ? 'completed' : ''}">
          <div class="case-card-top"><span>${String(pos + 1).padStart(2, '0')}</span><span class="difficulty ${c.level || 'medium'}">${lv}</span></div>
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

// ============ ПРОВЕРЬ СЕБЯ (практики курсов) ============
// Собирает все поурочные практики «Проверь себя» по курсам и запускает их из вкладки «Практика».
function selfCheckCatalog() {
  const isBoss = USER && USER.email === BOSS_EMAIL;
  const cat = [];
  const add = (id, name, sub, icon, lessons, open) => {
    const qs = [];
    lessons.forEach((ll) => (ll.qs || []).forEach((k) => qs.push({ q: k.q, options: k.options, ln: ll.num, lt: ll.title })));
    if (!qs.length) return;
    cat.push({ id, name, sub, icon, open, qs });
  };
  // курсы программы — практика открывается после первого пройденного урока курса
  add('spiced', 'Курс 1а · SPICED', 'Диагностика сделки · Winning by Design', 'S',
    SPICED.map((ll, i) => ({ num: i + 1, title: ll.title, qs: ll.practice || [] })),
    isBoss || REVIEW_MODE || S.spicedDone.length > 0);
  add('med', 'Курс MEDDPICC', 'Квалификация сделки · 8 элементов и риски', 'M',
    MED.map((ll, i) => ({ num: i + 1, title: ll.title, qs: ll.practice || [] })),
    isBoss || REVIEW_MODE || S.medDone.length > 0);
  add('pro', 'Курс 5 · ProActive', 'Управление сделкой · Skip Miller', 'P',
    PRO.map((ll, i) => ({ num: i + 1, title: ll.title, qs: ll.practice || [] })),
    isBoss || REVIEW_MODE || S.proDone.length > 0);
  // дополнительные курсы — практики открыты всегда
  const x3 = EXTRA_ALL.find((e) => e.id === 'x3');
  if (x3 && x3.practice && x3.practice.length) add('x3', 'Телефонные продажи', 'Разрыв шаблона вместо скрипта · Рабичев', 'Т',
    [{ num: 1, title: x3.title, qs: x3.practice }], true);
  const x4 = EXTRA_ALL.find((e) => e.id === 'x4');
  if (x4) add('x4', 'Удалённые продажи', 'Телефон, переписка, стенд, приёмы · 31 урок', 'У',
    x4.blocks.map((b, i) => ({ num: i + 1, title: b.h, qs: b.practice || [] })), true);
  return cat;
}
function scMark(id, qi, ok) { // отмечаем ответ на вопрос практики: answered + (если верно) correct
  if (!S.scStat) S.scStat = {};
  const st = S.scStat[id] || (S.scStat[id] = { a: [], r: [] });
  if (!st.a) st.a = [];
  if (!st.r) st.r = [];
  if (!st.a.includes(qi)) st.a.push(qi);
  if (ok && !st.r.includes(qi)) st.r.push(qi);
}
// Переносим в отметки «Проверь себя» то, что уже отработано в уроках (объединением, никогда не стираем).
function scBackfill() {
  if (!S.scStat) S.scStat = {};
  const mark = (id, from, to) => {
    if (!S.scStat[id]) S.scStat[id] = { a: [], r: [] };
    const st = S.scStat[id];
    if (!st.a) st.a = [];
    if (!st.r) st.r = [];
    for (let q = from; q < to; q++) if (!st.a.includes(q)) st.a.push(q);
  };
  const span = (id, counts, doneArr) => {
    (doneArr || []).forEach((li) => {
      if (li < 0 || li >= counts.length) return;
      let from = 0;
      for (let k = 0; k < li; k++) from += counts[k];
      mark(id, from, from + counts[li]);
    });
  };
  try {
    span('spiced', SPICED.map((l) => (l.practice || []).length), S.spPracticed);
    span('med', MED.map((l) => (l.practice || []).length), S.medPracticed);
    span('pro', PRO.map((l) => (l.practice || []).length), S.proPracticed);
    const x4 = EXTRA_ALL.find((e) => e.id === 'x4');
    if (x4) span('x4', x4.blocks.map((b) => (b.practice || []).length), (S.xDone && S.xDone['x4']) || []);
  } catch (e) {}
}
function renderSelfCheck() {
  const b = $('practiceContent');
  scBackfill();
  if (!S.sc) {
    const cat = selfCheckCatalog();
    b.innerHTML = `
      <div class="page-heading">
        <p class="eyebrow">ПРОВЕРЬ СЕБЯ</p>
        <h1 id="sc-title">Практики курсов</h1>
        <p>Вопросы после каждого урока — отвечайте и сверяйтесь с разбором. Прошли урок — его практика открыта здесь для повторения. +5 XP за верный ответ.</p>
      </div>
      <div class="module-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
        ${cat.map((c) => {
        const st = scStatOf(c.id);
        const total = c.qs.length;
        const ansN = st.a.length, rightN = st.r.length;
        const full = ansN >= total;
        const cls = c.open ? ('current' + (full ? ' practiced' : ansN > 0 ? ' answered' : '')) : 'locked';
        const foot = !c.open ? '🔒 После первого урока курса'
          : full && rightN ? '✓ Практика пройдена — ' + rightN + ' из ' + total
          : full ? 'Вопросы разобраны в уроках — пройдите заново'
          : ansN > 0 ? 'Отвечено ' + ansN + ' из ' + total + ' · ещё ' + (total - ansN)
          : 'Начать →';
        return `
        <article class="module-card ${cls}" ${c.open ? `data-sc="${c.id}"` : ''} tabindex="0" role="button" ${c.open ? '' : 'title="Пройдите хотя бы один урок курса — и практика откроется"'}>
          <div class="module-icon">${c.icon}</div>
          <span class="status-label">${total} ${pluralN(total, ['ВОПРОС', 'ВОПРОСА', 'ВОПРОСОВ'])}${rightN ? ' · ✓ ' + rightN : ''}</span>
          <h3>${esc(c.name)}</h3>
          <p>${esc(c.sub)}</p>
          ${c.open && ansN ? `<div class="sc-track"><i class="sc-fill ${full ? 'ok' : ''}" style="width:${Math.round((ansN / total) * 100)}%"></i></div>` : ''}
          <div class="module-footer"><span class="${full && rightN ? 'sc-done-txt' : ''}">${foot}</span>${ansN ? `<span class="sc-badge">${full ? 'ПРОЙДЕНО' : 'ОТВЕЧЕНО'}</span>` : ''}</div>
        </article>`;
      }).join('')}
      </div>`;
    b.querySelectorAll('[data-sc]').forEach((x) => x.addEventListener('click', () => { S.sc = { id: x.dataset.sc, i: 0, pick: null, score: 0 }; renderSelfCheck(); }));
    return;
  }
  const c = selfCheckCatalog().find((z) => z.id === S.sc.id) || selfCheckCatalog()[0];
  if (!c) { S.sc = null; renderSelfCheck(); return; }
  if (S.sc.i >= c.qs.length) {
    const pct = Math.round((S.sc.score / c.qs.length) * 100);
    const verdict = pct >= 85 ? 'Отличный результат. Практика закрепилась!' : pct >= 60 ? 'Неплохо. Повторите вопросы с разборами — и попробуйте ещё раз.' : 'Пока рано. Вернитесь к урокам курса и ответьте снова.';
    b.innerHTML = `
      <div class="page-heading"><p class="eyebrow">ПРОВЕРЬ СЕБЯ · ${esc(c.name.toUpperCase())}</p><h1>${S.sc.score} из ${c.qs.length}</h1><p>${pct}% верных · ${verdict}</p></div>
      <div class="feedback-actions">
        <button class="primary-button" id="scAgain">Ещё раз</button>
        <button class="secondary-button" id="scList">Другие практики</button>
      </div>`;
    $('scAgain').addEventListener('click', () => { S.sc = { id: c.id, i: 0, pick: null, score: 0 }; renderSelfCheck(); });
    $('scList').addEventListener('click', () => { S.sc = null; renderSelfCheck(); });
    return;
  }
  const k = c.qs[S.sc.i];
  const picked = S.sc.pick;
  b.innerHTML = `
    <div class="trainer-header">
      <div><p class="eyebrow">ПРОВЕРЬ СЕБЯ · ${esc(c.name.toUpperCase())}</p><h1 id="sc-title">Урок ${k.ln}: ${esc(k.lt)}</h1><p>вопрос после урока · ответьте и увидите разбор</p></div>
      <div style="display:flex;align-items:center;gap:14px">
        <div class="round-indicator"><strong>${S.sc.i + 1}</strong><span>/ ${c.qs.length} · ✓ ${S.sc.score}</span></div>
        <button class="mode-switch" id="scSwitch">← Практики</button>
      </div>
    </div>
    <div class="trainer-grid">
      <article class="scenario-card">
        <div class="scenario-top"><span class="case-chip">ВОПРОС</span><span>${esc(c.name)}</span></div>
        <div class="client-profile"><span class="avatar large">${c.icon}</span><div><strong>${esc(c.name)}</strong><p>Урок ${k.ln} · ${esc(k.lt.slice(0, 60))}${k.lt.length > 60 ? '…' : ''}</p></div></div>
        <blockquote id="scPhrase">${quoteSmart(k.q)}</blockquote>
      </article>
      <article class="answers-card">
        <div id="answerArea">
          <p class="answer-prompt">Ваш ответ:</p>
          ${k.options.map((o, oi) => `<button class="answer-option" data-o="${oi}" ${picked !== null ? 'disabled' : ''}><span>${String.fromCharCode(65 + oi)}</span><p>${esc(o.label)}</p></button>`).join('')}
        </div>
        <div id="feedbackArea" class="feedback-area hidden" aria-live="polite"></div>
      </article>
    </div>`;
  b.querySelectorAll('[data-o]').forEach((btn) => btn.addEventListener('click', () => {
    if (S.sc.pick !== null) return;
    const oi = +btn.dataset.o;
    const o = k.options[oi];
    S.sc.pick = oi;
    S.attempts++;
    scMark(c.id, S.sc.i, !!o.good);
    if (o.good) { S.correct++; S.sc.score++; addXp(5); toast('Верно · +5 XP'); }
    save();
    btn.classList.add(o.good ? 'correct' : 'wrong');
    k.options.forEach((x, xi) => { if (x.good) b.querySelectorAll('[data-o]')[xi].classList.add('correct'); });
    const fa = $('feedbackArea');
    fa.classList.remove('hidden');
    fa.innerHTML = `<div class="feedback-icon">${o.good ? '✓' : '✗'}</div><h2>${o.good ? 'Верно' : 'Неверно'}</h2><p>${esc(o.fb)}</p><div class="feedback-actions"><button class="primary-button" id="scNext">${S.sc.i + 1 >= c.qs.length ? 'Итог' : 'Дальше →'}</button></div>`;
    $('scNext').addEventListener('click', () => { S.sc.i++; S.sc.pick = null; renderSelfCheck(); });
  }));
  const sw = $('scSwitch');
  if (sw) sw.addEventListener('click', () => { S.sc = null; renderSelfCheck(); });
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
    const r = await spinApi({ action: 'team', token });
    const res = await r.json();
    if (!res.ok || !res.team) { el.innerHTML = '<div class="team-empty">Нет доступа к прогрессу команды</div>'; return; }
    if (!res.team.length) { el.innerHTML = '<div class="team-empty">Пока никто из команды не начал заниматься</div>'; return; }
    el.innerHTML = res.team.map((m) => {
      const rawNm = (m.name || (m.email ? m.email.split('@')[0] : '') || 'Участник');
      const nm = rawNm.charAt(0).toUpperCase() + rawNm.slice(1);
      const doneN = (m.done || []).length;
      const spicedN = (m.spicedDone || []).length;
      const medN = (m.medDone || []).length;
      const proN = (m.proDone || []).length;
      const pracN = (m.practiced || []).length;
      const lvl = levelFromXp(m.xp || 0);
      const totalN = L.length + SPICED.length + MED.length + PRO.length; // программа: основные + 1а SPICED + 1B MEDDPICC + 5 ProActive
      const pct = Math.min(100, Math.round(((doneN + spicedN + medN + proN) / totalN) * 100));
      const spFull = SPICED.length > 0 && spicedN >= SPICED.length;
      const medFull = MED.length > 0 && medN >= MED.length;
      const proFull = PRO.length > 0 && proN >= PRO.length;
      const gFrom = COURSES.length > 1 ? COURSES[1].from : L.length;
      const nxtI = L.findIndex((_, k) => !(m.done || []).includes(k));
      const fresh = doneN === 0 && spicedN === 0 && medN === 0 && proN === 0 && pracN === 0 && !(m.xp || 0);
      const status = fresh ? 'Ещё не начинал(а)'
        : nxtI === -1 && (!SPICED.length || spFull) && (!MED.length || medFull) && (!PRO.length || proFull) ? 'Курс завершён ✓'
        : (!spFull && SPICED.length > 0 && (nxtI === -1 || nxtI >= gFrom)) ? 'Курс 1а SPICED · урок ' + Math.min(spicedN + 1, SPICED.length) + ' из ' + SPICED.length
        : (nxtI === -1 && spFull && !medFull && MED.length > 0) ? 'Курс 1B MEDDPICC · урок ' + Math.min(medN + 1, MED.length) + ' из ' + MED.length
        : (nxtI === -1 && spFull && medFull && !proFull && PRO.length > 0) ? 'Курс 5 ProActive · урок ' + Math.min(proN + 1, PRO.length) + ' из ' + PRO.length
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
          <b>${doneN + spicedN + medN + proN} из ${totalN}</b>
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
// Какой кейс к какому методу (курсу) относится: 0–3 = курсы 1–4, 'spiced' = 1а, 'med' = 1B
const CASE_COURSE = { case1: 0, case2: 0, case3: 0, case4: 1, case5: 2, case6: 3, case7: 3, case8: 3, case9: 0, case10: 0, case11: 1, case12: 3, case13: 'med', case14: 'med' }; // индексы COURSES 0–3 + 'med'
const MODE_COURSE = { spin: 0, say: 0, need: 0, challenger: 1, solution: 2, consult: 3 }; // режимы тренажёра по курсам
const MODE_NAME = { spin: 'вопросы СПИН', say: 'типы высказываний', need: 'потребности клиента', challenger: 'ходы Challenger', solution: 'диагноз до рецепта', consult: 'стратег и коалиции', proact: 'ситуации ProActive' };
function pmCardHtml(name, sub, pDone, pTotal, modes, cDone, cTotal, ptogo) {
  const pPct = pTotal ? Math.round((pDone / pTotal) * 100) : 0;
  const cPct = cTotal ? Math.round((cDone / cTotal) * 100) : 0;
  return `<article class="pm-card">
    <div class="pm-head"><strong>${esc(name)}</strong><span>${esc(sub)}</span></div>
    ${pTotal ? `<div class="pm-line clickable" data-ptogo="${ptogo}" title="Открыть практику «Проверь себя» — она в конце урока"><span>✍️ практика «Проверь себя»</span><b>${pDone} из ${pTotal}</b><i class="pm-track"><em style="width:${pPct}%"></em></i></div>` : ''}
    ${modes.length ? `<div class="pm-line clickable" data-pjump="trainer" title="Открыть тренажёр"><span>🎯 тренажёр</span><b>${modes.length} ${pluralN(modes.length, ['режим', 'режима', 'режимов'])}</b><i class="pm-note">${esc(modes.map((m) => MODE_NAME[m]).join(' · '))}</i></div>` : ''}
    ${cTotal ? `<div class="pm-line clickable" data-pjump="cases" title="Открыть кейсы"><span>🧩 кейсы</span><b>${cDone} из ${cTotal}</b><i class="pm-track"><em style="width:${cPct}%"></em></i></div>` : ''}
  </article>`;
}
function pmCardsHtml() {
  const rows = [];
  // первый урок курса с непройденной практикой (для перехода «✍️ практика»)
  const firstP = (idxs) => { const i = idxs.find((k) => !S.practiced.includes(k)); return i === undefined ? idxs[0] : i; };
  COURSES.forEach((g, ci) => {
    const idxs = [];
    for (let i = g.from; i < g.to; i++) idxs.push(i);
    const pDone = idxs.filter((i) => S.practiced.includes(i)).length;
    const modes = Object.keys(MODE_COURSE).filter((m) => MODE_COURSE[m] === ci);
    const cList = cases.filter((c) => CASE_COURSE[c.id] === ci);
    const cDone = cList.filter((c) => S.cDone.includes(cases.indexOf(c))).length;
    rows.push(pmCardHtml(g.name, idxs.length + ' уроков · уроки ' + (g.from + 1) + '–' + g.to, pDone, idxs.length, modes, cDone, cList.length, 'main:' + firstP(idxs)));
    // курс 1а SPICED и курс 1B MEDDPICC идут сразу после Курса 1 — как в маршруте
    if (ci === 0 && SPICED.length) {
      const sp = SPICED.findIndex((x, k) => !S.spPracticed.includes(k));
      rows.push(pmCardHtml('Курс 1а · SPICED — расширение СПИН', SPICED.length + ' уроков · диагностика сделки', S.spPracticed.length, SPICED.length, [], 0, 0, 'spiced:' + (sp === -1 ? 0 : sp)));
    }
    if (ci === 0 && MED.length) {
      const cList = cases.filter((c) => CASE_COURSE[c.id] === 'med');
      const cDone = cList.filter((c) => S.cDone.includes(cases.indexOf(c))).length;
      const md = MED.findIndex((x, k) => !S.medPracticed.includes(k));
      rows.push(pmCardHtml('Курс 1B · MEDDPICC — квалификация', MED.length + ' уроков · проверка сделки', S.medPracticed.length, MED.length, [], cDone, cList.length, 'med:' + (md === -1 ? 0 : md)));
    }
  });
  if (PRO.length) {
    const pr = PRO.findIndex((x, k) => !S.proPracticed.includes(k));
    rows.push(pmCardHtml('Курс 5 · Проактивные продажи', PRO.length + ' уроков · управление сделкой', S.proPracticed.length, PRO.length, PRO_TRAINER.length ? ['proact'] : [], 0, 0, 'pro:' + (pr === -1 ? 0 : pr)));
  }
  return rows.join('');
}

function renderProgress() {
  const doneN = S.done.length;
  const spicedN = SPICED.filter((x, k) => S.spicedDone.includes(k)).length; // курс 1а входит в общий счёт
  const medN = MED.filter((x, k) => S.medDone.includes(k)).length; // курс 1B MEDDPICC — тоже в общем счёте
  const proN = PRO.filter((x, k) => S.proDone.includes(k)).length; // курс 5 ProActive — в общем счёте
  const totalAll = L.length + SPICED.length + MED.length + PRO.length;
  const boss = isBoss();
  const pct = S.attempts ? Math.round((S.correct / S.attempts) * 100) : 0;
  const xp = S.xp;
  const lvl = level();
  const nextLvl = lvlNeed(lvl + 1);
  const toNext = Math.max(0, nextLvl - xp);
  const skills = [
    { n: 'Ситуационные вопросы', l: 1, v: S.done.includes(1) ? 84 : 0 },
    { n: 'Болевые вопросы', l: 2, v: S.done.includes(2) ? 78 : 0 },
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
  const jumpPro = next === -1 && !jumpSpiced && !jumpMed && proN < PRO.length; // остался ProActive
  const allDone = next === -1 && !jumpSpiced && !jumpMed && !jumpPro;
  const rec = next !== -1 ? 'Следующий шаг — урок «' + L[next].title + '».'
    : jumpSpiced ? 'Основная программа пройдена. Остался курс 1а SPICED — расширение СПИН: ' + (SPICED.length - spicedN) + ' из ' + SPICED.length + ' уроков.'
    : jumpMed ? 'Курс 1а пройден. Остался MEDDPICC — квалификация сделки: ' + (MED.length - medN) + ' из ' + MED.length + ' уроков.'
    : jumpPro ? 'Методологии пройдены. Остался ProActive — управление сделкой: ' + (PRO.length - proN) + ' из ' + PRO.length + ' уроков.'
    : 'Всё пройдено — закрепите навык в кейсах.';
  // карточки «Курсы программы» — строго по маршруту: Курс 1 → SPICED (1а) → MEDDPICC (1B) → Курс 2–4 → ProActive (5)
  const progCourseCardsHtml = () => {
    const cards = [];
    COURSES.forEach((g, gi) => {
      const doneIn = L.slice(g.from, g.to).filter((ll, k) => S.done.includes(g.from + k)).length;
      const full = doneIn === g.to - g.from;
      const cpct = Math.round((doneIn / (g.to - g.from)) * 100);
      cards.push(`<article class="course-progress-card ${full ? 'completed' : ''}">
        <div class="course-progress-head"><strong>${g.name}</strong><span>${doneIn} из ${g.to - g.from} ${full ? '✓' : ''}</span></div>
        <div class="skill-track"><i style="width:${cpct}%"></i></div>
      </article>`);
      if (gi === 0 && SPICED.length) {
        const dIn = S.spicedDone.length;
        const f = dIn === SPICED.length;
        const p = Math.round((dIn / SPICED.length) * 100);
        const nx = SPICED.findIndex((x, k) => !S.spicedDone.includes(k));
        cards.push(`<article class="course-progress-card ${f ? 'completed' : ''}" style="cursor:pointer" data-spicedgo="${nx === -1 ? 0 : nx}" title="Курс 1а SPICED — открыть">
          <div class="course-progress-head"><strong>Курс 1а · SPICED — расширение СПИН</strong><span>${dIn} из ${SPICED.length} ${f ? '✓' : ''}</span></div>
          <div class="skill-track"><i style="width:${p}%"></i></div>
        </article>`);
      }
      if (gi === 0 && MED.length) {
        const dIn = S.medDone.length;
        const f = dIn === MED.length;
        const p = Math.round((dIn / MED.length) * 100);
        const nx = MED.findIndex((x, k) => !S.medDone.includes(k));
        cards.push(`<article class="course-progress-card ${f ? 'completed' : ''}" style="cursor:pointer" data-medgo="${nx === -1 ? 0 : nx}" title="Курс 1B MEDDPICC — открыть">
          <div class="course-progress-head"><strong>Курс 1B · MEDDPICC — квалификация</strong><span>${dIn} из ${MED.length} ${f ? '✓' : ''}</span></div>
          <div class="skill-track"><i style="width:${p}%"></i></div>
        </article>`);
      }
    });
    if (PRO.length) {
      const dIn = S.proDone.length;
      const f = dIn === PRO.length;
      const p = Math.round((dIn / PRO.length) * 100);
      const nx = PRO.findIndex((x, k) => !S.proDone.includes(k));
      cards.push(`<article class="course-progress-card ${f ? 'completed' : ''}" style="cursor:pointer" data-progo="${nx === -1 ? 0 : nx}" title="Курс 5 Проактивные продажи — открыть">
        <div class="course-progress-head"><strong>Курс 5 · Проактивные продажи</strong><span>${dIn} из ${PRO.length} ${f ? '✓' : ''}</span></div>
        <div class="skill-track"><i style="width:${p}%"></i></div>
      </article>`);
    }
    const x4i = EXTRA.findIndex((x) => x.course && x.blocks && x.blocks.length > 1);
    if (x4i >= 0) {
      const x4c = EXTRA[x4i];
      const pr = xProgress(x4c);
      const x4mods = xMods(x4c);
      cards.push(`<article class="course-progress-card ${pr.full ? 'completed' : ''}" style="cursor:pointer" data-xgo="${x4i}" title="Дополнительный курс — открыть">
        <div class="course-progress-head"><strong>Дополнительно · ${esc(String(x4c.title).split(':')[0])}</strong><span>${pr.done} из ${pr.total} ${pr.full ? '✓' : ''}</span></div>
        <div class="skill-track"><i style="width:${pr.pct}%"></i></div>
        ${x4mods.length > 1 ? `<div style="margin-top:10px;display:grid;gap:6px">${x4mods.map((m) => {
          const mp = xModProgress(x4c, m);
          return `<div class="x4-mod-row" data-xmod="${x4i}:${x4mods.indexOf(m)}" style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);cursor:pointer"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Курс ${m.num} · ${esc(m.name)}</span><b style="color:${mp.full ? 'var(--green)' : 'var(--ink)'};font-size:12.5px">${mp.done}/${mp.total}${mp.full ? ' ✓' : ''}</b></div>`;
        }).join('')}</div>` : ''}
      </article>`);
    }
    return cards.join('');
  };
  $('progressBody').innerHTML = `
    <div class="page-heading split-heading">
      <div><p class="eyebrow">ВАШ РЕЗУЛЬТАТ</p><h1 id="progress-title">Прогресс обучения</h1><p>Что уже получается и на чём сосредоточиться дальше.</p></div>
      <div class="level-badge"><span>УРОВЕНЬ</span><strong>${String(lvl).padStart(2, '0')}</strong></div>
    </div>
    <div class="stats-grid">
      <article><span class="stat-icon">✓</span><strong id="statLessons">${doneN + spicedN + medN + proN}</strong><p>уроков пройдено</p><small>из ${totalAll} в программе</small></article>
      <article><span class="stat-icon">↗</span><strong id="statAccuracy">${pct}%</strong><p>точность ответов</p><small>в тренировках</small></article>
      <article><span class="stat-icon">⚡</span><strong id="statXp">${xp}</strong><p>очков опыта</p><small>ещё ${toNext} до уровня ${lvl + 1}</small></article>
      <article class="accent-stat"><span class="stat-icon">✦</span><strong>${S.correct}</strong><p>верных ответов</p><small>всего</small></article>
    </div>
    ${boss ? `<div class="team-block">
      <div class="section-title-row" style="margin-top:26px"><div><h2>Прогресс команды</h2><p>режим начальника · кто сколько прошёл</p></div><button class="secondary-button" id="teamRefresh" type="button">Обновить ↻</button></div>
      <div id="teamList" class="team-grid"><div class="team-empty">Загрузка…</div></div>
    </div>` : ''}
    <div class="section-title-row" style="margin-top:26px"><div><h2>Курсы программы</h2><p>${COURSES.length + (SPICED.length ? 1 : 0) + (MED.length ? 1 : 0) + (PRO.length ? 1 : 0)} ${pluralN(COURSES.length + (SPICED.length ? 1 : 0) + (MED.length ? 1 : 0) + (PRO.length ? 1 : 0), ['курс', 'курса', 'курсов'])} по методологиям продаж</p></div></div>
    <div class="course-progress-grid">
      ${progCourseCardsHtml()}
    </div>
    <div class="section-title-row" style="margin-top:26px"><div><h2>Практика и кейсы</h2><p>закрепление по каждому методу: практики «Проверь себя», тренажёр, разборы встреч</p></div></div>
    <div class="pm-grid">
      ${pmCardsHtml()}
    </div>
    <div class="progress-lower">
      <article class="account-card">
        <div class="card-heading"><div><span class="eyebrow">АККАУНТ И СИНХРОНИЗАЦИЯ</span><h2 id="accName">${USER ? esc(USER.name) : 'Гость'}</h2></div></div>
        <div class="account-row">
          <span class="avatar large" id="accAvatar">${USER ? esc(USER.name.slice(0, 1).toUpperCase()) : '?'}</span>
          <div class="account-info">
            <strong id="accEmail">${USER ? esc(USER.email) : 'не вошли'}</strong>
            <span class="sync-chip off" id="syncStatus" role="button" tabindex="0" title="Нажмите, чтобы сверить прогресс с сервером" style="cursor:pointer">…</span>
          </div>
        </div>
        <p class="account-hint">Прогресс привязан к аккаунту и хранится на сервере: откройте курс с любого устройства под тем же логином — всё на месте. Гостевой режим прогресс не сохраняет.</p>
        <div class="feedback-actions">
          <button class="primary-button" id="accSwitch">Сменить аккаунт <span>↗</span></button>
          <button class="secondary-button" id="accRefresh">Обновить с сервера</button>
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
        <button class="dark-button" data-jump="${allDone ? 'practice' : 'theory'}" data-jt="${next !== -1 ? 'main' : jumpSpiced ? 'spiced' : jumpMed ? 'med' : jumpPro ? 'pro' : 'main'}">${next !== -1 ? 'К следующему уроку' : jumpSpiced ? 'К курсу 1а SPICED' : jumpMed ? 'К MEDDPICC' : jumpPro ? 'К ProActive' : 'К кейсам'} <span>→</span></button>
      </article>
    </div>`;
  $('progressBody').querySelectorAll('[data-pjump]').forEach((b) => b.addEventListener('click', () => { S.pTab = b.dataset.pjump; switchTab('practice'); }));
  $('progressBody').querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.jump === 'theory') {
      const jt = b.dataset.jt || 'main';
      if (jt === 'spiced') { const n = SPICED.findIndex((x, k) => !S.spicedDone.includes(k)); curSpiced = n === -1 ? 0 : n; curMed = null; curExtra = null; curPro = null; }
      else if (jt === 'med') { const n = MED.findIndex((x, k) => !S.medDone.includes(k)); curMed = n === -1 ? 0 : n; curSpiced = null; curExtra = null; curPro = null; }
      else if (jt === 'pro') { const n = PRO.findIndex((x, k) => !S.proDone.includes(k)); curPro = n === -1 ? 0 : n; curMed = null; curExtra = null; curSpiced = null; }
      else { S.lesson = next; curMed = null; curExtra = null; curSpiced = null; curPro = null; }
    }
    if (b.dataset.jump === 'practice') S.pTab = 'cases';
    switchTab(b.dataset.jump);
  }));
  $('progressBody').querySelectorAll('[data-medgo]').forEach((b) => b.addEventListener('click', () => { curMed = +b.dataset.medgo; curSpiced = null; curPro = null; switchTab('theory'); }));
  $('progressBody').querySelectorAll('[data-spicedgo]').forEach((b) => b.addEventListener('click', () => { curSpiced = +b.dataset.spicedgo; curMed = null; curPro = null; switchTab('theory'); }));
  $('progressBody').querySelectorAll('[data-progo]').forEach((b) => b.addEventListener('click', () => { curPro = +b.dataset.progo; curMed = null; curSpiced = null; switchTab('theory'); }));
  $('progressBody').querySelectorAll('[data-xgo]').forEach((b) => b.addEventListener('click', () => { const xi = +b.dataset.xgo; curExtra = xi; curXb = xEntry(EXTRA[xi]); curMed = null; curSpiced = null; curPro = null; save(); switchTab('theory'); window.scrollTo({ top: 0 }); }));
  $('progressBody').querySelectorAll('[data-xmod]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); openXMod(b.dataset.xmod); }));
  // «✍️ практика „Проверь себя“» в карточке курса — открывает урок с практикой и прокручивает к ней
  $('progressBody').querySelectorAll('[data-ptogo]').forEach((b) => b.addEventListener('click', () => {
    const [m, i] = b.dataset.ptogo.split(':');
    const idx = +i;
    if (m === 'spiced') { curSpiced = idx; curMed = null; curPro = null; }
    else if (m === 'med') { curMed = idx; curSpiced = null; curPro = null; }
    else if (m === 'pro') { curPro = idx; curSpiced = null; curMed = null; }
    else { S.lesson = idx; curSpiced = null; curMed = null; curPro = null; }
    switchTab('theory');
    setTimeout(() => {
      const pa = document.getElementById('pArea');
      const target = pa ? pa.closest('.level-card') || pa : document.querySelector('#theoryBody .question-levels');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
  }));
  const doLogout = async () => {
    flushSave();
    try { if (SB) await SB.auth.signOut(); } catch (e) {}
    location.reload();
  };
  const accSwitch = $('accSwitch');
  const accLogout = $('accLogout');
  const accRefresh = $('accRefresh');
  const chipSync = $('syncStatus');
  const doSync = async () => {
    if (!USER) { toast('Сначала войдите'); return; }
    try { if (S.dirty) await cloudSave(); await cloudLoad(); } catch (e) {}
    if ($('progress')) renderProgress();
  };
  if (chipSync) chipSync.addEventListener('click', doSync);
  if (accRefresh) accRefresh.addEventListener('click', async () => {
    if (!USER) { toast('Сначала войдите'); return; }
    accRefresh.disabled = true;
    const was = accRefresh.textContent;
    accRefresh.textContent = 'Сверяю…';
    try { if (S.dirty) await cloudSave(); await cloudLoad(); } catch (e) {}
    accRefresh.disabled = false;
    accRefresh.textContent = was;
    renderProgress();
  });
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
