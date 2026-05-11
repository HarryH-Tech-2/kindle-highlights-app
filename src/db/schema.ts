import type { DbExec } from './client';

export const currentSchemaVersion = 3;

const migrations: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    CREATE TABLE IF NOT EXISTS books (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      author     TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      note       TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_highlights_book ON highlights(book_id);

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS highlight_tags (
      highlight_id INTEGER NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
      tag_id       INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (highlight_id, tag_id)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS highlights_fts USING fts5(
      text, note, content='highlights', content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS highlights_ai AFTER INSERT ON highlights BEGIN
      INSERT INTO highlights_fts(rowid, text, note) VALUES (new.id, new.text, new.note);
    END;
    CREATE TRIGGER IF NOT EXISTS highlights_ad AFTER DELETE ON highlights BEGIN
      INSERT INTO highlights_fts(highlights_fts, rowid, text, note) VALUES('delete', old.id, old.text, old.note);
    END;
    CREATE TRIGGER IF NOT EXISTS highlights_au AFTER UPDATE ON highlights BEGIN
      INSERT INTO highlights_fts(highlights_fts, rowid, text, note) VALUES('delete', old.id, old.text, old.note);
      INSERT INTO highlights_fts(rowid, text, note) VALUES (new.id, new.text, new.note);
    END;
  `,
  2: `
    -- Cross-device sync support. remote_id is a UUID assigned by whichever device
    -- creates the row first; deleted_at is a soft-delete tombstone so deletes can
    -- propagate. updated_at is backfilled from created_at for any pre-v2 rows.
    ALTER TABLE books ADD COLUMN remote_id TEXT;
    ALTER TABLE books ADD COLUMN deleted_at INTEGER;
    ALTER TABLE books ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
    UPDATE books SET updated_at = created_at WHERE updated_at = 0;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_books_remote_id ON books(remote_id) WHERE remote_id IS NOT NULL;

    ALTER TABLE highlights ADD COLUMN remote_id TEXT;
    ALTER TABLE highlights ADD COLUMN deleted_at INTEGER;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_highlights_remote_id ON highlights(remote_id) WHERE remote_id IS NOT NULL;
  `,
  3: `
    -- Per-highlight display style (color + italic) stored as JSON. Nullable
    -- means "no style chosen yet" so existing rows render with the default
    -- text color and weight.
    ALTER TABLE highlights ADD COLUMN style TEXT;
  `
};

export async function runMigrations(db: DbExec): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'schema_version'"
  );
  const installed = row ? Number(row.value) : 0;
  for (let v = installed + 1; v <= currentSchemaVersion; v++) {
    const sql = migrations[v];
    if (!sql) throw new Error(`Missing migration for version ${v}`);
    await db.execAsync(sql);
    await db.runAsync(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)",
      [String(v)]
    );
  }
}
