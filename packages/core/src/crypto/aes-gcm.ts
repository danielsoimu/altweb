/**
 * AES-256-GCM Encryption/Decryption
 * Uses only the native Web Crypto API
 */

import type { EncryptedPayload } from '../types/crypto';
import { base64urlEncode, base64urlDecode } from './encoding';
import { deriveKey, generateSalt, generateIV } from './key-derivation';

export async function encrypt(
  plaintext: Uint8Array,
  password: string
): Promise<EncryptedPayload> {
  const salt = generateSalt();
  const iv = generateIV();
  const key = await deriveKey(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  );

  return {
    iv: base64urlEncode(iv),
    salt: base64urlEncode(salt),
    ct: base64urlEncode(new Uint8Array(encrypted)),
    v: 1,
  };
}

export async function decrypt(
  payload: EncryptedPayload,
  password: string
): Promise<Uint8Array> {
  const salt = base64urlDecode(payload.salt);
  const iv = base64urlDecode(payload.iv);
  const ct = base64urlDecode(payload.ct);

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource
  );

  return new Uint8Array(decrypted);
}
