/**
 * Base64url Encoding (RFC 4648 §5)
 * URL-safe — no +, /, or =
 *
 * Decoding is CANONICAL: exactly one string maps to a given byte sequence.
 * Non-canonical inputs (wrong charset, padding chars, non-zero trailing bits)
 * are rejected. This matters wherever the encoded STRING is an identity —
 * trust-file key comparison, --expect-key pinning, capsule hashing/dedup —
 * because otherwise several distinct strings alias the same bytes.
 */

/** Chunk size for byte→binary-string conversion. String.fromCharCode(...arr)
 * spreads the array onto the call stack, which overflows around ~100 KB —
 * a hard capsule-size ceiling and a crash vector. 32 Ki args is safely below
 * every engine's argument limit. */
const FROM_CHAR_CODE_CHUNK = 0x8000;

export function base64urlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i += FROM_CHAR_CODE_CHUNK) {
    binary += String.fromCharCode(
      ...data.subarray(i, i + FROM_CHAR_CODE_CHUNK)
    );
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function base64urlDecode(str: string): Uint8Array {
  // Strict charset first: atob's forgiving-base64 silently strips whitespace
  // and accepts '+', '/', '=' — all non-canonical for base64url.
  if (!/^[A-Za-z0-9_-]*$/.test(str)) {
    throw new Error('invalid base64url charset');
  }
  const rem = str.length % 4;
  if (rem === 1) {
    throw new Error('invalid base64url length');
  }
  // Trailing-bit check: the final partial group must have its unused low bits
  // zero, otherwise 'B', 'C', 'D' all decode to the same byte as 'A' would.
  if (rem !== 0) {
    const lastValue = BASE64URL_ALPHABET.indexOf(str[str.length - 1]);
    const unusedBits = rem === 2 ? 0b1111 : 0b11;
    if ((lastValue & unusedBits) !== 0) {
      throw new Error('non-canonical base64url encoding');
    }
  }
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

/**
 * Ordered concatenation of two byte spans. Used to define the exact bytes a
 * partial-encryption signature covers (visible meta || encrypted blocks), so
 * the encoder and every verifier agree on one canonical layout.
 */
export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
