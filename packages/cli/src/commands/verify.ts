/**
 * altweb verify <artifact|url|hash> [--password <p>] [--require-signature]
 *                                   [--expect-fingerprint <fp>] [--expect-key <spki>]
 *
 * Exit 0 = the artifact decodes, validates structurally, and (if signed)
 * the signature is valid. Exit 1 = any failure — scriptable (an agent can
 * assert an artifact's integrity within a session).
 *
 * Pinning: --expect-key pins the FULL base64url SPKI public key (the real
 * trust anchor); --expect-fingerprint pins the 8-byte display label (weaker
 * — fine as a convenience check, not as the only defense). "Valid signature"
 * only means "signed by SOMEONE"; pinning says "signed by whom I expect".
 */
import { parseArgs } from 'node:util';
import { base64urlDecode, decodePage, hasSignature } from '@altweb/core';
import { resolveHash } from '../artifact';
import { stripControl } from '../tty';

function envelopePublicKey(hash: string): string | undefined {
  try {
    const envelope = JSON.parse(new TextDecoder().decode(base64urlDecode(hash)));
    return typeof envelope?.pk === 'string' ? envelope.pk : undefined;
  } catch {
    return undefined;
  }
}

export async function verifyCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      password: { type: 'string' },
      'require-signature': { type: 'boolean', default: false },
      'expect-fingerprint': { type: 'string' },
      'expect-key': { type: 'string' },
    },
    allowPositionals: true,
  });

  const arg = positionals[0];
  if (!arg) {
    console.error(
      'Usage: altweb verify <artifact|url|hash> [--require-signature] [--expect-fingerprint <fp>] [--expect-key <spki>]'
    );
    return 1;
  }

  const hash = resolveHash(arg);
  const signed = hasSignature(hash);
  const result = await decodePage(hash, values.password);

  const lines = [
    // The title is capsule bytes on a human-facing verdict line — strip
    // terminal escapes so it cannot repaint the VALID/INVALID verdict below.
    `title:      ${stripControl(result.page.meta.title)}`,
    `blocks:     ${result.page.blocks.length}`,
    `signature:  ${signed ? (result.verified ? `VALID (${result.publicKeyFingerprint})` : 'INVALID') : 'unsigned'}`,
  ];
  console.log(lines.join('\n'));

  if (signed && !result.verified) return 1;
  if (values['require-signature'] && !signed) {
    console.error('failure: --require-signature but the artifact is unsigned');
    return 1;
  }

  const expectFp = values['expect-fingerprint'];
  const expectKey = values['expect-key'];
  if ((expectFp || expectKey) && (!signed || !result.verified)) {
    console.error('failure: pinning requested but the artifact has no valid signature');
    return 1;
  }
  if (expectFp && result.publicKeyFingerprint !== expectFp) {
    console.error(
      `failure: fingerprint mismatch — expected ${expectFp}, got ${result.publicKeyFingerprint}`
    );
    return 1;
  }
  if (expectKey) {
    const pk = envelopePublicKey(hash);
    if (pk !== expectKey) {
      console.error('failure: public key mismatch — signed by a different key than expected');
      console.error(`  expected: ${expectKey}`);
      console.error(`  got:      ${pk ?? '(none)'}`);
      return 1;
    }
  }
  return 0;
}
