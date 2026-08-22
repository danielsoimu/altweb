/**
 * CLI identity: deterministically derived from the passphrase (never stored).
 * ~/.altweb/identity.json holds ONLY {publicKey, fingerprint, created} —
 * the private key is re-derived from the passphrase on every run
 * (ALTWEB_PASSPHRASE env var or a hidden TTY prompt).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { deriveIdentityFromPassphrase, type DerivedIdentity } from '@altweb/core';

export const ALTWEB_DIR = join(homedir(), '.altweb');
const IDENTITY_FILE = join(ALTWEB_DIR, 'identity.json');

export interface SavedIdentity {
  publicKey: string;
  fingerprint: string;
  created: number;
}

export function loadSavedIdentity(): SavedIdentity | null {
  if (!existsSync(IDENTITY_FILE)) return null;
  try {
    return JSON.parse(readFileSync(IDENTITY_FILE, 'utf8')) as SavedIdentity;
  } catch {
    throw new Error(`${IDENTITY_FILE} is corrupted — delete it and run altweb keygen --save again`);
  }
}

export function saveIdentity(identity: DerivedIdentity): void {
  // 0700 at creation: the dir will also hold the trust file, and on a
  // multi-user host a default-umask dir leaks both. mkdir's mode only
  // applies when creating, so repair pre-existing dirs with chmod.
  mkdirSync(ALTWEB_DIR, { recursive: true, mode: 0o700 });
  chmodSync(ALTWEB_DIR, 0o700);
  const saved: SavedIdentity = {
    publicKey: identity.publicKeyBase64,
    fingerprint: identity.fingerprint,
    created: Date.now(),
  };
  // mode on writeFileSync applies at CREATION — no write-0644-then-chmod
  // window. For a pre-existing file the mode option is a no-op, so chmod
  // still runs to repair old installs.
  writeFileSync(IDENTITY_FILE, JSON.stringify(saved, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  chmodSync(IDENTITY_FILE, 0o600);
}

/** TTY prompt with hidden input (never echoed to the screen). */
export function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('no TTY: set ALTWEB_PASSPHRASE in the environment'));
      return;
    }
    process.stderr.write(question);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    let buf = '';
    const onData = (chunk: Buffer) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\n' || ch === '\r' || ch === '\u0004' /* Ctrl-D */) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stderr.write('\n');
          resolve(buf);
          return;
        }
        if (ch === '\u0003' /* Ctrl-C */) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stderr.write('\n');
          reject(new Error('cancelled'));
          return;
        }
        if (ch === '\u007f' /* backspace */ || ch === '\b') {
          buf = buf.slice(0, -1);
        } else {
          buf += ch;
        }
      }
    };
    stdin.on('data', onData);
  });
}

export async function getPassphrase(confirm = false): Promise<string> {
  const fromEnv = process.env.ALTWEB_PASSPHRASE;
  if (fromEnv) return fromEnv;

  const phrase = await promptHidden('ALTWEB identity passphrase: ');
  if (!phrase) throw new Error('empty passphrase');
  if (confirm) {
    const again = await promptHidden('Confirm passphrase: ');
    if (again !== phrase) throw new Error('passphrases do not match');
  }
  return phrase;
}

/**
 * Derives the identity and checks it against the saved one (if any) —
 * catches passphrase typos before you sign with the wrong identity.
 */
export async function resolveIdentity(): Promise<DerivedIdentity> {
  const passphrase = await getPassphrase();
  const identity = await deriveIdentityFromPassphrase(passphrase);
  const saved = loadSavedIdentity();
  if (saved && saved.fingerprint !== identity.fingerprint) {
    throw new Error(
      `derived fingerprint (${identity.fingerprint}) does NOT match the saved identity ` +
      `(${saved.fingerprint}) — wrong passphrase? (or delete ~/.altweb/identity.json if you changed it intentionally)`
    );
  }
  return identity;
}
