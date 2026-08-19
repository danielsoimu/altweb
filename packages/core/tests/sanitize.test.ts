/**
 * Sanitization Tests — utils/sanitize.ts
 * Direct unit coverage for the XSS surface (previously only tested indirectly via the encode/decode pipeline).
 */

import { describe, it, expect } from 'vitest';
import { sanitizePage, sanitizeUrl, validateDataUri } from '../src/sanitize/sanitize';
import type { AltPage } from '../src/types';

describe('sanitizeUrl', () => {
  it('keeps http/https/mailto URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    expect(sanitizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('blocks dangerous schemes', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#blocked');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#blocked');
  });

  it('rejects unparseable URLs', () => {
    expect(sanitizeUrl('not a url')).toBe('#invalid');
  });
});

describe('validateDataUri', () => {
  it('passes raster image data URIs through unchanged', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(validateDataUri(png)).toBe(png);
  });

  it('rejects non-image data URIs', () => {
    expect(validateDataUri('data:text/html;base64,PHNjcmlwdD4=')).toBe('');
    expect(validateDataUri('not-a-data-uri')).toBe('');
  });

  it('strips script from SVG data URIs (or rejects them)', () => {
    const evil = 'data:image/svg+xml;base64,' +
      btoa('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const result = validateDataUri(evil);
    // Either rejected ('') or sanitized — but never carrying the script through.
    expect(result).not.toContain('<script');
    expect(result.includes('javascript:')).toBe(false);
  });
});

describe('sanitizePage', () => {
  const base: AltPage = {
    v: 1,
    meta: {
      title: '<script>alert(1)</script>Hello',
      description: '<img src=x onerror=alert(1)>Desc',
      created: 0,
      modified: 0,
      lang: 'en',
    },
    blocks: [
      { t: 'p', c: 'Safe <strong>bold</strong> <script>alert(1)</script>' },
      { t: 'a', title: 'Link', url: 'javascript:alert(1)' },
    ],
    style: { theme: 'auto', font: 'sans', maxW: 'md' },
  };

  it('strips tags from meta and neutralizes XSS', () => {
    const clean = sanitizePage(base);
    expect(clean.meta.title).toBe('Hello');
    expect(clean.meta.description).not.toContain('onerror');
    expect(clean.meta.description).toContain('Desc');
  });

  it('keeps safe formatting tags in paragraphs but removes scripts', () => {
    const clean = sanitizePage(base);
    const p = clean.blocks[0] as { t: 'p'; c: string };
    expect(p.c).toContain('<strong>bold</strong>');
    expect(p.c).not.toContain('<script');
  });

  it('blocks dangerous link URLs', () => {
    const clean = sanitizePage(base);
    const a = clean.blocks[1] as { t: 'a'; url: string };
    expect(a.url).toBe('#blocked');
  });
});
