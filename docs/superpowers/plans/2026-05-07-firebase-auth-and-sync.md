# Firebase Auth + Cross-Device Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Google Sign-In and Firestore-backed cross-device sync (Pro-only) for books and highlights, while keeping the existing local-first SQLite experience for signed-out users.

**Architecture:** SQLite remains the source of truth on-device. When the user is signed in AND subscribed to Pro, a background sync orchestrator mirrors local writes to Firestore (`users/{uid}/books`, `users/{uid}/highlights`) and pulls remote changes since `last_synced_at`. Last-write-wins on `updated_at`. UUID `remote_id` columns and `deleted_at` (soft delete) are added so multiple devices can converge without integer-ID collisions. Tags are denormalized into a `tag_names: string[]` array on each highlight doc to avoid joining a separate collection.

**Tech Stack:**
- `@react-native-firebase/app`, `/auth`, `/firestore` (native modules; requires EAS dev build, already in use)
- `@react-native-google-signin/google-signin` for the Google ID-token flow
- `expo-build-properties` (already present) for native config
- Existing: Expo SDK 51, expo-router, expo-sqlite

**Decisions confirmed with user:**
- Sign-in is **optional** (Settings entry point; app fully usable without it)
- Sync is **Pro-only** (gated by existing `react-native-iap` subscription)
- Firebase Console setup is included as manual steps the user performs

---

## File Structure

**New files:**
- `src/auth/firebase.ts` — Firebase app initialization, Google Sign-In configuration
- `src/auth/session.ts` — Auth state observation, sign-in/sign-out helpers, current-user hook
- `src/sync/uuid.ts` — RFC 4122 v4 UUID generator (no native crypto dep)
- `src/sync/firestore.ts` — Firestore document shape + push/pull primitives
- `src/sync/sync.ts` — Orchestrator: gate by Pro, push dirty rows, pull deltas, update meta
- `app/account.tsx` — Sign-in/sign-out + manual sync screen, linked from Settings
- `src/auth/__tests__/session.test.ts`
- `src/sync/__tests__/uuid.test.ts`
- `src/sync/__tests__/sync.test.ts` — uses an in-memory Firestore mock
- `docs/firebase-setup.md` — manual console-side checklist for the user

**Modified files:**
- `package.json` — three new deps
- `app.json` — `googleServicesFile`, `@react-native-firebase/app` plugin, IPv4-style permissions unchanged
- `eas.json` — env-var hints (no functional change)
- `src/db/schema.ts` — migration v2: add `remote_id`, `deleted_at` columns + indexes
- `src/db/types.ts` — extend Book, Highlight types
- `src/db/books.ts` — generate UUID on insert, soft-delete, expose dirty/since helpers
- `src/db/highlights.ts` — same; serialize `tag_names` for Firestore
- `src/db/meta.ts` — add `getLastSyncedAt`, `setLastSyncedAt`, `getCurrentUserId`, `setCurrentUserId`
- `app/_layout.tsx` — kick off auth listener; trigger initial sync on cold start when eligible
- `app/(tabs)/settings.tsx` — add "Account & Sync" row that navigates to `app/account.tsx`
- `.gitignore` — ensure `google-services.json` is NOT committed (it contains keys; treat as secret per Google guidance)

---

## Task 0: Firebase Console Setup (manual, user-performed)

**Files:** none (external service)

- [ ] **Step 1: Create Firebase project**
  - Visit https://console.firebase.google.com → "Add project" → name `kindle-highlights`
  - Disable Google Analytics (not needed)

- [ ] **Step 2: Register Android app**
  - In project → "Add app" → Android
  - Package name: `com.harry.kindlehighlights` (matches `app.json` → `android.package`)
  - Get debug SHA-1 with: `cd android && ./gradlew signingReport` after running `npx expo prebuild` once, OR from EAS: `eas credentials` → Android → keystore → "Download credentials" and use `keytool -list -v -keystore ...` (paste BOTH debug AND release SHA-1 into Firebase)

- [ ] **Step 3: Download `google-services.json`**
  - Place at project root: `C:\Users\harry\Documents\code\kindle-screenshot-app\google-services.json`
  - This file is referenced from `app.json` (Task 2) and copied into the native Android build by the Firebase config plugin

