import './sync-core.js';
const Sync = globalThis.CrmSyncCore;
/* Tingli / Cidian cloud sync API
 * Route: crmuro.ru/api/*
 * Storage: Cloudflare D1 (SQLite) — env.DB, fallback KV — env.TINGLI_BACKUP
 *
 * Контракт совместим со старым /api/backup, приложения не меняются.
 * Отличия от старого бэка:
 *   - DELETE ?key=K удаляет ОДИН ключ (старый стирал всю базу);
 *   - POST ?force=1 — эталонная запись без merge (нужно для #canonical с телефона);
 *   - данные в D1, зависимости от Pages KV нет.
 */

const KEY_MAX = 7000000;
const ALLOW_ORIGINS = [
  'https://crmuro.ru',
  'https://www.crmuro.ru',
  'http://localhost',
  'http://127.0.0.1',
  'https://abramson-crm.pages.dev',
  'https://abramson2000.github.io'
];

/* ---------- безопасность ключей ---------- */
const SECRET_RE = /token|secret|password|passwd|auth|credential|vapid|private/i;
function isSafeKey(k) {
  if (typeof k !== 'string') return false;
  if (!(k.indexOf('tingli-') === 0 || k.indexOf('cidian-') === 0)) return false;
  if (SECRET_RE.test(k)) return false;
  if (k.length > 200) return false;
  return true;
}

/* ---------- merge: расписание ---------- */
function mergeSchedule(aStr, bStr) {
  return JSON.stringify(Sync.mergeSchedule(JSON.parse(aStr || '{}'), JSON.parse(bStr || '{}')));
}
function mergeCidian(aStr, bStr) {
  return JSON.stringify(Sync.mergeWords(JSON.parse(aStr || '[]'), JSON.parse(bStr || '[]')));
}

/* ---------- storage ---------- */
const store = {
  async get(env, k) {
    if (env.DB) {
      const r = await env.DB.prepare('SELECT value FROM kv WHERE key = ?').bind(k).first();
      return r ? r.value : null;
    }
    if (env.TINGLI_BACKUP) {
      const raw = await env.TINGLI_BACKUP.get('tingli-backup-v1');
      if (!raw) return null;
      const o = JSON.parse(raw);
      return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null;
    }
    return null;
  },
  async keys(env) {
    if (env.DB) {
      const r = await env.DB.prepare('SELECT key FROM kv').all();
      return (r.results || []).map((x) => x.key);
    }
    if (env.TINGLI_BACKUP) {
      const raw = await env.TINGLI_BACKUP.get('tingli-backup-v1');
      if (!raw) return [];
      return Object.keys(JSON.parse(raw));
    }
    return [];
  },
  async dump(env) {
    if (env.DB) {
      const r = await env.DB.prepare('SELECT key, value FROM kv').all();
      const o = {};
      (r.results || []).forEach((x) => { o[x.key] = x.value; });
      return o;
    }
    if (env.TINGLI_BACKUP) {
      const raw = await env.TINGLI_BACKUP.get('tingli-backup-v1');
      return raw ? JSON.parse(raw) : {};
    }
    return {};
  },
  async put(env, obj) {
    if (env.DB) {
      const now = Date.now();
      const ks = Object.keys(obj);
      for (let i = 0; i < ks.length; i++) {
        await env.DB.prepare(
          'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = MAX(kv.updated_at + 1, excluded.updated_at)'
        ).bind(ks[i], String(obj[ks[i]]), now).run();
      }
      return;
    }
    if (env.TINGLI_BACKUP) {
      let prev = {};
      const raw = await env.TINGLI_BACKUP.get('tingli-backup-v1');
      if (raw) { try { prev = JSON.parse(raw); } catch (e) {} }
      await env.TINGLI_BACKUP.put('tingli-backup-v1', JSON.stringify(Object.assign(prev, obj)));
    }
  },
  async del(env, k) {
    if (env.DB) {
      await env.DB.prepare('DELETE FROM kv WHERE key = ?').bind(k).run();
      return;
    }
    if (env.TINGLI_BACKUP) {
      const raw = await env.TINGLI_BACKUP.get('tingli-backup-v1');
      if (!raw) return;
      const o = JSON.parse(raw);
      delete o[k];
      await env.TINGLI_BACKUP.put('tingli-backup-v1', JSON.stringify(o));
    }
  }
};

