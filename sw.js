// sw.js — сервис-воркер CRM «Абрамовская база».
// ЧТО ДЕЛАЕТ:
//   1) офлайн-просмотр: ответы Supabase (/rest/v1/...) кэшируются, без сети отдаются из кэша;
//   2) офлайн-правки: изменения (POST/PATCH/DELETE) без сети встают в очередь (IndexedDB),
//      сразу применяются к кэшу (оптимистично) и отправляются в базу, как только появится связь;
//   3) локальная оболочка (index.html, supabase-js, иконки) — тоже в кэше.
// Онлайн-поведение НЕ меняется: при живой сети запросы идут напрямую, как раньше.
const APP_CACHE = 'crm-app-v1';
const DATA_CACHE = 'crm-data-v1';
const SUPABASE_HOST = 'mkehzkobjxnjobkqeiwt.supabase.co';
const SHELL = ['./', './index.html', './manifest.json', './supabase.v139.min.js', './icon.svg', './logo-192.png', './logo-512.png', './logo.jpg'];

const DB_NAME = 'crm-offline';
const DB_VER = 1;
const STORE = 'queue';
const META = 'meta';   // idMap: временные id → настоящие

// ---------- IndexedDB ----------
function idb() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, DB_VER);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'qid', autoIncrement: true });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'k' });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function dbDo(store, mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode);
    const os = tx.objectStore(store);
    let out;
    try { out = fn(os); } catch (e) { rej(e); return; }
    tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}
const qAdd = (item) => dbDo(STORE, 'readwrite', (os) => os.add(item));
const qAll = () => dbDo(STORE, 'readwrite', (os) => os.getAll());
const qDel = (qid) => dbDo(STORE, 'readwrite', (os) => os.delete(qid));
const qClear = () => dbDo(STORE, 'readwrite', (os) => os.clear());
const qCount = () => dbDo(STORE, 'readonly', (os) => os.count());
const metaGet = (k) => dbDo(META, 'readonly', (os) => os.get(k)).then((r) => (r ? r.v : null));
const metaSet = (k, v) => dbDo(META, 'readwrite', (os) => os.put({ k: k, v: v }));
async function idMap() { return (await metaGet('idmap')) || {}; }
async function idMapAdd(tmp, real) { const m = await idMap(); m[tmp] = real; await metaSet('idmap', m); }

