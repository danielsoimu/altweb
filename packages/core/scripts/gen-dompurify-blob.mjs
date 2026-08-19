#!/usr/bin/env node
/**
 * Regenerates src/codec/dompurify-blob.generated.ts from the installed
 * dompurify dist. Run after any dompurify upgrade:
 *   node scripts/gen-dompurify-blob.mjs
 * A unit test asserts the generated version matches the installed one,
 * so a forgotten regeneration fails CI instead of silently shipping an
 * outdated sanitizer inside standalone artifacts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..'));
const minPath = require.resolve('dompurify/dist/purify.min.js');
const code = readFileSync(minPath, 'utf8').trim();

const versionMatch = code.match(/DOMPurify (\d+\.\d+\.\d+)/);
if (!versionMatch) {
  console.error('could not find a DOMPurify version marker in purify.min.js');
  process.exit(1);
}
const version = versionMatch[1];

const out = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/gen-dompurify-blob.mjs
 * Source: dompurify/dist/purify.min.js (JSON-escaped so regex sequences
 * like \${ survive intact — a raw template literal would corrupt them).
 */
export const DOMPURIFY_VERSION = ${JSON.stringify(version)};
export const DOMPURIFY_CODE: string = ${JSON.stringify(code)};
`;

writeFileSync(join(here, '..', 'src', 'codec', 'dompurify-blob.generated.ts'), out);
console.log(`generated dompurify-blob.generated.ts (DOMPurify ${version})`);
