// Test helper: in-memory better-sqlite3 wrapped in the DbExec interface so production
// db code (written against expo-sqlite) can run unchanged in Jest. Expo's native
// SQLite module is unavailable in node, so we shim it.
import Database from 'better-sqlite3';
import type { DbExec } from './client';

export function makeTestDb(): { db: DbExec; raw: Database.Database } {
  const raw = new Database(':memory:');
  const db: DbExec = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, params: unknown[] = []) => {
      const info = raw.prepare(sql).run(...(params as unknown[] as never[]));
      return { lastInsertRowId: Number(info.lastInsertRowid), changes: info.changes };
    },
    getAllAsync: async <T = unknown>(sql: string, params: unknown[] = []) =>
      raw.prepare(sql).all(...(params as unknown[] as never[])) as T[],
    getFirstAsync: async <T = unknown>(sql: string, params: unknown[] = []) =>
      (raw.prepare(sql).get(...(params as unknown[] as never[])) ?? null) as T | null,
  };
  return { db, raw };
}
