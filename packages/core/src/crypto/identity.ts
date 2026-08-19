/**
 * Deterministic Identity Management
 * Derives ECDSA keypairs from passphrases for persistent identity
 */

import { p256 } from '@noble/curves/nist.js';
import { base64urlEncode } from './encoding';

// Fixed salt for determinism - all ALTWEB users derive keys the same way
const IDENTITY_SALT = new TextEncoder().encode('ALTWEB-IDENTITY-v1');
const PBKDF2_ITERATIONS = 600000;

/**
 * Represents a derived identity with keypair and fingerprint
 */
export interface DerivedIdentity {
  /** The CryptoKeyPair for signing (compatible with existing sign() function) */
  keyPair: CryptoKeyPair;
  /** Human-readable fingerprint (e.g., "a7:f3:c2:d1:...") */
  fingerprint: string;
  /** Base64url encoded public key for embedding in signatures */
  publicKeyBase64: string;
}

/**
 * Derives a deterministic ECDSA P-256 keypair from a passphrase.
 * Same passphrase always produces the same keypair.
 *
 * @param passphrase - Secret phrase (should be strong, like a password)
 * @returns DerivedIdentity with keypair and fingerprint
 *
 * @example
 * const identity = await deriveIdentityFromPassphrase("my-secret-journalist-phrase-2024");
 * // Use identity.keyPair with sign() function
 * // Publish identity.fingerprint publicly to establish authorship
 */
export async function deriveIdentityFromPassphrase(passphrase: string): Promise<DerivedIdentity> {
  // 1. Derive 32-byte seed from passphrase using PBKDF2
  const passphraseBytes = new TextEncoder().encode(passphrase);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const seedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: IDENTITY_SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );

  const privateScalar = new Uint8Array(seedBits);

  // 2. Compute public key using @noble/curves
  // getPublicKey returns uncompressed format: 04 || x(32) || y(32) = 65 bytes
  const publicKeyUncompressed = p256.getPublicKey(privateScalar, false);

  // Extract x and y coordinates (skip the 04 prefix)
  const x = publicKeyUncompressed.slice(1, 33);
  const y = publicKeyUncompressed.slice(33, 65);

  // 3. Import as JWK into Web Crypto API
  const privateJwk = {
    kty: 'EC',
    crv: 'P-256',
    d: base64urlEncode(privateScalar),
    x: base64urlEncode(x),
    y: base64urlEncode(y),
  };

  const publicJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64urlEncode(x),
    y: base64urlEncode(y),
  };

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, // extractable
    ['sign']
  );

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, // extractable
    ['verify']
  );

  // 4. Export public key in SPKI format for compatibility with existing code
  const publicKeySpki = await crypto.subtle.exportKey('spki', publicKey);
  const publicKeyBase64 = base64urlEncode(new Uint8Array(publicKeySpki));

  // 5. Compute fingerprint
  const fingerprint = await computeFingerprintFromBytes(new Uint8Array(publicKeySpki));

  return {
    keyPair: { privateKey, publicKey },
    fingerprint,
    publicKeyBase64,
  };
}

/**
 * Computes a human-readable fingerprint from public key bytes
 */
async function computeFingerprintFromBytes(publicKeyBytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', publicKeyBytes as BufferSource);
  const hashArray = new Uint8Array(hash);

  // Format: first 8 bytes as hex with colons
  return Array.from(hashArray.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':');
}

/**
 * Feedback keys for passphrase validation (for i18n)
 */
export type PassphraseFeedbackKey = 'empty' | 'tooShort' | 'weak' | 'acceptable' | 'good' | 'excellent';

/**
 * Validates passphrase strength for identity derivation.
 * Returns feedbackKey for translation in consuming component.
 */
export function validateIdentityPassphrase(passphrase: string): {
  valid: boolean;
  score: number; // 0-4
  feedbackKey: PassphraseFeedbackKey;
} {
  if (!passphrase) {
    return { valid: false, score: 0, feedbackKey: 'empty' };
  }

  const length = passphrase.length;
  let score = 0;

  // Length scoring
  if (length >= 8) score++;
  if (length >= 16) score++;
  if (length >= 24) score++;

  // Complexity scoring
  const hasLower = /[a-z]/.test(passphrase);
  const hasUpper = /[A-Z]/.test(passphrase);
  const hasNumber = /\d/.test(passphrase);
  const hasSpecial = /[^a-zA-Z0-9]/.test(passphrase);

  if ((hasLower && hasUpper) || (hasNumber && hasSpecial)) score++;

  // Cap at 4
  score = Math.min(score, 4);

  const feedbackKeys: PassphraseFeedbackKey[] = [
    'tooShort',
    'weak',
    'acceptable',
    'good',
    'excellent',
  ];

  // Identity derivation uses a global fixed salt by design (determinism:
  // same passphrase -> same key, nothing stored). That means the entire
  // security of an identity IS the passphrase entropy — no per-user salt
  // slows an offline attacker down. Hence the strict floor here: at least
  // 16 characters and score >= 3. Prefer long diceware-style phrases.
  return {
    valid: score >= 3 && length >= 16,
    score,
    feedbackKey: feedbackKeys[score],
  };
}
