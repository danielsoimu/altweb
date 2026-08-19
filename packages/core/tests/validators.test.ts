/**
 * Validator Tests — utils/validators.ts
 * Direct coverage for the Zod schema limits that bound payload size (DoS surface).
 */

import { describe, it, expect } from 'vitest';
import { validatePageStructure } from '../src/validate/validators';
import type { AltPage } from '../src/types';

function makePage(overrides: Partial<AltPage> = {}): AltPage {
  return {
    v: 1,
    meta: { title: 'T', created: 0, modified: 0, lang: 'en' },
    blocks: [{ t: 'p', c: 'hello' }],
    style: { theme: 'auto', font: 'sans', maxW: 'md' },
    ...overrides,
  };
}

describe('validatePageStructure', () => {
  it('accepts a well-formed page', () => {
    expect(() => validatePageStructure(makePage())).not.toThrow();
  });

  it('rejects more than 200 blocks', () => {
    const blocks = Array.from({ length: 201 }, () => ({ t: 'p' as const, c: 'x' }));
    expect(() => validatePageStructure(makePage({ blocks }))).toThrow();
  });

  it('rejects heading level out of range', () => {
    const page = makePage({ blocks: [{ t: 'h', l: 7 as 6, c: 'too deep' }] });
    expect(() => validatePageStructure(page)).toThrow();
  });

  it('rejects oversized image data URIs (>200KB)', () => {
    const page = makePage({ blocks: [{ t: 'img', d: 'x'.repeat(200001) }] });
    expect(() => validatePageStructure(page)).toThrow();
  });

  it('rejects an invalid block discriminator', () => {
    const page = makePage({ blocks: [{ t: 'bogus' } as unknown as AltPage['blocks'][number]] });
    expect(() => validatePageStructure(page)).toThrow();
  });

  it('enforces the reduced nav per-page hash limit (MED-02: max 10KB)', () => {
    const page = makePage({
      nav: { pages: [{ id: 'p1', label: 'Page', hash: 'a'.repeat(10001) }] },
    });
    expect(() => validatePageStructure(page)).toThrow();
  });

  it('accepts a nav hash at the 10KB boundary', () => {
    const page = makePage({
      nav: { pages: [{ id: 'p1', label: 'Page', hash: 'a'.repeat(10000) }] },
    });
    expect(() => validatePageStructure(page)).not.toThrow();
  });
});