- [ ] **Step 4: Enable Authentication → Google sign-in method**
  - Auth → Sign-in method → Google → Enable
  - Note the **Web client ID** under "Web SDK configuration" — copy it; you'll paste it into `src/auth/firebase.ts` (Task 4) as `GOOGLE_WEB_CLIENT_ID`

- [ ] **Step 5: Enable Firestore Database**
  - Build → Firestore Database → "Create database" → start in **production mode** → region closest to user base (e.g. `us-central1` or `europe-west1`)

- [ ] **Step 6: Set Firestore security rules**

  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```

  Paste into Firestore → Rules → Publish.

- [ ] **Step 7: Confirm `google-services.json` is in `.gitignore`** (Task 1 will add it; this is just a pre-flight check that you understand it must NOT be committed — it contains API keys)

---

## Task 1: Add gitignore entry and dependencies

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Add `google-services.json` to `.gitignore`**

  Append:
  ```
  # Firebase
  google-services.json
  GoogleService-Info.plist
  ```

- [ ] **Step 2: Install Firebase + Google Sign-In packages**

  Run in project root:
  ```bash
  npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-google-signin/google-signin
  ```

  Expected: three new entries in `package.json` dependencies, lockfile updated.

- [ ] **Step 3: Commit**

  ```bash
  git add .gitignore package.json package-lock.json
  git commit -m "chore: add firebase + google sign-in deps, gitignore secrets"
  ```

---

## Task 2: Configure native build (app.json)

**Files:** Modify: `app.json`

- [ ] **Step 1: Add Firebase config plugin and reference google-services.json**

  In `app.json` → `expo`:
  - Add `"googleServicesFile": "./google-services.json"` under `android`
  - Add `"@react-native-firebase/app"` to `plugins` array
  - Add `"@react-native-google-signin/google-signin"` to `plugins` array
  - Update `expo-build-properties` plugin to set `android.useAndroidX: true` and `android.minSdkVersion: 23` (Firebase requirement); leave existing proguard settings

  Resulting plugins array should look like:
  ```json
  "plugins": [
    "expo-router",
    "expo-camera",
    "react-native-iap",
    "@react-native-firebase/app",
    "@react-native-google-signin/google-signin",
    [
      "expo-build-properties",
      {
        "android": {
          "minSdkVersion": 23,
          "enableProguardInReleaseBuilds": true,
          "enableShrinkResourcesInReleaseBuilds": true
        }
      }
    ]
  ]
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add app.json
  git commit -m "chore: configure expo plugins for firebase + google sign-in"
  ```

  > **NOTE:** A new EAS dev build is required after this commit before any auth/sync code runs. The user must run `eas build --profile development --platform android` once before testing Task 4 onward.

---

## Task 3: Schema migration v2 (remote_id, deleted_at)

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/types.ts`
- Test: `src/db/__tests__/schema-v2.test.ts` (new)

- [ ] **Step 1: Write failing test for migration v2**

  ```ts
  // src/db/__tests__/schema-v2.test.ts
  import Database from 'better-sqlite3';
  import { runMigrations } from '../schema';
  import type { DbExec } from '../client';

  function adapter(db: Database.Database): DbExec {
    return {
      execAsync: async (sql) => { db.exec(sql); },
      runAsync: async (sql, params = []) => {
        const info = db.prepare(sql).run(...(params as any[]));
        return { lastInsertRowId: Number(info.lastInsertRowid), changes: info.changes };
      },
      getAllAsync: async (sql, params = []) => db.prepare(sql).all(...(params as any[])) as any,
      getFirstAsync: async (sql, params = []) => (db.prepare(sql).get(...(params as any[])) ?? null) as any,
    };
  }

  test('v2 adds remote_id and deleted_at to books and highlights', async () => {
    const sqlite = new Database(':memory:');
    const db = adapter(sqlite);
    await runMigrations(db);

    const bookCols = sqlite.prepare("PRAGMA table_info(books)").all() as { name: string }[];
    expect(bookCols.map((c) => c.name)).toEqual(
      expect.arrayContaining(['remote_id', 'deleted_at'])
    );

    const hCols = sqlite.prepare("PRAGMA table_info(highlights)").all() as { name: string }[];
    expect(hCols.map((c) => c.name)).toEqual(
      expect.arrayContaining(['remote_id', 'deleted_at'])
    );
  });
  ```

- [ ] **Step 2: Run test to confirm failure**

  ```bash
  npm test -- schema-v2
  ```
  Expected: FAIL — columns missing.

