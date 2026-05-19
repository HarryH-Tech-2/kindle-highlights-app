// Sync orchestrator. Owned by the Account screen and the cold-start hook in
// app/_layout.tsx. Single entry point: runSync(db, uid).
//
// Algorithm (last-write-wins, online-required):
//   1. Read the user's current subscription tier — we stamp it onto every doc
//      we push so the server can bucket free vs pro traffic. Free users are
//      capped at FREE_EXTRACTION_LIMIT highlights upstream of sync (in the
//      capture flow), so cost stays bounded.
//   2. Detect account switch: if the locally stored user id differs from the
//      one we're about to sync as, wipe all user-scoped local data (books,
//      highlights, tags, sync cursor). This keeps highlights private per
//      Google account — the new user starts with a clean slate and then
//      pulls their own data from Firestore.
//   3. Push: every row whose updated_at is strictly greater than the cursor
//      (including soft-deletes) goes up. Highlights serialize their parent
//      book's remote_id and the current set of tag names.
//   4. Pull: query Firestore for rows whose updated_at exceeds the same cursor.
//      For each, upsert into SQLite by remote_id. If the local row is newer,
//      we keep it (LWW). Tags are reconciled by re-running setHighlightTags
//      with the remote tag_names array.
//   5. Advance the cursor to "now" once both halves succeed.
//
// We deliberately use the local clock for the cursor (Date.now()), matching
// updated_at. This is fine for last-write-wins: even with clock skew the worst
// case is one round of redundant pulls. Server timestamps would tighten this
// but require schema-level FieldValue work that's not warranted yet.
//
// Cursor advances to the timestamp captured at *sync start*, not sync end.
// This guarantees that any row modified during the sync window (or at the
// exact millisecond the sync ended) will be re-evaluated next time. The
// trade-off is that rows just pushed in this sync may be re-pushed once next
// time, but `merge: true` makes that idempotent.

import type { DbExec } from '@/src/db/client';
import type { Book, Highlight, Tag } from '@/src/db/types';
import * as Meta from '@/src/db/meta';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import * as Tags from '@/src/db/tags';
import {
  pushBooks,
  pullBooksSince,
  pushHighlights,
  pullHighlightsSince,
  pushTags,
  pullTagsSince,
  type RemoteBook,
  type RemoteHighlight,
  type RemoteTag,
  type Tier,
} from './firestore';
import { emitSyncCompleted } from './events';
import { uuidv4 } from './uuid';

export type SyncResult = {
  pushed: number;
  pulled: number;
  finishedAt: number;
};

