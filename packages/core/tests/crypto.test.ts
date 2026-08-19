/**
 * Crypto Module Tests
 */

import { describe, it, expect } from 'vitest';
import {
  base64urlEncode,
  base64urlDecode,
  encrypt,
  decrypt,
  generateSigningKeyPair,
  sign,
  verify,
  exportPublicKey,
  computeFingerprint,
} from '../src/crypto';

describe('Base64url Encoding', () => {
  it('encode → decode returns the original data', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
    const encoded = base64urlEncode(original);
    const decoded = base64urlDecode(encoded);
    expect(decoded).toEqual(original);
  });

  it('contains no URL-invalid characters', () => {
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;
    const encoded = base64urlEncode(data);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('works with empty data', () => {
    const empty = new Uint8Array(0);
    const encoded = base64urlEncode(empty);
    const decoded = base64urlDecode(encoded);
    expect(decoded.length).toBe(0);
  });
});

describe('AES-256-GCM', () => {
  it('encrypt → decrypt returns the original data', async () => {
    const plaintext = new TextEncoder().encode('Hello, ALTWEB!');
    const password = 'test-password-123';

    const encrypted = await encrypt(plaintext, password);
    const decrypted = await decrypt(encrypted, password);

    expect(new TextDecoder().decode(decrypted)).toBe('Hello, ALTWEB!');
  });

  it('decrypting with a wrong password throws', async () => {
    const plaintext = new TextEncoder().encode('Secret message');
    const encrypted = await encrypt(plaintext, 'correct-password');

    await expect(decrypt(encrypted, 'wrong-password')).rejects.toThrow();
  });

  it('different IV on each encryption', async () => {
    const plaintext = new TextEncoder().encode('Same message');
    const password = 'same-password';

    const encrypted1 = await encrypt(plaintext, password);
    const encrypted2 = await encrypt(plaintext, password);

    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });

  it('different salt on each encryption', async () => {
    const plaintext = new TextEncoder().encode('Same message');
    const password = 'same-password';

    const encrypted1 = await encrypt(plaintext, password);
    const encrypted2 = await encrypt(plaintext, password);

    expect(encrypted1.salt).not.toBe(encrypted2.salt);
  });

  it('output does not contain the plaintext', async () => {
    const secret = 'super-secret-message-that-should-not-appear';
    const plaintext = new TextEncoder().encode(secret);
    const encrypted = await encrypt(plaintext, 'password');

    const fullPayload = JSON.stringify(encrypted);
    expect(fullPayload).not.toContain(secret);
  });
});

describe('ECDSA-P256 Signing', () => {
  it('sign → verify succeeds', async () => {
    const keyPair = await generateSigningKeyPair();
    const data = new TextEncoder().encode('Data to sign');

    const signature = await sign(data, keyPair.privateKey);
    const publicKeyExported = await exportPublicKey(keyPair.publicKey);
    const isValid = await verify(data, signature, publicKeyExported);

    expect(isValid).toBe(true);
  });

  it('verification fails with modified data', async () => {
    const keyPair = await generateSigningKeyPair();
    const data = new TextEncoder().encode('Original data');

    const signature = await sign(data, keyPair.privateKey);
    const publicKeyExported = await exportPublicKey(keyPair.publicKey);

    const modifiedData = new TextEncoder().encode('Modified data');
    const isValid = await verify(modifiedData, signature, publicKeyExported);

    expect(isValid).toBe(false);
  });

  it('consistent fingerprint for the same key', async () => {
    const keyPair = await generateSigningKeyPair();
    const publicKeyExported = await exportPublicKey(keyPair.publicKey);

    const fingerprint1 = await computeFingerprint(publicKeyExported);
    const fingerprint2 = await computeFingerprint(publicKeyExported);

    expect(fingerprint1).toBe(fingerprint2);
    expect(fingerprint1).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){7}$/);
  });

  it('different keys have different fingerprints', async () => {
    const keyPair1 = await generateSigningKeyPair();
    const keyPair2 = await generateSigningKeyPair();

    const pk1 = await exportPublicKey(keyPair1.publicKey);
    const pk2 = await exportPublicKey(keyPair2.publicKey);

    const fp1 = await computeFingerprint(pk1);
    const fp2 = await computeFingerprint(pk2);

    expect(fp1).not.toBe(fp2);
  });
});
