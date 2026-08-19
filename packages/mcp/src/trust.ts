/**
 * Trusted signer registry: ~/.altweb/trusted-keys.json (override via
 * ALTWEB_TRUST_FILE).
 *
 * Trust is decided on the FULL ECDSA public key (base64url SPKI, the same
 * string a capsule carries in its envelope). The 8-byte fingerprint that
 * the CLI prints is a human-readable label only — at 64 bits it is too
 * short to anchor trust against a targeted collision, so entries that
 * carry only a fingerprint are never matched.
 *
 * File format:
 *   { "keys": [ { "name": "Alice",
 *                 "publicKey": "<base64url SPKI>",
 *                 "fingerprint": "ab:12:..." } ] }
 * (publicKey is required for trust; fingerprint is an optional label.)
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface TrustedKey {
  name: string;
  publicKey: string;
  fingerprint?: string;
}

export function trustFilePath(): string {
  return process.env.ALTWEB_TRUST_FILE ?? join(homedir(), '.altweb', 'trusted-keys.json');
}

export function loadTrustedKeys(): TrustedKey[] {
  const path = trustFilePath();
  if (!existsSync(path)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${path}: not valid JSON — fix or remove the trust file`);
  }
  const keys = (parsed as { keys?: unknown }).keys;
  if (!Array.isArray(keys)) return [];
  return keys.filter(
    (k): k is TrustedKey =>
      typeof k === 'object' &&
      k !== null &&
      typeof (k as TrustedKey).name === 'string' &&
      typeof (k as TrustedKey).publicKey === 'string' &&
      (k as TrustedKey).publicKey.length > 0
  );
}

export function findTrusted(publicKey: string): TrustedKey | undefined {
  return loadTrustedKeys().find((k) => k.publicKey === publicKey);
}