export async function runSync(db: DbExec, uid: string): Promise<SyncResult> {
  if (!uid) throw new Error('runSync requires a signed-in user id');
  const tier: Tier = (await Meta.isSubscribed(db)) ? 'pro' : 'free';
  const startedAt = Date.now();

  // Detect account switches by comparing the uid we're about to sync as
  // against whatever we last synced as. A mismatch with a previously-known
  // uid means the local DB still holds another user's books/highlights/tags;
  // if we left those in place they would (a) be visible to the new account
  // in the UI and (b) get pushed up to the new account's Firestore on the
  // next push. Wipe everything user-scoped (which includes the sync cursor)
  // before re-stamping the current user id.
  //
  // The `lastUid !== null` guard avoids wiping on the very first sync after
  // install, when the user may have already created highlights while signing
  // in for the first time. Only an actual switch between two distinct uids
  // should trigger the wipe.
  const lastUid = await Meta.getCurrentUserId(db);
  if (lastUid !== null && lastUid !== uid) {
    await Meta.wipeUserScopedData(db);
  }
  if (lastUid !== uid) {
    await Meta.setCurrentUserId(db, uid);
  }
  const since = await Meta.getLastSyncedAt(db);

  // ---- PUSH ----
  // Tags push first so receivers that pull tags-then-highlights don't observe
  // a window where a highlight references a tag name we haven't shipped the
  // standalone tag row for yet. Tag rows are cheap (name + timestamps).
  const dirtyTags = await Tags.listTagsDirtySince(db, since);
  const dirtyBooks = await Books.listBooksDirtySince(db, since);
  const dirtyHighlights = await Highlights.listHighlightsDirtySince(db, since);

  // Backfill remote_id for any pre-sync rows that were created before this
  // feature shipped. Without this, rows with NULL remote_id would silently
  // skip the push.
  const booksToPush = await Promise.all(dirtyBooks.map((b) => ensureRemoteId(db, 'books', b)));
  const highlightsToPush = await Promise.all(
    dirtyHighlights.map((h) => ensureRemoteId(db, 'highlights', h))
  );
  const tagsToPush = await Promise.all(dirtyTags.map((t) => ensureTagRemoteId(db, t)));

  const remoteTags: RemoteTag[] = tagsToPush.map((t) => toRemoteTag(t, tier));
  const remoteBooks: RemoteBook[] = booksToPush.map((b) => toRemoteBook(b, tier));
  const remoteHighlights: RemoteHighlight[] = await Promise.all(
    highlightsToPush.map((h) => toRemoteHighlight(db, h, tier))
  );

  await pushTags(uid, remoteTags);
  await pushBooks(uid, remoteBooks);
  await pushHighlights(uid, remoteHighlights);

  // ---- PULL ----
  // Pull tags before highlights so applyRemoteHighlight's tag reconciliation
  // sees the freshest tag names — including tombstones we want to suppress.
  const pulledTags = await pullTagsSince(uid, since);
  const pulledBooks = await pullBooksSince(uid, since);
  const pulledHighlights = await pullHighlightsSince(uid, since);

  for (const rt of pulledTags) {
    await applyRemoteTag(db, rt);
  }
  for (const rb of pulledBooks) {
    await applyRemoteBook(db, rb);
  }
  for (const rh of pulledHighlights) {
    await applyRemoteHighlight(db, rh);
  }

  await Meta.setLastSyncedAt(db, startedAt);

  // Notify any subscribers (e.g. the Library screen that mounted while we
  // were still pulling) so they re-read from SQLite and the user's data
  // shows up without requiring a manual refresh.
  emitSyncCompleted();

  return {
    pushed: remoteBooks.length + remoteHighlights.length + remoteTags.length,
    pulled: pulledBooks.length + pulledHighlights.length + pulledTags.length,
    finishedAt: startedAt,
  };
}

// --- helpers ---------------------------------------------------------------

async function ensureRemoteId<T extends Book | Highlight>(
  db: DbExec,
  table: 'books' | 'highlights',
  row: T
): Promise<T & { remote_id: string }> {
  if (row.remote_id) return row as T & { remote_id: string };
  const id = uuidv4();
  await db.runAsync(`UPDATE ${table} SET remote_id = ? WHERE id = ?`, [id, row.id]);
  return { ...row, remote_id: id };
}

// Tags use their lowercased name as remote_id rather than a uuid, so this
// helper backfills the column for any rows that predate the v4 migration
// (or somehow slipped in without a remote_id).
async function ensureTagRemoteId(
  db: DbExec,
  row: Tag
): Promise<Tag & { remote_id: string }> {
  if (row.remote_id) return row as Tag & { remote_id: string };
  await db.runAsync('UPDATE tags SET remote_id = name WHERE id = ?', [row.id]);
  return { ...row, remote_id: row.name };
}

function toRemoteTag(t: Tag & { remote_id: string }, tier: Tier): RemoteTag {
  return {
    remote_id: t.remote_id,
    name: t.name,
    created_at: t.created_at,
    updated_at: t.updated_at,
    deleted_at: t.deleted_at,
    tier,
  };
}

function toRemoteBook(b: Book & { remote_id: string }, tier: Tier): RemoteBook {
  return {
    remote_id: b.remote_id,
    title: b.title,
    author: b.author,
    created_at: b.created_at,
    updated_at: b.updated_at,
    deleted_at: b.deleted_at,
    tier,
  };
}

async function toRemoteHighlight(
  db: DbExec,
  h: Highlight & { remote_id: string },
  tier: Tier
): Promise<RemoteHighlight> {
  // Look up parent book without filtering soft-deletes — a highlight tombstone
  // can outlive its book tombstone in the dirty list, but we still need the
  // parent's remote_id to serialize the doc.
  const book = await Books.getBookByIdIncludingDeleted(db, h.book_id);
  if (!book) {
    throw new Error(`Highlight ${h.id} references missing book ${h.book_id}`);
  }
  // book.remote_id may be null for pre-v2 rows; assign one on the fly.
  const bookRemoteId =
    book.remote_id ?? (await ensureRemoteId(db, 'books', book)).remote_id;
  const tags = await Tags.getTagsForHighlight(db, h.id);
  return {
    remote_id: h.remote_id,
    book_remote_id: bookRemoteId,
    text: h.text,
    note: h.note,
    tag_names: tags.map((t) => t.name),
    style: h.style ?? null,
    created_at: h.created_at,
    updated_at: h.updated_at,
    deleted_at: h.deleted_at,
    tier,
  };
}

