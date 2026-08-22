// @vitest-environment node
/**
 * inspectArtifact must work under PURE Node, without a DOM —
 * it is the VSCodium extension host path (trust badge without jsdom).
 * node-dom is intentionally NOT imported here. Fixtures are built with
 * encodePageUnsanitized (the DOM-free internal) because the public
 * encodePage sanitizes at build time and therefore requires a DOM.
 */
import { describe, it, expect } from 'vitest';
import { encodePageUnsanitized as encodePage } from '../src/codec/encoder';
import { inspectArtifact } from '../src/codec/inspect';
import { deriveIdentityFromPassphrase } from '../src/crypto/identity';
import type { AltPage } from '../src/types';

const page: AltPage = {
  v: 1,
  meta: { title: 'Artifact title', created: 1, modified: 1, lang: 'ro' },
  blocks: [{ t: 'p', c: 'content' }],
  style: { theme: 'auto', font: 'sans', accent: 'blue', maxW: 'md' },
};

describe('inspectArtifact (no DOM)', () => {
  it('public unsigned: encrypted=false, signed=false, title accessible', async () => {
    const hash = await encodePage(page);
    const info = await inspectArtifact(hash);
    expect(info).toMatchObject({ encrypted: false, signed: false, verified: null });
    expect(info.title).toBe('Artifact title');
  });

  it('public signed: verified=true + fingerprint', async () => {
    const identity = await deriveIdentityFromPassphrase('test-inspect-identity-vector');
    const hash = await encodePage(page, { signingKeyPair: identity.keyPair });
    const info = await inspectArtifact(hash);
    expect(info.signed).toBe(true);
    expect(info.verified).toBe(true);
    expect(info.fingerprint).toBe(identity.fingerprint);
  });

  it('forged signature: verified=false, no fingerprint', async () => {
    const identity = await deriveIdentityFromPassphrase('test-inspect-identity-vector');
    const hash = await encodePage(page, { signingKeyPair: identity.keyPair });
    // tamper with the public payload d, keeping the signature
    const envelope = JSON.parse(Buffer.from(hash.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    const other = await encodePage({ ...page, blocks: [{ t: 'p', c: 'altered' }] });
    const otherEnvelope = JSON.parse(Buffer.from(other.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    envelope.d = otherEnvelope.d;
    const tampered = Buffer.from(JSON.stringify(envelope))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const info = await inspectArtifact(tampered);
    expect(info.signed).toBe(true);
    expect(info.verified).toBe(false);
    expect(info.fingerprint).toBeUndefined();
  });

  it('fully encrypted: verified=null (unverifiable without the password)', async () => {
    const identity = await deriveIdentityFromPassphrase('test-inspect-identity-vector');
    const hash = await encodePage(page, {
      password: 'test-password',
      signingKeyPair: identity.keyPair,
    });
    const info = await inspectArtifact(hash);
    expect(info.encrypted).toBe(true);
    expect(info.signed).toBe(true);
    expect(info.verified).toBeNull();
  });

  it('partial encryption: title visible without the password', async () => {
    const hash = await encodePage(page, { password: 'test-password', encryptMeta: false });
    const info = await inspectArtifact(hash);
    expect(info.encrypted).toBe(true);
    expect(info.partialMeta).toBe(true);
    expect(info.title).toBe('Artifact title');
  });
});
