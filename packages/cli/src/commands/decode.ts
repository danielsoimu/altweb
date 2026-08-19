/**
 * altweb decode <artifact|url|hash> [--to md|json] [--password <p>]
 */
import { parseArgs } from 'node:util';
import {
  decodePage,
  serializeToMarkdownWithMeta,
  isEncryptedContent,
} from '@altweb/core';
import { resolveHash } from '../artifact';

export async function decodeCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      to: { type: 'string', default: 'md' },
      password: { type: 'string' },
    },
    allowPositionals: true,
  });

  const arg = positionals[0];
  if (!arg) {
    console.error('Usage: altweb decode <artifact|url|hash> [--to md|json] [--password <p>]');
    return 1;
  }

  const hash = resolveHash(arg);

  if (isEncryptedContent(hash) && !values.password) {
    console.error('encrypted content: --password is required');
    return 1;
  }

  const result = await decodePage(hash, values.password);

  if (values.to === 'json') {
    process.stdout.write(JSON.stringify(result.page, null, 2) + '\n');
  } else {
    process.stdout.write(
      serializeToMarkdownWithMeta(result.page.blocks, {
        title: result.page.meta.title,
        description: result.page.meta.description,
        author: result.page.meta.author,
      }) + '\n'
    );
  }
  return 0;
}
