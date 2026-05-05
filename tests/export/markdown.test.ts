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