async function applyRemoteTag(db: DbExec, rt: RemoteTag): Promise<void> {
  // Tag identity is the name, so we look up by name (not remote_id) — that
  // also catches local rows created by setHighlightTags before the standalone
  // tag arrived, and dedupes them under the same canonical row.
  const existing = await db.getFirstAsync<{ id: number; updated_at: number }>(
    'SELECT id, updated_at FROM tags WHERE name = ?',
    [rt.name]
  );
  if (!existing) {
    await db.runAsync(
      'INSERT INTO tags (name, remote_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?)',
      [rt.name, rt.remote_id, rt.created_at, rt.updated_at, rt.deleted_at]
    );
    return;
  }
  if (rt.updated_at < existing.updated_at) return; // local newer — keep
  // If the remote is a tombstone, drop the join rows so the tag disappears
  // from every highlight on this device immediately.
  if (rt.deleted_at != null) {
    await db.runAsync('DELETE FROM highlight_tags WHERE tag_id = ?', [existing.id]);
  }
  await db.runAsync(
    'UPDATE tags SET remote_id = ?, updated_at = ?, deleted_at = ? WHERE id = ?',
    [rt.remote_id, rt.updated_at, rt.deleted_at, existing.id]
  );
}

async function applyRemoteBook(db: DbExec, rb: RemoteBook): Promise<void> {
  const existing = await db.getFirstAsync<{ id: number; updated_at: number }>(
    'SELECT id, updated_at FROM books WHERE remote_id = ?',
    [rb.remote_id]
  );
  if (!existing) {
    await db.runAsync(
      'INSERT INTO books (remote_id, title, author, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)',
      [rb.remote_id, rb.title, rb.author, rb.created_at, rb.updated_at, rb.deleted_at]
    );
    return;
  }
  if (rb.updated_at < existing.updated_at) return; // local newer — keep
  await db.runAsync(
    'UPDATE books SET title = ?, author = ?, updated_at = ?, deleted_at = ? WHERE id = ?',
    [rb.title, rb.author, rb.updated_at, rb.deleted_at, existing.id]
  );
}

async function applyRemoteHighlight(db: DbExec, rh: RemoteHighlight): Promise<void> {
  // Resolve (or auto-insert) the parent book. If a highlight arrives before its
  // book, we create a placeholder so the FK is satisfied; the real book row
  // will overwrite the placeholder when its own pull arrives.
  let book = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM books WHERE remote_id = ?',
    [rh.book_remote_id]
  );
  if (!book) {
    const r = await db.runAsync(
      'INSERT INTO books (remote_id, title, author, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [rh.book_remote_id, '(unknown)', null, rh.created_at, rh.updated_at]
    );
    book = { id: r.lastInsertRowId };
  }

  const existing = await db.getFirstAsync<{ id: number; updated_at: number }>(
    'SELECT id, updated_at FROM highlights WHERE remote_id = ?',
    [rh.remote_id]
  );

  // Older remote docs may not have the `style` field; treat that as null
  // rather than overwriting any locally-set style with `undefined`.
  const remoteStyle = rh.style ?? null;

  let hid: number;
  if (!existing) {
    const r = await db.runAsync(
      'INSERT INTO highlights (remote_id, book_id, text, note, style, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [rh.remote_id, book.id, rh.text, rh.note, remoteStyle, rh.created_at, rh.updated_at, rh.deleted_at]
    );
    hid = r.lastInsertRowId;
  } else {
    if (rh.updated_at < existing.updated_at) return; // local newer — keep
    await db.runAsync(
      'UPDATE highlights SET text = ?, note = ?, style = ?, updated_at = ?, deleted_at = ? WHERE id = ?',
      [rh.text, rh.note, remoteStyle, rh.updated_at, rh.deleted_at, existing.id]
    );
    hid = existing.id;
  }

  // Tag reconciliation. setHighlightTags rebuilds the join rows from the array,
  // so a remote with [] correctly clears tags locally.
  await Tags.setHighlightTags(db, hid, rh.tag_names);
}