- [ ] **Step 3: Add v2 migration**

  In `src/db/schema.ts`:
  - Bump `currentSchemaVersion` to `2`
  - Add migration entry:
    ```ts
    2: `
      ALTER TABLE books ADD COLUMN remote_id TEXT;
      ALTER TABLE books ADD COLUMN deleted_at INTEGER;
      ALTER TABLE books ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_books_remote_id ON books(remote_id) WHERE remote_id IS NOT NULL;

      ALTER TABLE highlights ADD COLUMN remote_id TEXT;
      ALTER TABLE highlights ADD COLUMN deleted_at INTEGER;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_highlights_remote_id ON highlights(remote_id) WHERE remote_id IS NOT NULL;

      UPDATE books SET updated_at = created_at WHERE updated_at = 0;
    `
    ```

  Note: SQLite ALTER TABLE ADD COLUMN cannot enforce NOT NULL on an existing-rows table without a default, so we backfill `updated_at` from `created_at` after the fact for books. `remote_id` and `deleted_at` are nullable — they'll be populated when a row first syncs (Task 5/7) or is soft-deleted.

- [ ] **Step 4: Update `Book` and `Highlight` types**

  In `src/db/types.ts`:
  ```ts
  export type Book = {
    id: number;
    title: string;
    author: string | null;
    created_at: number;
    updated_at: number;     // new
    remote_id: string | null; // new
    deleted_at: number | null; // new
  };

  export type Highlight = {
    id: number;
    book_id: number;
    text: string;
    note: string | null;
    created_at: number;
    updated_at: number;
    remote_id: string | null; // new
    deleted_at: number | null; // new
  };
  ```

- [ ] **Step 5: Run test, verify pass**

  ```bash
  npm test -- schema-v2
  ```
  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add src/db/schema.ts src/db/types.ts src/db/__tests__/schema-v2.test.ts
  git commit -m "feat(db): migration v2 adds remote_id and deleted_at"
  ```

---

## Task 4: Auth module (Firebase + Google Sign-In)

**Files:**
- Create: `src/auth/firebase.ts`
- Create: `src/auth/session.ts`
- Test: `src/auth/__tests__/session.test.ts`

- [ ] **Step 1: Write failing test for `useAuthUser` hook**

  ```ts
  // src/auth/__tests__/session.test.ts
  import { renderHook, act } from '@testing-library/react-native';

  jest.mock('../firebase', () => {
    let listener: ((u: any) => void) | null = null;
    return {
      onAuthStateChanged: (cb: any) => { listener = cb; cb(null); return () => { listener = null; }; },
      __emit: (u: any) => listener?.(u),
      signInWithGoogle: jest.fn(),
      signOut: jest.fn(),
    };
  });

  import { useAuthUser } from '../session';
  import * as firebase from '../firebase';

  test('useAuthUser reflects auth changes', () => {
    const { result } = renderHook(() => useAuthUser());
    expect(result.current).toBeNull();
    act(() => { (firebase as any).__emit({ uid: 'abc', email: 'x@y.z' }); });
    expect(result.current?.uid).toBe('abc');
  });
  ```

- [ ] **Step 2: Run test, confirm fail**

  ```bash
  npm test -- auth/session
  ```
  Expected: FAIL.

- [ ] **Step 3: Implement `src/auth/firebase.ts`**

  Lazy-require pattern (mirrors `src/billing.ts`) so the JS bundle keeps loading on dev clients without the native module:

  ```ts
  // Paste the Web client ID copied from Firebase Console → Auth → Google provider config
  export const GOOGLE_WEB_CLIENT_ID = 'PASTE_WEB_CLIENT_ID_HERE.apps.googleusercontent.com';

  type AuthModule = typeof import('@react-native-firebase/auth').default;
  type GsiModule = typeof import('@react-native-google-signin/google-signin');

  let cachedAuth: ReturnType<AuthModule> | null = null;
  let cachedGsi: GsiModule | null = null;
  let configured = false;

  function loadAuth(): ReturnType<AuthModule> {
    if (cachedAuth) return cachedAuth;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const auth = require('@react-native-firebase/auth').default as AuthModule;
    cachedAuth = auth();
    return cachedAuth;
  }

  function loadGsi(): GsiModule {
    if (cachedGsi) return cachedGsi;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedGsi = require('@react-native-google-signin/google-signin') as GsiModule;
    if (!configured) {
      cachedGsi.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
      configured = true;
    }
    return cachedGsi;
  }

  export type AuthUser = { uid: string; email: string | null; displayName: string | null };

  export function onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void {
    const auth = loadAuth();
    return auth.onAuthStateChanged((u) =>
      cb(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null)
    );
  }

  export async function signInWithGoogle(): Promise<AuthUser> {
    const { GoogleSignin } = loadGsi();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result: any = await GoogleSignin.signIn();
    const idToken: string | undefined = result?.idToken ?? result?.data?.idToken;
    if (!idToken) throw new Error('Google sign-in returned no ID token');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const authMod = require('@react-native-firebase/auth') as typeof import('@react-native-firebase/auth');
    const credential = authMod.default.GoogleAuthProvider.credential(idToken);
    const cred = await loadAuth().signInWithCredential(credential);
    return { uid: cred.user.uid, email: cred.user.email, displayName: cred.user.displayName };
  }

  export async function signOut(): Promise<void> {
    const { GoogleSignin } = loadGsi();
    try { await GoogleSignin.signOut(); } catch { /* not signed in is fine */ }
    await loadAuth().signOut();
  }
  ```

  > **Manual:** Replace `PASTE_WEB_CLIENT_ID_HERE...` with the value from Task 0 Step 4.

- [ ] **Step 4: Implement `src/auth/session.ts`**

  ```ts
  import { useEffect, useState } from 'react';
  import { onAuthStateChanged, type AuthUser } from './firebase';

  export function useAuthUser(): AuthUser | null {
    const [user, setUser] = useState<AuthUser | null>(null);
    useEffect(() => onAuthStateChanged(setUser), []);
    return user;
  }
  ```

- [ ] **Step 5: Run test, verify pass**

  ```bash
  npm test -- auth/session
  ```
  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add src/auth package.json package-lock.json
  git commit -m "feat(auth): add firebase + google sign-in module"
  ```

