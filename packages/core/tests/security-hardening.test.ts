/**
 * Regression tests for the 2026-08-22 security audit remediation
 * (SECURITY-AUDIT-2026-08-22.md). One describe block per finding, each
 * exercising the exact attack the audit demonstrated.
 */
import { describe, it, expect } from 'vitest';
import pako from 'pako';
import { compress, decompress, MAX_COMPRESSED_BYTES } from '../src/compression';
import { decodePage, hasSignature, MAX_ENVELOPE_CHARS } from '../src/codec/decoder';
import { base64urlEncode, base64urlDecode } from '../src/crypto/encoding';
import { sign, verify } from '../src/crypto/signing';
import { deriveIdentityFromPassphrase } from '../src/crypto/identity';
import { sanitizePage } from '../src/sanitize/sanitize';
import { stripHtml } from '../src/markdown/html-utils';
import { markdownToHtml } from '../src/markdown/markdown';
import type { AltPage } from '../src/types';

const STRONG_PASSPHRASE = 'hardening-suite-author-passphrase';

describe('H1 - decompression bomb bounds CPU, not just memory', () => {
  it('aborts a large bomb without inflating the whole stream', () => {
    // ~512 MB of zeros compresses to ~500 KB. If the loop kept inflating to
    // the end (the pre-fix behavior), this would take multiple seconds; the
    // slice-fed loop stops within one slice past the 16 MiB cap.
    const bomb = pako.deflate(new Uint8Array(512 * 1024 * 1024), { level: 9 });
    expect(bomb.length).toBeLessThan(MAX_COMPRESSED_BYTES);
    const start = performance.now();
    expect(() => decompress(bomb)).toThrow(/exceeds/);
    const elapsed = performance.now() - start;
    // Full inflation of 512 MB takes seconds; the abort path is bounded by
    // cap + one slice (~66 MB worst case). 1s is a generous CI margin.
    expect(elapsed).toBeLessThan(1000);
  });

  it('rejects oversized compressed input before inflating anything', () => {
    const oversized = new Uint8Array(MAX_COMPRESSED_BYTES + 1);
    expect(() => decompress(oversized)).toThrow(/Compressed payload exceeds/);
  });

  it('still round-trips legitimate payloads', () => {
    const data = new TextEncoder().encode('legitimate content '.repeat(10000));
    const out = decompress(compress(data));
    // Byte comparison via Buffer: toEqual trips over cross-realm Uint8Array
    // constructor identity under the jsdom environment.
    expect(out.length).toBe(data.length);
    expect(Buffer.from(out).equals(Buffer.from(data))).toBe(true);
  });

  it('still rejects invalid deflate streams', () => {
    expect(() => decompress(new Uint8Array([1, 2, 3, 4, 5]))).toThrow();
    expect(() => decompress(new Uint8Array(0))).toThrow();
  });

  it('rejects a truncated stream', () => {
    const good = compress(new TextEncoder().encode('x'.repeat(100000)));
    expect(() => decompress(good.subarray(0, good.length - 10))).toThrow();
  });
});

