/**
 * Capsule helpers: build an AltPage from editor blocks and extract a capsule
 * hash from user input (raw hash, full URL, or standalone .altweb.html source).
 */

import type { AltPage, ContentBlock } from '@altweb/core';

/** Build a v1 AltPage around the given blocks. */
export function buildPage(blocks: ContentBlock[], title: string): AltPage {
  const now = Date.now();
  return {
    v: 1,
    meta: {
      title: title.trim() || 'Untitled capsule',
      created: now,
      modified: now,
      lang: 'en',
    },
    blocks,
    style: {
      font: 'sans',
      theme: 'auto',
    },
  };
}

/** Strip inline markdown so a heading can be reused as a plain title. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> label
    .replace(/(\*\*|__|~~|==|\*|`)/g, '');
}

/** First heading in the document, as plain text — used to prefill the title. */
export function firstHeadingText(blocks: ContentBlock[]): string | null {
  for (const block of blocks) {
    if (block.t === 'h') {
      const plain = stripInlineMarkdown(block.c).trim();
      if (plain) return plain;
    }
  }
  return null;
}

/** Filesystem-friendly name for the downloaded capsule. */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'capsule';
}

/**
 * Extract the base64url payload hash from user input. Accepts:
 * - the source of a standalone .altweb.html file (meta[name="altweb-hash"])
 * - a full URL of the form https://host/#hash
 * - a raw base64url hash
 */
export function extractHash(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  // Standalone HTML: the hash is embedded in a meta tag
  const metaMatch = text.match(/<meta\s+name="altweb-hash"\s+content="([^"]+)"/);
  if (metaMatch) return metaMatch[1];

  // URL with fragment, or raw hash
  const hashIndex = text.lastIndexOf('#');
  const candidate = (hashIndex >= 0 ? text.slice(hashIndex + 1) : text).trim();
  return /^[A-Za-z0-9_-]+$/.test(candidate) ? candidate : null;
}