---

## Task 5: UUID generator and meta helpers

**Files:**
- Create: `src/sync/uuid.ts`
- Test: `src/sync/__tests__/uuid.test.ts`
- Modify: `src/db/meta.ts`

- [ ] **Step 1: Write failing UUID test**

  ```ts
  // src/sync/__tests__/uuid.test.ts
  import { uuidv4 } from '../uuid';

  test('uuidv4 returns RFC4122 v4 string', () => {
    const id = uuidv4();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test('uuidv4 is unique across calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, uuidv4));
    expect(ids.size).toBe(1000);
  });
  ```

- [ ] **Step 2: Run test, confirm fail**

  ```bash
  npm test -- sync/uuid
  ```

- [ ] **Step 3: Implement `src/sync/uuid.ts`**

  ```ts
  // Math.random-based v4 UUID. Sufficient for client-generated IDs of user-scoped data
  // (collision space ~2^122). No native crypto module needed in RN.
  export function uuidv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  ```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Add sync meta helpers to `src/db/meta.ts`**

  Append:
  ```ts
  const LAST_SYNCED_AT_KEY = 'last_synced_at';
  const CURRENT_USER_ID_KEY = 'current_user_id';

  export async function getLastSyncedAt(db: DbExec): Promise<number> {
    const v = await getMeta(db, LAST_SYNCED_AT_KEY);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  export async function setLastSyncedAt(db: DbExec, ms: number): Promise<void> {
    await setMeta(db, LAST_SYNCED_AT_KEY, String(ms));
  }

  export async function getCurrentUserId(db: DbExec): Promise<string | null> {
    return getMeta(db, CURRENT_USER_ID_KEY);
  }

  export async function setCurrentUserId(db: DbExec, uid: string | null): Promise<void> {
    if (uid === null) {
      await db.runAsync('DELETE FROM meta WHERE key = ?', [CURRENT_USER_ID_KEY]);
    } else {
      await setMeta(db, CURRENT_USER_ID_KEY, uid);
    }
  }

  export async function resetSyncCursor(db: DbExec): Promise<void> {
    await db.runAsync('DELETE FROM meta WHERE key = ?', [LAST_SYNCED_AT_KEY]);
  }
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/sync/uuid.ts src/sync/__tests__/uuid.test.ts src/db/meta.ts
  git commit -m "feat(sync): add UUID generator and sync meta helpers"
  ```

---

## Task 6: Update db write paths (UUIDs, soft delete, dirty tracking)

