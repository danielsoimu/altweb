// @vitest-environment node
/**
 * Standalone-runtime hardening regressions (2026-08-22 audit): CSP hash
 * pinning, decompression cap, low-s rejection, CSSOM hex re-validation, and
 * hostile-date robustness — all against the ACTUAL inline runtime shipped in
 * .altweb.html artifacts, not the core decoder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import pako from 'pako';
import { encodePageUnsanitized } from '../src/codec/encoder';
import { generateStandaloneHTML } from '../src/codec/standalone-html';
import { deriveIdentityFromPassphrase } from '../src/crypto/identity';
import { base64urlEncode, base64urlDecode } from '../src/crypto/encoding';
import type { AltPage } from '../src/types';

const page: AltPage = {
  v: 1,
  meta: { title: 'Hardening test', created: 1, modified: 1, lang: 'en' },
  blocks: [{ t: 'p', c: 'authentic content' }],
  style: { theme: 'auto', font: 'sans', accent: 'blue', maxW: 'md' },
};

function b64urlToJson(hash: string): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(hash.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
  );
}

function jsonToB64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function extractScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function runtimeFor(hash: string): (password?: string) => Promise<{
  verified: boolean;
  signed: boolean;
  signatureInvalid: boolean;
}> {
  const html = generateStandaloneHTML({ hash, isEncrypted: false, lang: 'en' });
  const runtime = extractScripts(html).find((s) => s.includes('async function decodePage'));
  expect(runtime).toBeDefined();
  const harnessSrc = runtime!.replace(/init\(\);\s*\}\)\(\);/, 'return { decodePage };})();');
  expect(harnessSrc).not.toBe(runtime);
  const stubDocument = { getElementById: () => ({}) };
  const factory = new Function('document', 'window', `return ${harnessSrc.trim()}`);
  return factory(stubDocument, {}).decodePage;
}

/** Run decode + render and expose the rendered HTML plus the body-style stub. */
async function renderHarness(hash: string): Promise<{
  html: string;
  bodyStyle: Record<string, string>;
}> {
  const html = generateStandaloneHTML({ hash, isEncrypted: false, lang: 'en' });
  const runtime = extractScripts(html).find((s) => s.includes('async function decodePage'));
  const harnessSrc = runtime!.replace(
    /init\(\);\s*\}\)\(\);/,
    'return { decodePage, renderPage };})();'
  );
  const app: { innerHTML: string } = { innerHTML: '' };
  const bodyStyle: Record<string, string> = {};
  const stubDocument = {
    getElementById: () => app,
    body: { classList: { add() {} }, style: bodyStyle },
    documentElement: { style: { setProperty() {} } },
    title: '',
  };
  const stubWindow = { matchMedia: () => ({ matches: false }) };
  const stubDOMPurify = { sanitize: (h: string) => String(h) };
  const factory = new Function('document', 'window', 'DOMPurify', `return ${harnessSrc.trim()}`);
  const hooks = factory(stubDocument, stubWindow, stubDOMPurify);
  hooks.renderPage(await hooks.decodePage());
  return { html: app.innerHTML, bodyStyle };
}

describe('CSP: script-src pins both inline scripts by sha256 hash', () => {
  it('drops unsafe-inline from script-src and pins the exact script bytes', async () => {
    const hash = await encodePageUnsanitized(page);
    const html = generateStandaloneHTML({ hash, isEncrypted: false, lang: 'en' });

    const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1];
    expect(csp).toBeDefined();
    const scriptSrc = csp!.match(/script-src ([^;]+);/)?.[1];
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain('unsafe-inline');

    // The two inline scripts must be pinned by their EXACT bytes — recompute
    // the hashes independently so any drift between the CSP and the emitted
    // scripts fails here instead of failing closed in every reader's browser.
    const scripts = extractScripts(html);
    expect(scripts.length).toBe(2);
    for (const script of scripts) {
      const digest = createHash('sha256').update(script, 'utf8').digest('base64');
      expect(scriptSrc).toContain(`'sha256-${digest}'`);
    }
    // style-src intentionally keeps unsafe-inline (static <style> + spacer).
    expect(csp).toContain("style-src 'unsafe-inline'");
  });
});

