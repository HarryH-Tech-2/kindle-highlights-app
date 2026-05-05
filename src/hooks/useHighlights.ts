import { useCallback, useEffect, useState } from 'react';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import type { HighlightWithRelations, NewHighlightInput } from '@/src/db/types';

export function useHighlightsByBook(bookId: number | null) {
  const [highlights, setHighlights] = useState<HighlightWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (bookId == null) { setHighlights([]); setLoading(false); return; }
    const db = await getDb();
    setHighlights(await Highlights.listHighlightsByBook(db, bookId));
    setLoading(false);
  }, [bookId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { highlights, loading, refresh };
}

export async function createHighlight(input: NewHighlightInput) {
  const db = await getDb();
  return Highlights.createHighlight(db, input);
}

export async function updateHighlight(
  id: number,
  input: { text: string; note?: string | null; tag_names?: string[] }
) {
  const db = await getDb();
  return Highlights.updateHighlight(db, id, input);
}

export async function deleteHighlight(id: number) {
  const db = await getDb();
  return Highlights.deleteHighlight(db, id);
}