// ---------- разбор URL/фильтров PostgREST ----------
const SKIP_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'and', 'or']);
function parseFilters(sp) {
  const out = [];
  for (const [k, v] of sp.entries()) {
    if (SKIP_PARAMS.has(k)) continue;
    const t = parseOne(k, v);
    if (t) out.push(t);
  }
  return out;
}
function parseOne(col, v) {
  let neg = false, val = v;
  if (val.startsWith('not.')) { neg = true; val = val.slice(4); }
  const dot = val.indexOf('.');
  const op = dot > -1 ? val.slice(0, dot) : 'eq';
  const raw = dot > -1 ? val.slice(dot + 1) : val;
  let target = raw;
  if (op === 'in') target = raw.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
  return { col: col, op: op, neg: neg, target: target };
}
function matchRow(row, filters) {
  return filters.every((f) => {
    const rv = row[f.col];
    let ok = true;
    if (f.op === 'eq') ok = String(rv) === String(f.target);
    else if (f.op === 'neq') ok = String(rv) !== String(f.target);
    else if (f.op === 'in') ok = f.target.some((t) => String(rv) === t);
    else if (f.op === 'is') ok = f.target === 'null' ? (rv === null || rv === undefined) : String(rv) === f.target;
    else if (f.op === 'gt') ok = Number(rv) > Number(f.target);
    else if (f.op === 'lt') ok = Number(rv) < Number(f.target);
    else if (f.op === 'gte') ok = Number(rv) >= Number(f.target);
    else if (f.op === 'lte') ok = Number(rv) <= Number(f.target);
    else if (f.op === 'like' || f.op === 'ilike') ok = String(rv || '').toLowerCase().indexOf(f.target.replace(/%/g, '').toLowerCase()) > -1;
    return f.neg ? !ok : ok;
  });
}
function sortRows(rows, sp) {
  const ord = sp.get('order');
  if (!ord) return rows;
  const parts = ord.split(',').map((p) => {
    const [c, d] = p.trim().split('.');
    return { col: c, desc: (d || 'asc') === 'desc' };
  });
  return rows.slice().sort((a, b) => {
    for (const p of parts) {
      const x = a[p.col], y = b[p.col];
      if (x === y) continue;
      if (x === null || x === undefined) return p.desc ? 1 : -1;
      if (y === null || y === undefined) return p.desc ? -1 : 1;
      const cmp = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y));
      return p.desc ? -cmp : cmp;
    }
    return 0;
  });
}
function pagingRows(rows, sp, range) {
  let out = rows;
  const lim = sp.get('limit');
  if (lim) out = out.slice(0, parseInt(lim, 10) || out.length);
  if (range) {
    const m = /^(\d+)-(\d+)$/.exec(range);
    if (m) out = out.slice(parseInt(m[1], 10), parseInt(m[2], 10) + 1);
    else if (/^(\d+)-$/.test(range)) out = out.slice(parseInt(range, 10));
  }
  return out;
}
function jsonResp(rows, extraHeaders) {
  const h = new Headers({ 'content-type': 'application/json' });
  if (extraHeaders) Object.entries(extraHeaders).forEach(([k, v]) => { if (v != null) h.set(k, v); });
  return new Response(JSON.stringify(rows), { status: 200, headers: h });
}
// single()/maybeSingle() (Accept: application/vnd.pgrst.object+json) ждёт ОБЪЕКТ, а не массив
function wantsObject(req) {
  return /vnd\.pgrst\.object/i.test(req.headers.get('accept') || '');
}
// накладываем очередь на прочитанные строки (работает и с массивом, и с единичным объектом)
function overlayRead(table, rows, mine, sp, range) {
  const isArr = Array.isArray(rows);
  let list = isArr ? rows : (rows ? [rows] : []);
  if (!mine.length) return rows;
  list = applyOverlay(table, list, mine);
  if (isArr) list = pagingRows(sortRows(list, sp), sp, range);
  return isArr ? list : (list[0] || null);
}

// ---------- оптимистичное наложение очереди на прочитанные данные ----------
function applyOverlay(table, rows, pending) {
  let out = rows.slice();
  for (const it of pending) {
    if (it.table !== table) continue;
    const sp = new URL(it.url).searchParams;
    if (it.method === 'POST') {
      let body = null;
      try { body = it.body ? JSON.parse(it.body) : null; } catch (e) { body = null; }
      const list = Array.isArray(body) ? body : (body ? [body] : []);
      for (const b of list) out.push(Object.assign({}, b, { id: b.id != null ? b.id : it.tempId }));
    } else if (it.method === 'PATCH') {
      let body = {};
      try { body = JSON.parse(it.body || '{}'); } catch (e) {}
      const f = parseFilters(sp);
      out = out.map((r) => (f.length && matchRow(r, f) ? Object.assign({}, r, body) : r));
    } else if (it.method === 'DELETE') {
      const f = parseFilters(sp);
      if (f.length) out = out.filter((r) => !matchRow(r, f));
    }
  }
  return out;
}

// ---------- кэш данных ----------
function dataKey(req) {
  const url = new URL(req.url);
  const range = req.headers.get('range');
  return '/rest/v1/' + url.pathname.split('/rest/v1/')[1] + url.search + (range ? '|r=' + range : '');
}
async function cachePut(key, resp) {
  try { const c = await caches.open(DATA_CACHE); await c.put(new Request(key), resp); } catch (e) {}
}
async function cacheGet(key) {
  try { const c = await caches.open(DATA_CACHE); const r = await c.match(new Request(key)); return r || null; } catch (e) { return null; }
}
function tableOf(req) {
  const url = new URL(req.url);
  return url.pathname.split('/rest/v1/')[1].split('/')[0].split('?')[0];
}

