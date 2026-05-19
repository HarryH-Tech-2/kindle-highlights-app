// Thin wrapper around @react-native-firebase/firestore. Mirrors the lazy-require
// pattern used in src/billing.ts so the JS bundle keeps loading on dev clients
// where the native module isn't yet present (e.g. before the next EAS build).
//
// Document shape choices:
//   - `remote_id` is the document ID — Firestore's path is the source of truth
//     for identity, so we never need server-side dedupe.
//   - Tags sync two ways. (1) Each highlight carries a `tag_names: string[]`
//     so the highlight's tag list is self-contained — last writer wins per
//     highlight. (2) Tags themselves also sync as their own collection so
//     standalone tags (created on the Tags tab without being attached to
//     anything) survive sign-out and reach other devices. Tag identity is
//     the lowercased name, used both as the local UNIQUE key and the
//     Firestore doc id, so concurrent creators converge on one document.
//   - `deleted_at` is a tombstone, not a hard delete. Firestore docs are kept
//     so other devices can observe the deletion via their `updated_at > since`
//     query the next time they sync.
//   - `tier` records the user's subscription state at write time. It's metadata
//     for cost-bucketing and analytics on the server side — pulls ignore it.
//     A user who upgrades will have older docs stamped `'free'` and newer ones
//     `'pro'`; that's intentional, not a bug.

export type Tier = 'free' | 'pro';

export type RemoteBook = {
  remote_id: string;
  title: string;
  author: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  tier: Tier;
};

export type RemoteHighlight = {
  remote_id: string;
  book_remote_id: string;
  text: string;
  note: string | null;
  tag_names: string[];
  // Raw JSON blob mirroring the local `style` column. Optional on the wire
  // so older clients that wrote docs without the field still deserialize.
  style: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  tier: Tier;
};

export type RemoteTag = {
  remote_id: string;
  name: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  tier: Tier;
};

// Firestore enforces a 500-op limit per WriteBatch. Pick a slightly lower number
// for safety in case any operation generates implicit work.
const BATCH_LIMIT = 400;

type FirestoreDefaultExport = typeof import('@react-native-firebase/firestore').default;
type FirestoreInstance = ReturnType<FirestoreDefaultExport>;

let cached: FirestoreInstance | null = null;

function loadFirestore(): FirestoreInstance {
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-firebase/firestore') as {
    default: FirestoreDefaultExport;
  };
  cached = mod.default();
  return cached;
}

// Test seam: lets unit tests inject a fake Firestore implementation without
// having to install the native module under test. Pass null to clear.
export function _setFirestoreForTests(fake: FirestoreInstance | null): void {
  cached = fake;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function pushDocs<T extends { remote_id: string }>(
  uid: string,
  collection: 'books' | 'highlights' | 'tags',
  docs: T[]
): Promise<void> {
  if (docs.length === 0) return;
  const fs = loadFirestore();
  for (const part of chunk(docs, BATCH_LIMIT)) {
    const batch = fs.batch();
    for (const d of part) {
      const ref = fs.collection(`users/${uid}/${collection}`).doc(d.remote_id);
      batch.set(ref, d, { merge: true });
    }
    await batch.commit();
  }
}

async function pullDocs<T>(
  uid: string,
  collection: 'books' | 'highlights' | 'tags',
  since: number
): Promise<T[]> {
  const fs = loadFirestore();
  const snap = await fs
    .collection(`users/${uid}/${collection}`)
    .where('updated_at', '>', since)
    .get();
  return snap.docs.map((d) => d.data() as T);
}

export async function pushBooks(uid: string, books: RemoteBook[]): Promise<void> {
  return pushDocs(uid, 'books', books);
}

export async function pullBooksSince(uid: string, since: number): Promise<RemoteBook[]> {
  return pullDocs<RemoteBook>(uid, 'books', since);
}

export async function pushHighlights(
  uid: string,
  highlights: RemoteHighlight[]
): Promise<void> {
  return pushDocs(uid, 'highlights', highlights);
}

export async function pullHighlightsSince(
  uid: string,
  since: number
): Promise<RemoteHighlight[]> {
  return pullDocs<RemoteHighlight>(uid, 'highlights', since);
}

export async function pushTags(uid: string, tags: RemoteTag[]): Promise<void> {
  return pushDocs(uid, 'tags', tags);
}

export async function pullTagsSince(uid: string, since: number): Promise<RemoteTag[]> {
  return pullDocs<RemoteTag>(uid, 'tags', since);
}

// Hard-deletes every document under users/{uid}/{books,highlights,tags}.
// Used by the in-app "Delete account" flow — the user has explicitly asked
// for their cloud copy to disappear, so we drop the docs rather than write
// tombstones (which would defeat the point: tombstones still exist and
// would resurrect on a re-sign-in). The Firebase Auth user is deleted
// separately by the caller.
export async function deleteAllUserData(uid: string): Promise<void> {
  const fs = loadFirestore();
  for (const collection of ['books', 'highlights', 'tags'] as const) {
    const snap = await fs.collection(`users/${uid}/${collection}`).get();
    const refs = snap.docs.map((d) => d.ref);
    for (const part of chunk(refs, BATCH_LIMIT)) {
      const batch = fs.batch();
      for (const ref of part) batch.delete(ref);
      await batch.commit();
    }
  }
}