function legacyUnion(a, b) {
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = Object.assign({}, a);
    for (const k of Object.keys(b)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = legacyUnion(a[k], b[k]);
    }
    return out;
  }
  return a || b;
}
async function compareAndSet(env, key, base, value) {
  const now = Date.now();
  const stmt = base === null
    ? env.DB.prepare('INSERT INTO kv (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO NOTHING RETURNING updated_at').bind(key,value,now)
    : env.DB.prepare('UPDATE kv SET value = ?, updated_at = MAX(updated_at + 1, ?) WHERE key = ? AND value = ? RETURNING updated_at').bind(value,now,key,base);
  const row = await stmt.first();
  return row ? {rev:row.updated_at} : null;
}

/* ---------- http helpers ---------- */
function cors(origin) {
  const o = ALLOW_ORIGINS.indexOf(origin) >= 0 ? origin : 'https://crmuro.ru';
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control':'no-store' }, cors(origin))
  });
}

/* ---------- прокси статики (сайт живёт на GitHub Pages) ----------
 * GitHub Pages настроен на кастомный домен crmuro.ru и на любой запрос к
 * abramson2000.github.io отвечает 301 → crmuro.ru (петля). Поэтому дёргаем
 * origin по IP GitHub, но с Host: crmuro.ru — тогда он отдаёт контент сразу.
 */