describe('runtime decompression cap (DecompressionStream path)', () => {
  // Fixture built in beforeAll: deflating the plaintext is the slow part
  // (seconds in a slow container) and must not count against the it() budget
  // of the assertion that guards the defense.
  let bomb: Uint8Array; // ~96 MB expansion — far past the 16 MiB cap
  beforeAll(() => {
    const chunk = new Uint8Array(16 * 1024 * 1024);
    const deflator = new pako.Deflate({ level: 9 });
    for (let i = 0; i < 6; i++) deflator.push(chunk, i === 5);
    bomb = deflator.result as Uint8Array;
  }, 60_000);

  it(
    'refuses a decompression bomb instead of materializing it',
    async () => {
      // The runtime must stop at the 16 MiB output cap, not buffer ~100 MB
      // in the reader tab.
      const envelope = { v: 1, enc: false, d: base64urlEncode(bomb) };
      await expect(runtimeFor(jsonToB64url(envelope))()).rejects.toThrow(/exceeds/);
    },
    30_000
  );

  it('still decodes legitimate capsules', async () => {
    const hash = await encodePageUnsanitized(page);
    const result = await runtimeFor(hash)();
    expect(result.signed).toBe(false);
  });
});

describe('runtime rejects malleated (high-s) signatures like core does', () => {
  const P256_N = BigInt(
    '0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'
  );

  it('verified=false, signatureInvalid=true for the (r, n-s) twin', async () => {
    const author = await deriveIdentityFromPassphrase('runtime-test-author-passphrase');
    const signedHash = await encodePageUnsanitized(page, { signingKeyPair: author.keyPair });
    const envelope = b64urlToJson(signedHash) as { s: string };

    const sig = base64urlDecode(envelope.s);
    let s = 0n;
    for (let i = 32; i < 64; i++) s = (s << 8n) | BigInt(sig[i]);
    let sPrime = P256_N - s;
    const twisted = new Uint8Array(sig);
    for (let i = 63; i >= 32; i--) {
      twisted[i] = Number(sPrime & 0xffn);
      sPrime >>= 8n;
    }
    envelope.s = base64urlEncode(twisted);

    const result = await runtimeFor(jsonToB64url(envelope))();
    expect(result.signed).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.signatureInvalid).toBe(true);
  });
});

describe('runtime re-validates style.bg/fg before the CSSOM sink', () => {
  it('applies valid hex colors and drops CSS payloads', async () => {
    const legit: AltPage = {
      ...page,
      style: { ...page.style, bg: '#102030', fg: '#f0f0f0' },
    };
    const { bodyStyle: goodStyle } = await renderHarness(await encodePageUnsanitized(legit));
    expect(goodStyle.backgroundColor).toBe('#102030');
    expect(goodStyle.color).toBe('#f0f0f0');

    const hostile: AltPage = {
      ...page,
      style: {
        ...page.style,
        bg: 'url(https://evil.example/x)',
        fg: 'red; background-image: url(https://evil.example/y)',
      } as AltPage['style'],
    };
    const { bodyStyle: badStyle } = await renderHarness(await encodePageUnsanitized(hostile));
    expect(badStyle.backgroundColor).toBeUndefined();
    expect(badStyle.color).toBeUndefined();
  });
});

describe('runtime degrades hostile dates instead of aborting the render', () => {
  it('renders content when created/modified are not dates', async () => {
    const hostile: AltPage = {
      ...page,
      meta: {
        ...page.meta,
        created: 'not-a-date' as unknown as number,
        modified: 'also-not-a-date' as unknown as number,
        header: { showDate: true },
      },
      style: { ...page.style, showTimestamp: 'datetime' },
    };
    const { html } = await renderHarness(await encodePageUnsanitized(hostile));
    expect(html).toContain('authentic content');
    expect(html).not.toContain('<time');
  });
});
