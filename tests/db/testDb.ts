import Database from 'better-sqlite3';
import type { DbExec } from '../../src/db/client';

export function openTestDb(): DbExec {
  const db = new Database(':memory:');
  return {
    execAsync: async (sql) => { db.exec(sql); },
    runAsync: async (sql, params = []) => {
      const stmt = db.prepare(sql);
      const info = stmt.run(...(params as any[]));
      return { lastInsertRowId: Number(info.lastInsertRowid), changes: info.changes };
    },
    getAllAsync: async (sql, params = []) => {
      return db.prepare(sql).all(...(params as any[])) as any[];
    },
    getFirstAsync: async (sql, params = []) => {
      const row = db.prepare(sql).get(...(params as any[]));
      return (row ?? null) as any;
    }
  };
}
