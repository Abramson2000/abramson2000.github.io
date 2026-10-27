/* Shared sync protocol v2. No credentials, destructive reset or legacy fallback. */
(function (root) {
  'use strict';
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  const wordKey = w => [w.hanzi, w.pinyin, w.translation, w.kind || 'word'].map(x => String(x || '').trim()).join('\u0001');
  function wordMap(a) {
    const m = {};
    (a || []).forEach(w => {
      if (!w || !String(w.hanzi || '').trim()) return;
      const k = wordKey(w), old = m[k];
      if (!old || String(w.updatedAt || '') >= String(old.updatedAt || '')) m[k] = w;
    });
    return m;
  }
  // A change relative to the last acknowledged snapshot is intentional,
  // including false, an empty answer and a removed favorite/checkmark.
  function threeWay(base, local, remote) {
    if (same(local, base)) return clone(remote);
    if (same(remote, base) || same(local, remote)) return clone(local);
    if (obj(local) && obj(remote) && (obj(base) || base == null)) {
      const out = {}, b = base || {};
      new Set([...Object.keys(b), ...Object.keys(local), ...Object.keys(remote)]).forEach(k => {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
        const v = threeWay(b[k], local[k], remote[k]);
        if (v !== undefined) out[k] = v;
      });
      return out;
    }
    return clone(local);
  }
  function wordRecordMap(a) {
    const m = {};
    (a || []).forEach(w => {
      const k = w.uid || wordKey(w), old = m[k];
      if (!old || String(w.updatedAt || '') >= String(old.updatedAt || '')) m[k] = w;
    });
    return m;
  }
  function mergeWordRecords(a,b) {
    const m=wordRecordMap(a);
    Object.entries(wordRecordMap(b)).forEach(([k,w])=>{if(!m[k]||String(w.updatedAt||'')>=String(m[k].updatedAt||''))m[k]=w;});
    return Object.values(m);
  }
  function mergeWords(a, b) {
    const m = wordMap(a);
    Object.values(wordMap(b)).forEach(w => {
      const k = wordKey(w), old = m[k];
      if (!old || String(w.updatedAt || '') >= String(old.updatedAt || '')) m[k] = w;
    });
    return Object.values(m);
  }
  function mergeSchedule(a, b) {
    a = a || {}; b = b || {};
    const newer = (+b.upd || 0) > (+a.upd || 0) ? b : a;
    const out = Object.assign({}, a, newer);
    ['lessons','series','hw','hwstate','hwdue','hwdel','payments','pay'].forEach(g => {
      out[g] = Object.assign({}, a[g] || {});
      Object.keys(b[g] || {}).forEach(id => {
        const x = out[g][id], y = b[g][id];
        if (!x || (+y.upd || 0) > (+x.upd || 0)) out[g][id] = y;

      });
    });
    ['done','killed'].forEach(g => {
      out[g] = Object.assign({}, a[g] || {});
      Object.keys(b[g] || {}).forEach(id => { out[g][id] = Math.max(+out[g][id] || 0, +b[g][id] || 0); });
    });
    ['lessons','series'].forEach(g => Object.keys(out[g]).forEach(id => {
      if (out.killed[id] && out.killed[id] >= (+out[g][id].upd || 0)) delete out[g][id];
    }));
    Object.keys(out.lessons).forEach(id => {
      const m = /^s:([^:]+):/.exec(id);
      if (m && out.killed[m[1]] && out.killed[m[1]] >= (+out.lessons[id].upd || 0)) delete out.lessons[id];
    });
    out.upd = Math.max(+a.upd || 0, +b.upd || 0);
    return out;
  }
  function reconcile(key, baseRaw, localRaw, remoteRaw, initialMerge) {
    if (localRaw === null) return remoteRaw;
    if (remoteRaw === null) return localRaw;
    if (baseRaw === undefined) return initialMerge(key, localRaw, remoteRaw);
    if (localRaw === baseRaw) return remoteRaw;
    if (remoteRaw === baseRaw || localRaw === remoteRaw) return localRaw;
    try {
      const b = JSON.parse(baseRaw), l = JSON.parse(localRaw), r = JSON.parse(remoteRaw);
      if (key === 'cidian-data-v3') return JSON.stringify(Object.values(threeWay(wordRecordMap(b),wordRecordMap(l),wordRecordMap(r))));
      if (key === 'cidian-data-v1') return JSON.stringify(Object.values(threeWay(wordMap(b), wordMap(l), wordMap(r))));
      if (key === 'tingli-favs-v1') {
        const map = arr => Object.fromEntries((arr || []).map(x => [x, true]));
        return JSON.stringify(Object.keys(threeWay(map(b), map(l), map(r))));
      }
      if (key === 'tingli-dict-v1') {
        const map = arr => Object.fromEntries((arr || []).map(x => [x.zh, x]));
        return JSON.stringify(Object.values(threeWay(map(b), map(l), map(r))));
      }
      return JSON.stringify(threeWay(b, l, r));
    } catch (_) { return localRaw; }
  }
  function create(config) {
    const stateKey = config.stateKey;
    let state = { base: {}, rev: {} }, busy = null, timer = null, retry = 2000, rerun = false;
    const readState = () => {
      const raw = config.storage.getItem(stateKey);
      if (raw) { const s = JSON.parse(raw); if (obj(s.base) && obj(s.rev)) state = s; }
    };
    const checkpoint = () => config.storage.setItem(stateKey, JSON.stringify(state));
    const status = (s, e) => { try { config.status(s, e); } catch (_) {} };
    const schedule = (ms = 1200) => { clearTimeout(timer); timer = setTimeout(() => run(), ms); };
    const apply = (key, value) => {
      if (value === null) return; // remote absence cannot erase local work
      if (config.get(key) !== value) { config.set(key, value); config.changed(key); }
    };
    async function syncKey(key, record) {
      let remote = record.value, rev = record.rev;
      for (let attempt = 0; attempt < 8; attempt++) {
        const local = config.get(key), base = own(state.base, key) ? state.base[key] : undefined;
        const merged = reconcile(key, base, local, remote, config.initialMerge);
        // Preserve both versions when a scalar has conflicting changes.
        if (local !== null && remote !== null && local !== remote && merged !== remote && config.conflict) config.conflict(key, local, remote);
        apply(key, merged);
        state.base[key] = remote; state.rev[key] = rev; checkpoint();
        if (merged === remote || merged === null) return;
        const ack = await config.request('/api/sync', { method: 'POST', body: JSON.stringify({key, base: remote, value: merged}) });
        if (ack.status === 409) { remote = ack.value; rev = ack.rev; continue; }
        if (!ack.ok || typeof ack.value !== 'string' || ack.value !== merged) throw new Error('Запись не подтверждена');
        // Edits made while the request was in flight remain dirty in local storage.
        state.base[key] = ack.value; state.rev[key] = ack.rev; checkpoint();
        if (config.get(key) !== ack.value) rerun = true;
        return;
      }
      throw new Error('Конфликт записи: повторим синхронизацию');
    }
    async function cycle() {
      readState(); status('syncing');
      const catalog = await config.request('/api/sync?list=1');
      if (!catalog.ok || !obj(catalog.revisions)) throw new Error('Нужен API синхронизации v2');
      const all = new Set([...Object.keys(catalog.revisions), ...config.keys()]);
      const wanted = [...all].filter(config.allowed).filter(key =>
        !own(state.base, key) || config.get(key) !== state.base[key] || catalog.revisions[key] !== state.rev[key]);
      for (let i = 0; i < wanted.length; i += 20) {
        const keys = wanted.slice(i, i + 20);
        const data = await config.request('/api/sync?keys=' + encodeURIComponent(keys.join(',')));
        if (!data.ok || !obj(data.records)) throw new Error('Неполный ответ сервера');
        for (const key of keys) {
          const record = data.records[key];
          if (!record || !(record.value === null || typeof record.value === 'string')) throw new Error('Неполный ответ сервера');
          await syncKey(key, record);
        }
      }
      status('saved'); retry = 2000;
    }
    function run() {
      if (busy) { rerun = true; return busy; }
      clearTimeout(timer); rerun = false;
      busy = cycle().then(() => true).catch(e => { status('offline', e.message); return false; }).then(ok => {
        busy = null;
        schedule(ok ? (rerun ? 50 : 30000) : (retry = Math.min(retry * 2, 60000)));
        return ok;
      });
      return busy;
    }
    return { run, mark: () => { if (busy) rerun = true; else schedule(); }, stop: () => clearTimeout(timer), pending: () => config.keys().filter(config.allowed).filter(k => config.get(k) !== state.base[k]) };
  }
  const api = {create, threeWay, reconcile, mergeWords, mergeSchedule, wordKey, mergeWordRecords};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CrmSyncCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
