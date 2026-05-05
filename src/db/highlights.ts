import type { DbExec } from './client';
import type { Highlight, HighlightWithRelations, NewHighlightInput } from './types';
import { setHighlightTags, getTagsForHighlight } from './tags';
import { getBook } from './books';

async function hydrate(db: DbExec, h: Highlight): Promise<HighlightWithRelations> {
  const book = await getBook(db, h.book_id);
  if (!book) throw new Error(`Book ${h.book_id} missing for highlight ${h.id}`);
  const tags = await getTagsForHighlight(db, h.id);
  return { ...h, book, tags };
}

export async function createHighlight(
  db: DbExec,
  input: NewHighlightInput
): Promise<HighlightWithRelations> {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO highlights (book_id, text, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [input.book_id, input.text, input.note ?? null, now, now]
  );
  const id = result.lastInsertRowId;
  if (input.tag_names && input.tag_names.length > 0) {
    await setHighlightTags(db, id, input.tag_names);
  }
  const row = await db.getFirstAsync<Highlight>('SELECT * FROM highlights WHERE id = ?', [id]);
  if (!row) throw new Error(`Failed to load highlight ${id} after insert`);
  return hydrate(db, row);
}

export async function getHighlight(
  db: DbExec,
  id: number
): Promise<HighlightWithRelations | null> {
  const row = await db.getFirstAsync<Highlight>('SELECT * FROM highlights WHERE id = ?', [id]);
  if (!row) return null;
  return hydrate(db, row);
}

export async function listHighlightsByBook(
  db: DbExec,
  bookId: number
): Promise<HighlightWithRelations[]> {
  const rows = await db.getAllAsync<Highlight>(
    'SELECT * FROM highlights WHERE book_id = ? ORDER BY created_at DESC',
    [bookId]
  );
  return Promise.all(rows.map((r) => hydrate(db, r)));
}

export async function listHighlightsByTag(
  db: DbExec,
  tagName: string
): Promise<HighlightWithRelations[]> {
  const rows = await db.getAllAsync<Highlight>(
    `SELECT h.* FROM highlights h
     INNER JOIN highlight_tags ht ON ht.highlight_id = h.id
     INNER JOIN tags t ON t.id = ht.tag_id
     WHERE t.name = ?
     ORDER BY h.created_at DESC`,
    [tagName.trim().toLowerCase()]
  );
  return Promise.all(rows.map((r) => hydrate(db, r)));
}

export async function updateHighlight(
  db: DbExec,
  id: number,
  input: { text: string; note?: string | null; tag_names?: string[] }
): Promise<HighlightWithRelations> {
  const now = Date.now();
  await db.runAsync(
    'UPDATE highlights SET text = ?, note = ?, updated_at = ? WHERE id = ?',
    [input.text, input.note ?? null, now, id]
  );
  if (input.tag_names) {
    await setHighlightTags(db, id, input.tag_names);
  }
  const updated = await getHighlight(db, id);
  if (!updated) throw new Error(`Highlight ${id} not found after update`);
  return updated;
}

export async function deleteHighlight(db: DbExec, id: number): Promise<void> {
  await db.runAsync('DELETE FROM highlights WHERE id = ?', [id]);
}
