const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const Core = require(path.join(root, 'tingli/sync-core.js'));
let worker;
const ready = import(pathToFileURL(path.join(root, 'backend/tingli-worker/worker.js'))).then((m) => (worker = m.default));

function dbEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE kv(key TEXT PRIMARY KEY,value TEXT,updated_at INTEGER)');
  const stats = { rows: 0, calls: 0 };
  function prep(sql) {
    let args = [];
    const api = {
      bind(...v) { args = v; return api; },
      async first() { const r = db.prepare(sql).get(...args) || null; stats.calls++; stats.rows += r ? 1 : 0; return r; },
      async all() { const r = db.prepare(sql).all(...args); stats.calls++; stats.rows += r.length; return { results: r }; },
      async run() { const r = db.prepare(sql).run(...args); stats.calls++; return { meta: r }; },
      __sql: sql, __args: () => args,
    };
    return api;
  }
  const DB = {
    prepare: prep,
    async batch(list) {
      db.exec('BEGIN');
      try {
        const out = list.map((st) => { const r = db.prepare(st.__sql).all(...st.__args()); stats.calls++; stats.rows += r.length; return { results: r, success: true }; });
        db.exec('COMMIT');
        return out;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
  return { DB, db, stats };
}

async function call(env, url, opts = {}) {
  await ready;
  const r = await worker.fetch(new Request('https://api.crmuro.ru' + url, opts), env);
  let j = null;
  try { j = await r.json(); } catch (_) {}
  return { status: r.status, ...(j || {}) };
}

function seed(env, key, value, rev = 1) {
  env.db.prepare('INSERT OR REPLACE INTO kv VALUES(?,?,?)').run(key, value, rev);
}
function value(env, key) {
  const row = env.db.prepare('SELECT value FROM kv WHERE key=?').get(key);
  return row ? row.value : null;
}

test('каталог: первая сборка, затем list читает одну строку', async () => {
  const env = dbEnv();
  for (let i = 0; i < 40; i++) seed(env, 'tingli-k' + i, 'v' + i, i + 1);
  const first = await call(env, '/api/sync?list=1');
  assert.equal(Object.keys(first.revisions).length, 40);
  env.stats.rows = 0; env.stats.calls = 0;
  const second = await call(env, '/api/sync?list=1');
  assert.equal(Object.keys(second.revisions).length, 40);
  assert.equal(env.stats.rows, 1, 'list должен прочитать ровно одну строку');
  assert.equal(second.revisions['__catalog'], undefined);
});

test('каталог: добавление ключа видно сразу и значение читается', async () => {
  const env = dbEnv();
  await call(env, '/api/sync?list=1');
  const post = await call(env, '/api/sync', { method: 'POST', body: JSON.stringify({ key: 'tingli-new-1', base: null, value: 'hello' }) });
  assert.equal(post.ok, true);
  const list = await call(env, '/api/sync?list=1');
  assert.equal(list.revisions['tingli-new-1'], post.rev);
  const rec = await call(env, '/api/sync?keys=tingli-new-1');
  assert.equal(rec.records['tingli-new-1'].value, 'hello');
});

test('каталог: изменение повышает ревизию', async () => {
  const env = dbEnv();
  const a = await call(env, '/api/sync', { method: 'POST', body: JSON.stringify({ key: 'tingli-upd-1', base: null, value: 'v1' }) });
  const b = await call(env, '/api/sync', { method: 'POST', body: JSON.stringify({ key: 'tingli-upd-1', base: 'v1', value: 'v2' }) });
  assert.ok(b.rev > a.rev);
  const list = await call(env, '/api/sync?list=1');
  assert.equal(list.revisions['tingli-upd-1'], b.rev);
});

test('каталог: удаление убирает ключ и из каталога', async () => {
  const env = dbEnv();
  await call(env, '/api/sync', { method: 'POST', body: JSON.stringify({ key: 'tingli-del-1', base: null, value: 'x' }) });
  const del = await call(env, '/api/backup?key=tingli-del-1', { method: 'DELETE' });
  assert.equal(del.ok, true);
  const list = await call(env, '/api/sync?list=1');
  assert.equal(list.revisions['tingli-del-1'], undefined);
  const rec = await call(env, '/api/sync?keys=tingli-del-1');
  assert.equal(rec.records['tingli-del-1'].value, null);
});

test('каталог: одновременные записи двух устройств не теряются', async () => {
  const env = dbEnv();
  await call(env, '/api/sync?list=1');
  const [a, b] = await Promise.all([
    call(env, '/api/sync', { method: 'POST', body: JSON.stringify({ key: 'tingli-par-a', base: null, value: 'A' }) }),
    call(env, '/api/sync', { method: 'POST', body: JSON.stringify({ key: 'tingli-par-b', base: null, value: 'B' }) }),
  ]);
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  const list = await call(env, '/api/sync?list=1');
  assert.equal(list.revisions['tingli-par-a'], a.rev);
  assert.equal(list.revisions['tingli-par-b'], b.rev);
});

test('синхронизация между устройствами и восстановление после офлайна', async () => {
  const env = dbEnv();
  const storage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, data: m }; };
  const makeClient = (st, request) => Core.create({
    stateKey: 'local-sync-v2', storage: st,
    get: (k) => st.getItem(k), set: (k, v) => st.setItem(k, v), keys: () => [...st.data.keys()],
    allowed: (k) => /^tingli-/.test(k),
    request: request || ((u, o) => call(env, u, o)),
    initialMerge: (k, l, r) => { try { return JSON.stringify(Core.threeWay({}, JSON.parse(l), JSON.parse(r))); } catch { return l || r; } },
    changed: () => {}, status: () => {},
  });
  let offline = true;
  const stA = storage();
  const a = makeClient(stA, (u, o) => { if (offline && o && o.method === 'POST') throw Error('offline'); return call(env, u, o); });
  stA.setItem('tingli-x-1', 'from-A');
  a.mark();
  await a.run();
  offline = false;
  a.mark();
  await a.run();
  a.stop();
  const stB = storage();
  const b = makeClient(stB);
  await b.run();
  b.stop();
  assert.equal(env.db.prepare('SELECT value FROM kv WHERE key=?').get('tingli-x-1').value, 'from-A');
  assert.equal(stB.getItem('tingli-x-1'), 'from-A');
});
