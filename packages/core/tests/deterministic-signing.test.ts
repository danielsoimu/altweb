/**
 * Regression tests for deterministic signing (audit S3): RFC 6979 makes
 * signed capsule builds byte-reproducible, and the public docs claim it.
 */
import '../src/sanitize/node-dom';
import { describe, expect, it } from 'vitest';
import { deriveIdentityFromPassphrase } from '../src/crypto/identity';
import { sign, verify, exportPublicKey } from '../src/crypto/signing';
import { encodePage } from '../src/codec/encoder';
import type { AltPage } from '../src/types';

const PASSPHRASE = 'deterministic-signing-regression-test';

const PAGE: AltPage = {
  v: 1,
  meta: { title: 'Determinism', created: 1755000000000, modified: 1755000000000, lang: 'en' },
  blocks: [
    { t: 'h', l: 1, c: 'Determinism' },
    { t: 'p', c: 'Same input, same key, same bytes.' },
  ],
  style: { font: 'sans', theme: 'light' },
};

describe('deterministic signing (RFC 6979)', () => {
  it('same data + same key => identical signature bytes', async () => {
    const identity = await deriveIdentityFromPassphrase(PASSPHRASE);
    const data = new TextEncoder().encode('reproducible payload');
    const s1 = await sign(data, identity.keyPair.privateKey);
    const s2 = await sign(data, identity.keyPair.privateKey);
    expect(s1).toBe(s2);
  });

  it('deterministic signatures still verify through Web Crypto verify()', async () => {
    const identity = await deriveIdentityFromPassphrase(PASSPHRASE);
    const data = new TextEncoder().encode('cross-implementation check');
    const signature = await sign(data, identity.keyPair.privateKey);
    const publicKey = await exportPublicKey(identity.keyPair.publicKey);
    expect(await verify(data, signature, publicKey)).toBe(true);
    // Tampered data must still fail.
    expect(await verify(new TextEncoder().encode('x'), signature, publicKey)).toBe(false);
  });

  it('signed capsule builds are byte-reproducible end to end', async () => {
    const identity = await deriveIdentityFromPassphrase(PASSPHRASE);
    const h1 = await encodePage(PAGE, { signingKeyPair: identity.keyPair });
    const h2 = await encodePage(PAGE, { signingKeyPair: identity.keyPair });
    expect(h1).toBe(h2);
  });
});
