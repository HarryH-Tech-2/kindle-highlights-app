import type { DbExec } from './client';
import type { Tag } from './types';

export async function upsertTagByName(db: DbExec, name: string): Promise<Tag> {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) throw new Error('Tag name cannot be empty');
  await db.runAsync('INSERT OR IGNORE INTO tags (name) VALUES (?)', [trimmed]);
  const tag = await db.getFirstAsync<Tag>('SELECT * FROM tags WHERE name = ?', [trimmed]);
  if (!tag) throw new Error(`Failed to upsert tag ${trimmed}`);
  return tag;
}

export async function listTags(db: DbExec): Promise<Tag[]> {
  return db.getAllAsync<Tag>('SELECT * FROM tags ORDER BY name COLLATE NOCASE ASC');
}

export async function listTagsWithCounts(
  db: DbExec
): Promise<Array<{ id: number; name: string; count: number }>> {
  return db.getAllAsync(
    `SELECT t.id, t.name, COUNT(ht.highlight_id) AS count
     FROM tags t
     INNER JOIN highlight_tags ht ON ht.tag_id = t.id
     GROUP BY t.id, t.name
     ORDER BY count DESC, t.name COLLATE NOCASE ASC`
  );
}

export async function setHighlightTags(
  db: DbExec,
  highlightId: number,
  tagNames: string[]
): Promise<void> {
  const cleaned = Array.from(
    new Set(tagNames.map((n) => n.trim().toLowerCase()).filter((n) => n.length > 0))
  );
  await db.runAsync('DELETE FROM highlight_tags WHERE highlight_id = ?', [highlightId]);
  for (const name of cleaned) {
    const tag = await upsertTagByName(db, name);
    await db.runAsync(
      'INSERT OR IGNORE INTO highlight_tags (highlight_id, tag_id) VALUES (?, ?)',
      [highlightId, tag.id]
    );
  }
}

export async function getTagsForHighlight(db: DbExec, highlightId: number): Promise<Tag[]> {
  return db.getAllAsync<Tag>(
    `SELECT t.* FROM tags t
     INNER JOIN highlight_tags ht ON ht.tag_id = t.id
     WHERE ht.highlight_id = ?
     ORDER BY t.name COLLATE NOCASE ASC`,
    [highlightId]
  );
}
