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

let total = 0, bad = 0; const rows = [];
for (const u of units) {
  const txt = x => (typeof x === 'string' ? x : x.zh);
  const items = [...(u.ex || []).map(txt), ...(u.rvEx || []).map(txt)].filter(Boolean);
  let b = 0;
  for (const t of items) { total++; if (unknown(t).length) b++; }
  bad += b;
  if (b) rows.push(`урок ${u.n} (${u.zh}): ${b} из ${items.length}`);
}
console.log(`Примеров: ${total}, с незнакомыми словами: ${bad}`);
rows.forEach(r => console.log('  ' + r));