const ORIGIN_HOSTS = ['abramson2000.github.io', '185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];
async function proxyStatic(request, url) {
  const path = url.pathname + (url.search || '');
  const h = new Headers(request.headers);
  h.delete('Host');
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let last = null;
  for (const oh of ORIGIN_HOSTS) {
    try {
      const init = { method: request.method, headers: h, redirect: 'manual' };
      if (hasBody) { init.body = request.body; init.duplex = 'half'; }
      const res = await fetch(new Request('https://crmuro.ru' + path, init), { cf: { resolveOverride: oh } });
      if (res.status >= 300 && res.status < 400) { last = res; if (hasBody) break; continue; }
      const out = new Headers(res.headers);
      out.set('Access-Control-Allow-Origin', '*');
      out.set('X-Tingli-Origin', oh);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
    } catch (e) { last = e; }
  }
  if (last && last.headers && last.headers.get('location')) {
    return new Response(null, { status: 302, headers: { Location: last.headers.get('location') } });
  }
  return new Response('origin unreachable: ' + String((last && last.message) || last || 'unknown'), {
    status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || 'https://crmuro.ru';
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

    /* Всё, что не /api/ — отдаём с GitHub Pages (сайт tingli/ и cidian/).
       Так crmuro.ru/api/... становится настоящим same-origin для приложений. */
    if (!/^\/api\//.test(url.pathname)) return proxyStatic(request, url);

    if (url.pathname === '/api/_report') {
      if (method === 'GET') return json({ok:true,value:await store.get(env,'tingli-diag-report')},200,origin);
      if (method === 'POST') {
        const text=await request.text();
        if(text.length>500000)return json({ok:false,error:'bad size'},413,origin);
        try{JSON.parse(text);}catch(_){return json({ok:false,error:'bad json'},400,origin);}
        await store.put(env,{'tingli-diag-report':text});return json({ok:true},200,origin);
      }
      return json({ok:false,error:'method not allowed'},405,origin);
    }
    if (url.pathname === '/api/sync') {
      if (!env.DB) return json({ok:false, error:'D1 required for atomic sync'}, 503, origin);
      try {
        if (method === 'GET' && url.searchParams.get('list') === '1') {
          const rows = await env.DB.prepare('SELECT key, updated_at FROM kv').all();
          const revisions = {};
          for (const row of rows.results || []) if (isSafeKey(row.key)) revisions[row.key] = row.updated_at;
          return json({ok:true, protocol:2, revisions}, 200, origin);
        }
        if (method === 'GET' && url.searchParams.has('keys')) {
          const keys = url.searchParams.get('keys').split(',');
          if (!keys.length || keys.length > 20 || !keys.every(isSafeKey)) return json({ok:false, error:'bad keys'}, 400, origin);
          const records = {};
          for (const key of keys) {
            const row = await env.DB.prepare('SELECT value, updated_at FROM kv WHERE key = ?').bind(key).first();
            records[key] = row ? {value:row.value, rev:row.updated_at} : {value:null, rev:0};
          }
          return json({ok:true, records}, 200, origin);
        }
        if (method === 'POST') {
          const text = await request.text();
          if (text.length > KEY_MAX) return json({ok:false, error:'bad size'}, 413, origin);
          let input; try { input = JSON.parse(text); } catch (_) { return json({ok:false, error:'bad json'}, 400, origin); }
          if (!input || !isSafeKey(input.key) || typeof input.value !== 'string' || !(input.base === null || typeof input.base === 'string')) return json({ok:false, error:'bad mutation'}, 400, origin);
          const changed = await compareAndSet(env, input.key, input.base, input.value);
          if (!changed) {
            const row = await env.DB.prepare('SELECT value, updated_at FROM kv WHERE key = ?').bind(input.key).first();
            return json({ok:false, value:row ? row.value : null, rev:row ? row.updated_at : 0}, 409, origin);
          }
          // Return our acknowledged value, even if another device has already
          // committed a later value. A stale revision only causes another pull.
          return json({ok:true, value:input.value, rev:changed.rev}, 200, origin);
        }
        return json({ok:false, error:'method not allowed'}, 405, origin);
      } catch (e) { return json({ok:false, error:String(e.message || e)}, 500, origin); }
    }
    if (url.pathname !== '/api/backup') return json({ok:false, error:'not found'}, 404, origin);

    try {
      if (method === 'GET') {
        if (url.searchParams.get('list') === '1') {
          return json({ ok: true, keys: await store.keys(env) }, 200, origin);
        }
        if (url.searchParams.get('dump') === '1') {
          return json({ ok: true, values: await store.dump(env) }, 200, origin);
        }
        const keys = url.searchParams.get('keys');
        if (keys) {
          const list = keys.split(',').map((s) => s.trim()).filter(isSafeKey);
          const values = {};
          for (const k of list) { const v = await store.get(env, k); if (v !== null) values[k] = v; }
          return json({ ok: true, values: values }, 200, origin);
        }
        const one = url.searchParams.get('key');
        if (one) {
          if (!isSafeKey(one)) return json({ ok: false, error: 'bad key' }, 400, origin);
          const v = await store.get(env, one);
          return json({ ok: v !== null, key: one, value: v === null ? null : v }, 200, origin);
        }
        return json({ ok: true, keys: await store.keys(env) }, 200, origin);
      }

      if (method === 'DELETE') {
        const k = url.searchParams.get('key');
        if (!k) return json({ ok: false, error: 'key required' }, 400, origin);
        if (!isSafeKey(k)) return json({ ok: false, error: 'bad key' }, 400, origin);
        await store.del(env, k);
        return json({ ok: true, deleted: k }, 200, origin);
      }

      if (method === 'POST' || method === 'PUT') {
        const text = await request.text();
        if (!text || text.length > KEY_MAX) return json({ ok: false, error: 'bad size' }, 413, origin);
        let raw;
        try { raw = JSON.parse(text); } catch (e) { return json({ ok: false, error: 'bad json' }, 400, origin); }

        const incoming = {};
        Object.keys(raw || {}).forEach(function (k) {
          if (isSafeKey(k)) incoming[k] = String(raw[k]);
        });
        if (!Object.keys(incoming).length) return json({ ok: false, error: 'no valid keys' }, 400, origin);

        const force = url.searchParams.get('force') === '1';

        for (const key of Object.keys(incoming)) {
          if (!env.DB || force) { await store.put(env, {[key]:incoming[key]}); continue; }
          let committed = false;
          for (let attempt = 0; attempt < 8; attempt++) {
            const prev = await store.get(env, key);
            let value = incoming[key];
            if (prev !== null) {
              if (key === 'tingli-schedule-v1') value = mergeSchedule(prev, value);
              else if (key === 'cidian-data-v1') value = mergeCidian(prev, value);
              else if (key === 'tingli-manual-v1' || key === 'tingli-progress-v1') value = JSON.stringify(legacyUnion(JSON.parse(prev), JSON.parse(value)));
              else if (key === 'tingli-favs-v1') value = JSON.stringify([...new Set([...JSON.parse(prev), ...JSON.parse(value)])]);
            }
            if (await compareAndSet(env, key, prev, value)) { committed = true; break; }
          }
          if (!committed) return json({ok:false, error:'write conflict'}, 409, origin);
        }
        return json({ ok: true, wrote: Object.keys(incoming), force: !!force }, 200, origin);
      }

      return json({ ok: false, error: 'method not allowed' }, 405, origin);
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 500, origin);
    }
  }
};
