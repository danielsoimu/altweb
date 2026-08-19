/**
 * ECDSA-P256 Digital Signing
 * Signing is deterministic (RFC 6979 via @noble/curves): same content + same
 * key => same signature bytes, so signed capsule builds are byte-reproducible.
 * Verification stays on the native Web Crypto API and accepts both
 * deterministic and legacy random-k signatures (ECDSA verify is agnostic).
 */

import { p256 } from '@noble/curves/nist.js';
import { base64urlEncode, base64urlDecode } from './encoding';

export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true, // extractable for public key export
    ['sign', 'verify']
  );
}

export async function sign(
  data: Uint8Array,
  privateKey: CryptoKey
): Promise<string> {
  // Deterministic path (RFC 6979): extract the scalar and sign with noble.
  // Output is IEEE P1363 r||s (64 bytes) — the same wire format Web Crypto
  // produces and verify() expects.
  try {
    const jwk = await crypto.subtle.exportKey('jwk', privateKey);
    if (jwk.d) {
      const digest = new Uint8Array(
        await crypto.subtle.digest('SHA-256', data as BufferSource)
      );
      const signature = p256.sign(digest, base64urlDecode(jwk.d), { prehash: false });
      return base64urlEncode(signature);
    }
  } catch {
    // Non-extractable key — fall back to Web Crypto (random k, still valid).
  }
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data as BufferSource
  );
  return base64urlEncode(new Uint8Array(signature));
}

export async function verify(
  data: Uint8Array,
  signatureBase64: string,
  publicKeyBase64: string
): Promise<boolean> {
  try {
    const signature = base64urlDecode(signatureBase64);
    const publicKeyData = base64urlDecode(publicKeyBase64);

    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyData as BufferSource,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    return crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      signature as BufferSource,
      data as BufferSource
    );
  } catch {
    return false;
  }
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  return base64urlEncode(new Uint8Array(exported));
}

export async function computeFingerprint(publicKeyBase64: string): Promise<string> {
  const publicKeyData = base64urlDecode(publicKeyBase64);
  const hash = await crypto.subtle.digest('SHA-256', publicKeyData as BufferSource);
  const hashArray = new Uint8Array(hash);

  // Fingerprint format: first 8 bytes as hex separated by :
  const fingerprint = Array.from(hashArray.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':');

  return fingerprint;
}
