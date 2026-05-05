import { getDb } from './client';
import { runMigrations } from './schema';

let initPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await getDb();
      await runMigrations(db);
    })();
  }
  return initPromise;
}
