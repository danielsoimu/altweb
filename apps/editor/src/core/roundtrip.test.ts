/**
 * Round-trip proofs for the editor's transformers and the core codec:
 * 1. TipTap -> ALTWEB blocks -> TipTap -> ALTWEB blocks is stable
 * 2. blocks -> encodePage -> decodePage returns equal blocks
 *    (plain, encrypted, and signed variants)
 */

import { describe, it, expect } from 'vitest';
import {
  encodePage,
  decodePage,
  inspectArtifact,
  deriveIdentityFromPassphrase,
} from '@altweb/core';
import { tiptapToAltweb, type TipTapDoc } from './tiptapToAltweb';
import { altwebToTiptap } from './altwebToTiptap';
import { buildPage } from './capsule';

// 1x1 transparent PNG
const PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** A document shaped the way the Novel editor emits it. */
const sampleDoc: TipTapDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Capsule title' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Plain, ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ', ' },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        { type: 'text', text: ', ' },
        { type: 'text', text: 'struck', marks: [{ type: 'strike' }] },
        { type: 'text', text: ', ' },
        { type: 'text', text: 'mono', marks: [{ type: 'code' }] },
        { type: 'text', text: ' and a ' },
        {
          type: 'text',
          text: 'link',
          marks: [{ type: 'link', attrs: { href: 'https://example.com/page' } }],
        },
        { type: 'text', text: '.' },
      ],
    },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Lists' }] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'second' }] }],
        },
      ],
    },
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }],
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done task' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'open task' }] }],
        },
      ],
    },
    {
      type: 'blockquote',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'A quoted thought.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '— The Author' }] },
      ],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'js' },
      content: [{ type: 'text', text: 'const x = 1;\nconsole.log(x);' }],
    },
    {
      type: 'image',
      attrs: { src: PNG_DATA_URI, alt: 'tiny dot', title: 'A caption' },
    },
    { type: 'horizontalRule' },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }],
            },
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Value' }] }],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'alpha' }] }],
            },
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }],
            },
          ],
        },
      ],
    },
  ],
};

describe('TipTap <-> ALTWEB transformer round-trip', () => {
  it('tiptap -> blocks -> tiptap -> blocks is stable', () => {
    const blocksFirst = tiptapToAltweb(sampleDoc);
    expect(blocksFirst.length).toBeGreaterThan(0);

    const docSecond = altwebToTiptap(blocksFirst);
    const blocksSecond = tiptapToAltweb(docSecond);

    expect(blocksSecond).toEqual(blocksFirst);
  });

  it('covers every editor block type', () => {
    const blocks = tiptapToAltweb(sampleDoc);
    const types = new Set(blocks.map((b) => b.t));
    expect(types).toEqual(new Set(['h', 'p', 'list', 'q', 'code', 'img', 'hr', 'tbl']));
  });
});

describe('encodePage/decodePage round-trip', () => {
  it('plain capsule returns equal blocks', async () => {
    const blocks = tiptapToAltweb(sampleDoc);
    const page = buildPage(blocks, 'Round-trip test');

    const hash = await encodePage(page);
    const decoded = await decodePage(hash);

    expect(decoded.page.blocks).toEqual(blocks);
    expect(decoded.page.meta.title).toBe('Round-trip test');
    expect(decoded.verified).toBe(false);
  });

  it('encrypted capsule round-trips with the password', async () => {
    const blocks = tiptapToAltweb(sampleDoc);
    const page = buildPage(blocks, 'Secret note');

    const hash = await encodePage(page, { password: 'correct horse battery staple' });

    const info = await inspectArtifact(hash);
    expect(info.encrypted).toBe(true);

    await expect(decodePage(hash)).rejects.toThrow();

    const decoded = await decodePage(hash, 'correct horse battery staple');
    expect(decoded.page.blocks).toEqual(blocks);
  });

  it('signed capsule verifies and blocks survive', async () => {
    const blocks = tiptapToAltweb(sampleDoc);
    const page = buildPage(blocks, 'Signed capsule');

    const identity = await deriveIdentityFromPassphrase('editor-roundtrip-test-passphrase');
    const hash = await encodePage(page, { signingKeyPair: identity.keyPair });

    const info = await inspectArtifact(hash);
    expect(info.signed).toBe(true);
    expect(info.verified).toBe(true);
    expect(info.fingerprint).toBe(identity.fingerprint);

    const decoded = await decodePage(hash);
    expect(decoded.verified).toBe(true);
    expect(decoded.publicKeyFingerprint).toBe(identity.fingerprint);
    expect(decoded.page.blocks).toEqual(blocks);
  });
});
