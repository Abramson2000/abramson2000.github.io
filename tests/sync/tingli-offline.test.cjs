const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const root = __dirname + '/../..', base = 'https://crmuro.ru/tingli/';
const manifest = JSON.parse(fs.readFileSync(root + '/tingli/offline-manifest.5.71.0.json'));
const workerSource = fs.readFileSync(root + '/tingli/sw.js', 'utf8');
const html = fs.readFileSync(root + '/tingli/index.html', 'utf8');
function worker(stores = new Map()) {
  const handlers = {}, requests = [], rejected = new Set();
  let offline = false, hung = false, skipped = false, mediaQuota = false;
  const absolute = x => new URL(typeof x === 'string' ? x : x.url, base).href;
  const path = x => new URL(absolute(x)).pathname;
  function cache(name) {
    if (!stores.has(name)) {
      const rows = new Map();
      stores.set(name, { rows,
        async put(key, response) { if (mediaQuota && name === 'tingli-media-v1') throw Error('QuotaExceededError'); rows.set(absolute(key), response.clone()); },
        async match(key, opts = {}) { const k = absolute(key); let row = rows.get(k); if (!row && opts.ignoreSearch) row = [...rows].find(([u]) => path(u) === path(k))?.[1]; return row?.clone(); },
        async keys() { return [...rows.keys()].map(u => new Request(u)); },
        async delete(key) { return rows.delete(absolute(key)); }
      });
    }
    return stores.get(name);
  }
  const fetch = async (url, options = {}) => {
    requests.push(absolute(url));
    if (offline || rejected.has(path(url))) throw Error('offline');
    if (hung) return new Promise((_, reject) => options.signal?.addEventListener('abort', () => reject(Error('aborted'))));
    const p = path(url);
    const body = p.endsWith('offline-manifest.5.71.0.json') ? JSON.stringify(manifest) : p.endsWith('index.html') ? html : p.endsWith('sync-check.html') ? 'diagnostic' : 'file:' + p;
    return new Response(body, { headers: { 'content-type': p.endsWith('.json') ? 'application/json' : 'text/plain', 'content-encoding': 'br', 'content-length': '9999' } });
  };
  class LocalRequest extends Request { constructor(url, options) { super(new URL(url, base), options); } }
  vm.runInNewContext(workerSource, { URL, Request: LocalRequest, Response, Headers, AbortController, setTimeout, clearTimeout, fetch,
    caches: { open: async n => cache(n), keys: async () => [...stores.keys()], delete: async n => stores.delete(n) },
    self: { location: { origin: 'https://crmuro.ru', href: base + 'sw.js?v=offline-5.71.0' }, addEventListener: (type, fn) => handlers[type] = fn,
      skipWaiting: async () => { skipped = true; }, clients: { claim: async () => {} } }
  });
  async function lifecycle(type) { let promise; handlers[type]({ waitUntil: p => promise = p }); await promise; }
  async function message(data) { const messages = []; let promise; handlers.message({ data, ports: [{ postMessage: x => messages.push(x) }], waitUntil: p => promise = p }); await promise; return messages[messages.length - 1]; }
  function fetchEvent(url) { let response; const tasks = []; handlers.fetch({ request: { url: absolute(url), method: 'GET', mode: 'navigate' }, respondWith: p => response = p, waitUntil: p => tasks.push(p) }); return { response, tasks }; }
  return { cache, stores, requests, rejected, lifecycle, message, fetchEvent, offline: () => { offline = true; }, hung: () => { hung = true; }, quota: () => { mediaQuota = true; }, skipped: () => skipped };
}
test('offline manifest includes every data-declared audio and image, including all Sounds illustrations', () => {
  const expected = new Set([...html.matchAll(/"audio"\s*:\s*"([^"]+)"/g)].map(x => './audio/' + x[1]));
  for (const m of html.matchAll(/"image"\s*:\s*"([^"]+)"/g)) expected.add('./' + m[1]);
  assert.deepEqual(new Set(manifest.media.map(x => x.url)), expected);
  assert.equal(manifest.media.length, 366);
  assert.equal(manifest.media.filter(x => x.url.startsWith('./img/')).length, 14);
});
test('offline cold start returns the pinned shell without making a network request', async () => {
  const w = worker(); await w.lifecycle('install'); w.hung();
  const before = w.requests.length, response = await w.fetchEvent('./?tab=sched').response;
  assert.equal(await response.text(), html); assert.equal(w.requests.length, before);
});
test('an active worker without a saved shell gives an explicit offline page rather than an empty response', async () => {
  const w = worker(); w.offline(); const response = await w.fetchEvent('./').response;
  assert.equal(response.status, 503); assert.match(await response.text(), /Тингли не сохранён/);
});
test('offline status keeps the complete manifest and never shrinks to shell-only', async () => {
  const w = worker(); await w.lifecycle('install'); const online = await w.message({ type: 'status' }); w.offline();
  const offline = await w.message({ type: 'verify' });
  assert.equal(offline.total, online.total); assert.equal(offline.total, 410); assert.equal(offline.have, 44); assert.equal(offline.ready, false);
});
test('new shell activation migrates old query-versioned audio and retains a previous shell', async () => {
  const w = worker(), old = w.cache('tingli-cache-v56911-full');
  await old.put('./audio/1-1.mp3?v=5.69.11', new Response('saved audio', { headers: { 'content-encoding': 'br' } }));
  await old.put('./index.html', new Response('previous shell'));
  await w.lifecycle('install'); await w.lifecycle('activate');
  const hit = await w.cache('tingli-media-v1').match('./audio/1-1.mp3');
  assert.equal(await hit.text(), 'saved audio'); assert.equal(hit.headers.get('content-encoding'), null); assert.ok(w.stores.has('tingli-cache-v56911-full'));
  w.offline(); const event = w.fetchEvent('./audio/1-1.mp3?v=5.71.0'); assert.equal(await (await event.response).text(), 'saved audio'); await Promise.all(event.tasks);
});
test('a quota failure during migration retains and can serve original audio', async () => {
  const w = worker(); await w.cache('tingli-cache-old').put('./audio/1-1.mp3?v=old', new Response('original'));
  await w.lifecycle('install'); w.quota(); await w.lifecycle('activate'); w.offline();
  assert.ok(w.stores.has('tingli-cache-old')); const event = w.fetchEvent('./audio/1-1.mp3'); assert.equal(await (await event.response).text(), 'original'); await Promise.all(event.tasks);
});
test('a second shell update leaves durable media untouched', async () => {
  const w = worker(); await w.cache('tingli-media-v1').put('./audio/1-1.mp3', new Response('persistent'));
  await w.cache('tingli-shell-5.70.0').put('./index.html', new Response('older shell'));
  await w.lifecycle('install'); await w.lifecycle('activate');
  assert.equal(await (await w.cache('tingli-media-v1').match('./audio/1-1.mp3')).text(), 'persistent');
});
test('partial download resumes by exact missing files, not cached count', async () => {
  const w = worker(); await w.lifecycle('install'); const items = manifest.media.slice(0, 3);
  await w.cache('tingli-media-v1').put(items[1].url, new Response('already saved', { headers: { 'x-tingli-revision': items[1].revision } }));
  const start = w.requests.length, result = await w.message({ type: 'download-files', urls: items.map(x => x.url) });
  assert.equal(result.status.have, 3); assert.equal(result.failed.length, 0);
  const downloaded = w.requests.slice(start).map(x => new URL(x).pathname);
  assert.ok(downloaded.includes(new URL(items[0].url, base).pathname)); assert.ok(!downloaded.includes(new URL(items[1].url, base).pathname));
});
test('download errors preserve completed files and truthfully report missing files', async () => {
  const w = worker(); await w.lifecycle('install'); const items = manifest.media.slice(0, 3); w.rejected.add(new URL(items[1].url, base).pathname);
  const result = await w.message({ type: 'download-files', urls: items.map(x => x.url) });
  assert.equal(result.failed.length, 1); assert.equal(result.status.have, 2); assert.equal(result.status.ready, false);
  assert.ok(await w.cache('tingli-media-v1').match(items[0].url)); assert.ok(await w.cache('tingli-media-v1').match(items[2].url));
});
test('fresh worker execution recovers saved media and manifest from persistent caches', async () => {
  const w = worker(); await w.lifecycle('install'); await w.message({ type: 'download-files', urls: [manifest.media[0].url] });
  const restarted = worker(w.stores); restarted.offline();
  assert.equal((await restarted.message({ type: 'unit-status', urls: [manifest.media[0].url] })).have, 1);
  assert.equal(await (await restarted.fetchEvent('./').response).text(), html);
  assert.equal(restarted.requests.length, 0);
});
test('full download verifies all files, stays ready offline and retains all images after restart', async () => {
  const w = worker(); await w.lifecycle('install'); const result = await w.message({ type: 'precache' });
  assert.equal(result.status.ready, true); assert.equal(result.status.have, 410); assert.equal(result.failed.length, 0);
  const restarted = worker(w.stores); restarted.offline(); const checked = await restarted.message({ type: 'verify' });
  assert.equal(checked.ready, true); assert.equal(checked.have, 410);
  assert.equal((await restarted.fetchEvent('./img/yin-12.jpg').response).ok, true);
});
test('removing a lesson also removes old cached copies so a later update cannot resurrect them', async () => {
  const w = worker(); const file = manifest.media[0].url; await w.cache('tingli-cache-old').put(file + '?v=old', new Response('old'));
  await w.lifecycle('install'); await w.lifecycle('activate'); await w.message({ type: 'remove-files', urls: [file] }); await w.lifecycle('activate');
  assert.equal((await w.message({ type: 'unit-status', urls: [file] })).have, 0);
});
test('missing mandatory dependency prevents activation and does not remove previous shell', async () => {
  const w = worker(); await w.cache('tingli-cache-old').put('./index.html', new Response('working'));
  w.rejected.add('/tingli/offline.5.71.0.js'); await assert.rejects(w.lifecycle('install'), /shell missing/); assert.equal(w.skipped(), false); assert.ok(w.stores.has('tingli-cache-old'));
});
test('unknown deletion requests cannot touch dictionary files or data', async () => {
  const w = worker(); await w.lifecycle('install'); const result = await w.message({ type: 'remove-files', urls: ['../cidian/index.html'] });
  assert.match(result.error, /Неизвестный файл/);
});
test('cached HTML and media have no compression headers that could break offline decoding', async () => {
  const w = worker(); await w.lifecycle('install'); const hit = await w.cache('tingli-shell-5.71.0').match('./index.html');
  assert.equal(hit.headers.get('content-encoding'), null); assert.equal(hit.headers.get('content-length'), null);
});
test('downloader progress extends the inactivity deadline beyond 30 seconds', async () => {
  let now = 0, serial = 0; const timers = new Map(); let port;
  const setTimeout = (fn, delay) => { const id = ++serial; timers.set(id, { fn, at: now + delay }); return id; };
  const clearTimeout = id => timers.delete(id);
  class Channel { constructor() { this.port1 = { close() {} }; this.port2 = { receive: data => this.port1.onmessage({ data }) }; } }
  const context = { window: {}, navigator: { serviceWorker: { ready: Promise.resolve({ active: { postMessage(data, ports) { port = ports[0]; } } }) } }, MessageChannel: Channel, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync(root + '/tingli/offline.5.71.0.js', 'utf8'), context);
  const result = context.window.TingliOffline.message({ type: 'precache' }); await Promise.resolve(); await Promise.resolve();
  for (const time of [20000, 40000, 60000, 80000]) { now = time; for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); } port.receive({ type: 'progress', done: time / 20000, total: 10 }); }
  port.receive({ type: 'done', ok: 10 }); assert.equal((await result).ok, 10); assert.equal(timers.size, 0);
});