**Files:**
- Modify: `src/db/books.ts`
- Modify: `src/db/highlights.ts`
- Test: `src/db/__tests__/sync-fields.test.ts` (new)

- [ ] **Step 1: Write failing test**

  ```ts
  // src/db/__tests__/sync-fields.test.ts — verifies new rows get remote_id and updated_at,
  // delete is soft, and listX excludes soft-deleted rows.
  import Database from 'better-sqlite3';
  import { runMigrations } from '../schema';
  import * as Books from '../books';
  import * as Highlights from '../highlights';
  // adapter helper as in Task 3 step 1; extract to a shared test helper if duplicated

  test('createBook assigns remote_id and updated_at', async () => {
    // ... setup db, runMigrations, then:
    const book = await Books.createBook(db, { title: 'A' });
    expect(book.remote_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(book.updated_at).toBeGreaterThan(0);
  });

  test('deleteHighlight soft-deletes (deleted_at set, listByBook excludes it)', async () => {
    // create book + highlight, delete it, list should be empty, raw SELECT should still find row
  });
  ```

- [ ] **Step 2: Run, confirm fail**

- [ ] **Step 3: Update `src/db/books.ts`**

  - Import `uuidv4` from `@/src/sync/uuid`
  - In `createBook`: insert `remote_id = uuidv4()`, `updated_at = now`
  - In `updateBook`: set `updated_at = now`
  - Replace `deleteBook` body with:
    ```ts
    const now = Date.now();
    await db.runAsync('UPDATE books SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
    ```
  - In `listBooks` and `getBook`: add `WHERE deleted_at IS NULL`
  - Add `listBooksDirtySince(db, since: number): Promise<Book[]>` returning books with `updated_at > since`

- [ ] **Step 4: Update `src/db/highlights.ts`**

  - In `createHighlight`: insert `remote_id = uuidv4()`
  - In `updateHighlight`: existing `updated_at = now` is already correct
  - Replace `deleteHighlight` with soft delete (mirror books)
  - In all SELECTs (`getHighlight`, `listHighlightsByBook`, `listHighlightsByTag`): add `AND h.deleted_at IS NULL` / `WHERE deleted_at IS NULL`
  - Add `listHighlightsDirtySince(db, since: number): Promise<Highlight[]>` for sync push

  > **NOTE:** Hard-delete via FTS triggers in the schema will fire only on actual DELETEs, so soft-deleted rows remain in FTS. This is acceptable — search results filter the same as listX queries, but if you ever do raw FTS queries, filter `deleted_at IS NULL`. Check `src/db/search.ts` and add the same filter there.

- [ ] **Step 5: Update `src/db/search.ts`**

  Read current implementation, add `AND h.deleted_at IS NULL` to its joined query.

- [ ] **Step 6: Run all DB tests, verify pass**

  ```bash
  npm test -- src/db
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/db/books.ts src/db/highlights.ts src/db/search.ts src/db/__tests__/sync-fields.test.ts
  git commit -m "feat(db): UUID remote_id, soft-delete, dirty-since helpers"
  ```

---

## Task 7: Firestore push/pull primitives

**Files:**
- Create: `src/sync/firestore.ts`
- Test: `src/sync/__tests__/firestore.test.ts`

- [ ] **Step 1: Define document shapes**

  ```ts
  // src/sync/firestore.ts
  export type RemoteBook = {
    remote_id: string;
    title: string;
    author: string | null;
    created_at: number;
    updated_at: number;
    deleted_at: number | null;
  };

  export type RemoteHighlight = {
    remote_id: string;
    book_remote_id: string;
    text: string;
    note: string | null;
    tag_names: string[];
    created_at: number;
    updated_at: number;
    deleted_at: number | null;
  };
  ```

- [ ] **Step 2: Write failing test for push/pull (using a fake firestore)**

  Mock `loadFirestore()` and assert `pushBooks(uid, books)` calls `set` with the right shape and merge:true; `pullBooksSince(uid, since)` calls a `where('updated_at','>',since)` query.

