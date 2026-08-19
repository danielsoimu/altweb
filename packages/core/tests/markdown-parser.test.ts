/**
 * Markdown parser tests — utils/markdown-parser.ts
 * Locks the inline-content convention (markdown markers, NOT HTML) so imported
 * formatting renders correctly via the renderer / TipTap transformers.
 */

import { describe, it, expect } from 'vitest';
import { parseMarkdown, extractTitle } from '../src/markdown/markdown-parser';

describe('parseMarkdown — inline content is markdown, not HTML', () => {
  it('keeps bold/italic/code as markdown markers', () => {
    const blocks = parseMarkdown('A **bold**, *italic* and `code`.');
    const p = blocks.find(b => b.t === 'p') as { t: 'p'; c: string };
    expect(p.c).toContain('**bold**');
    expect(p.c).toContain('*italic*');
    expect(p.c).toContain('`code`');
    expect(p.c).not.toContain('<strong>');
    expect(p.c).not.toContain('<em>');
  });

  it('keeps links as markdown', () => {
    const blocks = parseMarkdown('See [site](https://example.com).');
    const p = blocks.find(b => b.t === 'p') as { t: 'p'; c: string };
    expect(p.c).toContain('[site](https://example.com)');
    expect(p.c).not.toContain('<a ');
  });
});

describe('parseMarkdown — structure', () => {
  it('supports heading levels 1-6', () => {
    const blocks = parseMarkdown('# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6');
    expect(blocks.map(b => (b.t === 'h' ? b.l : null))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('extracts a quote source from a trailing "— source" line', () => {
    const blocks = parseMarkdown('> Wisdom\n> — Author');
    expect(blocks.find(b => b.t === 'q')).toMatchObject({ t: 'q', c: 'Wisdom', src: 'Author' });
  });

  it('parses slide and card delimiters into hr variants', () => {
    const blocks = parseMarkdown('---slide:title---\n\nHi\n\n---endslide---\n\n---card:ig---\n\nYo\n\n---endcard---');
    const variants = blocks.filter(b => b.t === 'hr').map(b => (b as { variant?: string; layout?: string; platform?: string }));
    expect(variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variant: 'slide', layout: 'title' }),
        expect.objectContaining({ variant: 'endslide' }),
        expect.objectContaining({ variant: 'card', platform: 'instagram' }),
        expect.objectContaining({ variant: 'endcard' }),
      ])
    );
  });

  it('extracts the first H1 as title', () => {
    expect(extractTitle('# My Title\n\nBody')).toBe('My Title');
  });
});
