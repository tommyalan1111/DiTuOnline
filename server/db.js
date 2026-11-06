import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { DATA_DIR } from './config.js';

const db = new DatabaseSync(path.join(DATA_DIR, 'ditu.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email         TEXT NOT NULL COLLATE NOCASE UNIQUE,
    pass_hash     TEXT NOT NULL,
    pass_salt     TEXT NOT NULL,
    gender        TEXT CHECK (gender IN ('male','female')),
    temple_id     INTEGER,
    merit         INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    last_login_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at    INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    temple_id  INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    username   TEXT NOT NULL,
    gender     TEXT,
    text       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_chat_temple ON chat_messages (temple_id, id DESC);
  CREATE INDEX IF NOT EXISTS idx_reset_user ON reset_tokens (user_id);
`);

export default db;
