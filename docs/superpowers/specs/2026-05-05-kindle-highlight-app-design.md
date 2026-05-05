# Kindle Highlight App — Design

**Date:** 2026-05-05
**Status:** Approved (pending user spec review)

## Purpose

A mobile app that lets the user photograph a Kindle highlight, extract the text via on-device OCR, organize it under a book with optional tags and notes, and export to Markdown. Fully offline. Local-only storage.

## Scope

**In scope (v1):**
- Capture a photo, OCR it on-device, discard the photo
- Edit and save the extracted text under a book (required) with tags (optional) and a note (optional)
- Browse by book, browse by tag, full-text search
- Export to Markdown (whole library, single book, or single tag)
- Local SQLite storage; no cloud, no accounts

**Explicitly out of scope:**
- Cloud sync, multi-device, accounts
- Cloud OCR (on-device only)
- Photo storage (photos discarded immediately after OCR)
- Readwise / Notion / Obsidian integrations (export to Markdown is the integration story)
- JSON export (Markdown only)
- E2E tests

## Stack

- **Expo (SDK 51+) + React Native** with **Expo Dev Client** (required for ML Kit native module — Expo Go won't work)
- **TypeScript**
- **Expo Router** — file-based navigation
- **expo-sqlite** — local DB
- **expo-camera** — capture
- **expo-image-picker** — fallback "pick from gallery"
- **@react-native-ml-kit/text-recognition** — on-device OCR
- **expo-sharing** + **expo-file-system** — write Markdown file and invoke system share sheet
- **Jest** + **React Native Testing Library** — tests

Targets both iOS and Android app stores.

## Offline Guarantee

Every runtime path works without network. Internet is required only for: initial install, app updates. Camera capture, OCR, storage, browsing, search, export — all offline.

## Data Model

SQLite, four tables plus an FTS index.

### `books`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| title | TEXT NOT NULL | |
| author | TEXT | optional |
| created_at | INTEGER NOT NULL | unix ms |

### `highlights`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| book_id | INTEGER NOT NULL | FK → books.id, ON DELETE CASCADE |
| text | TEXT NOT NULL | the OCR'd + edited quote |
| note | TEXT | optional personal note (also where Kindle "Location/Page" goes) |
| created_at | INTEGER NOT NULL | |
| updated_at | INTEGER NOT NULL | |

### `tags`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL UNIQUE | |

### `highlight_tags` (join)
| Column | Type | Notes |
|---|---|---|
| highlight_id | INTEGER NOT NULL | FK, ON DELETE CASCADE |
| tag_id | INTEGER NOT NULL | FK, ON DELETE CASCADE |
| PRIMARY KEY (highlight_id, tag_id) | | |

### FTS index
- Virtual table `highlights_fts` over `highlights.text` and `highlights.note`
- Kept in sync via SQLite triggers on insert/update/delete

### Migrations
- Schema version stored in a `meta` table (key/value)
- Versioned, idempotent migration steps run on app start
- Day-one v1 migration creates everything above

## Screens & Navigation

Bottom tab bar with three top-level destinations: **Library**, **Tags**, **Settings**. Capture is a floating action button on Library. Capture/Review/Detail screens are stack-pushed above the tabs.

### 1. Library (`/`)
- Search bar (searches highlight text + notes + book titles via FTS for highlights, LIKE for book titles)
- List of books: title, author (if present), highlight count
- FAB: Capture button → `/capture`
- Tap book → `/book/[id]`
- Empty state: "No highlights yet. Tap the camera to capture your first one."

### 2. Capture (`/capture`)
- Live camera preview, shutter button
- Permission flow: contextual request on first entry; if denied, show explainer with "Open Settings"
- On shutter: take photo (in-memory), run ML Kit OCR, discard photo immediately
- On success: navigate to `/review` with OCR text
- On no-text: dialog with **Retry** (stay on camera) and **Enter manually** (go to `/review` with empty text)

### 3. Review & Save (`/review`)
- Editable multiline text area, pre-filled with OCR result
- Book picker: searchable dropdown of existing books, with "+ New book" inline (asks title, optional author)
- Tag input: chip-style, autocomplete from existing tags, free entry creates new tag
- Optional note field
- **Save** button (disabled until text + book are both set) → write to DB, return to Library
- **Discard** button → confirmation dialog → return to Library

### 4. Book Detail (`/book/[id]`)
- Book title + author (tap to edit inline)
- List of highlights for this book, newest first
- Tap highlight → `/highlight/[id]`
- Top-right menu: **Export this book** (Markdown), **Delete book** (confirm dialog showing highlight count, cascades)

### 5. Highlight Detail (`/highlight/[id]`)
- Full text, note, tags, book, created/updated timestamps
- **Edit** → reuses Review screen UI
- **Delete** → confirmation dialog

### 6. Tags (`/tags`)
- List of all tags with usage counts, sorted by count desc
- Tap tag → list of highlights with that tag (cross-book)
- From the tag's highlight list: **Export this tag** (Markdown)
- Empty state: "Tags you add will appear here."

### 7. Settings (`/settings`)
- **Export all data** (Markdown)
- **About** (version, links)

## OCR Flow Detail

1. User taps shutter on Capture screen
2. `expo-camera` returns a photo (file URI or base64 in memory)
3. Pass to `@react-native-ml-kit/text-recognition`
4. Receive recognized text blocks; join in reading order
5. Delete the temp photo file (if camera wrote one) immediately
6. Navigate to Review with the joined text

The photo never touches the database, never persists past step 5, and is never written to the app's documents directory.

## Markdown Export Format

One `.md` file. Books as `# Heading 1`. Each highlight is a blockquote followed by metadata lines, separated by `---`.

```markdown
# Atomic Habits
*by James Clear*

> You do not rise to the level of your goals. You fall to the level of your systems.

— Tags: #habits #systems
— Note: this reframed how I think about goal-setting
— Saved: 2026-05-05

---

> Every action you take is a vote for the type of person you wish to become.

— Tags: #identity #habits
— Saved: 2026-05-04
```

**Variants:**
- **Whole library:** all books, stacked, sorted alphabetically by title
- **Single book:** one `# Title` section
- **Single tag:** top-level `# Tag: habits`, then `## Book Title` subsections grouping highlights by book

**Metadata line rules:**
- Omit the `Tags:` line if no tags
- Omit the `Note:` line if no note
- `Saved:` always present, ISO date (YYYY-MM-DD)
- `*by Author*` line omitted if no author

**Mechanism:** build the Markdown string in memory, write to `${FileSystem.cacheDirectory}/highlights-export-<timestamp>.md`, hand to `expo-sharing.shareAsync` to invoke the system share sheet.

## Error Handling & Edge Cases

- **OCR no text:** Retry / Enter manually dialog
- **Camera permission denied:** explainer screen with "Open Settings" deep link
- **Delete book:** confirmation dialog stating "This will delete the book and its N highlights"; cascade via FK
- **Delete highlight:** confirmation dialog
- **Discard unsaved review:** confirmation dialog
- **Empty library / empty tags / no search results:** dedicated empty states with helpful copy
- **DB migration failure:** fail loudly with an error screen offering "Export raw DB" so user can recover; do not silently corrupt data

**Explicitly not handling:**
- Sync conflict resolution (no sync)
- Offline retry queues (all writes are local)
- Image compression (no image storage)
- Multi-user (single-user device-local app)

## Project Structure

```
app/
  _layout.tsx           # tab navigator + stack
  index.tsx             # Library
  capture.tsx           # Capture
  review.tsx            # Review & Save (also handles edit mode)
  tags.tsx              # Tags list
  settings.tsx          # Settings
  book/
    [id].tsx            # Book Detail
  highlight/
    [id].tsx            # Highlight Detail
  tag/
    [name].tsx          # Highlights for a tag
src/
  db/
    schema.ts           # migrations
    books.ts            # CRUD for books
    highlights.ts       # CRUD for highlights
    tags.ts             # CRUD for tags + join
    search.ts           # FTS queries
  ocr/
    recognize.ts        # wraps ML Kit
  export/
    markdown.ts         # pure functions: data → markdown string
    share.ts            # write file + invoke share sheet
  components/
    BookPicker.tsx
    TagInput.tsx
    HighlightCard.tsx
    EmptyState.tsx
    ConfirmDialog.tsx
  hooks/
    useBooks.ts
    useHighlights.ts
    useTags.ts
tests/
  db/
  export/
```

Each module has one clear purpose. Components consume hooks; hooks call DB modules. The DB layer is the only thing that touches SQLite. The export layer is pure functions over typed input — easy to test.

## Testing Strategy

Proportional to a solo project; chase value, not coverage numbers.

**Unit (Jest, in-memory SQLite):**
- `src/db/*` — every CRUD function, including cascade behavior on book delete
- `src/db/search.ts` — FTS queries return expected rows for sample data
- `src/export/markdown.ts` — sample data → exact string output, including all variants (library / book / tag) and metadata-line omission rules

**Component (React Native Testing Library):**
- Review screen: edits text, picks book, adds tags, saves → asserts correct DB calls
- Library: renders books, search filters list
- Empty states render at the right times

**Manual / device-only:**
- Camera capture + OCR end-to-end (requires real device — ML Kit native module)
- Permission flows on iOS and Android
- Share sheet behavior on iOS vs Android

**Out of scope:**
- E2E (Detox/Maestro)
- Snapshot tests
- Coverage targets

## Open Decisions

None at design time. Implementation may surface UX details (exact iconography, animation choices, empty-state illustrations) that will be decided in-flight.
