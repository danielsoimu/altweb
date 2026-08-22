/**
 * ECDSA-P256 Digital Signing
 * Signing is deterministic (RFC 6979 via @noble/curves): same content + same
 * key => same signature bytes, so signed capsule builds are byte-reproducible.
 * Verification stays on the native Web Crypto API and accepts both
 * deterministic and legacy random-k signatures (ECDSA verify is agnostic).
 *
 * Verification additionally REJECTS high-s (malleated) signatures: for any
 * ECDSA signature (r, s), (r, n - s) also verifies, so without this check two
 * distinct valid envelopes exist per signature. That does not break
 * authenticity, but it breaks every property built on "one content + one key
 * = one capsule byte-identity": byte-reproducibility, dedup-by-signature,
 * and provenance chaining over capsule hashes (SPEC §6.5), where a third
 * party could fork a chain without holding any key. The signer (noble)
 * always emits canonical low-s, so legitimate capsules are unaffected.
 */

import { p256 } from '@noble/curves/nist.js';
import { base64urlEncode, base64urlDecode } from './encoding';

/** P-256 group order n (a fixed domain parameter). */
const P256_N = BigInt(
  '0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'
);
const P256_HALF_N = P256_N >> 1n;

/**
 * True when the signature's s component is in the canonical low half
 * [1, n/2]. Layouts other than IEEE P1363 r||s (64 bytes) are passed
 * through — Web Crypto rejects them on its own.
 */
function isLowS(signature: Uint8Array): boolean {
  if (signature.length !== 64) return true;
  let s = 0n;
  for (let i = 32; i < 64; i++) {
    s = (s << 8n) | BigInt(signature[i]);
  }
  return s <= P256_HALF_N;
}

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

    if (!isLowS(signature)) {
      return false;
    }

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
