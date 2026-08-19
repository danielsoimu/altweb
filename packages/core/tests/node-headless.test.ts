// @vitest-environment node
/**
 * Verifies the full encode -> decode pipeline (with DOMPurify sanitization)
 * under plain Node, via the node-dom shim — exactly the path used by the CLI
 * and the extension host. Without the shim, DOMPurify.sanitize does not exist
 * under Node and decoding would crash (or, worse, become a no-op).
 */
import '../src/sanitize/node-dom';
import { describe, it, expect } from 'vitest';
import { encodePage } from '../src/codec/encoder';
import { decodePage } from '../src/codec/decoder';
import type { AltPage } from '../src/types';

const page: AltPage = {
  v: 1,
  meta: { title: '<script>alert(1)</script>Title', created: 1, modified: 1, lang: 'ro' },
  blocks: [
    { t: 'p', c: 'Text <strong>bold</strong> <script>alert(1)</script>' },
  ],
  style: { theme: 'auto', font: 'sans', accent: 'blue', maxW: 'md' },
};

describe('headless node pipeline', () => {
  it('encode -> decode sanitizes XSS under plain Node', async () => {
    const hash = await encodePage(page);
    const decoded = await decodePage(hash);
    expect(decoded.page.meta.title).not.toContain('<script');
    expect(decoded.page.meta.title).toContain('Title');
    const p = decoded.page.blocks[0] as { c: string };
    expect(p.c).not.toContain('<script');
    expect(p.c).toContain('<strong>bold</strong>');
  });
});
