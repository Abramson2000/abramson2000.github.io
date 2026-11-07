// Сверка примеров курса со словарём ученика.
// Запуск: node tools/check-vocab.mjs
// Список известных слов: docs/vocab-known.txt (слова курса + HSK1 + служебные).
import fs from 'node:fs';

const known = new Set(fs.readFileSync(new URL('../docs/vocab-known.txt', import.meta.url), 'utf8').split('\n').filter(Boolean));
const maxLen = Math.max(...[...known].map(w => w.length));

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// курс собран из нескольких массивов; порядок уроков: L2 (в начале), базовый набор, L3…L6
const ORDER = ['RIK_L2', 'RIK_UNITS', 'RIK_L3', 'RIK_L4', 'RIK_L5', 'RIK_L6'];
const blocks = {};
for (const name of ORDER) {
  const at = html.indexOf('const ' + name + ' = [');
  if (at < 0) continue;
  const open = html.indexOf('[', at);
  let depth = 0, end = open;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  blocks[name] = eval(html.slice(open, end + 1));
}
const units = [];
for (const name of ORDER) if (blocks[name]) units.push(...blocks[name]);
units.forEach((u, i) => { u.n = i + 1; });

// примеры повторов лежат в отдельных банках — собираем по номеру урока
for (const bank of ['RIK_REVIEW_BANK', 'RIK_REVIEW_L3', 'RIK_REVIEW_L4', 'RIK_REVIEW_L5', 'RIK_REVIEW_L6']) {
  const at = html.indexOf('const ' + bank + ' = {');
  if (at < 0) continue;
  const open = html.indexOf('{', at);
  let depth = 0, end = open;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  let obj;
  try { obj = eval('(' + html.slice(open, end + 1) + ')'); } catch (e) { continue; }
  for (const k of Object.keys(obj)) {
    const u = units[Number(k) - 1];
    if (!u) continue;
    const ex = (obj[k].ex || []).map(x => (typeof x === 'string' ? x : x.zh));
    if (ex.length) u.rvEx = ex;
  }
}

function unknown(text) {
  const out = []; let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (!/[\u4e00-\u9fa5]/.test(ch)) { i++; continue; }
    let matched = 0;
    for (let L = Math.min(maxLen, text.length - i); L >= 1; L--) {
      if (known.has(text.substr(i, L))) { matched = L; break; }
    }
    if (matched) { i += matched; continue; }
    let j = i;
    while (j < text.length && /[\u4e00-\u9fa5]/.test(text[j])) {
      let ok = false;
      for (let L = 1; L <= Math.min(maxLen, text.length - j); L++) if (known.has(text.substr(j, L))) { ok = true; break; }
      if (ok) break;
      j++;
    }
    out.push(text.slice(i, j)); i = j;
  }
  return out;
}

// слова самой темы урока считаются «новыми законно» — это и есть изучаемая грамматика
const TARGET = {
  12: ['任何'], 24: ['什么'], 30: ['口', '眼', '顿', '死'], 32: ['任何', '随着', '等'],
  33: ['就是了', '不过', '并'], 34: ['甚至', '于是', '再说'], 35: ['得', '了', '来得及', '来不及'],
  36: ['既', '又', '各', '至少'], 37: ['够', '厉害', '偶尔'], 38: ['此', '从来', '再次', '而'],
  39: ['方面', '拿', '相比', '既然'], 40: ['不管', '否则', '使'], 41: ['有的是', '有', '好', '说什么'],
};
const targetWords = n => new Set([...(TARGET[n] || []), ...String((units[n - 1] || {}).zh || '').split(/[^\u4e00-\u9fa5]+/).filter(Boolean)]);

let total = 0, bad = 0; const rows = [];
for (const u of units) {
  const txt = x => (typeof x === 'string' ? x : x.zh);
  const items = [...(u.ex || []).map(txt), ...(u.rvEx || []).map(txt)].filter(Boolean);
  const allow = targetWords(u.n);
  let b = 0;
  for (const t of items) {
    total++;
    if (unknown(t).filter(w => !allow.has(w)).length) b++;
  }
  bad += b;
  if (b) rows.push(`урок ${u.n} (${u.zh}): ${b} из ${items.length}`);
}
console.log(`Примеров: ${total}, с незнакомыми словами: ${bad}`);
rows.forEach(r => console.log('  ' + r));
