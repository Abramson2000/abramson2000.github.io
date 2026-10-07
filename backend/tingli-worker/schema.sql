-- Tingli / Cidian cloud storage (D1 = SQLite на Cloudflare)
CREATE TABLE IF NOT EXISTS kv (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS kv_upd ON kv(updated_at);