- [ ] **Step 3: Implement push/pull**

  ```ts
  type FirestoreModule = typeof import('@react-native-firebase/firestore').default;
  let cachedFs: ReturnType<FirestoreModule> | null = null;
  function loadFirestore() {
    if (cachedFs) return cachedFs;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('@react-native-firebase/firestore').default as FirestoreModule;
    cachedFs = fs();
    return cachedFs;
  }

  export async function pushBooks(uid: string, books: RemoteBook[]): Promise<void> {
    if (books.length === 0) return;
    const fs = loadFirestore();
    const batch = fs.batch();
    for (const b of books) {
      const ref = fs.collection(`users/${uid}/books`).doc(b.remote_id);
      batch.set(ref, b, { merge: true });
    }
    await batch.commit();
  }

  export async function pullBooksSince(uid: string, since: number): Promise<RemoteBook[]> {
    const fs = loadFirestore();
    const snap = await fs
      .collection(`users/${uid}/books`)
      .where('updated_at', '>', since)
      .get();
    return snap.docs.map((d) => d.data() as RemoteBook);
  }

  // Same shape for highlights:
  export async function pushHighlights(uid: string, hs: RemoteHighlight[]): Promise<void> { /* ... */ }
  export async function pullHighlightsSince(uid: string, since: number): Promise<RemoteHighlight[]> { /* ... */ }
  ```

  > **NOTE:** Firestore batches are limited to 500 ops; chunk if `books.length > 500` or `hs.length > 500`. Implement chunking in this task.

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

  ```bash
  git add src/sync/firestore.ts src/sync/__tests__/firestore.test.ts
  git commit -m "feat(sync): firestore push/pull primitives"
  ```

---

## Task 8: Sync orchestrator

**Files:**
- Create: `src/sync/sync.ts`
- Test: `src/sync/__tests__/sync.test.ts`

- [ ] **Step 1: Write failing integration test**

  Use an in-memory better-sqlite3 db plus mocked `pushBooks`/`pullBooksSince`/`pushHighlights`/`pullHighlightsSince`. Cases:
  - `runSync` with no changes → no calls, `last_synced_at` advanced
  - Local edits dirty → `pushBooks` called with those rows
  - Remote returns a book → upserted into local SQLite by `remote_id`
  - Remote returns a deleted book (`deleted_at` set) → local row soft-deleted
  - When `isSubscribed` is false → throws or returns early
  - When user not signed in → throws

- [ ] **Step 2: Run, confirm fail**

