import type { DbExec } from './client';
import type { Tag } from './types';

export async function upsertTagByName(db: DbExec, name: string): Promise<Tag> {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) throw new Error('Tag name cannot be empty');
  const now = Date.now();
  // Use the (lowercased) name as the remote_id — tag identity *is* the name,
  // both in the local UNIQUE constraint and in Firestore. Two devices that
  // mint the same tag therefore push to the same doc instead of creating
  // duplicate ones. INSERT OR IGNORE means the timestamps are only stamped
  // on first creation, not bumped on subsequent re-references.
  await db.runAsync(
    'INSERT OR IGNORE INTO tags (name, remote_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [trimmed, trimmed, now, now]
  );
  // If a row exists from before migration v4 (or somehow without remote_id),
  // backfill it so sync can pick it up. Cheap idempotent UPDATE.
  await db.runAsync(
    `UPDATE tags
       SET remote_id = COALESCE(remote_id, name),
           created_at = CASE WHEN created_at = 0 THEN ? ELSE created_at END,
           updated_at = CASE WHEN updated_at = 0 THEN ? ELSE updated_at END
     WHERE name = ?`,
    [now, now, trimmed]
  );
  const tag = await db.getFirstAsync<Tag>('SELECT * FROM tags WHERE name = ?', [trimmed]);
  if (!tag) throw new Error(`Failed to upsert tag ${trimmed}`);
  return tag;
}

export async function listTags(db: DbExec): Promise<Tag[]> {
  return db.getAllAsync<Tag>(
    'SELECT * FROM tags WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC'
  );
}

// Soft-delete a tag so the tombstone can sync. Also drops join rows so the
// tag immediately disappears from highlights' tag lists. We don't delete
// the tag row outright — sync needs the tombstone to propagate.
export async function deleteTag(db: DbExec, id: number): Promise<void> {
  const now = Date.now();
  await db.runAsync('DELETE FROM highlight_tags WHERE tag_id = ?', [id]);
  await db.runAsync(
    'UPDATE tags SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
}

// Sync helper: tags changed since the high-water mark (including tombstones).
export async function listTagsDirtySince(db: DbExec, since: number): Promise<Tag[]> {
  return db.getAllAsync<Tag>(
    'SELECT * FROM tags WHERE updated_at > ? ORDER BY updated_at ASC',
    [since]
  );
}

export async function listTagsWithCounts(
  db: DbExec
): Promise<Array<{ id: number; name: string; count: number }>> {
  // LEFT JOIN so tags with zero highlights still appear (the user might create
  // a tag from the Tags tab before attaching it to anything). The COUNT must
  // ignore both the unmatched LEFT-JOIN row (h.id IS NULL) AND soft-deleted
  // highlights so the number matches what the user sees on the tag detail
  // page. A previous version counted the unmatched row as 1, which made every
  // orphan tag display "1 highlight" — exactly the symptom this fixes.
  return db.getAllAsync(
    `SELECT t.id, t.name,
            COUNT(CASE WHEN h.id IS NOT NULL AND h.deleted_at IS NULL THEN 1 END) AS count
     FROM tags t
     LEFT JOIN highlight_tags ht ON ht.tag_id = t.id
     LEFT JOIN highlights h ON h.id = ht.highlight_id
     WHERE t.deleted_at IS NULL
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