// ---------- запросы к Supabase REST ----------
let flushing = false;
async function handleRest(req) {
  const url = new URL(req.url);
  const table = tableOf(req);
  const method = req.method;
  const key = dataKey(req);

  if (method === 'GET') {
    const pending = await qAll();
    const mine = pending.filter((p) => p.table === table);
    let resp = null;
    if (self.navigator.onLine) {
      try {
        resp = await fetch(req);
        if (resp && resp.ok) await cachePut(key, resp.clone());
      } catch (e) { resp = null; }
    }
    if (!resp || !resp.ok) {
      let hit = await cacheGet(key);
      let rows = null;
      if (hit) {
        try { rows = await hit.json(); } catch (e) { rows = null; }
      } else {
        hit = await cacheGet(dataKey(new Request(req.url)));   // без Range — базовая копия
        if (hit) {
          try { rows = await hit.json(); } catch (e) { rows = null; }
        }
      }
      if (rows === null) {
        // данных в кэше нет — отдаём пусто (мягче, чем ошибка: приложение не падает тостом)
        if (resp) return resp;
        return jsonResp(wantsObject(req) ? null : [], { 'x-crm-offline': '1', 'x-crm-cache-miss': '1' });
      }
      rows = overlayRead(table, rows, mine, url.searchParams, req.headers.get('range'));
      const hdrs = { 'x-crm-offline': '1' };
      if (hit) { const cr = hit.headers.get('content-range'); if (cr) hdrs['content-range'] = cr; }
      return jsonResp(rows, hdrs);
    }
    if (!mine.length) return resp;   // онлайн и нет локальных правок — отдаём ответ как есть
    let rows = null;
    try { rows = await resp.json(); } catch (e) { return resp; }
    rows = overlayRead(table, rows, mine, url.searchParams, req.headers.get('range'));
    const hdrs = { 'x-crm-offline': '1' };
    const cr = resp.headers.get('content-range');
    if (cr) hdrs['content-range'] = cr;
    return jsonResp(rows, hdrs);
  }

  // ---- изменения: POST / PATCH / DELETE ----
  const reqForNet = req.clone();          // клон ДО чтения тела — иначе fetch(клон) падает
  const body = await req.text();
  const hdrs = {};
  ['apikey', 'authorization', 'content-type', 'prefer', 'accept-profile', 'content-profile'].forEach((h) => {
    const v = req.headers.get(h);
    if (v) hdrs[h] = v;
  });
  const preferRepr = /return=representation/i.test(req.headers.get('prefer') || '');
  const item = { table: table, method: method, url: req.url, body: body, headers: hdrs, ts: Date.now(), tempId: null };

  // онлайн — просто прокидываем запрос в базу, ошибок не создаём
  if (self.navigator.onLine) {
    try {
      const r = await fetch(reqForNet);
      if (r.status < 500) return r;
    } catch (e) {}
  }

  // офлайн (или сеть не ответила) — в очередь + оптимистичный ответ
  if (method === 'POST' && preferRepr) {
    item.tempId = -(Date.now() % 100000000) - Math.floor(Math.random() * 999);
  }
  await qAdd(item);
  await notifyQueue();
  if (method === 'POST' && preferRepr) {
    let parsed = null;
    try { parsed = body ? JSON.parse(body) : null; } catch (e) {}
    const arr = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
    const out = arr.map((b) => Object.assign({}, b, { id: b.id != null ? b.id : item.tempId }));
    const h = new Headers({ 'content-type': 'application/json', 'x-crm-offline': '1' });
    h.set('content-range', '0-' + Math.max(0, out.length - 1) + '/' + out.length);
    const payload = wantsObject(req) ? (out[0] || null) : out;
    return new Response(JSON.stringify(payload), { status: 201, headers: h });
  }
  return new Response(null, { status: 204, headers: { 'x-crm-offline': '1' } });
}

