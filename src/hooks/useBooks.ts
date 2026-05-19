import { useCallback, useEffect, useState } from 'react';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import { scheduleSync } from '@/src/sync/scheduler';
import type { Book, NewBookInput } from '@/src/db/types';

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setBooks(await Books.listBooks(db));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (input: NewBookInput) => {
    const db = await getDb();
    const book = await Books.createBook(db, input);
    await refresh();
    scheduleSync();
    return book;
  }, [refresh]);

  return { books, loading, refresh, create };
}
