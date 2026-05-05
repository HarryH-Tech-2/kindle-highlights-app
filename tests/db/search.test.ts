import { search } from '../../src/db/search';
import { runMigrations } from '../../src/db/schema';
import { createBook } from '../../src/db/books';
import { createHighlight } from '../../src/db/highlights';
import { openTestDb } from './testDb';

async function setup() {
  const db = openTestDb();
  await runMigrations(db);
  return db;
}

describe('search', () => {
  test('matches highlight text via FTS', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'Random' });
    await createHighlight(db, { book_id: book.id, text: 'systems are how we win', tag_names: [] });
    await createHighlight(db, { book_id: book.id, text: 'unrelated content', tag_names: [] });
    const r = await search(db, 'systems');
    expect(r.highlights.map((h) => h.text)).toEqual(['systems are how we win']);
  });

  test('matches highlight notes', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'X' });
    await createHighlight(db, {
      book_id: book.id,
      text: 'q',
      note: 'noteworthy thought',
      tag_names: []
    });
    const r = await search(db, 'noteworthy');
    expect(r.highlights).toHaveLength(1);
  });

  test('matches book titles via LIKE', async () => {
    const db = await setup();
    await createBook(db, { title: 'Atomic Habits' });
    await createBook(db, { title: 'Other Book' });
    const r = await search(db, 'atomic');
    expect(r.books.map((b) => b.title)).toEqual(['Atomic Habits']);
  });

  test('returns empty results for empty query', async () => {
    const db = await setup();
    const r = await search(db, '   ');
    expect(r).toEqual({ highlights: [], books: [] });
  });
});
