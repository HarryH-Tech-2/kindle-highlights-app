import { runMigrations } from '@/src/db/schema';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import * as Meta from '@/src/db/meta';
import { makeTestDb } from '@/src/db/test-helpers';
import { _setFirestoreForTests } from '../firestore';
import { makeFakeFirestore, type FakeFirestore } from '../fake-firestore';
import { runSync } from '../sync';
import type { DbExec } from '@/src/db/client';

let fake: FakeFirestore;
let db: DbExec;

async function setup(): Promise<void> {
  ({ db } = makeTestDb());
  await runMigrations(db);
  fake = makeFakeFirestore();
  _setFirestoreForTests(fake as unknown as Parameters<typeof _setFirestoreForTests>[0]);
  await Meta.setSubscribed(db, true);
}

afterEach(() => {
  _setFirestoreForTests(null);
});

describe('runSync — guards', () => {
  test('throws on empty uid', async () => {
    await setup();
    await expect(runSync(db, '')).rejects.toThrow(/signed-in user/);
  });
});

describe('runSync — tier stamping', () => {
  test('pushes with tier="free" for unsubscribed users', async () => {
    ({ db } = makeTestDb());
    await runMigrations(db);
    fake = makeFakeFirestore();
    _setFirestoreForTests(fake as unknown as Parameters<typeof _setFirestoreForTests>[0]);
    // No setSubscribed call — defaults to free.
    const book = await Books.createBook(db, { title: 'A' });
    await Highlights.createHighlight(db, { book_id: book.id, text: 'hi' });
    await runSync(db, 'u1');
    const remoteBooks = fake.__collections.get('users/u1/books')!;
    const remoteHighlights = fake.__collections.get('users/u1/highlights')!;
    const b = Array.from(remoteBooks.values())[0] as { tier: string };
    const h = Array.from(remoteHighlights.values())[0] as { tier: string };
    expect(b.tier).toBe('free');
    expect(h.tier).toBe('free');
  });

  test('pushes with tier="pro" for subscribed users', async () => {
    await setup(); // setup() sets subscribed = true
    const book = await Books.createBook(db, { title: 'A' });
    await Highlights.createHighlight(db, { book_id: book.id, text: 'hi' });
    await runSync(db, 'u1');
    const remoteHighlights = fake.__collections.get('users/u1/highlights')!;
    const h = Array.from(remoteHighlights.values())[0] as { tier: string };
    expect(h.tier).toBe('pro');
  });
});

describe('runSync — push', () => {
  test('pushes locally created book + highlight to Firestore', async () => {
    await setup();
    const book = await Books.createBook(db, { title: 'A' });
    await Highlights.createHighlight(db, { book_id: book.id, text: 'hi', tag_names: ['focus'] });
    const result = await runSync(db, 'u1');
    expect(result.pushed).toBe(2);
    const remoteBooks = fake.__collections.get('users/u1/books');
    const remoteHighlights = fake.__collections.get('users/u1/highlights');
    expect(remoteBooks?.size).toBe(1);
    expect(remoteHighlights?.size).toBe(1);
    const hl = Array.from(remoteHighlights!.values())[0] as { tag_names: string[] };
    expect(hl.tag_names).toEqual(['focus']);
  });

  test('pushes tombstones for soft-deleted rows', async () => {
    await setup();
    const book = await Books.createBook(db, { title: 'A' });
    const h = await Highlights.createHighlight(db, { book_id: book.id, text: 'hi' });
    await runSync(db, 'u1');
    await Highlights.deleteHighlight(db, h.id);
    await runSync(db, 'u1');
    const remoteHighlights = fake.__collections.get('users/u1/highlights')!;
    const remote = Array.from(remoteHighlights.values())[0] as { deleted_at: number | null };
    expect(remote.deleted_at).not.toBeNull();
  });

  test('does not re-push rows after the cursor advances', async () => {
    await setup();
    const book = await Books.createBook(db, { title: 'A' });
    await Highlights.createHighlight(db, { book_id: book.id, text: 'hi' });
    await runSync(db, 'u1');
    const result = await runSync(db, 'u1');
    expect(result.pushed).toBe(0);
  });
});

