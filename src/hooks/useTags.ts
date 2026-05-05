import { useCallback, useEffect, useState } from 'react';
import { getDb } from '@/src/db/client';
import * as Tags from '@/src/db/tags';
import type { Tag } from '@/src/db/types';

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const refresh = useCallback(async () => {
    const db = await getDb();
    setTags(await Tags.listTags(db));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { tags, refresh };
}

export function useTagsWithCounts() {
  const [tags, setTags] = useState<Array<{ id: number; name: string; count: number }>>([]);
  const refresh = useCallback(async () => {
    const db = await getDb();
    setTags(await Tags.listTagsWithCounts(db));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { tags, refresh };
}
