import { createBook, listBooks, getBook, updateBook, deleteBook } from '../../src/db/books';
import { runMigrations } from '../../src/db/schema';
import { openTestDb } from './testDb';

async function setup() {
  const db = openTestDb();
  await runMigrations(db);
  return db;
}

describe('books', () => {
  test('create returns the new book with an id', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'Atomic Habits', author: 'James Clear' });
    expect(book.id).toBeGreaterThan(0);
    expect(book.title).toBe('Atomic Habits');
    expect(book.author).toBe('James Clear');
    expect(typeof book.created_at).toBe('number');
  });

  test('create allows null author', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'Untitled' });
    expect(book.author).toBeNull();
  });

  test('list returns books ordered by title', async () => {
    const db = await setup();
    await createBook(db, { title: 'Charlie' });
    await createBook(db, { title: 'Alpha' });
    await createBook(db, { title: 'Bravo' });
    const list = await listBooks(db);
    expect(list.map((b) => b.title)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  test('get returns null for unknown id', async () => {
    const db = await setup();
    expect(await getBook(db, 999)).toBeNull();
  });

  test('update changes title and author', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'Old', author: null });
    const updated = await updateBook(db, book.id, { title: 'New', author: 'Author' });
    expect(updated.title).toBe('New');
    expect(updated.author).toBe('Author');
  });

  test('delete removes the book', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'Doomed' });
    await deleteBook(db, book.id);
    expect(await getBook(db, book.id)).toBeNull();
  });
});
