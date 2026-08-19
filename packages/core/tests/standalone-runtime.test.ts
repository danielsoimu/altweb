// @vitest-environment node
/**
 * Anti-drift: executes the ACTUAL inline runtime shipped inside standalone
 * .altweb.html artifacts — not the core decoder — against the falsifiability
 * attacks. This is the test that would have caught "verified = !!envelope.s"
 * (signature presence displayed as verification).
 *
 * Node >= 20 provides crypto.subtle, DecompressionStream, atob globally, so
 * the runtime's decodePage/verifySignature run unmodified. The IIFE's
 * trailing init() (which touches the DOM) is replaced with a return of the
 * functions under test.
 */
import { describe, it, expect } from 'vitest';
import { encodePageUnsanitized } from '../src/codec/encoder';
import { generateStandaloneHTML } from '../src/codec/standalone-html';
import { deriveIdentityFromPassphrase } from '../src/crypto/identity';
import type { AltPage } from '../src/types';

const page: AltPage = {
  v: 1,
  meta: { title: 'Runtime test', created: 1, modified: 1, lang: 'en' },
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

/** Extract the runtime IIFE from the generated HTML and return its decodePage. */
function runtimeFor(hash: string): (password?: string) => Promise<{
  verified: boolean;
  signed: boolean;
  signatureInvalid: boolean;
  fingerprint: string | null;
  publicKey: string | null;
  page: AltPage;
}> {
  const html = generateStandaloneHTML({ hash, isEncrypted: false, lang: 'en' });
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const runtime = scripts.find((s) => s.includes('async function decodePage'));
  expect(runtime).toBeDefined();
  // Swap the DOM-touching bootstrap for a return of the function under test.
  const harnessSrc = runtime!.replace(/init\(\);\s*\}\)\(\);/, 'return { decodePage };})();');
  expect(harnessSrc).not.toBe(runtime);
  const stubDocument = { getElementById: () => ({}) };
  const factory = new Function('document', 'window', `return ${harnessSrc.trim()}`);
  const hooks = factory(stubDocument, {});
  return hooks.decodePage;
}

/**
 * Render the runtime against a hash and return the produced HTML string.
 * Mirrors runtimeFor but exposes renderPage with enough DOM stubs to run it.
 */
async function renderedHtmlFor(hash: string): Promise<string> {
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
  const factory = new Function('document', 'window', `return ${harnessSrc.trim()}`);
  const hooks = factory(stubDocument, stubWindow);
  hooks.renderPage(await hooks.decodePage());
  return app.innerHTML;
}

describe('standalone runtime URL sanitization (hand-crafted envelope)', () => {
  // The encoder sanitizes URLs at build time; an attacker who crafts the
  // envelope directly bypasses that. encodePageUnsanitized reproduces exactly
  // that bypass, so this proves the RUNTIME re-guards URL schemes rather than
  // relying on CSP alone.
  it('neutralizes javascript: and non-image data: URLs on every block-level sink', async () => {
    const hostile: AltPage = {
      v: 1,
      meta: {
        title: 'x',
        created: 1,
        modified: 1,
        lang: 'en',
        header: { logo: 'javascript:alert(1)' },
        footer: { links: [{ label: 'L', url: 'javascript:alert(2)' }] },
      },
      blocks: [
        { t: 'a', url: 'javascript:alert(3)', title: 'click' },
        { t: 'img', d: 'data:text/html,<script>alert(4)</script>' },
        { t: 'img', d: 'data:image/png;base64,AAAA' },
        { t: 'a', url: 'https://example.com', title: 'ok' },
      ],
      style: { font: 'sans', theme: 'light' },
    };
    const hash = await encodePageUnsanitized(hostile);
    const out = await renderedHtmlFor(hash);

    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('data:text/html');
    // Blocked hrefs collapse to the sentinel; the legit https link survives.
    expect(out).toContain('href="#blocked"');
    expect(out).toContain('https://example.com');
    // The legit raster data URI survives; the text/html one is dropped to empty.
    expect(out).toContain('data:image/png;base64,AAAA');
  });
});

describe('standalone runtime signature verification (falsifiability attacks)', () => {
  it('A0 original: verified=true with the author fingerprint', async () => {
    const author = await deriveIdentityFromPassphrase('runtime-test-author-passphrase');
    const hash = await encodePageUnsanitized(page, { signingKeyPair: author.keyPair });
    const result = await runtimeFor(hash)();
    expect(result.signed).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.signatureInvalid).toBe(false);
    expect(result.fingerprint).toBe(author.fingerprint);
    expect(result.publicKey).toBeTruthy();
  });

  it('B2 tampered content + old signature: verified=false, signatureInvalid=true, no fingerprint', async () => {
    const author = await deriveIdentityFromPassphrase('runtime-test-author-passphrase');
    const signedHash = await encodePageUnsanitized(page, { signingKeyPair: author.keyPair });
    const forgedContent = await encodePageUnsanitized({
      ...page,
      blocks: [{ t: 'p', c: 'FORGED content under the author signature' }],
    });
    const envelope = b64urlToJson(signedHash);
    envelope.d = b64urlToJson(forgedContent).d; // swap payload, keep signature+key
    const result = await runtimeFor(jsonToB64url(envelope))();
    expect(result.signed).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.signatureInvalid).toBe(true);
    expect(result.fingerprint).toBeNull();
    expect(result.publicKey).toBeNull();
  });

  it('B3 re-signed by an attacker key: verified=true but a DIFFERENT fingerprint', async () => {
    const author = await deriveIdentityFromPassphrase('runtime-test-author-passphrase');
    const attacker = await deriveIdentityFromPassphrase('runtime-test-attacker-passphrase');
    const forged = await encodePageUnsanitized(
      { ...page, blocks: [{ t: 'p', c: 'FORGED then re-signed' }] },
      { signingKeyPair: attacker.keyPair }
    );
    const result = await runtimeFor(forged)();
    expect(result.verified).toBe(true);
    expect(result.fingerprint).toBe(attacker.fingerprint);
    expect(result.fingerprint).not.toBe(author.fingerprint);
    // The full key is exposed so a reader can pin the expected signer.
    expect(result.publicKey).toBe(b64urlToJson(forged).pk);
  });

  it('unsigned: signed=false, no invalid banner state', async () => {
    const hash = await encodePageUnsanitized(page);
    const result = await runtimeFor(hash)();
    expect(result.signed).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.signatureInvalid).toBe(false);
    expect(result.fingerprint).toBeNull();
  });
});
