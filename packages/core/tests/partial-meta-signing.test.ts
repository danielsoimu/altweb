/**
 * Regression test for the partial-encryption metadata gap (external audit).
 *
 * In partial-encryption mode the visible meta (title/description/author/style)
 * travels in the clear in envelope.m. Before the fix the signature covered only
 * the encrypted blocks, so a signed partial capsule's visible author could be
 * rewritten while the signature still verified — contradicting the public
 * "not one byte changed" claim. The signature now covers meta || blocks.
 */
import '../src/sanitize/node-dom';
import { describe, expect, it } from 'vitest';
import { deriveIdentityFromPassphrase } from '../src/crypto/identity';
import { encodePage } from '../src/codec/encoder';
import { decodePage } from '../src/codec/decoder';
import { base64urlEncode, base64urlDecode } from '../src/crypto/encoding';
import { compress, decompress } from '../src/compression';
import type { AltPage } from '../src/types';

const PASSPHRASE = 'partial-meta-signing-regression';
const PASSWORD = 'capsule-password';

const PAGE: AltPage = {
  v: 1,
  meta: {
    title: 'Confidential Memo',
    description: 'internal only',
    author: 'Real Author',
    created: 1755000000000,
    modified: 1755000000000,
    lang: 'en',
  },
  blocks: [{ t: 'p', c: 'protected body' }],
  style: { font: 'sans', theme: 'light' },
};

describe('partial-encryption signature covers the visible meta', () => {
  it('a signed partial capsule verifies and keeps its author', async () => {
    const id = await deriveIdentityFromPassphrase(PASSPHRASE);
    const hash = await encodePage(PAGE, {
      password: PASSWORD,
      encryptMeta: false, // partial: meta visible, blocks encrypted
      signingKeyPair: id.keyPair,
    });

    const result = await decodePage(hash, PASSWORD);
    expect(result.verified).toBe(true);
    expect(result.page.meta.author).toBe('Real Author');
  });

  it('rewriting the visible meta breaks verification (the bug)', async () => {
    const id = await deriveIdentityFromPassphrase(PASSPHRASE);
    const hash = await encodePage(PAGE, {
      password: PASSWORD,
      encryptMeta: false,
      signingKeyPair: id.keyPair,
    });

    // Forge only the visible meta: swap the author, leave the encrypted blocks,
    // signature, and public key untouched.
    const envelope = JSON.parse(new TextDecoder().decode(base64urlDecode(hash)));
    const visibleMeta = JSON.parse(
      new TextDecoder().decode(decompress(base64urlDecode(envelope.m)))
    );
    visibleMeta.meta.author = 'Attacker';
    envelope.m = base64urlEncode(compress(new TextEncoder().encode(JSON.stringify(visibleMeta))));
    const forgedHash = base64urlEncode(new TextEncoder().encode(JSON.stringify(envelope)));

    const result = await decodePage(forgedHash, PASSWORD);
    // Before the fix the signature covered blocks only, so this returned true.
    expect(result.verified).toBe(false);
  });
});