- [ ] **Step 3: Implement orchestrator**

  ```ts
  // src/sync/sync.ts
  import type { DbExec } from '@/src/db/client';
  import * as Meta from '@/src/db/meta';
  import * as Books from '@/src/db/books';
  import * as Highlights from '@/src/db/highlights';
  import * as Tags from '@/src/db/tags';
  import { pushBooks, pullBooksSince, pushHighlights, pullHighlightsSince } from './firestore';
  import type { RemoteBook, RemoteHighlight } from './firestore';

  export type SyncResult = { pushed: number; pulled: number; finishedAt: number };

  export async function runSync(db: DbExec, uid: string): Promise<SyncResult> {
    if (!(await Meta.isSubscribed(db))) throw new Error('Sync requires Pro subscription');

    // Reset cursor if uid changed
    const lastUid = await Meta.getCurrentUserId(db);
    if (lastUid !== uid) {
      await Meta.resetSyncCursor(db);
      await Meta.setCurrentUserId(db, uid);
    }
    const since = await Meta.getLastSyncedAt(db);

    // 1. PUSH local dirty rows
    const dirtyBooks = await Books.listBooksDirtySince(db, since);
    const dirtyHighlights = await Highlights.listHighlightsDirtySince(db, since);

    const remoteBooks: RemoteBook[] = dirtyBooks.map((b) => ({
      remote_id: b.remote_id!, // ensured by Task 6
      title: b.title,
      author: b.author,
      created_at: b.created_at,
      updated_at: b.updated_at,
      deleted_at: b.deleted_at,
    }));

    const remoteHighlights: RemoteHighlight[] = await Promise.all(
      dirtyHighlights.map(async (h) => {
        const book = await Books.getBookById(db, h.book_id); // helper to add — bypasses deleted_at filter
        const tags = await Tags.getTagsForHighlight(db, h.id);
        return {
          remote_id: h.remote_id!,
          book_remote_id: book!.remote_id!,
          text: h.text,
          note: h.note,
          tag_names: tags.map((t) => t.name),
          created_at: h.created_at,
          updated_at: h.updated_at,
          deleted_at: h.deleted_at,
        };
      })
    );

    await pushBooks(uid, remoteBooks);
    await pushHighlights(uid, remoteHighlights);

    // 2. PULL remote changes since cursor
    const pulledBooks = await pullBooksSince(uid, since);
    const pulledHighlights = await pullHighlightsSince(uid, since);

    // 3. APPLY pulled books (upsert by remote_id, last-write-wins)
    for (const rb of pulledBooks) {
      await applyRemoteBook(db, rb);
    }
    for (const rh of pulledHighlights) {
      await applyRemoteHighlight(db, rh);
    }

    const finishedAt = Date.now();
    await Meta.setLastSyncedAt(db, finishedAt);
    return { pushed: remoteBooks.length + remoteHighlights.length, pulled: pulledBooks.length + pulledHighlights.length, finishedAt };
  }

  async function applyRemoteBook(db: DbExec, rb: RemoteBook): Promise<void> {
    const existing = await db.getFirstAsync<{ id: number; updated_at: number }>(
      'SELECT id, updated_at FROM books WHERE remote_id = ?', [rb.remote_id]
    );
    if (!existing) {
      await db.runAsync(
        'INSERT INTO books (remote_id, title, author, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)',
        [rb.remote_id, rb.title, rb.author, rb.created_at, rb.updated_at, rb.deleted_at]
      );
      return;
    }
    if (rb.updated_at < existing.updated_at) return; // local newer, keep
    await db.runAsync(
      'UPDATE books SET title=?, author=?, updated_at=?, deleted_at=? WHERE id=?',
      [rb.title, rb.author, rb.updated_at, rb.deleted_at, existing.id]
    );
  }

  async function applyRemoteHighlight(db: DbExec, rh: RemoteHighlight): Promise<void> {
    // Resolve / auto-insert parent book
    let book = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM books WHERE remote_id = ?', [rh.book_remote_id]
    );
    if (!book) {
      const r = await db.runAsync(
        'INSERT INTO books (remote_id, title, author, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [rh.book_remote_id, '(unknown)', null, rh.created_at, rh.updated_at]
      );
      book = { id: r.lastInsertRowId };
    }

    const existing = await db.getFirstAsync<{ id: number; updated_at: number }>(
      'SELECT id, updated_at FROM highlights WHERE remote_id = ?', [rh.remote_id]
    );
    let hid: number;
    if (!existing) {
      const r = await db.runAsync(
        'INSERT INTO highlights (remote_id, book_id, text, note, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [rh.remote_id, book.id, rh.text, rh.note, rh.created_at, rh.updated_at, rh.deleted_at]
      );
      hid = r.lastInsertRowId;
    } else {
      if (rh.updated_at < existing.updated_at) return;
      await db.runAsync(
        'UPDATE highlights SET text=?, note=?, updated_at=?, deleted_at=? WHERE id=?',
        [rh.text, rh.note, rh.updated_at, rh.deleted_at, existing.id]
      );
      hid = existing.id;
    }
    // Reconcile tags
    await Tags.setHighlightTags(db, hid, rh.tag_names);
  }
  ```

- [ ] **Step 4: Add `getBookById` to `src/db/books.ts`** (returns soft-deleted books too — needed for sync to find parent of a deleted highlight)

  ```ts
  export async function getBookById(db: DbExec, id: number): Promise<Book | null> {
    return db.getFirstAsync<Book>('SELECT * FROM books WHERE id = ?', [id]);
  }
  ```

- [ ] **Step 5: Run, verify pass**

- [ ] **Step 6: Commit**

  ```bash
  git add src/sync src/db/books.ts
  git commit -m "feat(sync): orchestrator with last-write-wins reconciliation"
  ```

---

## Task 9: Account screen UI

**Files:**
- Create: `app/account.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/_layout.tsx` (register the new route)

- [ ] **Step 1: Build `app/account.tsx`**

  Behavior:
  - Reads `useAuthUser()` and `isSubscribed`
  - If signed out: shows "Sign in with Google" button → calls `signInWithGoogle`
  - If signed in but not Pro: shows "Sync requires Pro" + button to navigate to `/paywall`
  - If signed in + Pro: shows email, last sync time, "Sync now" button → calls `runSync`, "Sign out" button
  - Surfaces errors via `Alert.alert`
  - Renders `ActivityIndicator` while a sync is in progress (local `useState`)

- [ ] **Step 2: Add Account row to `app/(tabs)/settings.tsx`**

  Add a `Pressable` above "Export all highlights" labeled "Account & Sync" → `router.push('/account')`. Update the "All data is stored locally" line to reflect sync state.

