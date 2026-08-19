/**
 * ECDSA-P256 Digital Signing
 * Uses the native Web Crypto API (no external dependencies)
 */

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
