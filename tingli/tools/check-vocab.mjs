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
  1: ['过'], 2: ['比'], 3: ['得'], 4: ['把'], 5: ['被'], 6: ['比', '更', '还'],
  7: ['到', '住', '走', '上'], 8: ['出', '起', '起来', '下去', '下来', '上'], 9: ['得', '不', '很', '极'],
  10: ['是', '的', '得'], 11: ['着', '了'], 12: ['任何'], 13: ['越', '越来越'],
  14: ['一边', '着'], 15: ['就', '才', '再', '又', '了'], 16: ['先', '再', '然后'],
  17: ['以外', '只要', '如果', '就', '除了'], 18: ['让', '叫', '使'], 19: ['好', '出来', '起来', '上去'],
  20: ['还是', '或者', '呢', '能', '那'], 21: ['感兴趣', '关于', '左右', '刻'], 22: ['一方面', '另一方面', '也'],
  23: ['不是', '就是', '是'], 24: ['都', '就', '什么'], 25: ['让', '叫', '派'], 26: ['得', '了'],
  27: ['的'], 28: ['由于', '因此', '所以', '要是', '并且'], 29: ['自从', '由', '朝', '按', '按照'],
  30: ['口', '眼', '顿', '死'], 31: ['是', '不仅', '不光', '还', '而且'],
  32: ['任何', '随着', '等'], 33: ['就是了', '不过', '并'], 34: ['甚至', '于是', '再说'],
  35: ['得', '不了', '来得及', '来不及'], 36: ['既', '又', '各', '至少'],
  37: ['够', '厉害', '偶尔'], 38: ['此', '从来', '再次', '而'], 39: ['方面', '拿', '来说', '相比', '既然'],
  40: ['不管', '否则', '使'], 41: ['有的是', '有', '好', '说什么'],
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
