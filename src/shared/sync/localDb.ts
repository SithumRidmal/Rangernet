import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY NOT NULL,
  entity TEXT NOT NULL,
  op TEXT NOT NULL,
  group_key TEXT,
  label TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS outbox_created_idx ON outbox (created_at);
CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY NOT NULL,
  entity TEXT NOT NULL,
  label TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

/** Single on-device SQLite database shared by the offline outbox, cache and role-specific tables. */
export function getLocalDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('rangernet.db');
      await db.execAsync(SCHEMA);
      return db;
    })().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO cache (key, value, updated_at) VALUES (?, ?, ?)',
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getLocalDb();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM cache WHERE key = ?', key);
    return row ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheRemove(key: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync('DELETE FROM cache WHERE key = ?', key);
}
