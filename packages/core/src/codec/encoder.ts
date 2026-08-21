/**
 * ALTWEB Encoder Pipeline
 * JSON → compress → encrypt → base64url
 *
 * Supports:
 * - Public mode (no encryption)
 * - Full encryption (meta + blocks encrypted)
 * - Partial encryption (meta visible, blocks encrypted)
 */

import type { AltPage, PayloadEnvelope, EncryptedPayload, VisibleMeta } from '../types';
import { base64urlEncode, concatBytes } from '../crypto/encoding';
import { encrypt } from '../crypto/aes-gcm';
import { sign, exportPublicKey } from '../crypto/signing';
import { compress } from '../compression';
import { sanitizePage } from '../sanitize/sanitize';

export interface EncodeOptions {
  password?: string;
  signingKeyPair?: CryptoKeyPair;
  encryptMeta?: boolean; // true = encrypt everything, false = blocks only (default: true)
}

export async function encodePage(
  page: AltPage,
  options: EncodeOptions = {}
): Promise<string> {
  // Sanitize at build time so capsules carry clean content even for
  // consumers that render without the decode path's sanitization pass
  // (the standalone renderer relies on CSP as its only other layer).
  // Note: like decodePage, this makes encodePage require a DOM (browser
  // or the "@altweb/core/node-dom" shim under Node).
  return encodePageUnsanitized(sanitizePage(page), options);
}

/**
 * Envelope construction without the sanitization pass — DOM-free.
 * Internal: not exported from the package barrel. Used by tests that
 * must build fixtures in a pure-Node environment (inspectArtifact's
 * no-DOM contract) without pulling in DOMPurify.
 */
export async function encodePageUnsanitized(
  page: AltPage,
  options: EncodeOptions = {}
): Promise<string> {
  const { password, signingKeyPair, encryptMeta = true } = options;
  const isEncrypted = Boolean(password);

  // 3. Build payload envelope
  const envelope: PayloadEnvelope = {
    v: 1,
    enc: isEncrypted,
  };

  if (isEncrypted && password) {
    if (encryptMeta) {
      // Full encryption - the entire page
      const json = JSON.stringify(page);
      const jsonBytes = new TextEncoder().encode(json);
      const compressed = compress(jsonBytes);

      const encrypted: EncryptedPayload = await encrypt(compressed, password);
      envelope.e = encrypted;

      // Sign over the compressed data
      if (signingKeyPair) {
        const signature = await sign(compressed, signingKeyPair.privateKey);
        envelope.s = signature;
        envelope.pk = await exportPublicKey(signingKeyPair.publicKey);
      }
    } else {
      // Partial encryption - meta visible, blocks encrypted

      // 1. Visible meta + style (compressed)
      const visibleMeta: VisibleMeta = {
        meta: page.meta,
        style: page.style,
      };
      const metaJson = JSON.stringify(visibleMeta);
      const metaBytes = new TextEncoder().encode(metaJson);
      const metaCompressed = compress(metaBytes);
      envelope.m = base64urlEncode(metaCompressed);

      // 2. Encrypted blocks
      const blocksData = {
        v: page.v,
        blocks: page.blocks,
        nav: page.nav,
        indexHash: page.indexHash,
      };
      const blocksJson = JSON.stringify(blocksData);
      const blocksBytes = new TextEncoder().encode(blocksJson);
      const blocksCompressed = compress(blocksBytes);

      const encrypted: EncryptedPayload = await encrypt(blocksCompressed, password);
      envelope.e = encrypted;

      // Sign over the visible meta AND the blocks. In partial mode meta+style
      // travel in the clear (envelope.m), so signing blocks alone would leave
      // title/description/author unprotected — a signed capsule whose visible
      // meta anyone could rewrite. The signature must bind both.
      if (signingKeyPair) {
        const signedBytes = concatBytes(metaCompressed, blocksCompressed);
        const signature = await sign(signedBytes, signingKeyPair.privateKey);
        envelope.s = signature;
        envelope.pk = await exportPublicKey(signingKeyPair.publicKey);
      }
    }
  } else {
    // Public mode - compressed only
    const json = JSON.stringify(page);
    const jsonBytes = new TextEncoder().encode(json);
    const compressed = compress(jsonBytes);
    envelope.d = base64urlEncode(compressed);

    // Sign over the compressed data
    if (signingKeyPair) {
      const signature = await sign(compressed, signingKeyPair.privateKey);
      envelope.s = signature;
      envelope.pk = await exportPublicKey(signingKeyPair.publicKey);
    }
  }

  // Final encoding
  const envelopeJson = JSON.stringify(envelope);
  const envelopeBytes = new TextEncoder().encode(envelopeJson);
  const encoded = base64urlEncode(envelopeBytes);

  return encoded;
}

export function generateFullUrl(hash: string, baseUrl: string): string {
  return `${baseUrl}/#${hash}`;
}
