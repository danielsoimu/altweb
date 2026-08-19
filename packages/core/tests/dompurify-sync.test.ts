/**
 * Guards the generated DOMPurify blob against drifting from the installed
 * dependency: standalone artifacts embed the blob, so a dompurify upgrade
 * without regeneration would silently ship an outdated sanitizer.
 * Fix on failure: node scripts/gen-dompurify-blob.mjs
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DOMPURIFY_CODE, DOMPURIFY_VERSION } from '../src/codec/dompurify-blob.generated';

const require = createRequire(import.meta.url);

describe('dompurify blob sync', () => {
  it('embedded blob version matches the installed dompurify version', () => {
    const minPath = require.resolve('dompurify/dist/purify.min.js');
    const installed = readFileSync(minPath, 'utf8').match(/DOMPurify (\d+\.\d+\.\d+)/);
    expect(installed).not.toBeNull();
    expect(DOMPURIFY_VERSION).toBe(installed![1]);
  });

  it('blob content matches the installed dist byte-for-byte', () => {
    const minPath = require.resolve('dompurify/dist/purify.min.js');
    expect(DOMPURIFY_CODE).toBe(readFileSync(minPath, 'utf8').trim());
  });
});
