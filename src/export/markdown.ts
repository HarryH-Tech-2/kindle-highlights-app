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
