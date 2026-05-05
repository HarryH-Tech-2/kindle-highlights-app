# Kindle Highlight App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully-offline React Native (Expo) mobile app that captures Kindle highlights via camera + on-device OCR, organizes them under books with tags and notes, and exports to Markdown.

**Architecture:** Local-first SQLite for storage with FTS for search. Pure data modules (DB, export) are isolated behind clear interfaces and heavily unit-tested. UI is built in Expo Router screens that consume thin hooks over the DB modules. Photos are transient — held in memory only during OCR, then discarded.

**Tech Stack:** Expo SDK 51+ with Dev Client, React Native, TypeScript, Expo Router, expo-sqlite, expo-camera, expo-image-picker, @react-native-ml-kit/text-recognition, expo-sharing, expo-file-system, Jest, React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-05-kindle-highlight-app-design.md`

---

## File Structure

```
app/                              # Expo Router routes
  _layout.tsx                     # root stack + tab navigator
  (tabs)/_layout.tsx              # bottom tabs: library, tags, settings
  (tabs)/index.tsx                # Library
  (tabs)/tags.tsx                 # Tags list
  (tabs)/settings.tsx             # Settings
  capture.tsx                     # Camera + OCR
  review.tsx                      # Edit + save (handles new and edit modes)
  book/[id].tsx                   # Book Detail
  highlight/[id].tsx              # Highlight Detail
  tag/[name].tsx                  # Highlights for a tag
src/
  db/
    client.ts                     # SQLite connection singleton
    schema.ts                     # migrations
    books.ts                      # books CRUD
    tags.ts                       # tags CRUD + join management
    highlights.ts                 # highlights CRUD
    search.ts                     # FTS queries
    types.ts                      # shared types
  ocr/
    recognize.ts                  # ML Kit wrapper
  export/
    markdown.ts                   # pure: data → markdown string
    share.ts                      # write file + invoke share sheet
  hooks/
    useBooks.ts
    useHighlights.ts
    useTags.ts
  components/
    BookPicker.tsx
    TagInput.tsx
    HighlightCard.tsx
    EmptyState.tsx
    ConfirmDialog.tsx
tests/
  db/
    schema.test.ts
    books.test.ts
    tags.test.ts
    highlights.test.ts
    search.test.ts
  export/
    markdown.test.ts
  components/
    review.test.tsx
    library.test.tsx
```

---

## Task 1: Initialize Expo project

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `.gitignore`, `app/_layout.tsx`, `app/index.tsx`

- [ ] **Step 1: Initialize git repo**

```bash
cd /c/Users/harry/Documents/code/kindle-screenshot-app
git init
git branch -M main
```

- [ ] **Step 2: Scaffold Expo + TypeScript + Expo Router**

Run from the project directory:

```bash
npx create-expo-app@latest . --template tabs@51 --no-install
```

When prompted to overwrite the empty directory, accept. This creates a TypeScript + Expo Router (tabs template) skeleton.

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

Expected: `node_modules` populated, no errors. If peer-dep warnings appear, they are safe to ignore for Expo SDK packages.

- [ ] **Step 4: Verify the project starts**

```bash
npx expo start
```

Expected: Metro bundler starts, prints a QR code. Press `Ctrl+C` to stop. (We will not run on a device yet — that requires Dev Client, set up in Task 2.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo + Expo Router project"
```

---

## Task 2: Install runtime dependencies and configure Dev Client

**Files:**
- Modify: `package.json`, `app.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npx expo install expo-sqlite expo-camera expo-image-picker expo-sharing expo-file-system expo-dev-client
npm install @react-native-ml-kit/text-recognition
```

Expected: each package added to `package.json`. `expo install` picks SDK-compatible versions automatically.

- [ ] **Step 2: Configure permissions in `app.json`**

Open `app.json` and add to the `expo` object (merge with what's already there):

```json
{
  "expo": {
    "name": "Kindle Highlights",
    "slug": "kindle-highlights",
    "ios": {
      "bundleIdentifier": "com.harry.kindlehighlights",
      "infoPlist": {
        "NSCameraUsageDescription": "Used to capture photos of book highlights for text extraction."
      }
    },
    "android": {
      "package": "com.harry.kindlehighlights",
      "permissions": ["android.permission.CAMERA"]
    },
    "plugins": [
      "expo-router",
      "expo-camera",
      "expo-sqlite"
    ]
  }
}
```

Replace existing `bundleIdentifier`, `package`, `infoPlist`, `permissions`, and `plugins` keys with the values above. Keep other existing keys (icon, splash, etc.) as-is.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore: add runtime deps and configure permissions"
```

---

## Task 3: Set up Jest and React Native Testing Library

**Files:**
- Create: `jest.config.js`, `jest.setup.ts`, `tests/smoke.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install test dependencies**

```bash
npm install --save-dev jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest ts-jest
```

- [ ] **Step 2: Create `jest.config.js`**

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|@react-native-ml-kit/.*))'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  }
};
```

- [ ] **Step 3: Create `jest.setup.ts`**

```typescript
import '@testing-library/jest-native/extend-expect';

// Mock ML Kit OCR — native module is not available in Jest
jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: {
    recognize: jest.fn(async () => ({ text: '', blocks: [] }))
  }
}));

