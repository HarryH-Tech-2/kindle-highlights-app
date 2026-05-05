import { runMigrations, currentSchemaVersion } from '../../src/db/schema';
import { openTestDb } from './testDb';

describe('runMigrations', () => {
  test('creates all tables and FTS index from a fresh database', async () => {
    const db = openTestDb();
    await runMigrations(db);
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['books', 'highlights', 'tags', 'highlight_tags', 'meta', 'highlights_fts'])
    );
  });

  test('records the current schema version in meta', async () => {
    const db = openTestDb();
    await runMigrations(db);
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'schema_version'"
    );
    expect(row?.value).toBe(String(currentSchemaVersion));
  });

  test('is idempotent: running twice does not error or duplicate state', async () => {
    const db = openTestDb();
    await runMigrations(db);
    await runMigrations(db);
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'schema_version'"
    );
    expect(row?.value).toBe(String(currentSchemaVersion));
  });
});
