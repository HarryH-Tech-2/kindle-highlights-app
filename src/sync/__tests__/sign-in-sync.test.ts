// Integration test for the sign-in → upload-highlights wire-up.
//
// app/_layout.tsx subscribes to onAuthStateChanged and, on every signed-in
// callback, invokes runSync(db, u.uid). The individual pieces have their own
// suites (firebase.test.ts, sync.test.ts), but this test exercises the
// hand-off between them so a regression in either side surfaces here.

import { runMigrations } from '@/src/db/schema';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import { makeTestDb } from '@/src/db/test-helpers';
import type { DbExec } from '@/src/db/client';

import { _setFirestoreForTests } from '../firestore';
import { makeFakeFirestore, type FakeFirestore } from '../fake-firestore';
import { runSync } from '../sync';
import {
  _setAuthForTests,
  onAuthStateChanged,
  signInWithGoogle,
} from '@/src/auth/firebase';

type FakeUser = { uid: string; email: string | null; displayName: string | null };

function makeAuthFakes(initialUser: FakeUser | null = null) {
  let currentUser: FakeUser | null = initialUser;
  const listeners: ((u: FakeUser | null) => void)[] = [];

  const auth = {
    get currentUser() {
      return currentUser;
    },
    signInWithCredential: jest.fn(async () => {
      currentUser = { uid: 'u-signed-in', email: 'a@b.com', displayName: 'A' };
      listeners.forEach((l) => l(currentUser));
      return { user: currentUser };
    }),
    signOut: jest.fn(async () => {
      currentUser = null;
      listeners.forEach((l) => l(null));
    }),
    onAuthStateChanged: (cb: (u: FakeUser | null) => void) => {
      listeners.push(cb);
      cb(currentUser);
      return () => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };

  const authModule = Object.assign(jest.fn(() => auth), {
    GoogleAuthProvider: { credential: (idToken: string) => ({ idToken }) },
  });

  const google = {
    GoogleSignin: {
      configure: jest.fn(),
      hasPlayServices: jest.fn(async () => true),
      signIn: jest.fn(async () => ({ data: { idToken: 'tok-1' } })),
      signOut: jest.fn(async () => undefined),
    },
    statusCodes: {},
  };

  return { auth, authModule, google };
}

let db: DbExec;
let fake: FakeFirestore;

beforeEach(async () => {
  ({ db } = makeTestDb());
  await runMigrations(db);
  fake = makeFakeFirestore();
  _setFirestoreForTests(fake as unknown as Parameters<typeof _setFirestoreForTests>[0]);
});

afterEach(() => {
  _setFirestoreForTests(null);
  _setAuthForTests({
    authModule: null,
    authInstance: null,
    google: null,
    googleConfigured: false,
  });
});

test('signing in triggers a sync that pushes locally-pending highlights to Firestore', async () => {
  // 1. User created a book + highlight while signed out (offline-first capture).
  const book = await Books.createBook(db, { title: 'Pre-sign-in book' });
  await Highlights.createHighlight(db, {
    book_id: book.id,
    text: 'captured before sign-in',
    tag_names: ['offline'],
  });

  // 2. Wire up auth fakes — start signed out, then sign in via Google.
  const { authModule, auth, google } = makeAuthFakes(null);
  _setAuthForTests({
    authModule: authModule as unknown as Parameters<typeof _setAuthForTests>[0]['authModule'],
    authInstance: auth as unknown as Parameters<typeof _setAuthForTests>[0]['authInstance'],
    google: google as unknown as Parameters<typeof _setAuthForTests>[0]['google'],
    googleConfigured: true,
  });

  // 3. Mirror app/_layout.tsx: subscribe to auth, kick off sync on sign-in.
  const syncPromises: Promise<unknown>[] = [];
  const unsub = onAuthStateChanged((u) => {
    if (!u) return;
    syncPromises.push(runSync(db, u.uid));
  });

  // 4. Trigger the actual Google sign-in path.
  const signed = await signInWithGoogle();
  expect(signed?.uid).toBe('u-signed-in');

  // 5. Wait for the sync triggered by the auth callback.
  await Promise.all(syncPromises);
  unsub();

  // 6. The pre-sign-in book + highlight + tag should now live in Firestore.
  const remoteBooks = fake.__collections.get('users/u-signed-in/books');
  const remoteHighlights = fake.__collections.get('users/u-signed-in/highlights');
  const remoteTags = fake.__collections.get('users/u-signed-in/tags');
  expect(remoteBooks?.size).toBe(1);
  expect(remoteHighlights?.size).toBe(1);
  expect(remoteTags?.size).toBe(1);

  const h = Array.from(remoteHighlights!.values())[0] as {
    text: string;
    tag_names: string[];
  };
  expect(h.text).toBe('captured before sign-in');
  expect(h.tag_names).toEqual(['offline']);
});

test('sign-out callback does NOT trigger a sync (no uid to push to)', async () => {
  const { authModule, auth, google } = makeAuthFakes({
    uid: 'u-signed-in',
    email: null,
    displayName: null,
  });
  _setAuthForTests({
    authModule: authModule as unknown as Parameters<typeof _setAuthForTests>[0]['authModule'],
    authInstance: auth as unknown as Parameters<typeof _setAuthForTests>[0]['authInstance'],
    google: google as unknown as Parameters<typeof _setAuthForTests>[0]['google'],
    googleConfigured: true,
  });

  let syncCalls = 0;
  const syncs: Promise<unknown>[] = [];
  const unsub = onAuthStateChanged((u) => {
    if (!u) return;
    syncCalls += 1;
    syncs.push(runSync(db, u.uid));
  });

  // Initial callback fires with the seeded user — that counts as one sync.
  expect(syncCalls).toBe(1);

  await auth.signOut();
  // Sign-out emits null; our handler short-circuits, so no additional sync.
  expect(syncCalls).toBe(1);
  unsub();
  // Drain the seed-triggered sync before afterEach clears the firestore fake,
  // otherwise it crashes when it tries to load the real native module.
  await Promise.all(syncs);
});
