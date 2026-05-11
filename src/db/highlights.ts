import type { DbExec } from './client';
import type { Highlight, HighlightStyle, HighlightWithRelations, NewHighlightInput } from './types';
import { setHighlightTags, getTagsForHighlight } from './tags';
import { getBook } from './books';
import { uuidv4 } from '@/src/sync/uuid';

function parseStyle(raw: string | null): HighlightStyle | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object') return v as HighlightStyle;
  } catch {
    // Malformed JSON (e.g. from a hand-edited DB) just falls back to null
    // rather than crashing the screen.
  }
  return null;
}

function serializeStyle(style: HighlightStyle | null | undefined): string | null {
  if (!style) return null;
  // Strip empty/default values so we don't persist `{}` as a meaningless blob.
  const trimmed: HighlightStyle = {};
  if (style.color) trimmed.color = style.color;
  if (style.italic) trimmed.italic = true;
  return Object.keys(trimmed).length > 0 ? JSON.stringify(trimmed) : null;
}

async function hydrate(db: DbExec, h: Highlight): Promise<HighlightWithRelations> {
  const book = await getBook(db, h.book_id);
  if (!book) throw new Error(`Book ${h.book_id} missing for highlight ${h.id}`);
  const tags = await getTagsForHighlight(db, h.id);
  return { ...h, book, tags, styleParsed: parseStyle(h.style) };
}

export async function createHighlight(
  db: DbExec,
  input: NewHighlightInput
): Promise<HighlightWithRelations> {
  const now = Date.now();
  const remoteId = uuidv4();
  const styleJson = serializeStyle(input.style);
  const result = await db.runAsync(
    'INSERT INTO highlights (book_id, text, note, created_at, updated_at, remote_id, style) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [input.book_id, input.text, input.note ?? null, now, now, remoteId, styleJson]
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
  const row = await db.getFirstAsync<Highlight>(
    'SELECT * FROM highlights WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  if (!row) return null;
  return hydrate(db, row);
}

// Library default — all non-deleted highlights, newest first. Used by the
// home screen's "Your highlights" feed.
export async function listAllHighlights(
  db: DbExec
): Promise<HighlightWithRelations[]> {
  const rows = await db.getAllAsync<Highlight>(
    'SELECT * FROM highlights WHERE deleted_at IS NULL ORDER BY created_at DESC'
  );
  return Promise.all(rows.map((r) => hydrate(db, r)));
}

export async function listHighlightsByBook(
  db: DbExec,
  bookId: number
): Promise<HighlightWithRelations[]> {
  const rows = await db.getAllAsync<Highlight>(
    'SELECT * FROM highlights WHERE book_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
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
     WHERE t.name = ? AND h.deleted_at IS NULL
     ORDER BY h.created_at DESC`,
    [tagName.trim().toLowerCase()]
  );
  return Promise.all(rows.map((r) => hydrate(db, r)));
}

export async function updateHighlight(
  db: DbExec,
  id: number,
  input: {
    text: string;
    note?: string | null;
    tag_names?: string[];
    // `undefined` means "leave style untouched"; passing `null` clears it.
    style?: HighlightStyle | null;
  }
): Promise<HighlightWithRelations> {
  const now = Date.now();
  if (input.style === undefined) {
    await db.runAsync(
      'UPDATE highlights SET text = ?, note = ?, updated_at = ? WHERE id = ?',
      [input.text, input.note ?? null, now, id]
    );
  } else {
    await db.runAsync(
      'UPDATE highlights SET text = ?, note = ?, style = ?, updated_at = ? WHERE id = ?',
      [input.text, input.note ?? null, serializeStyle(input.style), now, id]
    );
  }
  if (input.tag_names) {
    await setHighlightTags(db, id, input.tag_names);
  }
  const updated = await getHighlight(db, id);
  if (!updated) throw new Error(`Highlight ${id} not found after update`);
  return updated;
}

// Soft delete: keep the row so the tombstone can sync, but treat it as deleted
// for all reads.
export async function deleteHighlight(db: DbExec, id: number): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    'UPDATE highlights SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
}

// Sync helper: rows changed since the given high-water mark, including
// soft-deleted ones so tombstones propagate. Returns raw rows (no hydration)
// since the sync layer reads tags via Tags.getTagsForHighlight directly.
export async function listHighlightsDirtySince(
  db: DbExec,
  since: number
): Promise<Highlight[]> {
  return db.getAllAsync<Highlight>(
    'SELECT * FROM highlights WHERE updated_at > ? ORDER BY updated_at ASC',
    [since]
  );
}
