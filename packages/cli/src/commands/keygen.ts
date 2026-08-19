/**
 * altweb keygen [--save]
 *
 * Derives the deterministic identity from the passphrase and prints
 * the fingerprint. With --save, writes ONLY the public part to
 * ~/.altweb/identity.json (0600). The private key never touches disk.
 */
import { parseArgs } from 'node:util';
import { deriveIdentityFromPassphrase } from '@altweb/core';
import { getPassphrase, loadSavedIdentity, saveIdentity } from '../identity';

export async function keygenCommand(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      save: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
  });

  const existing = loadSavedIdentity();
  if (values.save && existing && !values.force) {
    console.error(
      `a saved identity already exists (${existing.fingerprint}); use --force to replace it`
    );
    return 1;
  }

  const passphrase = await getPassphrase(values.save);
  const identity = await deriveIdentityFromPassphrase(passphrase);

  console.log(`fingerprint: ${identity.fingerprint}`);
  if (values.save) {
    saveIdentity(identity);
    console.log('saved: ~/.altweb/identity.json (public key + fingerprint only)');
  }
  return 0;
}
