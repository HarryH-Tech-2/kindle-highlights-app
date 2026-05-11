import {
  pushBooks,
  pullBooksSince,
  pushHighlights,
  pullHighlightsSince,
  _setFirestoreForTests,
  type RemoteBook,
  type RemoteHighlight,
} from '../firestore';
import { makeFakeFirestore, type FakeFirestore } from '../fake-firestore';

let fake: FakeFirestore;

beforeEach(() => {
  fake = makeFakeFirestore();
  // Cast: the fake intentionally implements only the surface we use.
  _setFirestoreForTests(fake as unknown as Parameters<typeof _setFirestoreForTests>[0]);
});

afterEach(() => {
  _setFirestoreForTests(null);
});

const BOOK = (over: Partial<RemoteBook> = {}): RemoteBook => ({
  remote_id: 'b1',
  title: 'Atomic Habits',
  author: 'James Clear',
  created_at: 1000,
  updated_at: 1000,
  deleted_at: null,
  ...over,
});

const HL = (over: Partial<RemoteHighlight> = {}): RemoteHighlight => ({
  remote_id: 'h1',
  book_remote_id: 'b1',
  text: 'hello',
  note: null,
  tag_names: [],
  style: null,
  created_at: 1000,
  updated_at: 1000,
  deleted_at: null,
  ...over,
});

describe('pushBooks', () => {
  test('writes docs into users/{uid}/books keyed by remote_id', async () => {
    await pushBooks('u1', [BOOK({ remote_id: 'b1' }), BOOK({ remote_id: 'b2', title: 'X' })]);
    const col = fake.__collections.get('users/u1/books');
    expect(col?.size).toBe(2);
    expect(col?.get('b1')?.title).toBe('Atomic Habits');
    expect(col?.get('b2')?.title).toBe('X');
  });

  test('no-ops on empty array', async () => {
    await pushBooks('u1', []);
    expect(fake.__collections.size).toBe(0);
  });

  test('handles batches over 400 by chunking', async () => {
    const many = Array.from({ length: 850 }, (_, i) => BOOK({ remote_id: `b${i}` }));
    await pushBooks('u1', many);
    expect(fake.__collections.get('users/u1/books')?.size).toBe(850);
  });
});

describe('pullBooksSince', () => {
  test('returns only docs with updated_at strictly greater than the cursor', async () => {
    await pushBooks('u1', [
      BOOK({ remote_id: 'old', updated_at: 100 }),
      BOOK({ remote_id: 'edge', updated_at: 200 }),
      BOOK({ remote_id: 'new', updated_at: 300 }),
    ]);
    const got = await pullBooksSince('u1', 200);
    expect(got.map((b) => b.remote_id)).toEqual(['new']);
  });

  test('scopes by user', async () => {
    await pushBooks('u1', [BOOK({ remote_id: 'b1', updated_at: 500 })]);
    await pushBooks('u2', [BOOK({ remote_id: 'b2', updated_at: 500 })]);
    const u1 = await pullBooksSince('u1', 0);
    expect(u1.map((b) => b.remote_id)).toEqual(['b1']);
  });
});

describe('pushHighlights / pullHighlightsSince', () => {
  test('roundtrips a highlight with tag_names', async () => {
    await pushHighlights('u1', [
      HL({ remote_id: 'h1', tag_names: ['focus', 'habit'], updated_at: 500 }),
    ]);
    const got = await pullHighlightsSince('u1', 0);
    expect(got).toHaveLength(1);
    expect(got[0].tag_names).toEqual(['focus', 'habit']);
  });

  test('tombstones (deleted_at set) round-trip just like live docs', async () => {
    await pushHighlights('u1', [HL({ remote_id: 'h1', updated_at: 500, deleted_at: 600 })]);
    const got = await pullHighlightsSince('u1', 0);
    expect(got[0].deleted_at).toBe(600);
  });
});
