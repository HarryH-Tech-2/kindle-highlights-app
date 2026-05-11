import { runMigrations, currentSchemaVersion } from '../schema';
import { makeTestDb } from '../test-helpers';

describe('schema v2', () => {
  test('currentSchemaVersion is at least 2', () => {
    expect(currentSchemaVersion).toBeGreaterThanOrEqual(2);
  });

  test('books table has remote_id, deleted_at, updated_at columns', async () => {
    const { db, raw } = makeTestDb();
    await runMigrations(db);
    const cols = (raw.prepare('PRAGMA table_info(books)').all() as { name: string }[]).map(
      (c) => c.name
    );
    expect(cols).toEqual(expect.arrayContaining(['remote_id', 'deleted_at', 'updated_at']));
  });

  test('highlights table has remote_id, deleted_at columns', async () => {
    const { db, raw } = makeTestDb();
    await runMigrations(db);
    const cols = (raw.prepare('PRAGMA table_info(highlights)').all() as { name: string }[]).map(
      (c) => c.name
    );
    expect(cols).toEqual(expect.arrayContaining(['remote_id', 'deleted_at']));
  });

  test('unique index on books.remote_id exists', async () => {
    const { db, raw } = makeTestDb();
    await runMigrations(db);
    const idx = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get('idx_books_remote_id') as { name: string } | undefined;
    expect(idx?.name).toBe('idx_books_remote_id');
  });

  test('unique index on highlights.remote_id exists', async () => {
    const { db, raw } = makeTestDb();
    await runMigrations(db);
    const idx = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get('idx_highlights_remote_id') as { name: string } | undefined;
    expect(idx?.name).toBe('idx_highlights_remote_id');
  });

  test('migrating from v1 (existing books rows) preserves data and backfills updated_at', async () => {
    // Simulate an app that was on v1 before this update: install v1 only, insert data,
    // then run all migrations and confirm the v2 ALTERs don't break existing rows.
    const { db, raw } = makeTestDb();
    raw.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT,
        created_at INTEGER NOT NULL
      );
      INSERT INTO books (id, title, author, created_at) VALUES (1, 'Old Book', 'X', 1000);
      INSERT INTO meta (key, value) VALUES ('schema_version', '1');
      CREATE TABLE highlights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO highlights (id, book_id, text, note, created_at, updated_at)
      VALUES (1, 1, 'hello', NULL, 2000, 2000);
    `);
    await runMigrations(db);
    const book = raw.prepare('SELECT * FROM books WHERE id = 1').get() as {
      title: string;
      updated_at: number;
      remote_id: string | null;
      deleted_at: number | null;
    };
    expect(book.title).toBe('Old Book');
    expect(book.updated_at).toBe(1000); // backfilled from created_at
    expect(book.remote_id).toBeNull();
    expect(book.deleted_at).toBeNull();
  });
});
