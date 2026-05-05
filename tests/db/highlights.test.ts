import {
  createHighlight,
  getHighlight,
  listHighlightsByBook,
  listHighlightsByTag,
  updateHighlight,
  deleteHighlight
} from '../../src/db/highlights';
import { runMigrations } from '../../src/db/schema';
import { createBook, deleteBook } from '../../src/db/books';
import { openTestDb } from './testDb';

async function setup() {
  const db = openTestDb();
  await runMigrations(db);
  const book = await createBook(db, { title: 'B', author: null });
  return { db, book };
}

describe('highlights', () => {
  test('create with tags persists relations', async () => {
    const { db, book } = await setup();
    const h = await createHighlight(db, {
      book_id: book.id,
      text: 'first',
      note: 'a note',
      tag_names: ['Habits', 'systems']
    });
    expect(h.id).toBeGreaterThan(0);
    expect(h.text).toBe('first');
    expect(h.note).toBe('a note');
    expect(h.tags.map((t) => t.name).sort()).toEqual(['habits', 'systems']);
    expect(h.book.id).toBe(book.id);
  });

  test('update changes text/note and replaces tags', async () => {
    const { db, book } = await setup();
    const h = await createHighlight(db, { book_id: book.id, text: 't1', tag_names: ['a'] });
    const updated = await updateHighlight(db, h.id, {
      text: 't2',
      note: 'n2',
      tag_names: ['b', 'c']
    });
    expect(updated.text).toBe('t2');
    expect(updated.note).toBe('n2');
    expect(updated.tags.map((t) => t.name).sort()).toEqual(['b', 'c']);
    expect(updated.updated_at).toBeGreaterThanOrEqual(h.updated_at);
  });

  test('listHighlightsByBook returns newest first', async () => {
    const { db, book } = await setup();
    const a = await createHighlight(db, { book_id: book.id, text: 'a' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createHighlight(db, { book_id: book.id, text: 'b' });
    const list = await listHighlightsByBook(db, book.id);
    expect(list.map((h) => h.id)).toEqual([b.id, a.id]);
  });

  test('listHighlightsByTag returns matches across books', async () => {
    const { db, book } = await setup();
    const other = await createBook(db, { title: 'Other', author: null });
    await createHighlight(db, { book_id: book.id, text: 'x', tag_names: ['focus'] });
    await createHighlight(db, { book_id: other.id, text: 'y', tag_names: ['focus'] });
    await createHighlight(db, { book_id: book.id, text: 'z', tag_names: ['other'] });
    const matches = await listHighlightsByTag(db, 'focus');
    expect(matches.map((h) => h.text).sort()).toEqual(['x', 'y']);
  });

  test('deleting a book cascades to its highlights', async () => {
    const { db, book } = await setup();
    const h = await createHighlight(db, { book_id: book.id, text: 'doomed' });
    await deleteBook(db, book.id);
    expect(await getHighlight(db, h.id)).toBeNull();
  });

  test('deleteHighlight removes the row and its tag joins', async () => {
    const { db, book } = await setup();
    const h = await createHighlight(db, { book_id: book.id, text: 't', tag_names: ['x'] });
    await deleteHighlight(db, h.id);
    expect(await getHighlight(db, h.id)).toBeNull();
    const joins = await db.getAllAsync(
      'SELECT * FROM highlight_tags WHERE highlight_id = ?',
      [h.id]
    );
    expect(joins).toEqual([]);
  });
});
