/**
 * Closes the audit's testing gap: every other standalone-runtime test stubs
 * DOMPurify with a passthrough, so the content-sanitization path — the
 * javascript:-link stripping that rests entirely on DOMPurify's default URI
 * filter — was never exercised. This suite runs the ACTUAL inline runtime
 * with the REAL DOMPurify (jsdom environment; the dompurify-sync test pins
 * the embedded blob byte-identical to this installed dependency).
 */
import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import { DecompressionStream as NodeDecompressionStream } from 'node:stream/web';
import { encodePageUnsanitized } from '../src/codec/encoder';
import { generateStandaloneHTML } from '../src/codec/standalone-html';
import type { AltPage } from '../src/types';

// jsdom does not ship DecompressionStream; borrow Node's implementation so
// the runtime's decode path runs unmodified.
if (typeof globalThis.DecompressionStream === 'undefined') {
  globalThis.DecompressionStream =
    NodeDecompressionStream as unknown as typeof globalThis.DecompressionStream;
}

async function renderWithRealDOMPurify(hostile: AltPage): Promise<string> {
  const hash = await encodePageUnsanitized(hostile);
  const html = generateStandaloneHTML({ hash, isEncrypted: false, lang: 'en' });
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const runtime = scripts.find((s) => s.includes('async function decodePage'));
  expect(runtime).toBeDefined();
  const harnessSrc = runtime!.replace(
    /init\(\);\s*\}\)\(\);/,
    'return { decodePage, renderPage };})();'
  );
  const app: { innerHTML: string } = { innerHTML: '' };
  const stubDocument = {
    getElementById: () => app,
    body: { classList: { add() {} }, style: {} },
    documentElement: { style: { setProperty() {} } },
    title: '',
  };
  const stubWindow = { matchMedia: () => ({ matches: false }) };
  const factory = new Function('document', 'window', 'DOMPurify', `return ${harnessSrc.trim()}`);
  const hooks = factory(stubDocument, stubWindow, DOMPurify);
  hooks.renderPage(await hooks.decodePage());
  return app.innerHTML;
}

describe('standalone runtime content sanitization with REAL DOMPurify', () => {
  it('strips javascript: hrefs from inline-markdown links in block content', async () => {
    const hostile: AltPage = {
      v: 1,
      meta: { title: 'x', created: 1, modified: 1, lang: 'en' },
      blocks: [
        { t: 'p', c: '[click me](javascript:alert(1))' },
        { t: 'h', l: 2, c: '[heading link](javascript:alert(2))' },
        { t: 'list', ordered: false, items: ['[item](javascript:alert(3))'] },
      ],
      style: { font: 'sans', theme: 'light' },
    };
    const out = await renderWithRealDOMPurify(hostile);
    expect(out).toContain('click me');
    expect(out).not.toContain('javascript:');
  });

  it('keeps legitimate inline formatting and https links', async () => {
    const legit: AltPage = {
      v: 1,
      meta: { title: 'x', created: 1, modified: 1, lang: 'en' },
      blocks: [{ t: 'p', c: '**bold** and [ok](https://example.com/x) and `code`' }],
      style: { font: 'sans', theme: 'light' },
    };
    const out = await renderWithRealDOMPurify(legit);
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('href="https://example.com/x"');
    expect(out).toContain('<code>code</code>');
  });

  it('neutralizes raw HTML smuggled into block content', async () => {
    const hostile: AltPage = {
      v: 1,
      meta: { title: 'x', created: 1, modified: 1, lang: 'en' },
      blocks: [{ t: 'p', c: '<img src=x onerror=alert(4)> and <script>alert(5)</script>' }],
      style: { font: 'sans', theme: 'light' },
    };
    const out = await renderWithRealDOMPurify(hostile);
    // Raw HTML is entity-escaped into inert text by the runtime pipeline —
    // no live tag or handler may survive.
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;img src=x onerror=alert(4)&gt;');
  });
});