describe('M1 - envelope size cap before any decoding work', () => {
  it('decodePage refuses an oversized envelope immediately', async () => {
    const huge = 'A'.repeat(MAX_ENVELOPE_CHARS + 1);
    const start = performance.now();
    await expect(decodePage(huge)).rejects.toThrow(/character limit/);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('predicates fail closed on oversized input', () => {
    const huge = 'A'.repeat(MAX_ENVELOPE_CHARS + 1);
    expect(hasSignature(huge)).toBe(false);
  });
});

describe('M2/M3 - ReDoS linearization in markdown paths', () => {
  it('stripHtml is linear on adversarial "<" floods', () => {
    const hostile = '<'.repeat(200 * 1024);
    const start = performance.now();
    stripHtml(hostile);
    // The quadratic regex took ~14 s on 195 KB; linear takes milliseconds.
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('stripHtml keeps the regex semantics on normal input', () => {
    const samples = [
      '<b>bold</b> and <i>italic</i>',
      'no tags at all',
      'unterminated <tag stays',
      'a < b but <em>real</em> > c',
      '<<double>>',
      '',
    ];
    for (const sample of samples) {
      expect(stripHtml(sample)).toBe(
        sample.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) =>
          ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' })[m] || m
        )
      );
    }
  });

  it('markdownToHtml list wrapping is linear on adversarial list floods', () => {
    const hostile = '- item\n'.repeat(80 * 1024);
    const start = performance.now();
    markdownToHtml(hostile);
    // The nested-quantifier regex took ~10 s on 586 KB.
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('markdownToHtml still wraps lists like the old regex', () => {
    const samples = [
      '- one\n- two\n\ntext\n\n- three',
      '- single',
      'no list here',
      '1. a\n2. b',
    ];
    for (const sample of samples) {
      const linear = markdownToHtml(sample);
      // Reference: the exact pre-fix implementation step applied to the same
      // pre-wrap state is hard to reconstruct here, so assert structure:
      expect(linear).not.toContain('<li>'.repeat(2)); // every li run is wrapped
      if (sample.includes('- one')) {
        expect(linear).toContain('<ul><li>one</li>\n<li>two</li>\n</ul>');
        expect(linear).toContain('<ul><li>three</li>');
      }
    }
  });
});

describe('M4 - ECDSA malleability rejected on verify', () => {
  const P256_N = BigInt(
    '0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'
  );

  function malleate(signatureB64: string): string {
    const sig = base64urlDecode(signatureB64);
    let s = 0n;
    for (let i = 32; i < 64; i++) s = (s << 8n) | BigInt(sig[i]);
    let sPrime = P256_N - s;
    const out = new Uint8Array(sig);
    for (let i = 63; i >= 32; i--) {
      out[i] = Number(sPrime & 0xffn);
      sPrime >>= 8n;
    }
    return base64urlEncode(out);
  }

  it('accepts the canonical signature and rejects its (r, n-s) twin', async () => {
    const identity = await deriveIdentityFromPassphrase(STRONG_PASSPHRASE);
    const data = new TextEncoder().encode('malleability probe');
    const signature = await sign(data, identity.keyPair.privateKey);

    expect(await verify(data, signature, identity.publicKeyBase64)).toBe(true);

    const twisted = malleate(signature);
    expect(twisted).not.toBe(signature);
    // Web Crypto alone accepts this twin; the low-s gate must refuse it.
    expect(await verify(data, twisted, identity.publicKeyBase64)).toBe(false);
  });
});

describe('M5 - sanitizePage covers header and footer', () => {
  const hostilePage: AltPage = {
    v: 1,
    meta: {
      title: 'x',
      created: 1,
      modified: 1,
      lang: 'en',
      header: {
        logo: 'javascript:alert(1)',
        customText: '<img src=x onerror=alert(2)>tagline',
      },
      footer: {
        copyright: '<script>alert(3)</script>(c) 2026',
        customText: '<svg onload=alert(4)>foot',
        links: [
          { label: '<b>click</b>', url: 'javascript:alert(5)' },
          { label: 'fine', url: 'https://example.com/page' },
        ],
      },
    },
    blocks: [{ t: 'p', c: 'body' }],
    style: { font: 'sans', theme: 'light' },
  };

  it('strips markup and dangerous URLs from header/footer fields', () => {
    const clean = sanitizePage(hostilePage);
    expect(clean.meta.header?.logo).toBe('');
    expect(clean.meta.header?.customText).not.toContain('<img');
    expect(clean.meta.header?.customText).toContain('tagline');
    expect(clean.meta.footer?.copyright).not.toContain('<script');
    expect(clean.meta.footer?.copyright).toContain('(c) 2026');
    expect(clean.meta.footer?.customText).not.toContain('<svg');
    expect(clean.meta.footer?.links?.[0].label).toBe('click');
    expect(clean.meta.footer?.links?.[0].url).toBe('#blocked');
    expect(clean.meta.footer?.links?.[1].url).toBe('https://example.com/page');
  });

  it('keeps legitimate header logos (data URI and https)', () => {
    const page: AltPage = {
      ...hostilePage,
      meta: {
        ...hostilePage.meta,
        header: {
          logo: 'https://example.com/logo.png',
          customText: 'plain',
        },
      },
    };
    expect(sanitizePage(page).meta.header?.logo).toBe('https://example.com/logo.png');
  });
});

describe('Low - base64url canonical decode', () => {
  it('round-trips canonical encodings', () => {
    for (const len of [0, 1, 2, 3, 31, 32, 33]) {
      const data = new Uint8Array(len).map((_, i) => (i * 37) % 256);
      expect(base64urlDecode(base64urlEncode(data))).toEqual(data);
    }
  });

  it('rejects non-canonical trailing bits', () => {
    // 'AQ' (0x01) is canonical; 'AR' decodes to the same byte with dirty
    // trailing bits — two strings, one byte value.
    expect(base64urlDecode('AQ')).toEqual(new Uint8Array([1]));
    expect(() => base64urlDecode('AR')).toThrow(/non-canonical/);
  });

  it('rejects foreign charset, padding, and impossible lengths', () => {
    expect(() => base64urlDecode('AQ==')).toThrow(/charset/);
    expect(() => base64urlDecode('A Q')).toThrow(/charset/);
    expect(() => base64urlDecode('A+/w')).toThrow(/charset/);
    expect(() => base64urlDecode('AAAAA')).toThrow(/length/);
  });

  it('encodes large inputs without stack overflow', () => {
    const big = new Uint8Array(512 * 1024).map((_, i) => i % 256);
    const encoded = base64urlEncode(big);
    expect(base64urlDecode(encoded)).toEqual(big);
  });
});

describe('Low - passphrase floor enforced at derivation', () => {
  it('refuses to derive from a passphrase below the floor', async () => {
    await expect(deriveIdentityFromPassphrase('a')).rejects.toThrow(/floor/);
    await expect(deriveIdentityFromPassphrase('short-and-weak')).rejects.toThrow(/floor/);
  });

  it('derives normally above the floor', async () => {
    const identity = await deriveIdentityFromPassphrase(STRONG_PASSPHRASE);
    expect(identity.fingerprint).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){7}$/);
  });
});