describe('runSync — pull', () => {
  test('inserts a remote book that does not exist locally', async () => {
    await setup();
    // Seed the remote side directly via the fake.
    const col = fake.__collections;
    col.set(
      'users/u1/books',
      new Map([
        [
          'rb1',
          {
            remote_id: 'rb1',
            title: 'Remote',
            author: 'X',
            created_at: 1,
            updated_at: 1000,
            deleted_at: null,
          },
        ],
      ])
    );
    await runSync(db, 'u1');
    const local = await Books.listBooks(db);
    expect(local.map((b) => b.title)).toEqual(['Remote']);
    expect(local[0].remote_id).toBe('rb1');
  });

  test('soft-deletes a local row when the remote tombstone arrives', async () => {
    await setup();
    const book = await Books.createBook(db, { title: 'Local' });
    await runSync(db, 'u1'); // get it remote
    // Now simulate another device deleting it: bump updated_at + set deleted_at.
    const remoteBooks = fake.__collections.get('users/u1/books')!;
    const existing = remoteBooks.get(book.remote_id!) as Record<string, unknown>;
    remoteBooks.set(book.remote_id!, {
      ...existing,
      updated_at: Date.now() + 10_000,
      deleted_at: Date.now() + 10_000,
    });
    await runSync(db, 'u1');
    expect(await Books.getBook(db, book.id)).toBeNull();
  });

  test('LWW: keeps local row when local updated_at is newer than remote', async () => {
    await setup();
    const book = await Books.createBook(db, { title: 'Local' });
    // Inject an older "remote" version of this same book.
    const col = new Map();
    col.set('rb1', {
      remote_id: book.remote_id, // same id
      title: 'Stale Remote',
      author: null,
      created_at: 1,
      updated_at: book.updated_at - 1000, // older
      deleted_at: null,
    });
    fake.__collections.set('users/u1/books', col);
    await runSync(db, 'u1');
    const reloaded = await Books.getBook(db, book.id);
    expect(reloaded?.title).toBe('Local');
  });

  test('account switch wipes the previous user\'s local data', async () => {
    await setup();
    const book = await Books.createBook(db, { title: 'A' });
    await Highlights.createHighlight(db, {
      book_id: book.id,
      text: 'u1 secret',
      tag_names: ['private'],
    });
    await runSync(db, 'u1');
    // Sign in as u2; u1's local books/highlights/tags should be gone and
    // only u2's remote data should come down.
    fake.__collections.set(
      'users/u2/books',
      new Map([
        [
          'rb-u2',
          {
            remote_id: 'rb-u2',
            title: 'For U2',
            author: null,
            created_at: 1,
            updated_at: 5,
            deleted_at: null,
          },
        ],
      ])
    );
    await runSync(db, 'u2');
    const titles = (await Books.listBooks(db)).map((b) => b.title).sort();
    expect(titles).toEqual(['For U2']);
    expect(await Highlights.listAllHighlights(db)).toHaveLength(0);
    // And u1's Firestore docs were not re-pushed under u2 (which would have
    // happened if we'd only reset the cursor without wiping local data).
    expect(fake.__collections.get('users/u2/books')?.size).toBe(1);
    expect(fake.__collections.get('users/u2/highlights')?.size ?? 0).toBe(0);
  });

  test('reconciles tags from remote tag_names array', async () => {
    await setup();
    const book = await Books.createBook(db, { title: 'A' });
    const h = await Highlights.createHighlight(db, {
      book_id: book.id,
      text: 'hi',
      tag_names: ['old1', 'old2'],
    });
    await runSync(db, 'u1');
    // Remote replaces tags. Bump updated_at past the cursor so PULL picks it up.
    const remoteHighlights = fake.__collections.get('users/u1/highlights')!;
    const existing = remoteHighlights.get(h.remote_id!) as Record<string, unknown>;
    remoteHighlights.set(h.remote_id!, {
      ...existing,
      tag_names: ['new1'],
      updated_at: Date.now() + 10_000,
    });
    await runSync(db, 'u1');
    const reloaded = await Highlights.getHighlight(db, h.id);
    expect(reloaded?.tags.map((t) => t.name)).toEqual(['new1']);
  });
});
