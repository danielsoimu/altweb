/**
 * altweb compile <input.md> [-o <out>] [--format html|hash|url|json]
 *                [--title <t>] [--lang ro|en] [--base-url <url>]
 *
 * Timestamps: derived from the source file's mtime — recompiling the same
 * file produces the same artifact (deterministic builds).
 */
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import {
  parseMarkdown,
  extractTitle,
  extractDescription,
  encodePage,
  generateFullUrl,
  generateStandaloneHTML,
  type AltPage,
  type Language,
} from '@altweb/core';
import { resolveIdentity } from '../identity';

export async function compileCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      output: { type: 'string', short: 'o' },
      format: { type: 'string', default: 'html' },
      title: { type: 'string' },
      lang: { type: 'string', default: 'en' },
      'base-url': { type: 'string', default: 'https://altweb.software' },
      sign: { type: 'boolean', default: false },
      // the password comes from the ALTWEB_ENCRYPT_PASSWORD env var or as a direct value
      // (a direct value lingers in shell history — the env var is preferable)
      encrypt: { type: 'string' },
    },
    allowPositionals: true,
  });

  const input = positionals[0];
  if (!input) {
    console.error('Usage: altweb compile <input.md> [-o <out>] [--format html|hash|url|json]');
    return 1;
  }

  const markdown = readFileSync(input, 'utf8');
  const blocks = parseMarkdown(markdown);
  const title = values.title ?? extractTitle(markdown) ?? basename(input).replace(/\.md$/, '');
  const description = extractDescription(markdown) ?? undefined;
  const lang = (values.lang === 'en' ? 'en' : 'ro') as Language;
  const mtime = Math.floor(statSync(input).mtimeMs);

  const page: AltPage = {
    v: 1,
    meta: { title, description, created: mtime, modified: mtime, lang },
    blocks,
    style: { theme: 'auto', font: 'sans', accent: 'blue', maxW: 'md' },
  };

  const identity = values.sign ? await resolveIdentity() : undefined;
  const password =
    values.encrypt === '' ? process.env.ALTWEB_ENCRYPT_PASSWORD : values.encrypt;
  if (values.encrypt !== undefined && !password) {
    console.error('--encrypt without a value requires ALTWEB_ENCRYPT_PASSWORD in the environment');
    return 1;
  }
  const hash = await encodePage(page, {
    ...(identity ? { signingKeyPair: identity.keyPair } : {}),
    ...(password ? { password } : {}),
  });
  if (identity) {
    console.error(`signed: ${identity.fingerprint}`);
  }

  switch (values.format) {
    case 'hash':
      process.stdout.write(hash + '\n');
      return 0;
    case 'url':
      process.stdout.write(generateFullUrl(hash, values['base-url']) + '\n');
      return 0;
    case 'json':
      process.stdout.write(JSON.stringify(page, null, 2) + '\n');
      return 0;
    case 'html': {
      const html = generateStandaloneHTML({ hash, title, isEncrypted: Boolean(password), lang });
      const out = values.output ?? input.replace(/\.md$/, '') + '.altweb.html';
      writeFileSync(out, html, 'utf8');
      console.error(`wrote: ${out} (${(html.length / 1024).toFixed(0)} KB, hash ${hash.length} chars)`);
      return 0;
    }
    default:
      console.error(`unknown format: ${values.format} (html|hash|url|json)`);
      return 1;
  }
}
