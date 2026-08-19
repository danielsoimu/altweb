/**
 * Nested lists + task lists: parser -> blocks -> serializer round-trip,
 * Zod validation (depth cap) and recursive sanitization.
 */
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../src/markdown/markdown-parser';
import { serializeToMarkdown } from '../src/markdown/markdown-serializer';
import { validatePageStructure } from '../src/validate/validators';
import { sanitizePage } from '../src/sanitize/sanitize';
import type { AltPage, ListBlock, ListItem } from '../src/types';

const style = { theme: 'auto', font: 'sans', accent: 'blue', maxW: 'md' } as AltPage['style'];

function pageWith(blocks: AltPage['blocks']): AltPage {
  return {
    v: 1,
    meta: { title: 'T', created: 1, modified: 1, lang: 'ro' },
    blocks,
    style,
  };
}

describe('nested lists parsing', () => {
  it('parses nested bullets into a tree and flattens items[]', () => {
    const md = [
      '- parent 1',
      '  - child 1a',
      '  - child 1b',
      '    - grandchild 1b-i',
      '- parent 2',
    ].join('\n');

    const blocks = parseMarkdown(md);
    const list = blocks.find((b) => b.t === 'list') as ListBlock;

    expect(list).toBeDefined();
    expect(list.nodes).toHaveLength(2);
    expect(list.nodes![0].c).toBe('parent 1');
    expect(list.nodes![0].children).toHaveLength(2);
    expect(list.nodes![0].children![1].children![0].c).toBe('grandchild 1b-i');
    // flattened fallback, depth-first
    expect(list.items).toEqual(['parent 1', 'child 1a', 'child 1b', 'grandchild 1b-i', 'parent 2']);
  });

  it('parses task lists with checked state', () => {
    const md = ['- [x] done', '- [ ] to do'].join('\n');
    const blocks = parseMarkdown(md);
    const list = blocks.find((b) => b.t === 'list') as ListBlock;

    expect(list.nodes![0]).toMatchObject({ c: 'done', task: true, done: true });
    expect(list.nodes![1]).toMatchObject({ c: 'to do', task: true, done: false });
  });

  it('keeps inline formatting in nested items', () => {
    const md = ['- **bold** parent', '  - child with `code`'].join('\n');
    const blocks = parseMarkdown(md);
    const list = blocks.find((b) => b.t === 'list') as ListBlock;

    expect(list.nodes![0].c).toContain('**bold**');
    expect(list.nodes![0].children![0].c).toContain('`code`');
  });
});

describe('nested lists round-trip', () => {
  it('md -> blocks -> md preserves nesting and task state', () => {
    const md = [
      '- parent',
      '  - [x] child done',
      '  - [ ] child to do',
      '    - grandchild',
    ].join('\n');

    const blocks = parseMarkdown(md);
    const out = serializeToMarkdown(blocks);
    const reparsed = parseMarkdown(out);
    const a = blocks.find((b) => b.t === 'list') as ListBlock;
    const b = reparsed.find((x) => x.t === 'list') as ListBlock;

    expect(b.nodes).toEqual(a.nodes);
  });

  it('ordered nested round-trip', () => {
    const md = ['1. one', '   1. one-one', '2. two'].join('\n');
    const blocks = parseMarkdown(md);
    const out = serializeToMarkdown(blocks);
    const reparsed = parseMarkdown(out);

    expect((reparsed.find((x) => x.t === 'list') as ListBlock).nodes)
      .toEqual((blocks.find((x) => x.t === 'list') as ListBlock).nodes);
  });
});

describe('validation', () => {
  it('accepts nodes within depth cap', () => {
    const list: ListBlock = {
      t: 'list',
      ordered: false,
      items: ['a', 'b'],
      nodes: [{ c: 'a', children: [{ c: 'b' }] }],
    };
    const page = validatePageStructure(pageWith([list]));
    const validated = page.blocks[0] as ListBlock;
    expect(validated.nodes).toEqual(list.nodes);
  });

  it('rejects nodes deeper than the cap (6)', () => {
    let node: ListItem = { c: 'leaf' };
    for (let i = 0; i < 7; i++) {
      node = { c: `n${i}`, children: [node] };
    }
    const list: ListBlock = { t: 'list', ordered: false, items: [], nodes: [node] };
    expect(() => validatePageStructure(pageWith([list]))).toThrow();
  });
});

describe('sanitization', () => {
  it('sanitizes XSS recursively in nodes', () => {
    const list: ListBlock = {
      t: 'list',
      ordered: false,
      items: ['<script>alert(1)</script>a'],
      nodes: [
        {
          c: '<script>alert(1)</script>parent',
          children: [{ c: 'child <img src=x onerror=alert(1)> ok' }],
        },
      ],
    };
    const clean = sanitizePage(pageWith([list]));
    const cleanList = clean.blocks[0] as ListBlock;

    expect(cleanList.nodes![0].c).not.toContain('<script');
    expect(cleanList.nodes![0].children![0].c).not.toContain('<img');
    expect(cleanList.nodes![0].children![0].c).toContain('ok');
    expect(cleanList.items[0]).not.toContain('<script');
  });
});
