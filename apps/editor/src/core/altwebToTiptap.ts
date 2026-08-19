/**
 * ALTWEB Format -> TipTap JSON Transformer
 * Converts ALTWEB blocks to TipTap editor format
 * Parses markdown inline formatting to TipTap marks
 *
 * Editor scope note: this app edits flat documents with standard TipTap
 * nodes only. Blocks from the wider ALTWEB model degrade gracefully:
 * - 'hr' divider variants (slides/cards) become a plain horizontal rule
 * - 'a' link cards become a paragraph with a markdown link
 * - 'space' and 'col-break' layout blocks are dropped
 */

import type { ContentBlock } from '@altweb/core';

// TipTap JSON types
interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TipTapTextNode {
  type: 'text';
  text: string;
  marks?: TipTapMark[];
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: (TipTapNode | TipTapTextNode)[];
}

interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

/**
 * Parse markdown inline formatting to TipTap text nodes with marks
 * Supports: **bold**, *italic*, __underline__, ~~strike~~, `code`, [link](url), ==highlight==
 * Handles nested formatting like **[link](url)** and [**bold**](url) correctly
 */
function parseInlineMarkdown(text: string): TipTapTextNode[] {
  if (!text) return [];

  const nodes: TipTapTextNode[] = [];

  // Process formatting patterns - check if entire text is wrapped
  // Bold **text**
  const boldMatch = text.match(/^\*\*(.+)\*\*$/s);
  if (boldMatch) {
    const innerNodes = parseInlineMarkdown(boldMatch[1]);
    return innerNodes.map(node => ({
      ...node,
      marks: [{ type: 'bold' }, ...(node.marks || [])],
    }));
  }

  // Italic *text* (but not **)
  const italicMatch = text.match(/^\*([^*].*?[^*]|[^*])\*$/s);
  if (italicMatch) {
    const innerNodes = parseInlineMarkdown(italicMatch[1]);
    return innerNodes.map(node => ({
      ...node,
      marks: [{ type: 'italic' }, ...(node.marks || [])],
    }));
  }

  // Underline __text__
  const underlineMatch = text.match(/^__(.+)__$/s);
  if (underlineMatch) {
    const innerNodes = parseInlineMarkdown(underlineMatch[1]);
    return innerNodes.map(node => ({
      ...node,
      marks: [{ type: 'underline' }, ...(node.marks || [])],
    }));
  }

  // Strikethrough ~~text~~
  const strikeMatch = text.match(/^~~(.+)~~$/s);
  if (strikeMatch) {
    const innerNodes = parseInlineMarkdown(strikeMatch[1]);
    return innerNodes.map(node => ({
      ...node,
      marks: [{ type: 'strike' }, ...(node.marks || [])],
    }));
  }

  // Highlight ==text==
  const highlightMatch = text.match(/^==(.+)==$/s);
  if (highlightMatch) {
    const innerNodes = parseInlineMarkdown(highlightMatch[1]);
    return innerNodes.map(node => ({
      ...node,
      marks: [{ type: 'highlight' }, ...(node.marks || [])],
    }));
  }

  // Code `text` - no nested formatting
  const codeMatch = text.match(/^`(.+)`$/s);
  if (codeMatch) {
    return [{ type: 'text', text: codeMatch[1], marks: [{ type: 'code' }] }];
  }

  // Link [text](url) - RECURSIVELY parse the link text for nested formatting
  const linkOnlyMatch = text.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (linkOnlyMatch) {
    const linkText = linkOnlyMatch[1];
    const linkHref = linkOnlyMatch[2];
    // Recursively parse the link text to handle nested formatting like [**bold**](url)
    const innerNodes = parseInlineMarkdown(linkText);
    return innerNodes.map(node => ({
      ...node,
      marks: [...(node.marks || []), { type: 'link', attrs: { href: linkHref } }],
    }));
  }

  // Now handle inline patterns (not wrapping the whole text)
  interface Token {
    start: number;
    end: number;
    nodes: TipTapTextNode[];
  }

  const tokens: Token[] = [];

  // Process BOLD first (can contain links)
  const boldRegex = /\*\*(.+?)\*\*/g;
  let boldMatch2;
  while ((boldMatch2 = boldRegex.exec(text)) !== null) {
    const innerNodes = parseInlineMarkdown(boldMatch2[1]);
    tokens.push({
      start: boldMatch2.index,
      end: boldMatch2.index + boldMatch2[0].length,
      nodes: innerNodes.map(node => ({
        ...node,
        marks: [{ type: 'bold' }, ...(node.marks || [])],
      })),
    });
  }

  // Process UNDERLINE (can contain links)
  const underlineRegex = /__(.+?)__/g;
  let underlineMatch2;
  while ((underlineMatch2 = underlineRegex.exec(text)) !== null) {
    const overlaps = tokens.some(t =>
      (underlineMatch2!.index < t.end && underlineMatch2!.index + underlineMatch2![0].length > t.start)
    );
    if (!overlaps) {
      const innerNodes = parseInlineMarkdown(underlineMatch2[1]);
      tokens.push({
        start: underlineMatch2.index,
        end: underlineMatch2.index + underlineMatch2[0].length,
        nodes: innerNodes.map(node => ({
          ...node,
          marks: [{ type: 'underline' }, ...(node.marks || [])],
        })),
      });
    }
  }

  // Process STRIKETHROUGH (can contain links)
  const strikeRegex = /~~(.+?)~~/g;
  let strikeMatch2;
  while ((strikeMatch2 = strikeRegex.exec(text)) !== null) {
    const overlaps = tokens.some(t =>
      (strikeMatch2!.index < t.end && strikeMatch2!.index + strikeMatch2![0].length > t.start)
    );
    if (!overlaps) {
      const innerNodes = parseInlineMarkdown(strikeMatch2[1]);
      tokens.push({
        start: strikeMatch2.index,
        end: strikeMatch2.index + strikeMatch2[0].length,
        nodes: innerNodes.map(node => ({
          ...node,
          marks: [{ type: 'strike' }, ...(node.marks || [])],
        })),
      });
    }
  }

  // Process HIGHLIGHT (can contain links)
  const highlightRegex = /==(.+?)==/g;
  let highlightMatch2;
  while ((highlightMatch2 = highlightRegex.exec(text)) !== null) {
    const overlaps = tokens.some(t =>
      (highlightMatch2!.index < t.end && highlightMatch2!.index + highlightMatch2![0].length > t.start)
    );
    if (!overlaps) {
      const innerNodes = parseInlineMarkdown(highlightMatch2[1]);
      tokens.push({
        start: highlightMatch2.index,
        end: highlightMatch2.index + highlightMatch2[0].length,
        nodes: innerNodes.map(node => ({
          ...node,
          marks: [{ type: 'highlight' }, ...(node.marks || [])],
        })),
      });
    }
  }

  // Process ITALIC (can contain links)
  const italicRegex = /\*([^*]+)\*/g;
  let italicMatch2;
  while ((italicMatch2 = italicRegex.exec(text)) !== null) {
    const overlaps = tokens.some(t =>
      (italicMatch2!.index < t.end && italicMatch2!.index + italicMatch2![0].length > t.start)
    );
    if (!overlaps) {
      const innerNodes = parseInlineMarkdown(italicMatch2[1]);
      tokens.push({
        start: italicMatch2.index,
        end: italicMatch2.index + italicMatch2[0].length,
        nodes: innerNodes.map(node => ({
          ...node,
          marks: [{ type: 'italic' }, ...(node.marks || [])],
        })),
      });
    }
  }

  // Process LINKS last - recursively parse link text for nested formatting
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let linkMatch2;
  while ((linkMatch2 = linkRegex.exec(text)) !== null) {
    const overlaps = tokens.some(t =>
      (linkMatch2!.index < t.end && linkMatch2!.index + linkMatch2![0].length > t.start)
    );
    if (!overlaps) {
      // Recursively parse link text for nested formatting like [**bold**](url)
      const innerNodes = parseInlineMarkdown(linkMatch2[1]);
      tokens.push({
        start: linkMatch2.index,
        end: linkMatch2.index + linkMatch2[0].length,
        nodes: innerNodes.map(node => ({
          ...node,
          marks: [...(node.marks || []), { type: 'link', attrs: { href: linkMatch2![2] } }],
        })),
      });
    }
  }

  // Process CODE last (no nesting allowed inside code)
  const codeRegex = /`([^`]+)`/g;
  let codeMatch2;
  while ((codeMatch2 = codeRegex.exec(text)) !== null) {
    const overlaps = tokens.some(t =>
      (codeMatch2!.index < t.end && codeMatch2!.index + codeMatch2![0].length > t.start)
    );
    if (!overlaps) {
      tokens.push({
        start: codeMatch2.index,
        end: codeMatch2.index + codeMatch2[0].length,
        nodes: [{ type: 'text', text: codeMatch2[1], marks: [{ type: 'code' }] }],
      });
    }
  }

  // Sort tokens by start position
  tokens.sort((a, b) => a.start - b.start);

  // Build result - interleave plain text with formatted tokens
  let currentPos = 0;

  for (const token of tokens) {
    // Add plain text before this token
    if (token.start > currentPos) {
      const plainText = text.slice(currentPos, token.start);
      if (plainText) {
        nodes.push({ type: 'text', text: plainText });
      }
    }

    // Add formatted nodes
    nodes.push(...token.nodes);

    currentPos = token.end;
  }

  // Add remaining plain text
  if (currentPos < text.length) {
    const remainingText = text.slice(currentPos);
    if (remainingText) {
      nodes.push({ type: 'text', text: remainingText });
    }
  }

  // If no formatting found, return single text node
  if (nodes.length === 0 && text) {
    nodes.push({ type: 'text', text });
  }

  return nodes;
}

/**
 * Create a paragraph node with parsed inline markdown
 */
function createParagraph(text: string, attrs?: Record<string, unknown>): TipTapNode {
  const content = parseInlineMarkdown(text);
  const node: TipTapNode = {
    type: 'paragraph',
    content: content.length > 0 ? content : [{ type: 'text', text: '' }],
  };
  if (attrs && Object.keys(attrs).length > 0) {
    node.attrs = attrs;
  }
  return node;
}

/**
 * Convert a single ALTWEB block to TipTap node.
 * Returns null for layout-only blocks this editor does not represent.
 */
function convertBlock(block: ContentBlock): TipTapNode | TipTapNode[] | null {
  switch (block.t) {
    case 'h': {
      const attrs: Record<string, unknown> = { level: block.l };
      if (block.align && block.align !== 'left') {
        attrs.textAlign = block.align;
      }
      if (block.lh) {
        attrs.lineHeight = block.lh;
      }
      return {
        type: 'heading',
        attrs,
        content: parseInlineMarkdown(block.c),
      };
    }

    case 'p': {
      const attrs: Record<string, unknown> = {};
      if (block.align && block.align !== 'left') {
        attrs.textAlign = block.align;
      }
      if (block.lh) {
        attrs.lineHeight = block.lh;
      }
      return createParagraph(block.c, Object.keys(attrs).length > 0 ? attrs : undefined);
    }

    case 'img': {
      return {
        type: 'image',
        attrs: {
          src: block.d,
          alt: block.alt || '',
          title: block.cap || '',
        },
      };
    }

    case 'code': {
      return {
        type: 'codeBlock',
        attrs: block.lang ? { language: block.lang } : undefined,
        content: [{ type: 'text', text: block.c }],
      };
    }

    case 'q': {
      // Split quote into paragraphs
      const paragraphs = block.c.split('\n').filter(Boolean);
      // Preserve the source as a final "— source" line so it survives the
      // round-trip through TipTap (tiptapToAltweb extracts it back into `src`).
      if (block.src) {
        paragraphs.push(`— ${block.src}`);
      }
      return {
        type: 'blockquote',
        content: paragraphs.map(p => createParagraph(p)),
      };
    }

    case 'hr': {
      // Slide/card divider variants degrade to a plain horizontal rule
      return { type: 'horizontalRule' };
    }

    case 'list': {
      const listType = block.ordered ? 'orderedList' : 'bulletList';

      // Check if it's a task list (items start with [ ] or [x])
      const isTaskList = block.items.some(item =>
        item.startsWith('[ ]') || item.startsWith('[x]')
      );

      if (isTaskList) {
        return {
          type: 'taskList',
          content: block.items.map(item => {
            const checked = item.startsWith('[x]');
            const text = item.replace(/^\[[ x]\]\s*/, '');
            return {
              type: 'taskItem',
              attrs: { checked },
              content: [createParagraph(text)],
            };
          }),
        };
      }

      return {
        type: listType,
        content: block.items.map(item => ({
          type: 'listItem',
          content: [createParagraph(item)],
        })),
      };
    }

    case 'tbl': {
      const rows: TipTapNode[] = [];

      // Header row
      if (block.headers.length > 0) {
        rows.push({
          type: 'tableRow',
          content: block.headers.map(header => ({
            type: 'tableHeader',
            content: [createParagraph(header)],
          })),
        });
      }

      // Data rows
      for (const row of block.rows) {
        rows.push({
          type: 'tableRow',
          content: row.map(cell => ({
            type: 'tableCell',
            content: [createParagraph(cell)],
          })),
        });
      }

      return {
        type: 'table',
        content: rows,
      };
    }

    case 'a': {
      // Link cards degrade to a paragraph with a markdown link
      return createParagraph(`[${block.title}](${block.url})`);
    }

    case 'space':
    case 'col-break': {
      // Layout-only blocks have no representation in this editor
      return null;
    }

    default:
      // Unknown block type, create empty paragraph
      return { type: 'paragraph', content: [] };
  }
}

/**
 * Convert ALTWEB blocks array to TipTap JSON document
 */
export function altwebToTiptap(blocks: ContentBlock[]): TipTapDoc {
  const content: TipTapNode[] = [];

  for (const block of blocks) {
    const result = convertBlock(block);
    if (result === null) continue;
    if (Array.isArray(result)) {
      content.push(...result);
    } else {
      content.push(result);
    }
  }

  // Ensure at least one paragraph
  if (content.length === 0) {
    content.push({ type: 'paragraph', content: [] });
  }

  return {
    type: 'doc',
    content,
  };
}

/**
 * Create initial TipTap content for empty editor
 */
export function createEmptyDoc(): TipTapDoc {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [],
      },
    ],
  };
}
