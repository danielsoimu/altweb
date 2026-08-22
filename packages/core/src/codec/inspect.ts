/**
 * Artifact inspection WITHOUT rendering and WITHOUT a DOM: pure cryptography
 * only (signature verification, fingerprint) + surface metadata.
 *
 * Rationale: the VSCodium extension host computes the trust badge here
 * (a Node process with no DOM, no jsdom); content is rendered exclusively
 * in the webview, where decodePage performs full validation + sanitization.
 *
 * Model note: for encrypted content, the signature covers the DECRYPTED
 * payload — it cannot be verified without the password => verified: null.
 */
import type { PayloadEnvelope } from '../types/crypto';
import { base64urlDecode } from '../crypto/encoding';
import { verify, computeFingerprint } from '../crypto/signing';
import { decompress } from '../compression';
import { ValidationError, MAX_ENVELOPE_CHARS } from './decoder';

export interface ArtifactInfo {
  encrypted: boolean;
  /** partial encryption: meta (title/description) visible without a password */
  partialMeta: boolean;
  signed: boolean;
  /** true/false = cryptographically verified; null = signed but unverifiable without the password */
  verified: boolean | null;
  fingerprint?: string;
  /** the title, if accessible without a password (plain text for the UI, never rendered as HTML) */
  title?: string;
}

export async function inspectArtifact(hash: string): Promise<ArtifactInfo> {
  if (hash.length > MAX_ENVELOPE_CHARS) {
    throw new ValidationError('Invalid artifact format');
  }
  let envelope: PayloadEnvelope;
  try {
    envelope = JSON.parse(new TextDecoder().decode(base64urlDecode(hash)));
  } catch {
    throw new ValidationError('Invalid artifact format');
  }
  if (envelope.v !== 1) {
    throw new ValidationError(`Protocol version ${envelope.v} not supported`);
  }

  const signed = Boolean(envelope.s && envelope.pk);
  const info: ArtifactInfo = {
    encrypted: envelope.enc,
    partialMeta: Boolean(envelope.enc && envelope.m),
    signed,
    verified: signed ? null : null,
  };

  if (signed) {
    info.fingerprint = await computeFingerprint(envelope.pk!);
  }

  if (!envelope.enc) {
    if (!envelope.d) throw new ValidationError('Missing public data');
    const compressed = base64urlDecode(envelope.d);
    if (signed) {
      info.verified = await verify(compressed, envelope.s!, envelope.pk!);
      if (!info.verified) info.fingerprint = undefined;
    }
    try {
      const page = JSON.parse(new TextDecoder().decode(decompress(compressed)));
      if (typeof page?.meta?.title === 'string') info.title = page.meta.title;
    } catch {
      // the title is best-effort; the signature remains the source of truth
    }
  } else if (envelope.m) {
    try {
      const meta = JSON.parse(new TextDecoder().decode(decompress(base64urlDecode(envelope.m))));
      if (typeof meta?.meta?.title === 'string') info.title = meta.meta.title;
    } catch {
      // corrupted visible meta — leave without a title
    }
  }

  return info;
}
