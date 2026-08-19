/**
 * End-to-end pipeline test
 *
 * Exercises the full data flow exactly as the app does it:
 *   markdown → parseMarkdown → AltPage → encodePage(encrypt + sign)
 *           → decodePage(verify + sanitize) → serializeToMarkdown
 */

import { describe, it, expect } from 'vitest';
import { encodePage, decodePage } from '../src/codec';
import { generateSigningKeyPair } from '../src/crypto';
import { parseMarkdown, extractTitle, extractDescription } from '../src/markdown/markdown-parser';
import { serializeToMarkdown } from '../src/markdown/markdown-serializer';
import type { AltPage } from '../src/types';

const MARKDOWN = `# End-to-end

A paragraph with **bold**, *italic* and a [link](https://example.com).

> My quote
> — The Author

- one
- two

\`\`\`js
const x = 1;
\`\`\`
`;

describe('E2E pipeline (full round-trip)', () => {
  it('markdown → encode(encrypt+sign) → decode(verify) → serialize', async () => {
    const blocks = parseMarkdown(MARKDOWN);
    // Inject an XSS payload to confirm sanitization happens on decode.
    blocks.push({ t: 'p', c: 'Safe <script>alert(1)</script> end' });

    const page: AltPage = {
      v: 1,
      meta: {
        title: extractTitle(MARKDOWN) ?? 'Untitled',
        description: extractDescription(MARKDOWN) ?? undefined,
        author: 'WA',
        created: 0,
        modified: 0,
        lang: 'ro',
      },
      blocks,
      style: { theme: 'auto', font: 'sans', maxW: 'md' },
    };

    const keyPair = await generateSigningKeyPair();
    const password = 'end-to-end-secret';

    const hash = await encodePage(page, { password, signingKeyPair: keyPair });
    const result = await decodePage(hash, password);

    // Signature verified end-to-end.
    expect(result.verified).toBe(true);
    expect(result.publicKeyFingerprint).toBeTruthy();

    // Content intact through encrypt → decrypt.
    expect(result.page.blocks.find(b => b.t === 'h')).toMatchObject({ t: 'h', l: 1, c: 'End-to-end' });
    expect(result.page.blocks.find(b => b.t === 'q')).toMatchObject({ t: 'q', src: 'The Author' });

    // XSS neutralized by sanitization.
    expect(JSON.stringify(result.page)).not.toContain('<script');

    // Serializes back to markdown, preserving the quote source.
    const md = serializeToMarkdown(result.page.blocks);
    expect(md).toContain('# End-to-end');
    expect(md).toContain('> — The Author');
  });

  it('rejects a wrong password', async () => {
    const page: AltPage = {
      v: 1,
      meta: { title: 'X', created: 0, modified: 0, lang: 'ro' },
      blocks: [{ t: 'p', c: 'secret' }],
      style: { theme: 'auto', font: 'sans', maxW: 'md' },
    };
    const hash = await encodePage(page, { password: 'correct' });
    await expect(decodePage(hash, 'wrong')).rejects.toThrow();
  });

  it('public (unencrypted) page round-trips without a password', async () => {
    const page: AltPage = {
      v: 1,
      meta: { title: 'Public', created: 0, modified: 0, lang: 'en' },
      blocks: parseMarkdown('# Public\n\nHello world.'),
      style: { theme: 'auto', font: 'sans', maxW: 'md' },
    };
    const hash = await encodePage(page, {});
    const result = await decodePage(hash);
    expect(result.verified).toBe(false);
    expect(result.page.blocks[0]).toMatchObject({ t: 'h', l: 1, c: 'Public' });
  });
});
