var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/spin-progress.js
var SB_URL = "https://mkehzkobjxnjobkqeiwt.supabase.co";
var SB_ANON = "sb_publishable_4RVlpOkywKmEjsnKsHpRiA_q_Af-f0v";
var BOSS_EMAIL = "abramson@crm.ru";
var HIDDEN_EMAILS = ["bot@crm.ru", "guest@crm.ru", "review@crm.ru"];
var EXTRA_TEAM = [
  { email: "irina@crm.ru", name: "\u0411\u0435\u0431\u0438\u0448\u0435\u0432\u0430" }
];
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
  });
}
__name(json, "json");
async function verifyToken(token) {
  try {
    const r = await fetch(SB_URL + "/auth/v1/user", {
      headers: { apikey: SB_ANON, Authorization: "Bearer " + token }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch (e) {
    return null;
  }
}
__name(verifyToken, "verifyToken");
function userNameOf(u) {
  const meta = u && u.user_metadata || {};
  if (meta.name && String(meta.name).trim()) return String(meta.name).trim().slice(0, 40);
  const raw = (u && u.email || "").split("@")[0] || "";
  if (!raw) return "";
  return (raw[0].toUpperCase() + raw.slice(1)).slice(0, 40);
}
__name(userNameOf, "userNameOf");
async function onRequestPost(ctx) {
  try {
    const body = await ctx.request.json();
    const token = String(body.token || "").trim();
    const action = body.action === "save" ? "save" : body.action === "team" ? "team" : "get";
    if (!token) return json({ ok: false, error: "token \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D" }, 400);
    const user = await verifyToken(token);
    if (!user) return json({ ok: false, error: "\u043D\u0435 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u043E\u0432\u0430\u043D" }, 401);
    const kv = ctx.env.TINGLI_BACKUP;
    const key = "spin:" + user.id;
    if (action === "team") {
      if (user.email !== BOSS_EMAIL) return json({ ok: false, error: "\u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430" }, 403);
      const list = await kv.list({ prefix: "spin:" });
      const team = [];
      const seen = /* @__PURE__ */ new Set();
      for (const k of list.keys || []) {
        try {
          const raw2 = await kv.get(k.name);
          if (!raw2) continue;
          const d = JSON.parse(raw2);
          if (HIDDEN_EMAILS.includes(d.email || "")) continue;
          seen.add((d.email || "").toLowerCase() || k.name);
          team.push({
            id: k.name.slice(5),
            name: d.name || "",
            email: d.email || "",
            lesson: d.lesson || 0,
            done: d.done || [],
            practiced: d.practiced || [],
            spicedDone: d.spicedDone || [],
            medDone: d.medDone || [],
            proDone: d.proDone || [],
            spPracticed: d.spPracticed || [],
            medPracticed: d.medPracticed || [],
            proPracticed: d.proPracticed || [],
            xp: d.xp || 0,
            correct: d.correct || 0,
            attempts: d.attempts || 0,
            updatedAt: d.updatedAt || 0
          });
        } catch (e) {
        }
      }
      try {
        const r = await fetch(SB_URL + "/rest/v1/user_managers?select=email,manager,role", {
          headers: { apikey: SB_ANON, Authorization: "Bearer " + token }
        });
        if (r.ok) {
          const ums = await r.json();
          for (const um of ums || []) {
            const em = String(um.email || "").toLowerCase();
            if (HIDDEN_EMAILS.includes(em) || em === BOSS_EMAIL) continue;
            if (seen.has(em)) continue;
            seen.add(em);
            team.push({
              id: "",
              name: String(um.manager || em.split("@")[0] || "").trim(),
              email: em,
              lesson: 0,
              done: [],
              practiced: [],
              xp: 0,
              correct: 0,
              attempts: 0,
              updatedAt: 0
            });
          }
        }
      } catch (e) {
      }
      for (const ex of EXTRA_TEAM) {
        const em = String(ex.email || "").toLowerCase();
        if (HIDDEN_EMAILS.includes(em) || em === BOSS_EMAIL) continue;
        if (seen.has(em)) continue;
        seen.add(em);
        team.push({
          id: "",
          name: ex.name || "",
          email: em,
          lesson: 0,
          done: [],
          practiced: [],
          spicedDone: [],
          medDone: [],
          spPracticed: [],
          medPracticed: [],
          xp: 0,
          correct: 0,
          attempts: 0,
          updatedAt: 0
        });
      }
      team.sort((a, b) => (b.xp || 0) - (a.xp || 0));
      return json({ ok: true, team });
    }
    if (action === "save") {
      const data = body.data;
      if (!data || typeof data !== "object") return json({ ok: false, error: "data \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u0430" }, 400);
      const clean = {
        name: String(data.name || userNameOf(user) || "").slice(0, 40),
        email: String(data.email || user.email || "").slice(0, 80),
        lesson: Number(data.lesson) || 0,
        done: Array.isArray(data.done) ? data.done.map(Number).filter((n) => n >= 0 && n < 50) : [],
        practiced: Array.isArray(data.practiced) ? data.practiced.map(Number).filter((n) => n >= 0 && n < 50) : [],
        spicedDone: Array.isArray(data.spicedDone) ? data.spicedDone.map(Number).filter((n) => n >= 0 && n < 50) : [],
        medDone: Array.isArray(data.medDone) ? data.medDone.map(Number).filter((n) => n >= 0 && n < 50) : [],
        proDone: Array.isArray(data.proDone) ? data.proDone.map(Number).filter((n) => n >= 0 && n < 100) : [],
        spPracticed: Array.isArray(data.spPracticed) ? data.spPracticed.map(Number).filter((n) => n >= 0 && n < 50) : [],
        medPracticed: Array.isArray(data.medPracticed) ? data.medPracticed.map(Number).filter((n) => n >= 0 && n < 50) : [],
        proPracticed: Array.isArray(data.proPracticed) ? data.proPracticed.map(Number).filter((n) => n >= 0 && n < 100) : [],
        cDone: Array.isArray(data.cDone) ? data.cDone.map(Number).filter((n) => n >= 0 && n < 200) : [],
        xd: data.xd && typeof data.xd === "object" && !Array.isArray(data.xd) ? Object.fromEntries(Object.entries(data.xd).slice(0, 20).map(([k, v]) => [String(k).slice(0, 24), Array.isArray(v) ? v.map(Number).filter((n) => n >= 0 && n < 500) : []])) : {},
        scs: data.scs && typeof data.scs === "object" && !Array.isArray(data.scs) ? Object.fromEntries(Object.entries(data.scs).slice(0, 30).map(([k, v]) => [String(k).slice(0, 24), {
          a: Array.isArray(v && v.a) ? v.a.map(Number).filter((n) => n >= 0 && n < 500) : [],
          r: Array.isArray(v && v.r) ? v.r.map(Number).filter((n) => n >= 0 && n < 500) : []
        }])) : {},
        trn: data.trn && typeof data.trn === "object" && !Array.isArray(data.trn) ? Object.fromEntries(Object.entries(data.trn).slice(0, 20).map(([k, v]) => [String(k).slice(0, 24), {
          ord: Array.isArray(v && v.ord) ? v.ord.map(Number).filter((n) => n >= 0 && n < 500).slice(0, 600) : [],
          i: Number(v && v.i) || 0,
          sc: Number(v && v.sc) || 0,
          done: !!(v && v.done),
          wrong: Array.isArray(v && v.wrong) ? v.wrong.map(Number).filter((n) => n >= 0 && n < 500).slice(0, 600) : []
        }])) : {},
        xp: Number(data.xp) || 0,
        correct: Number(data.correct) || 0,
        attempts: Number(data.attempts) || 0,
        extra: data.extra === null || data.extra === void 0 || data.extra === "" ? null : Number(data.extra) >= 0 && Number(data.extra) < 50 ? Number(data.extra) : null,
        xb: Number(data.xb) || 0,
        updatedAt: Date.now()
      };
      await kv.put(key, JSON.stringify(clean));
      return json({ ok: true });
    }
    const raw = await kv.get(key);
    if (!raw) return json({ ok: true, data: null });
    try {
      const d = JSON.parse(raw);
      let changed = false;
      if (!d.name && user.email) {
        d.name = userNameOf(user);
        changed = true;
      }
      if (!d.email && user.email) {
        d.email = user.email;
        changed = true;
      }
      d.updatedAt = Date.now();
      changed = true;
      if (changed) await kv.put(key, JSON.stringify(d));
      return json({ ok: true, data: d });
    } catch (e) {
      return json({ ok: true, data: null });
    }
  } catch (e) {
    return json({ ok: false, error: "spin-progress: " + String(e && e.message || e) }, 500);
  }
}
__name(onRequestPost, "onRequestPost");
async function onRequestOptions() {
  return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
__name(onRequestOptions, "onRequestOptions");

// api/tingli-check.js
var DS_URL = "https://api.deepseek.com/chat/completions";
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
function json2(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS)
  });
}
__name(json2, "json");
async function onRequestOptions2() {
  return new Response(null, { status: 204, headers: CORS });
}
__name(onRequestOptions2, "onRequestOptions");
async function onRequestPost2(ctx) {
  try {
    const key = ctx.env && ctx.env.TINGLI_DS_KEY || "";
    if (!key) return json2({ ok: false, error: "TINGLI_DS_KEY \u043D\u0435 \u0437\u0430\u0434\u0430\u043D" }, 500);
    const body = await ctx.request.json();
    const q = String(body.q || "").trim().slice(0, 500);
    const a = String(body.a || "").trim().slice(0, 2e3);
    const text = String(body.text || "").trim().slice(0, 6e3);
    if (!q || !a) return json2({ ok: false, error: "q \u0438 a \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B" }, 400);
    const sys = '\u0422\u044B \u2014 \u0441\u0442\u0440\u043E\u0433\u0438\u0439, \u043D\u043E \u0434\u043E\u0431\u0440\u044B\u0439 \u0443\u0447\u0438\u0442\u0435\u043B\u044C \u043A\u0438\u0442\u0430\u0439\u0441\u043A\u043E\u0433\u043E \u044F\u0437\u044B\u043A\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u0448\u044C \u043F\u0438\u0441\u044C\u043C\u0435\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 \u0443\u0447\u0435\u043D\u0438\u043A\u0430 \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441 \u043F\u043E \u0442\u0435\u043A\u0441\u0442\u0443 \u0443\u0440\u043E\u043A\u0430. \u041E\u0446\u0435\u043D\u0438\u0432\u0430\u0439 \u043F\u043E \u0441\u043C\u044B\u0441\u043B\u0443: \u0433\u043B\u0430\u0432\u043D\u043E\u0435 \u2014 \u0443\u043F\u043E\u043C\u044F\u043D\u0443\u0442\u044B \u043B\u0438 \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u0444\u0430\u043A\u0442\u044B, \u0433\u0440\u0430\u043C\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043E\u0433\u0440\u0435\u0445\u0438 \u043D\u0435 \u043A\u0440\u0438\u0442\u0438\u0447\u043D\u044B. \u041E\u0442\u0432\u0435\u0447\u0430\u0439 \u0422\u041E\u041B\u042C\u041A\u041E \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u043C JSON \u0431\u0435\u0437 markdown: {"correct": true|false, "comment": "\u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043F\u043E-\u0440\u0443\u0441\u0441\u043A\u0438, 1-3 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F: \u0447\u0442\u043E \u0432\u0435\u0440\u043D\u043E, \u0430 \u0435\u0441\u043B\u0438 \u043D\u0435\u0432\u0435\u0440\u043D\u043E/\u043D\u0435\u043F\u043E\u043B\u043D\u043E \u2014 \u0447\u0442\u043E \u0438\u043C\u0435\u043D\u043D\u043E \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E \u0438\u043B\u0438 \u0432 \u0447\u0451\u043C \u043E\u0448\u0438\u0431\u043A\u0430, \u0431\u0435\u0437 \u0433\u043E\u0442\u043E\u0432\u043E\u0433\u043E \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430"}';
    const user = "\u0422\u0435\u043A\u0441\u0442 \u0443\u0440\u043E\u043A\u0430:\n" + (text || "(\u0442\u0435\u043A\u0441\u0442 \u043D\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D)") + "\n\n\u0412\u043E\u043F\u0440\u043E\u0441:\n" + q + "\n\n\u041E\u0442\u0432\u0435\u0442 \u0443\u0447\u0435\u043D\u0438\u043A\u0430:\n" + a;
    const r = await fetch(DS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user }
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });
    const data = await r.json();
    if (!r.ok) return json2({ ok: false, error: "DeepSeek: " + (data.error ? data.error.message : r.status) }, 502);
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    let parsed = null;
    try {
      const m = String(content).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    } catch (e) {
      parsed = null;
    }
    if (!parsed || typeof parsed.correct !== "boolean") {
      return json2({ ok: false, error: "\u0418\u0418 \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442" }, 502);
    }
    return json2({ ok: true, correct: parsed.correct, comment: String(parsed.comment || "") });
  } catch (e) {
    return json2({ ok: false, error: String(e) }, 500);
  }
}
__name(onRequestPost2, "onRequestPost");

