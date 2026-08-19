/**
 * altweb — the ALTWEB CLI
 *
 * Import order matters: node-dom MUST come first — it initializes
 * window/document (JSDOM) before dompurify self-initializes at import
 * time; otherwise sanitization does not exist under Node.
 */
import '@altweb/core/node-dom';
import { compileCommand } from './commands/compile';
import { decodeCommand } from './commands/decode';
import { verifyCommand } from './commands/verify';
import { keygenCommand } from './commands/keygen';

const HELP = `altweb — signed ALTWEB capsules from the command line

Commands:
  compile <input.md> [-o <out>] [--format html|hash|url|json] [--sign]
                     [--title <t>] [--lang ro|en] [--base-url <url>]
  decode  <artifact|url|hash> [--to md|json] [--password <p>]
  verify  <artifact|url|hash> [--require-signature] [--password <p>]
          [--expect-fingerprint <fp>] [--expect-key <spki>]
  keygen  [--save] [--force]

Artifact = a standalone .altweb.html file, a raw .altweb hash file,
a URL with #hash, or the hash itself.
Identity: passphrase from ALTWEB_PASSPHRASE or TTY prompt;
~/.altweb/identity.json stores only the public key + fingerprint.
`;

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'compile':
      return compileCommand(rest);
    case 'decode':
      return decodeCommand(rest);
    case 'verify':
      return verifyCommand(rest);
    case 'keygen':
      return keygenCommand(rest);
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(HELP);
      return command ? 0 : 1;
    default:
      console.error(`unknown command: ${command}\n`);
      process.stdout.write(HELP);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
