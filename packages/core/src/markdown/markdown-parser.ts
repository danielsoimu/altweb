/**
 * Markdown to ALTWEB Blocks Parser
 * Converts Markdown content to ALTWEB ContentBlock array
 */

import { marked, type Token, type Tokens } from 'marked';
import DOMPurify from 'dompurify';
import type { ContentBlock, HeadingBlock, TextBlock, CodeBlock, QuoteBlock, ListBlock, ListItem, TableBlock, DividerBlock, ColumnBreakBlock } from '../types/content';
import { parseDelimiter, isDelimiter } from './delimiter-parser';
import { stripHtml } from './html-utils';

/**
 * Sanitize inline HTML - allow only safe formatting tags.
 *
 * DOM-less fallback (extension host / Node without jsdom): DOMPurify is
 * unavailable (sanitize is not a function) — we escape ALL raw HTML, stricter
 * than the browser whitelist. The safety net either way remains sanitizePage
 * at decode time (always runs with a real DOM: browser or jsdom).
 */
function sanitizeInlineHtml(html: string): string {
  if (typeof DOMPurify.sanitize !== 'function') {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'code', 'br', 'a', 'u', 's', 'mark', 'sub', 'sup', 'del'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Inline content is stored as markdown-style markers (`**bold**`, `*italic*`, `` `code` ``,
 * `[link](url)`, `==highlight==`) — exactly what the renderer (`inlineMarkdownToHtml`) and the
 * TipTap transformers expect. We therefore keep the source markdown as-is instead of
 * pre-rendering it to HTML (which previously made imported formatting show as literal tags).
 * Safety is handled downstream: `sanitizePage` (DOMPurify) on decode + HTML escaping at render.
 */
function parseInline(text: string): string {
  return text;
}

/**
 * Builds the ListItem tree from marked tokens (recursive).
 * marked exposes nesting as a 'list' token in item.tokens and task
 * state via item.task / item.checked.
 */
function parseListItems(items: Tokens.ListItem[]): ListItem[] {
  return items.map(item => {
    const textParts: string[] = [];
    let children: ListItem[] | undefined;

    for (const t of item.tokens) {
      if (t.type === 'text') {
        textParts.push((t as Tokens.Text).text);
      } else if (t.type === 'paragraph') {
        textParts.push((t as Tokens.Paragraph).text);
      } else if (t.type === 'list') {
        children = parseListItems((t as Tokens.List).items);
      }
    }

    const node: ListItem = { c: parseInline(textParts.filter(Boolean).join(' ')) };
    if (item.task) {
      node.task = true;
      node.done = !!item.checked;
    }
    if (children && children.length > 0) {
      node.children = children;
    }
    return node;
  });
}

/**
 * Flattens the tree into items[] (depth-first) — the compat fallback.
 */
function flattenListItems(nodes: ListItem[], out: string[] = []): string[] {
  for (const node of nodes) {
    out.push(node.c);
    if (node.children) {
      flattenListItems(node.children, out);
    }
  }
  return out;
}

/**
 * Convert a single marked token to ALTWEB block(s)
 */
function tokenToBlocks(token: Token): ContentBlock[] {
  switch (token.type) {
    case 'heading': {
      const headingToken = token as Tokens.Heading;
      // ALTWEB supports levels 1-6 (HeadingBlock.l)
      const level = Math.min(headingToken.depth, 6) as 1 | 2 | 3 | 4 | 5 | 6;
      return [{
        t: 'h',
        l: level,
        c: stripHtml(parseInline(headingToken.text)),
      } as HeadingBlock];
    }

    case 'paragraph': {
      const paragraphToken = token as Tokens.Paragraph;
      const text = paragraphToken.text.trim();

      // Check for delimiter patterns (marked may parse these as paragraphs)
      // New syntax: ---slide---, ---slide:title---, ---slide[params]---, etc.
      if (isDelimiter(text)) {
        const delimiter = parseDelimiter(text);
        if (delimiter) {
          return [delimiter];
        }
      }

      return [{
        t: 'p',
        c: parseInline(paragraphToken.text),
      } as TextBlock];
    }

    case 'code': {
      const codeToken = token as Tokens.Code;
      return [{
        t: 'code',
        c: codeToken.text,
        lang: codeToken.lang || undefined,
      } as CodeBlock];
    }

    case 'blockquote': {
      const quoteToken = token as Tokens.Blockquote;
      // Extract text from blockquote tokens
      const lines = quoteToken.tokens
        .map(t => {
          if (t.type === 'paragraph') {
            return (t as Tokens.Paragraph).text;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n')
        .split('\n');

      const quote: QuoteBlock = { t: 'q', c: '' };
      // A trailing "— source" line is the quote source (mirrors the serializer
      // output `> — src` and the TipTap transformers).
      const lastLine = lines[lines.length - 1];
      const srcMatch = lastLine?.match(/^—\s+(.+)$/);
      if (srcMatch && lines.length > 1) {
        quote.src = stripHtml(parseInline(srcMatch[1]));
        lines.pop();
      }
      quote.c = parseInline(lines.join('\n'));
      return [quote];
    }

    case 'list': {
      const listToken = token as Tokens.List;
      const nodes = parseListItems(listToken.items);
      return [{
        t: 'list',
        ordered: listToken.ordered,
        // items is always written (flattened) — fallback for older
        // renderers that do not know about `nodes`
        items: flattenListItems(nodes),
        nodes,
      } as ListBlock];
    }

    case 'table': {
      const tableToken = token as Tokens.Table;
      // Tables don't support HTML formatting in ALTWEB, so decode entities to plain text
      const headers = tableToken.header.map(cell => stripHtml(parseInline(cell.text)));
      const rows = tableToken.rows.map(row =>
        row.map(cell => stripHtml(parseInline(cell.text)))
      );
      return [{
        t: 'tbl',
        headers,
        rows,
      } as TableBlock];
    }

    case 'hr': {
      const hrToken = token as Tokens.Hr;
      const raw = hrToken.raw.trim();

      // Check if it's asterisks (***) - column break
      if (raw.startsWith('*')) {
        return [{ t: 'col-break' } as ColumnBreakBlock];
      }

      // Try to parse as delimiter (slide, card, etc.)
      if (isDelimiter(raw)) {
        const delimiter = parseDelimiter(raw);
        if (delimiter) {
          return [delimiter];
        }
      }

      // Plain divider
      return [{ t: 'hr', variant: 'default' } as DividerBlock];
    }

    case 'space': {
      // Ignore whitespace tokens
      return [];
    }

    case 'html': {
      // Convert HTML blocks to paragraphs - sanitize to prevent XSS
      const htmlToken = token as Tokens.HTML;
      const text = htmlToken.text.trim();
      if (text) {
        // Sanitize HTML to only allow safe inline formatting
        const sanitized = sanitizeInlineHtml(text);
        if (sanitized.trim()) {
          return [{
            t: 'p',
            c: sanitized,
          } as TextBlock];
        }
      }
      return [];
    }

    default: {
      // For any unhandled token types, try to extract text
      if ('text' in token && typeof token.text === 'string') {
        return [{
          t: 'p',
          c: parseInline(token.text),
        } as TextBlock];
      }
      return [];
    }
  }
}

/**
 * Parse Markdown string to ALTWEB ContentBlock array
 */
export function parseMarkdown(markdown: string): ContentBlock[] {
  // Use marked lexer to get tokens
  const tokens = marked.lexer(markdown);

  // Convert each token to blocks
  const blocks: ContentBlock[] = [];

  for (const token of tokens) {
    const converted = tokenToBlocks(token);
    blocks.push(...converted);
  }

  return blocks;
}

/**
 * Extract title from markdown (first h1)
 */
export function extractTitle(markdown: string): string | null {
  const tokens = marked.lexer(markdown);

  for (const token of tokens) {
    if (token.type === 'heading' && (token as Tokens.Heading).depth === 1) {
      return stripHtml(parseInline((token as Tokens.Heading).text));
    }
  }

  return null;
}

/**
 * Extract description from markdown (first paragraph after title)
 */
export function extractDescription(markdown: string): string | null {
  const tokens = marked.lexer(markdown);
  let foundHeading = false;

  for (const token of tokens) {
    if (token.type === 'heading' && (token as Tokens.Heading).depth === 1) {
      foundHeading = true;
      continue;
    }

    if (foundHeading && token.type === 'paragraph') {
      const text = stripHtml(parseInline((token as Tokens.Paragraph).text));
      // Truncate to 160 chars for description
      return text.length > 160 ? text.slice(0, 157) + '...' : text;
    }
  }

  return null;
}
