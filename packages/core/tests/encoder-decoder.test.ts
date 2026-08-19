/**
 * Encoder/Decoder Pipeline Tests
 */

import { describe, it, expect } from 'vitest';
import { encodePage, decodePage, isEncryptedContent, hasSignature } from '../src/codec';
import { generateSigningKeyPair } from '../src/crypto';
import type { AltPage } from '../src/types';

const samplePage: AltPage = {
  v: 1,
  meta: {
    title: 'Test Page',
    description: 'A test page for ALTWEB',
    author: 'Tester',
    created: Date.now(),
    modified: Date.now(),
    lang: 'en',
  },
  blocks: [
    { t: 'h', l: 1, c: 'Welcome' },
    { t: 'p', c: 'This is a test paragraph.' },
    { t: 'a', title: 'Example', url: 'https://example.com', desc: 'A link' },
  ],
  style: {
    theme: 'auto',
    font: 'sans',
    maxW: 'md',
  },
};

describe('Encoder/Decoder Pipeline', () => {
  it('encode → decode returns the original page', async () => {
    const password = 'test-password';
    const encoded = await encodePage(samplePage, { password });
    const result = await decodePage(encoded, password);

    expect(result.page.meta.title).toBe(samplePage.meta.title);
    expect(result.page.blocks.length).toBe(samplePage.blocks.length);
    expect(result.verified).toBe(false);
  });

  it('public mode works without a password', async () => {
    const encoded = await encodePage(samplePage, {});
    const result = await decodePage(encoded);

    expect(result.page.meta.title).toBe(samplePage.meta.title);
    expect(isEncryptedContent(encoded)).toBe(false);
  });

  it('encrypted mode is detected correctly', async () => {
    const encrypted = await encodePage(samplePage, { password: 'secret' });
    const public_ = await encodePage(samplePage, {});

    expect(isEncryptedContent(encrypted)).toBe(true);
    expect(isEncryptedContent(public_)).toBe(false);
  });

  it('encrypted + signed mode works', async () => {
    const keyPair = await generateSigningKeyPair();
    const encoded = await encodePage(samplePage, {
      password: 'secret',
      signingKeyPair: keyPair,
    });

    expect(hasSignature(encoded)).toBe(true);

    const result = await decodePage(encoded, 'secret');
    expect(result.verified).toBe(true);
    expect(result.publicKeyFingerprint).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){7}$/);
  });

  it('resulting URL is valid base64url', async () => {
    const encoded = await encodePage(samplePage, { password: 'test' });

    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('decrypting with a wrong password throws', async () => {
    const encoded = await encodePage(samplePage, { password: 'correct' });

    await expect(decodePage(encoded, 'wrong')).rejects.toThrow();
  });

  it('sanitizes XSS content', async () => {
    const maliciousPage: AltPage = {
      ...samplePage,
      meta: {
        ...samplePage.meta,
        title: '<script>alert("xss")</script>Safe Title',
      },
      blocks: [
        { t: 'p', c: '<img src=x onerror=alert(1)>Safe text' },
      ],
    };

    const encoded = await encodePage(maliciousPage, { password: 'test' });
    const result = await decodePage(encoded, 'test');

    expect(result.page.meta.title).not.toContain('<script>');
    expect(result.page.blocks[0]).toHaveProperty('c');
    const textBlock = result.page.blocks[0] as { t: 'p'; c: string };
    expect(textBlock.c).not.toContain('onerror');
  });
});

describe('Compression', () => {
  it('compression shrinks long text', async () => {
    const longText = 'Lorem ipsum '.repeat(100);
    const largePage: AltPage = {
      ...samplePage,
      blocks: [{ t: 'p', c: longText }],
    };

    const encoded = await encodePage(largePage, { password: 'test' });

    // Encoded output should be significantly smaller than the original text
    const originalSize = longText.length;
    const encodedSize = encoded.length;

    // The compression ratio should be at least 40%
    expect(encodedSize).toBeLessThan(originalSize * 0.8);
  });
});
