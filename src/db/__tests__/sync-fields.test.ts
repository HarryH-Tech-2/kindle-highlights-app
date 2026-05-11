import { runMigrations } from '../schema';
import * as Books from '../books';
import * as Highlights from '../highlights';
import { search } from '../search';
import { makeTestDb } from '../test-helpers';
import type { DbExec } from '../client';

async function setup(): Promise<DbExec> {
  const { db } = makeTestDb();
  await runMigrations(db);
  return db;
}

describe('books sync fields', () => {
  test('createBook assigns remote_id and updated_at', async () => {
    const db = await setup();
    const book = await Books.createBook(db, { title: 'A' });
    expect(book.remote_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(book.updated_at).toBeGreaterThan(0);
    expect(book.deleted_at).toBeNull();
  });

  test('updateBook bumps updated_at', async () => {
    const db = await setup();
    const book = await Books.createBook(db, { title: 'A' });
    const before = book.updated_at;
    // Force a millisecond gap so updated_at strictly increases
    await new Promise((r) => setTimeout(r, 5));
    const updated = await Books.updateBook(db, book.id, { title: 'B', author: null });
    expect(updated.updated_at).toBeGreaterThan(before);
  });

  test('deleteBook soft-deletes and hides from listBooks/getBook', async () => {
    const db = await setup();
    const book = await Books.createBook(db, { title: 'Doomed' });
    await Books.deleteBook(db, book.id);
    expect(await Books.getBook(db, book.id)).toBeNull();
    expect(await Books.listBooks(db)).toHaveLength(0);
    // But the row is still there for sync purposes
    const stillThere = await Books.getBookByIdIncludingDeleted(db, book.id);
    expect(stillThere?.deleted_at).not.toBeNull();
  });

  test('listBooksDirtySince returns rows updated after the cursor, including deleted', async () => {
    const db = await setup();
    const a = await Books.createBook(db, { title: 'A' });
    const cursor = a.updated_at;
    await new Promise((r) => setTimeout(r, 5));
    const b = await Books.createBook(db, { title: 'B' });
    await Books.deleteBook(db, a.id);
    const dirty = await Books.listBooksDirtySince(db, cursor);
    const ids = dirty.map((x) => x.id).sort();
    expect(ids).toEqual([a.id, b.id].sort());
    expect(dirty.find((x) => x.id === a.id)?.deleted_at).not.toBeNull();
  });
});

describe('highlights sync fields', () => {
  test('createHighlight assigns remote_id', async () => {
    const db = await setup();
    const book = await Books.createBook(db, { title: 'A' });
    const h = await Highlights.createHighlight(db, { book_id: book.id, text: 'hi' });
    expect(h.remote_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('deleteHighlight soft-deletes and excludes from listings', async () => {
    const db = await setup();
    const book = await Books.createBook(db, { title: 'A' });
    const h = await Highlights.createHighlight(db, { book_id: book.id, text: 'hi' });
    await Highlights.deleteHighlight(db, h.id);
    expect(await Highlights.getHighlight(db, h.id)).toBeNull();
    expect(await Highlights.listHighlightsByBook(db, book.id)).toHaveLength(0);
  });

  test('search excludes soft-deleted highlights', async () => {
    const db = await setup();
    const book = await Books.createBook(db, { title: 'A' });
    const h = await Highlights.createHighlight(db, {
      book_id: book.id,
      text: 'pineapple sundae',
    });
    expect((await search(db, 'pineapple')).highlights).toHaveLength(1);
    await Highlights.deleteHighlight(db, h.id);
    expect((await search(db, 'pineapple')).highlights).toHaveLength(0);
  });

  test('listHighlightsDirtySince returns rows including tombstones', async () => {
    const db = await setup();
    const book = await Books.createBook(db, { title: 'A' });
    const h1 = await Highlights.createHighlight(db, { book_id: book.id, text: 'one' });
    const cursor = h1.updated_at;
    await new Promise((r) => setTimeout(r, 5));
    const h2 = await Highlights.createHighlight(db, { book_id: book.id, text: 'two' });
    await Highlights.deleteHighlight(db, h1.id);
    const dirty = await Highlights.listHighlightsDirtySince(db, cursor);
    const ids = dirty.map((x) => x.id).sort();
    expect(ids).toEqual([h1.id, h2.id].sort());
  });
});