- [ ] **Step 3: Register route in `app/_layout.tsx`**

  Add inside the `<Stack>`:
  ```tsx
  <Stack.Screen name="account" options={{ title: 'Account & Sync' }} />
  ```

- [ ] **Step 4: Manual smoke test on dev build**
  - Build EAS dev client (if not already done after Task 2)
  - Open app → Settings → Account & Sync → Sign in
  - Verify Firebase Console → Auth → Users shows the new user
  - Subscribe to Pro (test SKU), tap "Sync now"
  - Verify Firestore Console → `users/{uid}/highlights` contains your local highlights

- [ ] **Step 5: Commit**

  ```bash
  git add app/account.tsx app/_layout.tsx app/(tabs)/settings.tsx
  git commit -m "feat(ui): account & sync screen with sign-in and manual sync"
  ```

---

## Task 10: Auto-sync on app start and after writes

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add a sync trigger in the root layout**

  After `initDb()` and the onboarding check, subscribe to auth state. When a user is present AND `isSubscribed`, call `runSync(db, uid)` once (fire-and-forget, swallow errors with a console log — sync errors should never break app launch).

  ```tsx
  // inside the existing useEffect, after setReady(true):
  const unsub = onAuthStateChanged(async (user) => {
    if (!user) return;
    if (!(await isSubscribed(db))) return;
    runSync(db, user.uid).catch((e) => console.warn('[sync] failed:', e));
  });
  // store unsub in a ref so we can clean up on unmount
  ```

- [ ] **Step 2: Manual verification**
  - Edit a highlight on Device A, kill app, relaunch → on cold start, edit appears in Firestore
  - On Device B (or after clearing local data and re-signing-in), launch → highlight pulls down

- [ ] **Step 3: Commit**

  ```bash
  git add app/_layout.tsx
  git commit -m "feat(sync): auto-sync on app start when signed in + pro"
  ```

---

## Task 11: Documentation

**Files:** Create: `docs/firebase-setup.md`

- [ ] **Step 1: Write the manual-setup checklist**

  Mirror Task 0 here so future maintainers (or you on a fresh machine) can re-do the console setup. Include:
  - Where to get SHA-1 fingerprints
  - How to rotate `google-services.json`
  - Security rules snippet
  - Troubleshooting: `DEVELOPER_ERROR` from GoogleSignin → SHA-1 mismatch
  - Troubleshooting: `auth/network-request-failed` → emulator without Google Play Services

- [ ] **Step 2: Commit**

  ```bash
  git add docs/firebase-setup.md
  git commit -m "docs: firebase manual setup checklist"
  ```

---

## Self-Review

**Spec coverage:**
- Optional sign-in → Task 9 (Account screen, no forced redirect)
- Pro-only sync → Task 8 (`isSubscribed` check inside `runSync`) + Task 10 (auto-sync also gated)
- Cross-device text sync → Tasks 7, 8 (Firestore push/pull books + highlights + tags as denormalized array)
- Quick login → Task 4 (Google Sign-In one-tap)
- Existing data goes up on first sync → Task 8 dirty scan from `since=0` after first sign-in (cursor reset on uid change)
- Hard deletes won't propagate → Task 6 (soft delete + `deleted_at`)
- ID conflicts across devices → Task 3 / Task 6 (`remote_id` UUID columns)
- Setup discoverability → Tasks 0, 11 (manual checklist + ongoing docs)

**Type consistency:** `Book`/`Highlight` types extended in Task 3, used as-is in Tasks 6–8. `RemoteBook`/`RemoteHighlight` defined in Task 7 and consumed in Task 8. `runSync(db, uid)` signature stable across Tasks 8, 9, 10.

**Placeholder scan:** One intentional placeholder remains: the Web Client ID in `src/auth/firebase.ts` Task 4 Step 3, flagged with a `> Manual:` callout. Test bodies in Task 6 Step 1 and Task 7 Step 2 are sketched — the executing engineer should expand them following the patterns shown in Task 3 Step 1 (full test body provided as the model). Acceptable since the patterns are reused, but a strict TDD pass should fully spell them out.

**Known limitation:** Tags are synced denormalized per-highlight. A tag rename on Device A propagates only to highlights that re-sync. This is acceptable for the current product (tags are user-private and cheap to re-tag). If multi-device tag-rename becomes an issue later, add a `users/{uid}/tags` collection in a future plan.