// ---------- отправка очереди ----------
function mapIds(str, map) {
  let s = String(str);
  for (const [tmp, real] of Object.entries(map)) s = s.split('eq.' + tmp).join('eq.' + real);
  return s;
}
function mapBody(str, map) {
  if (!str) return str;
  let out = str;
  for (const [tmp, real] of Object.entries(map)) out = out.split(':' + tmp).join(':' + real);
  return out;
}
async function flushQueue() {
  if (flushing || !self.navigator.onLine) return { ok: 0, left: await qCount() };
  flushing = true;
  let sent = 0, failed = 0, left = 0;
  try {
    const items = await qAll();
    if (!items.length) { flushing = false; return { ok: 0, left: 0 }; }
    let map = await idMap();
    for (const it of items) {
      const url = mapIds(it.url, map);
      const body = it.body ? mapBody(it.body, map) : undefined;
      try {
        const r = await fetch(url, {
          method: it.method,
          headers: it.headers,
          body: it.method === 'GET' ? undefined : (body || (it.method === 'PATCH' || it.method === 'DELETE' ? it.body : undefined))
        });
        if (r.status >= 400 && r.status < 500) {           // отказ базы — снимаем с очереди, чтобы не застрять
          await qDel(it.qid); failed++;
          continue;
        }
        if (!r.ok) break;                                   // сеть/сервер — оставим на потом
        if (it.tempId) {
          try {
            const rows = await r.clone().json();
            const real = Array.isArray(rows) && rows[0] ? rows[0].id : null;
            if (real != null) { map[it.tempId] = real; await idMapAdd(it.tempId, real); }
          } catch (e) {}
        }
        await qDel(it.qid); sent++;
      } catch (e) { break; }
    }
    left = await qCount();
  } finally { flushing = false; }
  await notifyQueue(true);
  return { ok: sent, left: left, failed: failed };
}

// ---------- оболочка приложения ----------
async function handleShell(req) {
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    try {
      const r = await fetch(req);
      if (r && r.ok) { const c = await caches.open(APP_CACHE); c.put('./index.html', r.clone()); }
      return r;
    } catch (e) {
      const hit = (await caches.match('./index.html')) || (await caches.match('./'));
      return hit || new Response('<h1>Нет сети</h1>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
  }
  const hit = await caches.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r && r.ok && url.origin === self.location.origin) { const c = await caches.open(APP_CACHE); c.put(req, r.clone()); }
  return r;
}

// ---------- уведомления странице ----------
async function notifyQueue(flushed) {
  try {
    const n = await qCount();
    const cs = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    cs.forEach((c) => c.postMessage({ type: 'queue-changed', n: n, flushed: !!flushed }));
  } catch (e) {}
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    try {
      const c = await caches.open(APP_CACHE);
      for (const u of SHELL) {
        try { const r = await fetch(u, { cache: 'reload' }); if (r && r.ok) await c.put(u, r.clone()); } catch (err) {}
      }
    } catch (e) {}
    try { await self.skipWaiting(); } catch (e) {}
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== APP_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k)));
    } catch (e) {}
    try { await self.clients.claim(); } catch (e) {}
    flushQueue();
  })());
});

self.addEventListener('message', (e) => {
  const d = e.data || {};
  const port = e.ports && e.ports[0];
  const reply = (m) => { try { if (port) port.postMessage(m); } catch (_) {} };
  if (d.type === 'queue-info') {
    qCount().then((n) => reply({ type: 'queue-info', n: n, online: self.navigator.onLine })).catch(() => reply({ type: 'queue-info', n: 0 }));
    return;
  }
  if (d.type === 'flush') {
    flushQueue().then((r) => reply(Object.assign({ type: 'flush-done' }, r))).catch(() => reply({ type: 'flush-done', ok: 0 }));
    return;
  }
  if (d.type === 'clear-queue') {
    qClear().then(() => { notifyQueue(); reply({ type: 'cleared' }); }).catch(() => {});
    return;
  }
  if (d.type === 'precache') {
    (async () => {
      const c = await caches.open(APP_CACHE);
      let ok = 0, total = SHELL.length;
      for (const u of SHELL) {
        try { const r = await fetch(u, { cache: 'reload' }); if (r && r.ok) { await c.put(u, r.clone()); ok++; } if (port) port.postMessage({ type: 'progress', done: ok, total: total }); } catch (err) {}
      }
      reply({ type: 'precache-done', ok: ok, total: total });
    })();
    return;
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'DELETE') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.hostname === SUPABASE_HOST) {
    if (url.pathname.indexOf('/rest/v1/') === 0) e.respondWith(handleRest(req));
    return;   // auth и остальное — напрямую
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/spin/') === 0 || url.pathname.indexOf('/tingli/') === 0) return;
  if (req.method !== 'GET') return;
  if (url.pathname.indexOf('/api/') === 0) return;   // функции CF — только сеть
  e.respondWith(handleShell(req));
});

self.addEventListener('online', () => { flushQueue(); });
