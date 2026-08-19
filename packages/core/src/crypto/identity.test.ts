import { describe, it, expect } from 'vitest';
import { deriveIdentityFromPassphrase, validateIdentityPassphrase } from './identity';
import { sign, verify } from './signing';

describe('Identity - Deterministic Key Derivation', () => {
  it('derives the same keypair from the same passphrase', async () => {
    const passphrase = 'test-journalist-passphrase-2024';

    const identity1 = await deriveIdentityFromPassphrase(passphrase);
    const identity2 = await deriveIdentityFromPassphrase(passphrase);

    // Same fingerprint
    expect(identity1.fingerprint).toBe(identity2.fingerprint);

    // Same public key
    expect(identity1.publicKeyBase64).toBe(identity2.publicKeyBase64);
  });

  it('derives different keypairs from different passphrases', async () => {
    const identity1 = await deriveIdentityFromPassphrase('passphrase-one');
    const identity2 = await deriveIdentityFromPassphrase('passphrase-two');

    expect(identity1.fingerprint).not.toBe(identity2.fingerprint);
    expect(identity1.publicKeyBase64).not.toBe(identity2.publicKeyBase64);
  });

  it('produces valid signing keypair', async () => {
    const passphrase = 'signing-test-passphrase';
    const identity = await deriveIdentityFromPassphrase(passphrase);

    const message = new TextEncoder().encode('Hello, ALTWEB!');

    // Sign with derived private key
    const signature = await sign(message, identity.keyPair.privateKey);

    // Verify with public key
    const isValid = await verify(message, signature, identity.publicKeyBase64);
    expect(isValid).toBe(true);
  });

  it('verification fails with wrong public key', async () => {
    const identity1 = await deriveIdentityFromPassphrase('passphrase-one');
    const identity2 = await deriveIdentityFromPassphrase('passphrase-two');

    const message = new TextEncoder().encode('Signed by identity1');
    const signature = await sign(message, identity1.keyPair.privateKey);

    // Verify with wrong public key should fail
    const isValid = await verify(message, signature, identity2.publicKeyBase64);
    expect(isValid).toBe(false);
  });

  it('fingerprint has correct format', async () => {
    const identity = await deriveIdentityFromPassphrase('fingerprint-test');

    // Fingerprint should be 8 hex bytes separated by colons
    // Format: xx:xx:xx:xx:xx:xx:xx:xx (23 chars)
    expect(identity.fingerprint).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){7}$/);
  });
});

describe('validateIdentityPassphrase', () => {
  it('rejects empty passphrase', () => {
    const result = validateIdentityPassphrase('');
    expect(result.valid).toBe(false);
    expect(result.score).toBe(0);
  });

  it('rejects short passphrases', () => {
    const result = validateIdentityPassphrase('short');
    expect(result.valid).toBe(false);
    expect(result.score).toBeLessThan(2);
  });

  it('accepts strong passphrases', () => {
    const result = validateIdentityPassphrase('this-is-a-strong-passphrase-2024');
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });
});
