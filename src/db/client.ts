import * as SQLite from 'expo-sqlite';

export type DbExec = {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: unknown[]) => Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
  getFirstAsync: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | null>;
};

let cached: DbExec | null = null;

export async function getDb(): Promise<DbExec> {
  if (cached) return cached;
  const db = await SQLite.openDatabaseAsync('highlights.db');
  cached = {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params) => db.runAsync(sql, params ?? []),
    getAllAsync: (sql, params) => db.getAllAsync(sql, params ?? []) as Promise<any[]>,
    getFirstAsync: (sql, params) => db.getFirstAsync(sql, params ?? []) as Promise<any>
  };
  return cached;
}

export function _resetDbCacheForTests() {
  cached = null;
}