// api/backup.js
var KEY = "tingli-backup-v1";
var MAX = 6e5;
var CORS2 = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function json3(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS2)
  });
}
__name(json3, "json");
async function onRequest(ctx) {
  const kv = ctx.env && ctx.env.TINGLI_BACKUP;
  if (!kv) return json3({ ok: false, error: "KV \u043D\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D" }, 500);
  const method = ctx.request.method;
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS2 });
  if (method === "PUT" || method === "POST") {
    try {
      const text = await ctx.request.text();
      if (!text || text.length > MAX) return json3({ ok: false, error: "bad size" }, 413);
      JSON.parse(text);
      await kv.put(KEY, text);
      return json3({ ok: true });
    } catch (e) {
      return json3({ ok: false, error: "bad json" }, 400);
    }
  }
  if (method === "DELETE") {
    await kv.delete(KEY);
    return json3({ ok: true });
  }
  const data = await kv.get(KEY);
  if (!data) return json3({ ok: false, empty: true });
  return new Response(data, { headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS2) });
}
__name(onRequest, "onRequest");

// vpn.js
import { connect } from "cloudflare:sockets";
var UUID = "acfee5dd-bbd5-4053-8f18-f32c274a9127";
var UUID_BYTES = (() => {
  const hex = UUID.replace(/-/g, "");
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
})();
var FLUSH_AT = 128 * 1024;
var FLUSH_MS = 12;
function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
__name(concat, "concat");
function parseHeader(buf) {
  if (buf.length < 18) return null;
  const uuid = buf.slice(1, 17);
  const addonLen = buf[17];
  const pos = 18 + addonLen;
  if (buf.length < pos + 4) return null;
  const cmd = buf[pos];
  const port = buf[pos + 1] << 8 | buf[pos + 2];
  const atype = buf[pos + 3];
  let address = "";
  let addrLen = 0;
  if (atype === 1) {
    if (buf.length < pos + 8) return null;
    address = `${buf[pos + 4]}.${buf[pos + 5]}.${buf[pos + 6]}.${buf[pos + 7]}`;
    addrLen = 4;
  } else if (atype === 2) {
    if (buf.length < pos + 5) return null;
    const len = buf[pos + 4];
    if (buf.length < pos + 5 + len) return null;
    address = new TextDecoder().decode(buf.slice(pos + 5, pos + 5 + len));
    addrLen = 1 + len;
  } else if (atype === 3) {
    if (buf.length < pos + 20) return null;
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push((buf[pos + 4 + i * 2] << 8 | buf[pos + 5 + i * 2]).toString(16));
    address = "[" + parts.join(":") + "]";
    addrLen = 16;
  } else {
    return { bad: true };
  }
  return { uuid, cmd, port, address, headerLen: pos + 4 + addrLen };
}
__name(parseHeader, "parseHeader");
function sameBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
__name(sameBytes, "sameBytes");
function makeWsSink(ws, onDead) {
  let dead = false;
  let parts = [];
  let len = 0;
  let tail = null;
  const send = /* @__PURE__ */ __name(() => {
    if (dead || !len) return;
    const out = new Uint8Array(len);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.byteLength;
    }
    parts = [];
    len = 0;
    try {
      ws.send(out);
    } catch (e) {
      dead = true;
      onDead();
    }
  }, "send");
  const killTail = /* @__PURE__ */ __name(() => {
    if (tail) {
      try {
        clearTimeout(tail);
      } catch (e) {
      }
      tail = null;
    }
  }, "killTail");
  return new WritableStream({
    write(chunk) {
      if (dead) return;
      parts.push(chunk);
      len += chunk.byteLength;
      if (len >= FLUSH_AT) {
        killTail();
        send();
      } else {
        killTail();
        tail = setTimeout(() => {
          tail = null;
          send();
        }, FLUSH_MS);
      }
    },
    close() {
      killTail();
      send();
      onDead();
    },
    abort() {
      killTail();
      onDead();
    }
  });
}
__name(makeWsSink, "makeWsSink");
async function dohLookup(queryBytes) {
  for (const url of ["https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query"]) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/dns-message", accept: "application/dns-message" },
        body: queryBytes
      });
      if (r.ok) {
        const b = new Uint8Array(await r.arrayBuffer());
        if (b.length) return b;
      }
    } catch (e) {
    }
  }
  return null;
}
__name(dohLookup, "dohLookup");
function handleSession(webSocket) {
  let buf = new Uint8Array(0);
  let writer = null;
  let closed = false;
  let udpMode = false;
  let udpPort = 0;
  let udpBuf = new Uint8Array(0);
  const closeAll = /* @__PURE__ */ __name(() => {
    if (closed) return;
    closed = true;
    try {
      if (writer) writer.releaseLock();
    } catch (e) {
    }
    try {
      webSocket.close();
    } catch (e) {
    }
  }, "closeAll");
  const sendUdp = /* @__PURE__ */ __name((payload) => {
    const out = new Uint8Array(2 + payload.length);
    out[0] = payload.length >> 8 & 255;
    out[1] = payload.length & 255;
    out.set(payload, 2);
    try {
      webSocket.send(out);
    } catch (e) {
      closeAll();
    }
  }, "sendUdp");
  const drainUdp = /* @__PURE__ */ __name(async () => {
    while (udpBuf.length >= 2) {
      const l = udpBuf[0] << 8 | udpBuf[1];
      if (udpBuf.length < 2 + l) break;
      const payload = udpBuf.slice(2, 2 + l);
      udpBuf = udpBuf.slice(2 + l);
      if (udpPort === 53) {
        const ans = await dohLookup(payload);
        if (ans) sendUdp(ans);
      }
    }
  }, "drainUdp");
  webSocket.addEventListener("message", async (event) => {
    try {
      if (closed) return;
      const chunk = new Uint8Array(event.data);
      if (udpMode) {
        udpBuf = concat(udpBuf, chunk);
        await drainUdp();
        return;
      }
      if (writer) {
        await writer.write(chunk);
        return;
      }
      buf = concat(buf, chunk);
      const h = parseHeader(buf);
      if (!h) return;
      if (h.bad || !sameBytes(h.uuid, UUID_BYTES)) {
        console.log("vpn: uuid-\u043D\u0435-\u043D\u0430\u0448");
        closeAll();
        return;
      }
      console.log("vpn: \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A cmd=" + h.cmd + " " + h.address + ":" + h.port + " \u043E\u0441\u0442\u0430\u0442\u043E\u043A=" + (buf.length - h.headerLen));
      if (h.cmd === 2) {
        udpMode = true;
        udpPort = h.port;
        udpBuf = buf.slice(h.headerLen);
        buf = new Uint8Array(0);
        await drainUdp();
        return;
      }
      if (h.cmd !== 1) {
        buf = new Uint8Array(0);
        return;
      }
      const rest = buf.slice(h.headerLen);
      buf = new Uint8Array(0);
      const socket = connect({ hostname: h.address, port: h.port });
      writer = socket.writable.getWriter();
      webSocket.send(new Uint8Array([0, 0]));
      socket.readable.pipeTo(makeWsSink(webSocket, closeAll)).catch(() => closeAll());
      if (rest.length) await writer.write(rest);
    } catch (e) {
      closeAll();
    }
  });
  webSocket.addEventListener("close", () => {
    console.log("vpn: \u0441\u0435\u0441\u0441\u0438\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u0430");
    closeAll();
  });
  webSocket.addEventListener("error", () => {
    closeAll();
  });
}
__name(handleSession, "handleSession");
async function onRequest2(context) {
  const { request } = context;
  const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();
  if (upgrade === "websocket") console.log("vpn: ws-open " + request.url + " ip=" + (request.headers.get("cf-connecting-ip") || "?") + " ua=" + (request.headers.get("user-agent") || "").slice(0, 40));
  if (upgrade !== "websocket") {
    return new Response("OK", { status: 200 });
  }
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  handleSession(server);
  return new Response(null, { status: 101, webSocket: client });
}
__name(onRequest2, "onRequest");

// ../.wrangler/tmp/pages-I0p1ZJ/functionsRoutes-0.3536747136445533.mjs
var routes = [
  {
    routePath: "/api/spin-progress",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/spin-progress",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/tingli-check",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/tingli-check",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/backup",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/vpn",
    mountPath: "/",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  }
];

// ../../../../../../../Application Support/QClaw/npm-global/lib/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../../../../Application Support/QClaw/npm-global/lib/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
