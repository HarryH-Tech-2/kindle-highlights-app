import {
  upsertTagByName,
  listTags,
  setHighlightTags,
  getTagsForHighlight,
  listTagsWithCounts
} from '../../src/db/tags';
import { runMigrations } from '../../src/db/schema';
import { createBook } from '../../src/db/books';
import { openTestDb } from './testDb';
import type { DbExec } from '../../src/db/client';

async function setup() {
  const db = openTestDb();
  await runMigrations(db);
  return db;
}

async function insertHighlight(db: DbExec, book_id: number, text = 'sample') {
  const now = Date.now();
  const r = await db.runAsync(
    'INSERT INTO highlights (book_id, text, note, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)',
    [book_id, text, now, now]
  );
  return r.lastInsertRowId;
}

describe('tags', () => {
  test('upsertTagByName creates once, returns same id on repeat', async () => {
    const db = await setup();
    const a = await upsertTagByName(db, 'habits');
    const b = await upsertTagByName(db, 'habits');
    expect(a.id).toBe(b.id);
    expect(a.name).toBe('habits');
  });

  test('listTags returns all tags sorted by name', async () => {
    const db = await setup();
    await upsertTagByName(db, 'zen');
    await upsertTagByName(db, 'art');
    expect((await listTags(db)).map((t) => t.name)).toEqual(['art', 'zen']);
  });

  test('setHighlightTags replaces previous tags for that highlight', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'B' });
    const hid = await insertHighlight(db, book.id);
    await setHighlightTags(db, hid, ['a', 'b']);
    expect((await getTagsForHighlight(db, hid)).map((t) => t.name).sort()).toEqual(['a', 'b']);
    await setHighlightTags(db, hid, ['b', 'c']);
    expect((await getTagsForHighlight(db, hid)).map((t) => t.name).sort()).toEqual(['b', 'c']);
  });

  test('listTagsWithCounts returns usage counts and skips orphans', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'B' });
    const h1 = await insertHighlight(db, book.id, 'one');
    const h2 = await insertHighlight(db, book.id, 'two');
    await setHighlightTags(db, h1, ['x', 'y']);
    await setHighlightTags(db, h2, ['x']);
    await upsertTagByName(db, 'orphan');
    const counts = await listTagsWithCounts(db);
    const map = Object.fromEntries(counts.map((c) => [c.name, c.count]));
    expect(map.x).toBe(2);
    expect(map.y).toBe(1);
    expect(map.orphan).toBeUndefined();
  });
});
