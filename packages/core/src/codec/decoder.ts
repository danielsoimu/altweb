/**
 * ALTWEB Decoder Pipeline
 * base64url → decrypt → decompress → JSON
 *
 * Supports:
 * - Public mode (no encryption)
 * - Full encryption (meta + blocks encrypted)
 * - Partial encryption (meta visible, blocks encrypted)
 */

import type { AltPage, PayloadEnvelope, DecodeResult, VisibleMeta } from '../types';
import { base64urlDecode, concatBytes } from '../crypto/encoding';
import { decrypt } from '../crypto/aes-gcm';
import { verify, computeFingerprint } from '../crypto/signing';
import { decompress } from '../compression';
import { validatePageStructure } from '../validate/validators';
import { sanitizePage } from '../sanitize/sanitize';

/**
 * Hard cap on the base64url envelope length (characters), checked before any
 * decoding work. Derived from the compression caps: a legitimate envelope is
 * at most ~17 MiB of compressed payload, base64url-expanded by 4/3 plus JSON
 * framing. Without this cap a multi-hundred-MB input buys a same-sized buffer
 * and a huge JSON.parse before the per-field caps ever run.
 */
export const MAX_ENVELOPE_CHARS = 24 * 1024 * 1024;

function assertEnvelopeSize(hash: string): void {
  if (hash.length > MAX_ENVELOPE_CHARS) {
    throw new ValidationError(
      `Envelope exceeds the ${MAX_ENVELOPE_CHARS} character limit`
    );
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Result for partial encryption when the password is unavailable
export interface PartialDecodeResult {
  partial: true;
  meta: VisibleMeta;
  needsPassword: true;
}

export async function decodePage(
  hash: string,
  password?: string
): Promise<DecodeResult> {
  assertEnvelopeSize(hash);

  // 1. Base64url decoding
  const envelopeBytes = base64urlDecode(hash);
  const envelopeJson = new TextDecoder().decode(envelopeBytes);

  // 2. Parse envelope
  let envelope: PayloadEnvelope;
  try {
    envelope = JSON.parse(envelopeJson);
  } catch {
    throw new ValidationError('Invalid URL format');
  }

  // Version check
  if (envelope.v !== 1) {
    throw new ValidationError(`Protocol version ${envelope.v} not supported`);
  }

  let compressed: Uint8Array;
  let page: AltPage;

  // 3. Decrypt or extract public data
  if (envelope.enc) {
    // Check whether this is partial encryption (visible meta)
    const isPartialEncryption = Boolean(envelope.m);

    if (isPartialEncryption) {
      // Partial encryption - extract the visible meta
      const metaCompressed = base64urlDecode(envelope.m!);
      const metaBytes = decompress(metaCompressed);
      const metaJson = new TextDecoder().decode(metaBytes);
      const visibleMeta: VisibleMeta = JSON.parse(metaJson);

      if (!password) {
        // No password - show only the meta
        throw new DecryptionError('Password required for encrypted content');
      }

      if (!envelope.e) {
        throw new ValidationError('Missing encrypted payload');
      }

      // Decrypt the blocks
      let blocksCompressed: Uint8Array;
      try {
        blocksCompressed = await decrypt(envelope.e, password);
      } catch {
        throw new DecryptionError('Incorrect password or corrupted data');
      }

      // Verify the signature over the visible meta AND the blocks: partial-mode
      // capsules sign meta || blocks, so verifying blocks alone would accept a
      // capsule whose visible title/description/author had been rewritten.
      let verified = false;
      let fingerprint: string | undefined;
      if (envelope.s && envelope.pk) {
        const signedBytes = concatBytes(metaCompressed, blocksCompressed);
        verified = await verify(signedBytes, envelope.s, envelope.pk);
        if (verified) {
          fingerprint = await computeFingerprint(envelope.pk);
        }
      }

      // Decompress and rebuild the page
      const blocksBytes = decompress(blocksCompressed);
      const blocksJson = new TextDecoder().decode(blocksBytes);
      const blocksData = JSON.parse(blocksJson);

      page = {
        v: blocksData.v || 1,
        meta: visibleMeta.meta,
        style: visibleMeta.style,
        blocks: blocksData.blocks,
        nav: blocksData.nav,
        indexHash: blocksData.indexHash,
      };

      const validatedPage = validatePageStructure(page);
      const sanitizedPage = sanitizePage(validatedPage);

      return {
        page: sanitizedPage,
        verified,
        publicKeyFingerprint: fingerprint,
      };
    } else {
      // Full encryption - the classic mode
      if (!password) {
        throw new DecryptionError('Password required for encrypted content');
      }
      if (!envelope.e) {
        throw new ValidationError('Missing encrypted payload');
      }

      try {
        compressed = await decrypt(envelope.e, password);
      } catch {
        throw new DecryptionError('Incorrect password or corrupted data');
      }
    }
  } else {
    if (!envelope.d) {
      throw new ValidationError('Missing public data');
    }
    compressed = base64urlDecode(envelope.d);
  }

  // 4. Verify the signature (if present) - for non-partial modes
  let verified = false;
  let fingerprint: string | undefined;
  if (envelope.s && envelope.pk) {
    verified = await verify(compressed, envelope.s, envelope.pk);
    if (verified) {
      fingerprint = await computeFingerprint(envelope.pk);
    }
  }

  // 5. Decompression
  let jsonBytes: Uint8Array;
  try {
    jsonBytes = decompress(compressed);
  } catch {
    throw new ValidationError('Failed to decompress data');
  }

  const json = new TextDecoder().decode(jsonBytes);

  // 6. Parse and validate the content
  try {
    const parsed = JSON.parse(json);
    page = validatePageStructure(parsed);
  } catch (e) {
    throw new ValidationError(
      `Invalid page structure: ${e instanceof Error ? e.message : 'unknown error'}`
    );
  }

  // 7. Sanitize the content
  const sanitizedPage = sanitizePage(page);

  return {
    page: sanitizedPage,
    verified,
    publicKeyFingerprint: fingerprint,
  };
}

// Get the visible meta without a password (for partial encryption)
export async function getVisibleMeta(hash: string): Promise<VisibleMeta | null> {
  try {
    assertEnvelopeSize(hash);
    const envelopeBytes = base64urlDecode(hash);
    const envelopeJson = new TextDecoder().decode(envelopeBytes);
    const envelope: PayloadEnvelope = JSON.parse(envelopeJson);

    if (envelope.enc && envelope.m) {
      const metaCompressed = base64urlDecode(envelope.m);
      const metaBytes = decompress(metaCompressed);
      const metaJson = new TextDecoder().decode(metaBytes);
      return JSON.parse(metaJson) as VisibleMeta;
    }
    return null;
  } catch {
    return null;
  }
}

// Check whether the content has visible meta
export function hasVisibleMeta(hash: string): boolean {
  try {
    assertEnvelopeSize(hash);
    const envelopeBytes = base64urlDecode(hash);
    const envelopeJson = new TextDecoder().decode(envelopeBytes);
    const envelope: PayloadEnvelope = JSON.parse(envelopeJson);
    return envelope.enc === true && Boolean(envelope.m);
  } catch {
    return false;
  }
}

export function isEncryptedContent(hash: string): boolean {
  try {
    assertEnvelopeSize(hash);
    const envelopeBytes = base64urlDecode(hash);
    const envelopeJson = new TextDecoder().decode(envelopeBytes);
    const envelope: PayloadEnvelope = JSON.parse(envelopeJson);
    return envelope.enc === true;
  } catch {
    return false;
  }
}

export function hasSignature(hash: string): boolean {
  try {
    assertEnvelopeSize(hash);
    const envelopeBytes = base64urlDecode(hash);
    const envelopeJson = new TextDecoder().decode(envelopeBytes);
    const envelope: PayloadEnvelope = JSON.parse(envelopeJson);
    return Boolean(envelope.s && envelope.pk);
  } catch {
    return false;
  }
}
