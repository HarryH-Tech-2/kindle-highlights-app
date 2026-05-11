import type { DbExec } from './client';
import type { Book, HighlightStyle, HighlightWithRelations, Highlight } from './types';
import { getBook } from './books';
import { getTagsForHighlight } from './tags';

function parseStyle(raw: string | null): HighlightStyle | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object') return v as HighlightStyle;
  } catch {
    // Malformed JSON falls back to no style rather than crashing search.
  }
  return null;
}

export type SearchResult = { highlights: HighlightWithRelations[]; books: Book[] };

function ftsQuery(input: string): string {
  // Escape FTS5 syntax characters by quoting each token, then join with AND
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"`);
  return tokens.join(' ');
}

export async function search(db: DbExec, query: string): Promise<SearchResult> {
  const q = query.trim();
  if (!q) return { highlights: [], books: [] };

  const fts = ftsQuery(q);
  // FTS triggers don't track soft-deletes, so filter deleted_at here at query time.
  const highlightRows = await db.getAllAsync<Highlight>(
    `SELECT h.* FROM highlights h
     INNER JOIN highlights_fts ON highlights_fts.rowid = h.id
     WHERE highlights_fts MATCH ? AND h.deleted_at IS NULL
     ORDER BY h.created_at DESC`,
    [fts]
  );

  const highlights = await Promise.all(
    highlightRows.map(async (h) => {
      const book = await getBook(db, h.book_id);
      const tags = await getTagsForHighlight(db, h.id);
      return { ...h, book: book!, tags, styleParsed: parseStyle(h.style) };
    })
  );

  const books = await db.getAllAsync<Book>(
    'SELECT * FROM books WHERE title LIKE ? AND deleted_at IS NULL ORDER BY title COLLATE NOCASE ASC',
    [`%${q}%`]
  );

  return { highlights, books };
}
