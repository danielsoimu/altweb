/**
 * Browser identity store — mirrors the CLI's ~/.altweb/identity.json:
 * ONLY the public key + fingerprint are persisted (localStorage).
 * The passphrase and the private key never leave memory.
 */

import type { DerivedIdentity } from '@altweb/core';

const STORAGE_KEY = 'altweb.editor.identity';

export interface SavedIdentity {
  publicKey: string;
  fingerprint: string;
  created: number;
}

export function loadSavedIdentity(): SavedIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedIdentity;
    if (typeof parsed.publicKey !== 'string' || typeof parsed.fingerprint !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: DerivedIdentity): SavedIdentity {
  const record: SavedIdentity = {
    publicKey: identity.publicKeyBase64,
    fingerprint: identity.fingerprint,
    created: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function forgetIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}
