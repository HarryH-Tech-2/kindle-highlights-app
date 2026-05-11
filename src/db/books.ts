import type { DbExec } from './client';
import type { Book, NewBookInput } from './types';
import { uuidv4 } from '@/src/sync/uuid';

export async function createBook(db: DbExec, input: NewBookInput): Promise<Book> {
  const now = Date.now();
  const remoteId = uuidv4();
  const result = await db.runAsync(
    'INSERT INTO books (title, author, created_at, updated_at, remote_id) VALUES (?, ?, ?, ?, ?)',
    [input.title, input.author ?? null, now, now, remoteId]
  );
  return {
    id: result.lastInsertRowId,
    title: input.title,
    author: input.author ?? null,
    created_at: now,
    updated_at: now,
    remote_id: remoteId,
    deleted_at: null,
  };
}

export async function listBooks(db: DbExec): Promise<Book[]> {
  return db.getAllAsync<Book>(
    'SELECT * FROM books WHERE deleted_at IS NULL ORDER BY title COLLATE NOCASE ASC'
  );
}

export async function getBook(db: DbExec, id: number): Promise<Book | null> {
  return db.getFirstAsync<Book>(
    'SELECT * FROM books WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

// Sync helper: returns a book by id even if soft-deleted. Used by the sync
// orchestrator when serializing a tombstoned highlight whose parent book is
// also tombstoned, where listBooks/getBook would hide the row.
export async function getBookByIdIncludingDeleted(
  db: DbExec,
  id: number
): Promise<Book | null> {
  return db.getFirstAsync<Book>('SELECT * FROM books WHERE id = ?', [id]);
}

export async function updateBook(
  db: DbExec,
  id: number,
  input: { title: string; author: string | null }
): Promise<Book> {
  const now = Date.now();
  await db.runAsync('UPDATE books SET title = ?, author = ?, updated_at = ? WHERE id = ?', [
    input.title,
    input.author,
    now,
    id,
  ]);
  const updated = await getBook(db, id);
  if (!updated) throw new Error(`Book ${id} not found after update`);
  return updated;
}

// Soft delete: tombstone the row so the deletion can sync to other devices.
// Cascade the tombstone to child highlights so each one propagates as its own
// tombstone (the schema's ON DELETE CASCADE only fires for hard deletes).
export async function deleteBook(db: DbExec, id: number): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    'UPDATE highlights SET deleted_at = ?, updated_at = ? WHERE book_id = ? AND deleted_at IS NULL',
    [now, now, id]
  );
  await db.runAsync(
    'UPDATE books SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
}

// Sync helper: rows changed since the given high-water mark. Includes
// soft-deleted rows so tombstones propagate.
export async function listBooksDirtySince(db: DbExec, since: number): Promise<Book[]> {
  return db.getAllAsync<Book>(
    'SELECT * FROM books WHERE updated_at > ? ORDER BY updated_at ASC',
    [since]
  );
}
