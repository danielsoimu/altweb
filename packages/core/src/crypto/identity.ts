/**
 * Deterministic Identity Management
 * Derives ECDSA keypairs from passphrases for persistent identity.
 *
 * v2 (current): Argon2id. The salt stays fixed on purpose — the product
 * promise is "a passphrase is a keypair": one thing to remember, nothing
 * stored, reproducible anywhere. What a fixed salt gives an attacker is a
 * precompute-once dictionary that amortizes across every user; Argon2id
 * removes the economics of that dictionary instead of the salt: each guess
 * costs 64 MiB of memory, so GPU/ASIC mass production stops paying. A
 * per-user salt (identifier) was considered and rejected — it would double
 * what a user must remember exactly, for a marginal gain over memory-hardness
 * plus the enforced passphrase floor (see validateIdentityPassphrase).
 *
 * v1 (legacy): PBKDF2-SHA256, 600k iterations, fixed salt. Kept only so
 * pre-v2 identities can still be re-derived; new derivations are always v2.
 */

import { p256 } from '@noble/curves/nist.js';
import { argon2id } from '@noble/hashes/argon2.js';
import { base64urlEncode } from './encoding';

const IDENTITY_SALT_V1 = new TextEncoder().encode('ALTWEB-IDENTITY-v1');
const PBKDF2_ITERATIONS = 600000;

const IDENTITY_SALT_V2 = new TextEncoder().encode('ALTWEB-IDENTITY-v2');
// 64 MiB, 3 passes, 1 lane — above the OWASP floor, sized for a long-term
// signing key. ~0.5s in Node, ~1s in a browser: fine for a rare operation.
const ARGON2_MEM_KIB = 65536;
const ARGON2_PASSES = 3;
const ARGON2_LANES = 1;

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
 * Derives a deterministic ECDSA P-256 keypair from a passphrase (v2, Argon2id).
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
  // The floor is enforced AT DERIVATION, not only in the editor UX: with a
  // fixed salt, the passphrase's entropy is the identity's entire foundation,
  // and every caller (CLI, library consumers) must hit the same wall the
  // editor shows. deriveIdentityFromPassphrase("a") must not mint a real key.
  const { valid } = validateIdentityPassphrase(passphrase);
  if (!valid) {
    throw new Error(
      'passphrase below the identity floor: use at least 16 characters ' +
        'scoring >= 3 (add length, mixed case, or digits + symbols)'
    );
  }
  // 1. Derive a 32-byte seed with Argon2id (memory-hard; see header comment)
  const seed = argon2id(new TextEncoder().encode(passphrase), IDENTITY_SALT_V2, {
    m: ARGON2_MEM_KIB,
    t: ARGON2_PASSES,
    p: ARGON2_LANES,
    dkLen: 32,
  });
  return identityFromSeed(seed);
}

/**
 * Legacy v1 derivation (PBKDF2-SHA256, 600k iterations, fixed salt).
 * @deprecated Only for re-deriving identities created before the v2 scheme —
 * fingerprints differ between v1 and v2 for the same passphrase. New
 * identities must use deriveIdentityFromPassphrase.
 */
export async function deriveLegacyIdentityFromPassphrase(
  passphrase: string
): Promise<DerivedIdentity> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const seedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: IDENTITY_SALT_V1,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );
  return identityFromSeed(new Uint8Array(seedBits));
}

/** Seed -> validated scalar -> Web Crypto keypair + fingerprint. */
async function identityFromSeed(seed: Uint8Array): Promise<DerivedIdentity> {
  // ~1 in 2^32 seeds falls outside [1, n-1] for P-256; noble would throw.
  // Deterministic rehash-until-valid (FIPS 186-5 B.4.1 style): valid seeds —
  // virtually all — are used unchanged, so existing identities are unaffected;
  // out-of-range seeds now derive a key instead of crashing.
  let privateScalar = seed;
  while (!p256.utils.isValidSecretKey(privateScalar)) {
    privateScalar = new Uint8Array(
      await crypto.subtle.digest('SHA-256', privateScalar as BufferSource)
    );
  }

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

  // Identity derivation uses a fixed salt by design (determinism: same
  // passphrase -> same key, nothing stored). Argon2id makes mass dictionary
  // precomputation economically hostile, but the passphrase entropy is still
  // the identity's foundation. Hence the strict floor here: at least
  // 16 characters and score >= 3. Prefer long diceware-style phrases.
  return {
    valid: score >= 3 && length >= 16,
    score,
    feedbackKey: feedbackKeys[score],
  };
}