// Mock expo-file-system + expo-sharing for export tests
jest.mock('expo-file-system', () => ({
  cacheDirectory: '/tmp/cache/',
  writeAsStringAsync: jest.fn(async () => undefined),
  EncodingType: { UTF8: 'utf8' }
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(async () => undefined),
  isAvailableAsync: jest.fn(async () => true)
}));
```

- [ ] **Step 4: Add the test script to `package.json`**

In the `scripts` section, add:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 5: Add a smoke test**

Create `tests/smoke.test.ts`:

```typescript
test('jest is wired up', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: Run the smoke test**

```bash
npm test -- tests/smoke.test.ts
```

Expected: PASS, 1 test passed.

- [ ] **Step 7: Commit**

```bash
git add jest.config.js jest.setup.ts tests/smoke.test.ts package.json package-lock.json
git commit -m "chore: configure Jest + RNTL"
```

---

## Task 4: SQLite client and shared types

**Files:**
- Create: `src/db/client.ts`, `src/db/types.ts`

- [ ] **Step 1: Create `src/db/types.ts`**

```typescript
export type Book = {
  id: number;
  title: string;
  author: string | null;
  created_at: number;
};

export type Highlight = {
  id: number;
  book_id: number;
  text: string;
  note: string | null;
  created_at: number;
  updated_at: number;
};

export type Tag = {
  id: number;
  name: string;
};

export type HighlightWithRelations = Highlight & {
  book: Book;
  tags: Tag[];
};

export type NewBookInput = { title: string; author?: string | null };
export type NewHighlightInput = {
  book_id: number;
  text: string;
  note?: string | null;
  tag_names?: string[];
};
```

- [ ] **Step 2: Create `src/db/client.ts`**

This module exposes a single `getDb()` for production code (uses `expo-sqlite`) and an `openTestDb()` factory for tests (uses `better-sqlite3` in-memory). Tests call `openTestDb()` directly to avoid Expo's native module.

```typescript
import * as SQLite from 'expo-sqlite';

export type DbExec = {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: unknown[]) => Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
  getFirstAsync: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | null>;
};

let cached: DbExec | null = null;

export async function getDb(): Promise<DbExec> {
  if (cached) return cached;
  const db = await SQLite.openDatabaseAsync('highlights.db');
  cached = {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params) => db.runAsync(sql, params ?? []),
    getAllAsync: (sql, params) => db.getAllAsync(sql, params ?? []) as Promise<any[]>,
    getFirstAsync: (sql, params) => db.getFirstAsync(sql, params ?? []) as Promise<any>
  };
  return cached;
}

export function _resetDbCacheForTests() {
  cached = null;
}
```

- [ ] **Step 3: Install test-only better-sqlite3 for in-memory tests**

```bash
npm install --save-dev better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 4: Create `tests/db/testDb.ts` (test helper)**

```typescript
import Database from 'better-sqlite3';
import type { DbExec } from '../../src/db/client';

export function openTestDb(): DbExec {
  const db = new Database(':memory:');
  return {
    execAsync: async (sql) => { db.exec(sql); },
    runAsync: async (sql, params = []) => {
      const stmt = db.prepare(sql);
      const info = stmt.run(...(params as any[]));
      return { lastInsertRowId: Number(info.lastInsertRowid), changes: info.changes };
    },
    getAllAsync: async (sql, params = []) => {
      return db.prepare(sql).all(...(params as any[])) as any[];
    },
    getFirstAsync: async (sql, params = []) => {
      const row = db.prepare(sql).get(...(params as any[]));
      return (row ?? null) as any;
    }
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/db/types.ts src/db/client.ts tests/db/testDb.ts package.json package-lock.json
git commit -m "feat(db): add SQLite client abstraction and test helper"
```

---

## Task 5: Database schema and migrations

**Files:**
- Create: `src/db/schema.ts`, `tests/db/schema.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/db/schema.test.ts`:

```typescript
import { runMigrations, currentSchemaVersion } from '../../src/db/schema';
import { openTestDb } from './testDb';

describe('runMigrations', () => {
  test('creates all tables and FTS index from a fresh database', async () => {
    const db = openTestDb();
    await runMigrations(db);
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['books', 'highlights', 'tags', 'highlight_tags', 'meta', 'highlights_fts'])
    );
  });

  test('records the current schema version in meta', async () => {
    const db = openTestDb();
    await runMigrations(db);
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'schema_version'"
    );
    expect(row?.value).toBe(String(currentSchemaVersion));
  });

  test('is idempotent: running twice does not error or duplicate state', async () => {
    const db = openTestDb();
    await runMigrations(db);
    await runMigrations(db);
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'schema_version'"
    );
    expect(row?.value).toBe(String(currentSchemaVersion));
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- tests/db/schema.test.ts
```

Expected: FAIL — module `../../src/db/schema` cannot be resolved.

- [ ] **Step 3: Implement `src/db/schema.ts`**

```typescript
import type { DbExec } from './client';

export const currentSchemaVersion = 1;

const migrations: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    CREATE TABLE IF NOT EXISTS books (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      author     TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      note       TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_highlights_book ON highlights(book_id);

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS highlight_tags (
      highlight_id INTEGER NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
      tag_id       INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (highlight_id, tag_id)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS highlights_fts USING fts5(
      text, note, content='highlights', content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS highlights_ai AFTER INSERT ON highlights BEGIN
      INSERT INTO highlights_fts(rowid, text, note) VALUES (new.id, new.text, new.note);
    END;
    CREATE TRIGGER IF NOT EXISTS highlights_ad AFTER DELETE ON highlights BEGIN
      INSERT INTO highlights_fts(highlights_fts, rowid, text, note) VALUES('delete', old.id, old.text, old.note);
    END;
    CREATE TRIGGER IF NOT EXISTS highlights_au AFTER UPDATE ON highlights BEGIN
      INSERT INTO highlights_fts(highlights_fts, rowid, text, note) VALUES('delete', old.id, old.text, old.note);
      INSERT INTO highlights_fts(rowid, text, note) VALUES (new.id, new.text, new.note);
    END;
  `
};

export async function runMigrations(db: DbExec): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'schema_version'"
  );
  const installed = row ? Number(row.value) : 0;
  for (let v = installed + 1; v <= currentSchemaVersion; v++) {
    const sql = migrations[v];
    if (!sql) throw new Error(`Missing migration for version ${v}`);
    await db.execAsync(sql);
    await db.runAsync(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)",
      [String(v)]
    );
  }
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- tests/db/schema.test.ts
```

Expected: PASS, 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts tests/db/schema.test.ts
git commit -m "feat(db): schema migrations with FTS triggers"
```

---

## Task 6: Books CRUD

**Files:**
- Create: `src/db/books.ts`, `tests/db/books.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/db/books.test.ts
import { createBook, listBooks, getBook, updateBook, deleteBook } from '../../src/db/books';
import { runMigrations } from '../../src/db/schema';
import { openTestDb } from './testDb';

async function setup() {
  const db = openTestDb();
  await runMigrations(db);
  return db;
}

describe('books', () => {
  test('create returns the new book with an id', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'Atomic Habits', author: 'James Clear' });
    expect(book.id).toBeGreaterThan(0);
    expect(book.title).toBe('Atomic Habits');
    expect(book.author).toBe('James Clear');
    expect(typeof book.created_at).toBe('number');
  });

  test('create allows null author', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'Untitled' });
    expect(book.author).toBeNull();
  });

  test('list returns books ordered by title', async () => {
    const db = await setup();
    await createBook(db, { title: 'Charlie' });
    await createBook(db, { title: 'Alpha' });
    await createBook(db, { title: 'Bravo' });
    const list = await listBooks(db);
    expect(list.map((b) => b.title)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  test('get returns null for unknown id', async () => {
    const db = await setup();
    expect(await getBook(db, 999)).toBeNull();
  });

  test('update changes title and author', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'Old', author: null });
    const updated = await updateBook(db, book.id, { title: 'New', author: 'Author' });
    expect(updated.title).toBe('New');
    expect(updated.author).toBe('Author');
  });

  test('delete removes the book', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'Doomed' });
    await deleteBook(db, book.id);
    expect(await getBook(db, book.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- tests/db/books.test.ts
```

- [ ] **Step 3: Implement `src/db/books.ts`**

```typescript
import type { DbExec } from './client';
import type { Book, NewBookInput } from './types';

export async function createBook(db: DbExec, input: NewBookInput): Promise<Book> {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO books (title, author, created_at) VALUES (?, ?, ?)',
    [input.title, input.author ?? null, now]
  );
  return {
    id: result.lastInsertRowId,
    title: input.title,
    author: input.author ?? null,
    created_at: now
  };
}

export async function listBooks(db: DbExec): Promise<Book[]> {
  return db.getAllAsync<Book>('SELECT * FROM books ORDER BY title COLLATE NOCASE ASC');
}

export async function getBook(db: DbExec, id: number): Promise<Book | null> {
  return db.getFirstAsync<Book>('SELECT * FROM books WHERE id = ?', [id]);
}

export async function updateBook(
  db: DbExec,
  id: number,
  input: { title: string; author: string | null }
): Promise<Book> {
  await db.runAsync('UPDATE books SET title = ?, author = ? WHERE id = ?', [
    input.title,
    input.author,
    id
  ]);
  const updated = await getBook(db, id);
  if (!updated) throw new Error(`Book ${id} not found after update`);
  return updated;
}

export async function deleteBook(db: DbExec, id: number): Promise<void> {
  await db.runAsync('DELETE FROM books WHERE id = ?', [id]);
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- tests/db/books.test.ts
```

Expected: PASS, 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/db/books.ts tests/db/books.test.ts
git commit -m "feat(db): books CRUD"
```

---

## Task 7: Tags CRUD with join management

**Files:**
- Create: `src/db/tags.ts`, `tests/db/tags.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/db/tags.test.ts
import {
  upsertTagByName,
  listTags,
  setHighlightTags,
  getTagsForHighlight,
  listTagsWithCounts
} from '../../src/db/tags';
import { runMigrations } from '../../src/db/schema';
import { createBook } from '../../src/db/books';
import { openTestDb } from './testDb';
import type { DbExec } from '../../src/db/client';

async function setup() {
  const db = openTestDb();
  await runMigrations(db);
  return db;
}

async function insertHighlight(db: DbExec, book_id: number, text = 'sample') {
  const now = Date.now();
  const r = await db.runAsync(
    'INSERT INTO highlights (book_id, text, note, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)',
    [book_id, text, now, now]
  );
  return r.lastInsertRowId;
}

describe('tags', () => {
  test('upsertTagByName creates once, returns same id on repeat', async () => {
    const db = await setup();
    const a = await upsertTagByName(db, 'habits');
    const b = await upsertTagByName(db, 'habits');
    expect(a.id).toBe(b.id);
    expect(a.name).toBe('habits');
  });

  test('listTags returns all tags sorted by name', async () => {
    const db = await setup();
    await upsertTagByName(db, 'zen');
    await upsertTagByName(db, 'art');
    expect((await listTags(db)).map((t) => t.name)).toEqual(['art', 'zen']);
  });

  test('setHighlightTags replaces previous tags for that highlight', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'B' });
    const hid = await insertHighlight(db, book.id);
    await setHighlightTags(db, hid, ['a', 'b']);
    expect((await getTagsForHighlight(db, hid)).map((t) => t.name).sort()).toEqual(['a', 'b']);
    await setHighlightTags(db, hid, ['b', 'c']);
    expect((await getTagsForHighlight(db, hid)).map((t) => t.name).sort()).toEqual(['b', 'c']);
  });

  test('listTagsWithCounts returns usage counts and skips orphans', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'B' });
    const h1 = await insertHighlight(db, book.id, 'one');
    const h2 = await insertHighlight(db, book.id, 'two');
    await setHighlightTags(db, h1, ['x', 'y']);
    await setHighlightTags(db, h2, ['x']);
    await upsertTagByName(db, 'orphan');
    const counts = await listTagsWithCounts(db);
    const map = Object.fromEntries(counts.map((c) => [c.name, c.count]));
    expect(map.x).toBe(2);
    expect(map.y).toBe(1);
    expect(map.orphan).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- tests/db/tags.test.ts
```

- [ ] **Step 3: Implement `src/db/tags.ts`**

```typescript
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
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- tests/db/tags.test.ts
```

Expected: PASS, 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/db/tags.ts tests/db/tags.test.ts
git commit -m "feat(db): tags CRUD with join management"
```

---

## Task 8: Highlights CRUD with cascade

**Files:**
- Create: `src/db/highlights.ts`, `tests/db/highlights.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/db/highlights.test.ts
import {
  createHighlight,
  getHighlight,
  listHighlightsByBook,
  listHighlightsByTag,
  updateHighlight,
  deleteHighlight
} from '../../src/db/highlights';
import { runMigrations } from '../../src/db/schema';
import { createBook, deleteBook } from '../../src/db/books';
import { openTestDb } from './testDb';

async function setup() {
  const db = openTestDb();
  await runMigrations(db);
  const book = await createBook(db, { title: 'B', author: null });
  return { db, book };
}

describe('highlights', () => {
  test('create with tags persists relations', async () => {
    const { db, book } = await setup();
    const h = await createHighlight(db, {
      book_id: book.id,
      text: 'first',
      note: 'a note',
      tag_names: ['Habits', 'systems']
    });
    expect(h.id).toBeGreaterThan(0);
    expect(h.text).toBe('first');
    expect(h.note).toBe('a note');
    expect(h.tags.map((t) => t.name).sort()).toEqual(['habits', 'systems']);
    expect(h.book.id).toBe(book.id);
  });

  test('update changes text/note and replaces tags', async () => {
    const { db, book } = await setup();
    const h = await createHighlight(db, { book_id: book.id, text: 't1', tag_names: ['a'] });
    const updated = await updateHighlight(db, h.id, {
      text: 't2',
      note: 'n2',
      tag_names: ['b', 'c']
    });
    expect(updated.text).toBe('t2');
    expect(updated.note).toBe('n2');
    expect(updated.tags.map((t) => t.name).sort()).toEqual(['b', 'c']);
    expect(updated.updated_at).toBeGreaterThanOrEqual(h.updated_at);
  });

  test('listHighlightsByBook returns newest first', async () => {
    const { db, book } = await setup();
    const a = await createHighlight(db, { book_id: book.id, text: 'a' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createHighlight(db, { book_id: book.id, text: 'b' });
    const list = await listHighlightsByBook(db, book.id);
    expect(list.map((h) => h.id)).toEqual([b.id, a.id]);
  });

  test('listHighlightsByTag returns matches across books', async () => {
    const { db, book } = await setup();
    const other = await createBook(db, { title: 'Other', author: null });
    await createHighlight(db, { book_id: book.id, text: 'x', tag_names: ['focus'] });
    await createHighlight(db, { book_id: other.id, text: 'y', tag_names: ['focus'] });
    await createHighlight(db, { book_id: book.id, text: 'z', tag_names: ['other'] });
    const matches = await listHighlightsByTag(db, 'focus');
    expect(matches.map((h) => h.text).sort()).toEqual(['x', 'y']);
  });

  test('deleting a book cascades to its highlights', async () => {
    const { db, book } = await setup();
    const h = await createHighlight(db, { book_id: book.id, text: 'doomed' });
    await deleteBook(db, book.id);
    expect(await getHighlight(db, h.id)).toBeNull();
  });

  test('deleteHighlight removes the row and its tag joins', async () => {
    const { db, book } = await setup();
    const h = await createHighlight(db, { book_id: book.id, text: 't', tag_names: ['x'] });
    await deleteHighlight(db, h.id);
    expect(await getHighlight(db, h.id)).toBeNull();
    const joins = await db.getAllAsync(
      'SELECT * FROM highlight_tags WHERE highlight_id = ?',
      [h.id]
    );
    expect(joins).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- tests/db/highlights.test.ts
```

- [ ] **Step 3: Implement `src/db/highlights.ts`**

```typescript
import type { DbExec } from './client';
import type { Highlight, HighlightWithRelations, NewHighlightInput, Book, Tag } from './types';
import { setHighlightTags, getTagsForHighlight } from './tags';
import { getBook } from './books';

async function hydrate(db: DbExec, h: Highlight): Promise<HighlightWithRelations> {
  const book = await getBook(db, h.book_id);
  if (!book) throw new Error(`Book ${h.book_id} missing for highlight ${h.id}`);
  const tags = await getTagsForHighlight(db, h.id);
  return { ...h, book, tags };
}

export async function createHighlight(
  db: DbExec,
  input: NewHighlightInput
): Promise<HighlightWithRelations> {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO highlights (book_id, text, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [input.book_id, input.text, input.note ?? null, now, now]
  );
  const id = result.lastInsertRowId;
  if (input.tag_names && input.tag_names.length > 0) {
    await setHighlightTags(db, id, input.tag_names);
  }
  const row = await db.getFirstAsync<Highlight>('SELECT * FROM highlights WHERE id = ?', [id]);
  if (!row) throw new Error(`Failed to load highlight ${id} after insert`);
  return hydrate(db, row);
}

export async function getHighlight(
  db: DbExec,
  id: number
): Promise<HighlightWithRelations | null> {
  const row = await db.getFirstAsync<Highlight>('SELECT * FROM highlights WHERE id = ?', [id]);
  if (!row) return null;
  return hydrate(db, row);
}

export async function listHighlightsByBook(
  db: DbExec,
  bookId: number
): Promise<HighlightWithRelations[]> {
  const rows = await db.getAllAsync<Highlight>(
    'SELECT * FROM highlights WHERE book_id = ? ORDER BY created_at DESC',
    [bookId]
  );
  return Promise.all(rows.map((r) => hydrate(db, r)));
}

export async function listHighlightsByTag(
  db: DbExec,
  tagName: string
): Promise<HighlightWithRelations[]> {
  const rows = await db.getAllAsync<Highlight>(
    `SELECT h.* FROM highlights h
     INNER JOIN highlight_tags ht ON ht.highlight_id = h.id
     INNER JOIN tags t ON t.id = ht.tag_id
     WHERE t.name = ?
     ORDER BY h.created_at DESC`,
    [tagName.trim().toLowerCase()]
  );
  return Promise.all(rows.map((r) => hydrate(db, r)));
}

export async function updateHighlight(
  db: DbExec,
  id: number,
  input: { text: string; note?: string | null; tag_names?: string[] }
): Promise<HighlightWithRelations> {
  const now = Date.now();
  await db.runAsync(
    'UPDATE highlights SET text = ?, note = ?, updated_at = ? WHERE id = ?',
    [input.text, input.note ?? null, now, id]
  );
  if (input.tag_names) {
    await setHighlightTags(db, id, input.tag_names);
  }
  const updated = await getHighlight(db, id);
  if (!updated) throw new Error(`Highlight ${id} not found after update`);
  return updated;
}

export async function deleteHighlight(db: DbExec, id: number): Promise<void> {
  await db.runAsync('DELETE FROM highlights WHERE id = ?', [id]);
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- tests/db/highlights.test.ts
```

Expected: PASS, 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/db/highlights.ts tests/db/highlights.test.ts
git commit -m "feat(db): highlights CRUD with cascade"
```

---

## Task 9: Search across highlights and book titles

**Files:**
- Create: `src/db/search.ts`, `tests/db/search.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/db/search.test.ts
import { search } from '../../src/db/search';
import { runMigrations } from '../../src/db/schema';
import { createBook } from '../../src/db/books';
import { createHighlight } from '../../src/db/highlights';
import { openTestDb } from './testDb';

async function setup() {
  const db = openTestDb();
  await runMigrations(db);
  return db;
}

describe('search', () => {
  test('matches highlight text via FTS', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'Random' });
    await createHighlight(db, { book_id: book.id, text: 'systems are how we win', tag_names: [] });
    await createHighlight(db, { book_id: book.id, text: 'unrelated content', tag_names: [] });
    const r = await search(db, 'systems');
    expect(r.highlights.map((h) => h.text)).toEqual(['systems are how we win']);
  });

  test('matches highlight notes', async () => {
    const db = await setup();
    const book = await createBook(db, { title: 'X' });
    await createHighlight(db, {
      book_id: book.id,
      text: 'q',
      note: 'noteworthy thought',
      tag_names: []
    });
    const r = await search(db, 'noteworthy');
    expect(r.highlights).toHaveLength(1);
  });

  test('matches book titles via LIKE', async () => {
    const db = await setup();
    await createBook(db, { title: 'Atomic Habits' });
    await createBook(db, { title: 'Other Book' });
    const r = await search(db, 'atomic');
    expect(r.books.map((b) => b.title)).toEqual(['Atomic Habits']);
  });

  test('returns empty results for empty query', async () => {
    const db = await setup();
    const r = await search(db, '   ');
    expect(r).toEqual({ highlights: [], books: [] });
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- tests/db/search.test.ts
```

- [ ] **Step 3: Implement `src/db/search.ts`**

```typescript
import type { DbExec } from './client';
import type { Book, HighlightWithRelations, Highlight } from './types';
import { getBook } from './books';
import { getTagsForHighlight } from './tags';

export type SearchResult = { highlights: HighlightWithRelations[]; books: Book[] };

function ftsQuery(input: string): string {
  // Escape FTS5 syntax characters by quoting each token, then join with AND
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"`);
  return tokens.join(' ');
}

export async function search(db: DbExec, query: string): Promise<SearchResult> {
  const q = query.trim();
  if (!q) return { highlights: [], books: [] };

  const fts = ftsQuery(q);
  const highlightRows = await db.getAllAsync<Highlight>(
    `SELECT h.* FROM highlights h
     INNER JOIN highlights_fts ON highlights_fts.rowid = h.id
     WHERE highlights_fts MATCH ?
     ORDER BY h.created_at DESC`,
    [fts]
  );

  const highlights = await Promise.all(
    highlightRows.map(async (h) => {
      const book = await getBook(db, h.book_id);
      const tags = await getTagsForHighlight(db, h.id);
      return { ...h, book: book!, tags };
    })
  );

  const books = await db.getAllAsync<Book>(
    'SELECT * FROM books WHERE title LIKE ? ORDER BY title COLLATE NOCASE ASC',
    [`%${q}%`]
  );

  return { highlights, books };
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- tests/db/search.test.ts
```

Expected: PASS, 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/db/search.ts tests/db/search.test.ts
git commit -m "feat(db): search across highlights and book titles"
```

---

## Task 10: Markdown export (pure functions)

**Files:**
- Create: `src/export/markdown.ts`, `tests/export/markdown.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/export/markdown.test.ts
import {
  renderHighlight,
  renderBookSection,
  renderLibrary,
  renderBookExport,
  renderTagExport
} from '../../src/export/markdown';
import type { Book, HighlightWithRelations } from '../../src/db/types';

const mkBook = (over: Partial<Book> = {}): Book => ({
  id: 1, title: 'Atomic Habits', author: 'James Clear', created_at: 0, ...over
});

const mkHighlight = (over: Partial<HighlightWithRelations> = {}): HighlightWithRelations => ({
  id: 1,
  book_id: 1,
  text: 'You do not rise to the level of your goals.',
  note: null,
  created_at: new Date('2026-05-05T10:00:00Z').getTime(),
  updated_at: new Date('2026-05-05T10:00:00Z').getTime(),
  book: mkBook(),
  tags: [],
  ...over
});

describe('renderHighlight', () => {
  test('basic blockquote with saved date only', () => {
    const out = renderHighlight(mkHighlight());
    expect(out).toBe(
      '> You do not rise to the level of your goals.\n\n— Saved: 2026-05-05'
    );
  });

  test('includes tags line when tags present', () => {
    const out = renderHighlight(
      mkHighlight({ tags: [{ id: 1, name: 'habits' }, { id: 2, name: 'systems' }] })
    );
    expect(out).toContain('— Tags: #habits #systems');
  });

  test('includes note line when note present', () => {
    const out = renderHighlight(mkHighlight({ note: 'reframed goals' }));
    expect(out).toContain('— Note: reframed goals');
  });

  test('omits tags and note when both absent', () => {
    const out = renderHighlight(mkHighlight());
    expect(out).not.toContain('Tags:');
    expect(out).not.toContain('Note:');
  });
});

describe('renderBookSection', () => {
  test('book heading with author italics and highlights separated by ---', () => {
    const book = mkBook();
    const hs = [
      mkHighlight({ id: 1, text: 'A' }),
      mkHighlight({ id: 2, text: 'B' })
    ];
    const out = renderBookSection(book, hs);
    expect(out).toMatch(/^# Atomic Habits\n\*by James Clear\*\n\n/);
    expect(out).toContain('> A');
    expect(out).toContain('> B');
    expect((out.match(/\n---\n/g) ?? []).length).toBe(1);
  });

  test('omits author line when author null', () => {
    const out = renderBookSection(mkBook({ author: null }), [mkHighlight()]);
    expect(out).not.toContain('*by');
  });
});

describe('renderLibrary', () => {
  test('groups highlights by book, sorted alphabetically by book title', () => {
    const b1 = mkBook({ id: 1, title: 'Bravo' });
    const b2 = mkBook({ id: 2, title: 'Alpha' });
    const out = renderLibrary([
      { book: b1, highlights: [mkHighlight({ book: b1, text: 'b' })] },
      { book: b2, highlights: [mkHighlight({ book: b2, text: 'a' })] }
    ]);
    const aIdx = out.indexOf('# Alpha');
    const bIdx = out.indexOf('# Bravo');
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(aIdx);
  });
});

describe('renderTagExport', () => {
  test('top-level tag heading then ## book subsections', () => {
    const b1 = mkBook({ id: 1, title: 'Alpha' });
    const b2 = mkBook({ id: 2, title: 'Bravo' });
    const out = renderTagExport('habits', [
      mkHighlight({ id: 1, book: b1, text: 'x', tags: [{ id: 1, name: 'habits' }] }),
      mkHighlight({ id: 2, book: b2, text: 'y', tags: [{ id: 1, name: 'habits' }] })
    ]);
    expect(out).toMatch(/^# Tag: habits\n\n/);
    expect(out).toContain('## Alpha');
    expect(out).toContain('## Bravo');
  });
});

describe('renderBookExport', () => {
  test('thin wrapper over renderBookSection', () => {
    const book = mkBook();
    const out = renderBookExport(book, [mkHighlight()]);
    expect(out).toContain('# Atomic Habits');
    expect(out).toContain('> You do not rise');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- tests/export/markdown.test.ts
```

- [ ] **Step 3: Implement `src/export/markdown.ts`**

```typescript
import type { Book, HighlightWithRelations } from '../db/types';

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function renderHighlight(h: HighlightWithRelations): string {
  const lines: string[] = [`> ${h.text}`, ''];
  if (h.tags.length > 0) {
    lines.push(`— Tags: ${h.tags.map((t) => `#${t.name}`).join(' ')}`);
  }
  if (h.note) {
    lines.push(`— Note: ${h.note}`);
  }
  lines.push(`— Saved: ${isoDate(h.created_at)}`);
  return lines.join('\n');
}

export function renderBookSection(book: Book, highlights: HighlightWithRelations[]): string {
  const head = book.author
    ? `# ${book.title}\n*by ${book.author}*\n\n`
    : `# ${book.title}\n\n`;
  return head + highlights.map(renderHighlight).join('\n\n---\n\n');
}

export function renderBookExport(book: Book, highlights: HighlightWithRelations[]): string {
  return renderBookSection(book, highlights);
}

export function renderLibrary(
  data: Array<{ book: Book; highlights: HighlightWithRelations[] }>
): string {
  const sorted = [...data].sort((a, b) =>
    a.book.title.localeCompare(b.book.title, undefined, { sensitivity: 'base' })
  );
  return sorted.map(({ book, highlights }) => renderBookSection(book, highlights)).join('\n\n');
}

export function renderTagExport(tagName: string, highlights: HighlightWithRelations[]): string {
  const byBook = new Map<number, { book: Book; highlights: HighlightWithRelations[] }>();
  for (const h of highlights) {
    const entry = byBook.get(h.book.id) ?? { book: h.book, highlights: [] };
    entry.highlights.push(h);
    byBook.set(h.book.id, entry);
  }
  const groups = Array.from(byBook.values()).sort((a, b) =>
    a.book.title.localeCompare(b.book.title, undefined, { sensitivity: 'base' })
  );
  const sections = groups.map(({ book, highlights }) => {
    const subhead = book.author
      ? `## ${book.title}\n*by ${book.author}*\n\n`
      : `## ${book.title}\n\n`;
    return subhead + highlights.map(renderHighlight).join('\n\n---\n\n');
  });
  return `# Tag: ${tagName}\n\n` + sections.join('\n\n');
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- tests/export/markdown.test.ts
```

Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/export/markdown.ts tests/export/markdown.test.ts
git commit -m "feat(export): markdown rendering pure functions"
```

---

## Task 11: Share helper (write file + invoke share sheet)

**Files:**
- Create: `src/export/share.ts`

- [ ] **Step 1: Implement `src/export/share.ts`**

```typescript
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareMarkdown(filename: string, content: string): Promise<void> {
  const safeName = filename.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 80) || 'highlights';
  const path = `${FileSystem.cacheDirectory}${safeName}-${Date.now()}.md`;
  await FileSystem.writeAsStringAsync(path, content, {
    encoding: FileSystem.EncodingType.UTF8
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/markdown', dialogTitle: 'Export highlights' });
  }
}
```

This module is intentionally not unit-tested: it's a thin pass-through over two mocked Expo APIs. Manual device testing in Task 23 covers it.

- [ ] **Step 2: Commit**

```bash
git add src/export/share.ts
git commit -m "feat(export): share helper writes file and invokes share sheet"
```

---

## Task 12: OCR wrapper

**Files:**
- Create: `src/ocr/recognize.ts`, `tests/ocr/recognize.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/ocr/recognize.test.ts
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { recognizeFromUri } from '../../src/ocr/recognize';

describe('recognizeFromUri', () => {
  test('returns the joined text from ML Kit blocks', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValueOnce({
      text: 'Block one.\nBlock two.',
      blocks: []
    });
    const out = await recognizeFromUri('file:///tmp/photo.jpg');
    expect(out).toBe('Block one.\nBlock two.');
  });

  test('returns empty string when no text detected', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValueOnce({ text: '', blocks: [] });
    const out = await recognizeFromUri('file:///tmp/empty.jpg');
    expect(out).toBe('');
  });

  test('trims surrounding whitespace', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValueOnce({
      text: '\n\n  hello  \n',
      blocks: []
    });
    expect(await recognizeFromUri('file:///x')).toBe('hello');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- tests/ocr/recognize.test.ts
```

- [ ] **Step 3: Implement `src/ocr/recognize.ts`**

```typescript
import TextRecognition from '@react-native-ml-kit/text-recognition';

export async function recognizeFromUri(uri: string): Promise<string> {
  const result = await TextRecognition.recognize(uri);
  return (result?.text ?? '').trim();
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- tests/ocr/recognize.test.ts
```

Expected: PASS, 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/ocr/recognize.ts tests/ocr/recognize.test.ts
git commit -m "feat(ocr): wrap ML Kit text recognition"
```

---

## Task 13: App-level DB initialization

**Files:**
- Create: `src/db/init.ts`, modify `app/_layout.tsx`

- [ ] **Step 1: Implement `src/db/init.ts`**

```typescript
import { getDb } from './client';
import { runMigrations } from './schema';

let initPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await getDb();
      await runMigrations(db);
    })();
  }
  return initPromise;
}
```

- [ ] **Step 2: Wire into `app/_layout.tsx`**

Replace the contents of `app/_layout.tsx` (which the Expo Router template generated) with:

```tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { initDb } from '@/src/db/init';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    initDb().then(() => setReady(true)).catch(setError);
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text>Failed to initialize database</Text>
        <Text selectable>{error.message}</Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="capture" options={{ title: 'Capture' }} />
      <Stack.Screen name="review" options={{ title: 'Review' }} />
      <Stack.Screen name="book/[id]" options={{ title: 'Book' }} />
      <Stack.Screen name="highlight/[id]" options={{ title: 'Highlight' }} />
      <Stack.Screen name="tag/[name]" options={{ title: 'Tag' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/db/init.ts app/_layout.tsx
git commit -m "feat: app-level DB init and root stack"
```

---

## Task 14: Tab navigator and route placeholders

**Files:**
- Create: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/tags.tsx`, `app/(tabs)/settings.tsx`
- Create: `app/capture.tsx`, `app/review.tsx`, `app/book/[id].tsx`, `app/highlight/[id].tsx`, `app/tag/[name].tsx`

This task wires up the routing surface only — every screen renders a placeholder. Real screens land in later tasks.

- [ ] **Step 1: Replace tabs layout — `app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: 'Library', tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="tags"
        options={{ title: 'Tags', tabBarIcon: ({ color, size }) => <Ionicons name="pricetag" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Add placeholder screens**

For each of these files, the body is the same template — only the displayed name changes.

`app/(tabs)/index.tsx`:

```tsx
import { View, Text } from 'react-native';
export default function Library() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Library</Text></View>;
}
```

Repeat the same shape for: `app/(tabs)/tags.tsx` (Text "Tags"), `app/(tabs)/settings.tsx` (Text "Settings"), `app/capture.tsx` ("Capture"), `app/review.tsx` ("Review"), `app/book/[id].tsx` ("Book Detail"), `app/highlight/[id].tsx` ("Highlight Detail"), `app/tag/[name].tsx` ("Tag Detail").

- [ ] **Step 3: Delete leftover template routes**

Remove any leftover routes from the `tabs@51` template that we are not using (e.g. `app/(tabs)/two.tsx`, modal routes). Keep only the files listed above and `_layout.tsx`.

```bash
git status
```

Then `git rm` any unused template routes.

- [ ] **Step 4: Commit**

```bash
git add app
git commit -m "feat(routing): tab navigator and placeholder screens"
```

---

## Task 15: Hooks layer

**Files:**
- Create: `src/hooks/useBooks.ts`, `src/hooks/useHighlights.ts`, `src/hooks/useTags.ts`

These hooks wrap the DB modules and expose React-friendly state. They share a refresh trigger so mutations re-fetch.

- [ ] **Step 1: Create `src/hooks/useBooks.ts`**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
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
    return book;
  }, [refresh]);

  return { books, loading, refresh, create };
}
```

- [ ] **Step 2: Create `src/hooks/useHighlights.ts`**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import type { HighlightWithRelations, NewHighlightInput } from '@/src/db/types';

export function useHighlightsByBook(bookId: number | null) {
  const [highlights, setHighlights] = useState<HighlightWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (bookId == null) { setHighlights([]); setLoading(false); return; }
    const db = await getDb();
    setHighlights(await Highlights.listHighlightsByBook(db, bookId));
    setLoading(false);
  }, [bookId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { highlights, loading, refresh };
}

export async function createHighlight(input: NewHighlightInput) {
  const db = await getDb();
  return Highlights.createHighlight(db, input);
}

export async function updateHighlight(
  id: number,
  input: { text: string; note?: string | null; tag_names?: string[] }
) {
  const db = await getDb();
  return Highlights.updateHighlight(db, id, input);
}

export async function deleteHighlight(id: number) {
  const db = await getDb();
  return Highlights.deleteHighlight(db, id);
}
```

- [ ] **Step 3: Create `src/hooks/useTags.ts`**

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks
git commit -m "feat(hooks): useBooks, useHighlights, useTags"
```

---

## Task 16: Reusable components

**Files:**
- Create: `src/components/EmptyState.tsx`, `src/components/ConfirmDialog.tsx`, `src/components/HighlightCard.tsx`, `src/components/TagInput.tsx`, `src/components/BookPicker.tsx`

- [ ] **Step 1: `src/components/EmptyState.tsx`**

```tsx
import { View, Text } from 'react-native';

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ textAlign: 'center', color: '#666' }}>{message}</Text>
    </View>
  );
}
```

- [ ] **Step 2: `src/components/ConfirmDialog.tsx`**

```tsx
import { Alert } from 'react-native';

export function confirm(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(opts.title, opts.message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: opts.confirmLabel ?? 'Confirm',
        style: opts.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true)
      }
    ]);
  });
}
```

- [ ] **Step 3: `src/components/HighlightCard.tsx`**

```tsx
import { View, Text, Pressable } from 'react-native';
import type { HighlightWithRelations } from '@/src/db/types';

export function HighlightCard({
  highlight,
  onPress
}: {
  highlight: HighlightWithRelations;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
      <Text numberOfLines={4} style={{ fontSize: 15 }}>{highlight.text}</Text>
      {highlight.tags.length > 0 && (
        <Text style={{ marginTop: 6, color: '#888' }}>
          {highlight.tags.map((t) => `#${t.name}`).join(' ')}
        </Text>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 4: `src/components/TagInput.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';

export function TagInput({
  value,
  onChange,
  suggestions
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t) return;
    if (value.includes(t)) return;
    onChange([...value, t]);
    setDraft('');
  };

  const remove = (t: string) => onChange(value.filter((x) => x !== t));

  const filteredSuggestions =
    draft.trim().length > 0
      ? (suggestions ?? []).filter(
          (s) => s.startsWith(draft.trim().toLowerCase()) && !value.includes(s)
        ).slice(0, 5)
      : [];

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {value.map((t) => (
          <Pressable
            key={t}
            onPress={() => remove(t)}
            style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#eef', borderRadius: 12 }}
          >
            <Text>#{t} ✕</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => add(draft)}
        placeholder="Add tag, then press return"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
      />
      {filteredSuggestions.length > 0 && (
        <View style={{ marginTop: 6 }}>
          {filteredSuggestions.map((s) => (
            <Pressable key={s} onPress={() => add(s)} style={{ padding: 8 }}>
              <Text>#{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 5: `src/components/BookPicker.tsx`**

```tsx
import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import type { Book } from '@/src/db/types';

export function BookPicker({
  books,
  selectedId,
  onSelect,
  onCreate
}: {
  books: Book[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: (title: string, author: string | null) => Promise<Book>;
}) {
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => b.title.toLowerCase().includes(q));
  }, [books, filter]);

  const selected = books.find((b) => b.id === selectedId) ?? null;

  if (creating) {
    return (
      <View style={{ gap: 8 }}>
        <TextInput
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Title"
          style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
        />
        <TextInput
          value={newAuthor}
          onChangeText={setNewAuthor}
          placeholder="Author (optional)"
          style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={async () => {
              if (!newTitle.trim()) return;
              const b = await onCreate(newTitle.trim(), newAuthor.trim() || null);
              onSelect(b.id);
              setCreating(false);
              setNewTitle('');
              setNewAuthor('');
            }}
            style={{ padding: 10, backgroundColor: '#007aff', borderRadius: 8 }}
          >
            <Text style={{ color: '#fff' }}>Create</Text>
          </Pressable>
          <Pressable onPress={() => setCreating(false)} style={{ padding: 10 }}>
            <Text>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={{ marginBottom: 4 }}>
        {selected ? `Selected: ${selected.title}` : 'Pick a book'}
      </Text>
      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder="Search books"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 8 }}
      />
      <View style={{ maxHeight: 200 }}>
        {filtered.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => onSelect(b.id)}
            style={{
              padding: 10,
              backgroundColor: b.id === selectedId ? '#eef' : 'transparent',
              borderRadius: 6
            }}
          >
            <Text>{b.title}</Text>
            {b.author && <Text style={{ color: '#888' }}>{b.author}</Text>}
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setCreating(true)} style={{ padding: 10 }}>
        <Text style={{ color: '#007aff' }}>+ New book</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components
git commit -m "feat(components): reusable UI primitives"
```

---

## Task 17: Library screen

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Implement Library**

```tsx
import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import { search } from '@/src/db/search';
import type { Book, HighlightWithRelations } from '@/src/db/types';
import { EmptyState } from '@/src/components/EmptyState';
import { HighlightCard } from '@/src/components/HighlightCard';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function Library() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [searchHighlights, setSearchHighlights] = useState<HighlightWithRelations[]>([]);
  const [searchBooks, setSearchBooks] = useState<Book[]>([]);

  const load = useCallback(async () => {
    const db = await getDb();
    setBooks(await Books.listBooks(db));
    const rows = await db.getAllAsync<{ book_id: number; c: number }>(
      'SELECT book_id, COUNT(*) AS c FROM highlights GROUP BY book_id'
    );
    setCounts(Object.fromEntries(rows.map((r) => [r.book_id, r.c])));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!query.trim()) { setSearchHighlights([]); setSearchBooks([]); return; }
      const db = await getDb();
      const r = await search(db, query);
      if (cancelled) return;
      setSearchHighlights(r.highlights);
      setSearchBooks(r.books);
    })();
    return () => { cancelled = true; };
  }, [query]);

  const showingSearch = query.trim().length > 0;

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search highlights and books"
        style={{ margin: 12, padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 }}
      />
      {showingSearch ? (
        searchHighlights.length === 0 && searchBooks.length === 0 ? (
          <EmptyState message={`Nothing matches "${query}".`} />
        ) : (
          <FlatList
            data={[
              ...searchBooks.map((b) => ({ kind: 'book' as const, book: b })),
              ...searchHighlights.map((h) => ({ kind: 'hl' as const, hl: h }))
            ]}
            keyExtractor={(item) => (item.kind === 'book' ? `b${item.book.id}` : `h${item.hl.id}`)}
            renderItem={({ item }) =>
              item.kind === 'book' ? (
                <Pressable
                  onPress={() => router.push(`/book/${item.book.id}`)}
                  style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}
                >
                  <Text style={{ fontWeight: '600' }}>{item.book.title}</Text>
                  {item.book.author && <Text style={{ color: '#666' }}>{item.book.author}</Text>}
                </Pressable>
              ) : (
                <HighlightCard
                  highlight={item.hl}
                  onPress={() => router.push(`/highlight/${item.hl.id}`)}
                />
              )
            }
          />
        )
      ) : books.length === 0 ? (
        <EmptyState message="No highlights yet. Tap the camera to capture your first one." />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => String(b.id)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/book/${item.id}`)}
              style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}
            >
              <Text style={{ fontWeight: '600', fontSize: 16 }}>{item.title}</Text>
              {item.author && <Text style={{ color: '#666' }}>{item.author}</Text>}
              <Text style={{ color: '#999', marginTop: 2 }}>
                {counts[item.id] ?? 0} highlight{(counts[item.id] ?? 0) === 1 ? '' : 's'}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Pressable
        onPress={() => router.push('/capture')}
        style={{
          position: 'absolute',
          right: 24,
          bottom: 32,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#007aff',
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4
        }}
      >
        <Ionicons name="camera" color="#fff" size={28} />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat(library): book list, search, and FAB capture"
```

---

## Task 18: Capture screen

**Files:**
- Modify: `app/capture.tsx`

- [ ] **Step 1: Implement Capture**

```tsx
import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { recognizeFromUri } from '@/src/ocr/recognize';

export default function Capture() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ textAlign: 'center' }}>
          Camera access is needed to capture highlights.
        </Text>
        <Pressable
          onPress={async () => {
            const r = await requestPermission();
            if (!r.granted) Linking.openSettings();
          }}
          style={{ padding: 12, backgroundColor: '#007aff', borderRadius: 8 }}
        >
          <Text style={{ color: '#fff' }}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  const handleSnap = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: true });
      if (!photo?.uri) throw new Error('No photo URI');
      const text = await recognizeFromUri(photo.uri);
      // Discard the photo immediately
      try { await FileSystem.deleteAsync(photo.uri, { idempotent: true }); } catch {}

      if (!text) {
        Alert.alert('No text detected', 'Try again, or enter the highlight manually.', [
          { text: 'Retry', style: 'cancel' },
          { text: 'Enter manually', onPress: () => router.replace({ pathname: '/review', params: { text: '' } }) }
        ]);
        return;
      }
      router.replace({ pathname: '/review', params: { text } });
    } catch (e: any) {
      Alert.alert('Capture failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <View style={{ position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' }}>
        {busy ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <Pressable
            onPress={handleSnap}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#fff',
              borderWidth: 4,
              borderColor: '#ccc'
            }}
          />
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/capture.tsx
git commit -m "feat(capture): camera + OCR + photo discard"
```

---

## Task 19: Review screen (create + edit)

**Files:**
- Modify: `app/review.tsx`

The Review screen handles two modes via search params:
- **Create:** `?text=<ocr text>` (no highlight id) — saves a new highlight
- **Edit:** `?id=<highlight id>` — loads existing, saves with `updateHighlight`

- [ ] **Step 1: Implement Review**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import * as Tags from '@/src/db/tags';
import { useBooks } from '@/src/hooks/useBooks';
import { BookPicker } from '@/src/components/BookPicker';
import { TagInput } from '@/src/components/TagInput';
import { confirm } from '@/src/components/ConfirmDialog';

export default function Review() {
  const router = useRouter();
  const params = useLocalSearchParams<{ text?: string; id?: string }>();
  const editingId = params.id ? Number(params.id) : null;

  const { books, create: createBook, refresh: refreshBooks } = useBooks();
  const [text, setText] = useState(params.text ?? '');
  const [bookId, setBookId] = useState<number | null>(null);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(editingId != null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const t = await Tags.listTags(db);
      setAllTagNames(t.map((x) => x.name));
      if (editingId != null) {
        const h = await Highlights.getHighlight(db, editingId);
        if (h) {
          setText(h.text);
          setBookId(h.book_id);
          setTagNames(h.tags.map((tg) => tg.name));
          setNote(h.note ?? '');
        }
        setLoading(false);
      }
    })();
  }, [editingId]);

  const canSave = text.trim().length > 0 && bookId != null && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editingId != null) {
        await Highlights.updateHighlight(await getDb(), editingId, {
          text: text.trim(),
          note: note.trim() || null,
          tag_names: tagNames
        });
      } else {
        await Highlights.createHighlight(await getDb(), {
          book_id: bookId!,
          text: text.trim(),
          note: note.trim() || null,
          tag_names: tagNames
        });
      }
      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = async () => {
    if (await confirm({
      title: 'Discard?',
      message: 'Your changes will be lost.',
      confirmLabel: 'Discard',
      destructive: true
    })) {
      router.replace('/');
    }
  };

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Highlight text</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          style={{
            borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10,
            minHeight: 120, textAlignVertical: 'top'
          }}
        />
      </View>

      <View>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Book</Text>
        <BookPicker
          books={books}
          selectedId={bookId}
          onSelect={setBookId}
          onCreate={async (title, author) => {
            const b = await createBook({ title, author });
            await refreshBooks();
            return b;
          }}
        />
      </View>

      <View>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Tags</Text>
        <TagInput value={tagNames} onChange={setTagNames} suggestions={allTagNames} />
      </View>

      <View>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          style={{
            borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10,
            minHeight: 60, textAlignVertical: 'top'
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          style={{
            flex: 1, padding: 14, borderRadius: 8,
            backgroundColor: canSave ? '#007aff' : '#aac',
            alignItems: 'center'
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable onPress={onDiscard} style={{ padding: 14 }}>
          <Text>Discard</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/review.tsx
git commit -m "feat(review): create + edit highlight screen"
```

---

## Task 20: Book Detail screen

**Files:**
- Modify: `app/book/[id].tsx`

- [ ] **Step 1: Implement Book Detail**

```tsx
import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import type { Book, HighlightWithRelations } from '@/src/db/types';
import { renderBookExport } from '@/src/export/markdown';
import { shareMarkdown } from '@/src/export/share';
import { confirm } from '@/src/components/ConfirmDialog';
import { HighlightCard } from '@/src/components/HighlightCard';

export default function BookDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = Number(id);
  const [book, setBook] = useState<Book | null>(null);
  const [highlights, setHighlights] = useState<HighlightWithRelations[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');

  const load = useCallback(async () => {
    const db = await getDb();
    const b = await Books.getBook(db, bookId);
    setBook(b);
    if (b) { setTitle(b.title); setAuthor(b.author ?? ''); }
    setHighlights(await Highlights.listHighlightsByBook(db, bookId));
  }, [bookId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!book) return <View />;

  const onSaveEdit = async () => {
    const db = await getDb();
    const updated = await Books.updateBook(db, bookId, {
      title: title.trim() || book.title,
      author: author.trim() || null
    });
    setBook(updated);
    setEditing(false);
  };

  const onDelete = async () => {
    if (await confirm({
      title: 'Delete book?',
      message: `This will delete the book and its ${highlights.length} highlight${highlights.length === 1 ? '' : 's'}.`,
      confirmLabel: 'Delete',
      destructive: true
    })) {
      const db = await getDb();
      await Books.deleteBook(db, bookId);
      router.replace('/');
    }
  };

  const onExport = async () => {
    const md = renderBookExport(book, highlights);
    await shareMarkdown(book.title, md);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
        {editing ? (
          <View style={{ gap: 8 }}>
            <TextInput value={title} onChangeText={setTitle} placeholder="Title"
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }} />
            <TextInput value={author} onChangeText={setAuthor} placeholder="Author"
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={onSaveEdit}
                style={{ padding: 10, backgroundColor: '#007aff', borderRadius: 8 }}>
                <Text style={{ color: '#fff' }}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditing(false)} style={{ padding: 10 }}>
                <Text>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setEditing(true)}>
            <Text style={{ fontSize: 22, fontWeight: '600' }}>{book.title}</Text>
            {book.author && <Text style={{ color: '#666' }}>{book.author}</Text>}
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <Pressable onPress={onExport}><Text style={{ color: '#007aff' }}>Export Markdown</Text></Pressable>
          <Pressable onPress={onDelete}><Text style={{ color: '#c00' }}>Delete book</Text></Pressable>
        </View>
      </View>
      <FlatList
        data={highlights}
        keyExtractor={(h) => String(h.id)}
        renderItem={({ item }) => (
          <HighlightCard highlight={item} onPress={() => router.push(`/highlight/${item.id}`)} />
        )}
        ListEmptyComponent={<Text style={{ padding: 24, color: '#666' }}>No highlights yet for this book.</Text>}
      />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/book/[id].tsx"
git commit -m "feat(book): detail screen with edit, delete, export"
```

---

## Task 21: Highlight Detail screen

**Files:**
- Modify: `app/highlight/[id].tsx`

- [ ] **Step 1: Implement Highlight Detail**

```tsx
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import type { HighlightWithRelations } from '@/src/db/types';
import { confirm } from '@/src/components/ConfirmDialog';

export default function HighlightDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hid = Number(id);
  const [hl, setHl] = useState<HighlightWithRelations | null>(null);

  const load = useCallback(async () => {
    const db = await getDb();
    setHl(await Highlights.getHighlight(db, hid));
  }, [hid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!hl) return <View />;

  const onDelete = async () => {
    if (await confirm({
      title: 'Delete highlight?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true
    })) {
      await Highlights.deleteHighlight(await getDb(), hid);
      router.back();
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 18 }}>{hl.text}</Text>
      <View>
        <Text style={{ color: '#666' }}>From</Text>
        <Pressable onPress={() => router.push(`/book/${hl.book.id}`)}>
          <Text style={{ color: '#007aff', fontSize: 16 }}>
            {hl.book.title}{hl.book.author ? ` — ${hl.book.author}` : ''}
          </Text>
        </Pressable>
      </View>
      {hl.tags.length > 0 && (
        <View>
          <Text style={{ color: '#666' }}>Tags</Text>
          <Text>{hl.tags.map((t) => `#${t.name}`).join(' ')}</Text>
        </View>
      )}
      {hl.note && (
        <View>
          <Text style={{ color: '#666' }}>Note</Text>
          <Text>{hl.note}</Text>
        </View>
      )}
      <Text style={{ color: '#999' }}>Saved {new Date(hl.created_at).toLocaleString()}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => router.push({ pathname: '/review', params: { id: String(hid) } })}>
          <Text style={{ color: '#007aff' }}>Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete}>
          <Text style={{ color: '#c00' }}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/highlight/[id].tsx"
git commit -m "feat(highlight): detail screen with edit and delete"
```

---

## Task 22: Tags screen and tag detail

**Files:**
- Modify: `app/(tabs)/tags.tsx`, `app/tag/[name].tsx`

- [ ] **Step 1: Implement Tags list `app/(tabs)/tags.tsx`**

```tsx
import { useCallback } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTagsWithCounts } from '@/src/hooks/useTags';
import { EmptyState } from '@/src/components/EmptyState';

export default function TagsList() {
  const router = useRouter();
  const { tags, refresh } = useTagsWithCounts();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  if (tags.length === 0) return <EmptyState message="Tags you add will appear here." />;

  return (
    <FlatList
      data={tags}
      keyExtractor={(t) => String(t.id)}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/tag/${encodeURIComponent(item.name)}`)}
          style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}
        >
          <Text style={{ fontSize: 16 }}>#{item.name}</Text>
          <Text style={{ color: '#999' }}>{item.count} highlight{item.count === 1 ? '' : 's'}</Text>
        </Pressable>
      )}
    />
  );
}
```

- [ ] **Step 2: Implement Tag detail `app/tag/[name].tsx`**

```tsx
import { useCallback, useState } from 'react';
import { View, FlatList, Pressable, Text } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getDb } from '@/src/db/client';
import * as Highlights from '@/src/db/highlights';
import type { HighlightWithRelations } from '@/src/db/types';
import { HighlightCard } from '@/src/components/HighlightCard';
import { renderTagExport } from '@/src/export/markdown';
import { shareMarkdown } from '@/src/export/share';

export default function TagDetail() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const tagName = decodeURIComponent(String(name));
  const [items, setItems] = useState<HighlightWithRelations[]>([]);

  const load = useCallback(async () => {
    const db = await getDb();
    setItems(await Highlights.listHighlightsByTag(db, tagName));
  }, [tagName]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>#{tagName}</Text>
        <Pressable onPress={async () => shareMarkdown(`tag-${tagName}`, renderTagExport(tagName, items))}>
          <Text style={{ color: '#007aff' }}>Export</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(h) => String(h.id)}
        renderItem={({ item }) => (
          <HighlightCard highlight={item} onPress={() => router.push(`/highlight/${item.id}`)} />
        )}
      />
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/tags.tsx" "app/tag/[name].tsx"
git commit -m "feat(tags): tag list and tag detail with export"
```

---

## Task 23: Settings screen — export all

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Implement Settings**

```tsx
import { View, Text, Pressable, Alert } from 'react-native';
import Constants from 'expo-constants';
import { getDb } from '@/src/db/client';
import * as Books from '@/src/db/books';
import * as Highlights from '@/src/db/highlights';
import { renderLibrary } from '@/src/export/markdown';
import { shareMarkdown } from '@/src/export/share';

export default function Settings() {
  const exportAll = async () => {
    try {
      const db = await getDb();
      const books = await Books.listBooks(db);
      const sections = await Promise.all(
        books.map(async (book) => ({
          book,
          highlights: await Highlights.listHighlightsByBook(db, book.id)
        }))
      );
      const md = renderLibrary(sections.filter((s) => s.highlights.length > 0));
      if (!md.trim()) {
        Alert.alert('Nothing to export', 'You have no highlights yet.');
        return;
      }
      await shareMarkdown('all-highlights', md);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Unknown error');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Pressable onPress={exportAll} style={{ padding: 14, backgroundColor: '#007aff', borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Export all highlights (Markdown)</Text>
      </Pressable>
      <View>
        <Text style={{ color: '#666' }}>About</Text>
        <Text>Kindle Highlights v{Constants.expoConfig?.version ?? '0.0.0'}</Text>
        <Text style={{ color: '#666' }}>All data is stored locally on this device.</Text>
      </View>
    </View>
  );
}
```

Install expo-constants if not already present:

```bash
npx expo install expo-constants
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/settings.tsx package.json package-lock.json
git commit -m "feat(settings): export-all and about"
```

---

## Task 24: Build a Dev Client and run on a device

ML Kit OCR requires a native build. From this point forward, validation happens on a real Android device (and an iOS device or simulator if desired).

- [ ] **Step 1: Install EAS CLI (if not installed)**

```bash
npm install -g eas-cli
eas login
```

- [ ] **Step 2: Configure EAS**

```bash
eas build:configure
```

- [ ] **Step 3: Build the Android Dev Client**

```bash
eas build --profile development --platform android
```

Expected: a build URL to download an `.apk` for the dev client. Install on your Android phone.

- [ ] **Step 4: Run the dev server**

```bash
npx expo start --dev-client
```

Open the dev client app on the phone and scan the QR code or enter the local URL.

- [ ] **Step 5: Manual smoke test on device**

Walk through this checklist on a real device:

1. App launches, lands on Library, empty state visible.
2. Tap camera FAB → permission prompt → grant → camera preview shows.
3. Photograph a Kindle highlight → OCR completes → Review screen pre-filled with text.
4. Create a new book inline ("Atomic Habits", "James Clear"). Save with one tag, no note.
5. Library shows the book with `1 highlight`.
6. Tap the book → see the highlight. Tap the highlight → detail view.
7. Edit the highlight, change a word, save. Detail reflects the change.
8. Capture a second highlight. Pick the existing book. Add two tags including a brand new one.
9. Switch to Tags tab → both tags shown with counts. Tap a tag → see correct highlights.
10. From a tag detail, Export → share sheet appears, send to yourself, file opens as Markdown.
11. From a book detail, Export → file contains both highlights.
12. From Settings, Export all → file contains everything.
13. Delete a highlight → confirm dialog → highlight gone.
14. Delete a book → confirmation shows correct count → cascade works, tags screen counts update.
15. Toggle airplane mode and repeat capture/save/export — everything still works.

- [ ] **Step 6: Final commit and tag**

```bash
git tag v0.1.0
git commit --allow-empty -m "chore: v0.1.0 — feature-complete on-device build"
```

---

## Spec Coverage Self-Review

| Spec section | Tasks |
|---|---|
| Stack & Dev Client | 1, 2, 24 |
| Offline guarantee | 4–13 (all local) |
| Data model + FTS + migrations | 4, 5 |
| Books CRUD | 6 |
| Tags CRUD + join | 7 |
| Highlights CRUD + cascade | 8 |
| Search across highlights and book titles | 9 |
| Markdown export (library/book/tag variants, omission rules) | 10 |
| Share sheet | 11 |
| OCR wrapper | 12 |
| App-level DB init | 13 |
| Tab navigation + stack routes | 14 |
| Hooks layer | 15 |
| Reusable components (BookPicker, TagInput, HighlightCard, EmptyState, ConfirmDialog) | 16 |
| Library screen + FAB + search | 17 |
| Capture screen + permission + photo discard | 18 |
| Review screen (create + edit) | 19 |
| Book detail + edit/delete/export | 20 |
| Highlight detail + edit/delete | 21 |
| Tags screen + tag detail + export | 22 |
| Settings + export all + about | 23 |
| Manual device validation | 24 |

No gaps.
