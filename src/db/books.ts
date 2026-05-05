import type { DbExec } from './client';
import type { Book, NewBookInput } from './types';

export async function createBook(db: DbExec, input: NewBookInput): Promise<Book> {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO books (title, author, created_at) VALUES (?, ?, ?)',
    [input.title, input.author ?? null, now]
  );
  return {
    id: result.lastInsertRowId,
    title: input.title,
    author: input.author ?? null,
    created_at: now
  };
}

export async function listBooks(db: DbExec): Promise<Book[]> {
  return db.getAllAsync<Book>('SELECT * FROM books ORDER BY title COLLATE NOCASE ASC');
}

export async function getBook(db: DbExec, id: number): Promise<Book | null> {
  return db.getFirstAsync<Book>('SELECT * FROM books WHERE id = ?', [id]);
}

export async function updateBook(
  db: DbExec,
  id: number,
  input: { title: string; author: string | null }
): Promise<Book> {
  await db.runAsync('UPDATE books SET title = ?, author = ? WHERE id = ?', [
    input.title,
    input.author,
    id
  ]);
  const updated = await getBook(db, id);
  if (!updated) throw new Error(`Book ${id} not found after update`);
  return updated;
}

export async function deleteBook(db: DbExec, id: number): Promise<void> {
  await db.runAsync('DELETE FROM books WHERE id = ?', [id]);
}
