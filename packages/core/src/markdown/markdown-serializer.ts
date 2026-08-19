/**
 * Markdown Serializer
 * Converts ALTWEB ContentBlock array back to Markdown
 */

import type { ContentBlock, DividerBlock, ListItem } from '../types/content';
import { serializeDelimiter } from './delimiter-parser';
import { stripHtml, htmlToMarkdown } from './html-utils';

/**
 * Serializes the list item tree with indentation (recursive).
 * The per-level indent is the width of the parent marker (CommonMark requires
 * the sublist to align with the start of the content): "- " -> 2 spaces,
 * "1. " -> 3 spaces.
 */
function serializeListNodes(nodes: ListItem[], ordered: boolean, depth: number): string {
  const indent = (ordered ? '   ' : '  ').repeat(depth);
  return nodes
    .map((node, i) => {
      const marker = ordered ? `${i + 1}.` : '-';
      const task = node.task ? (node.done ? '[x] ' : '[ ] ') : '';
      const line = `${indent}${marker} ${task}${htmlToMarkdown(node.c)}`;
      const children = node.children && node.children.length > 0
        ? '\n' + serializeListNodes(node.children, ordered, depth + 1)
        : '';
      return line + children;
    })
    .join('\n');
}

/**
 * Serialize a single block to Markdown
 */
function blockToMarkdown(block: ContentBlock): string {
  switch (block.t) {
    case 'h': {
      const level = block.l || 2;
      const text = stripHtml(block.c || '');
      return `${'#'.repeat(level)} ${text}`;
    }

    case 'p': {
      return htmlToMarkdown(block.c || '');
    }

    case 'code': {
      const lang = block.lang || '';
      const code = block.c || '';
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case 'q': {
      const text = htmlToMarkdown(block.c || '');
      const lines = text.split('\n');
      const quoted = lines.map(line => `> ${line}`).join('\n');
      if (block.src) {
        return `${quoted}\n> — ${block.src}`;
      }
      return quoted;
    }

    case 'hr': {
      // Use the delimiter serializer for all variants
      return serializeDelimiter(block as DividerBlock);
    }

    case 'col-break': {
      // Column break uses asterisks
      return '***';
    }

    case 'list': {
      if (block.nodes && block.nodes.length > 0) {
        return serializeListNodes(block.nodes, block.ordered, 0);
      }
      // fallback for older blocks without `nodes`
      const items = block.items || [];
      return items.map((item, i) => {
        const content = htmlToMarkdown(item);
        return block.ordered ? `${i + 1}. ${content}` : `- ${content}`;
      }).join('\n');
    }

    case 'tbl': {
      const headers = block.headers || [];
      const rows = block.rows || [];

      if (headers.length === 0) return '';

      // Header row
      const headerRow = `| ${headers.join(' | ')} |`;
      // Separator row
      const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
      // Data rows
      const dataRows = rows.map(row => `| ${row.join(' | ')} |`).join('\n');

      return [headerRow, separatorRow, dataRows].filter(Boolean).join('\n');
    }

    case 'img': {
      const alt = block.alt || '';
      // Note: data URLs are too long for markdown, so we use a placeholder
      if (block.d?.startsWith('data:')) {
        return `![${alt}](embedded-image)`;
      }
      return `![${alt}](${block.d || ''})`;
    }

    case 'a': {
      const title = block.title || block.url || '';
      const url = block.url || '';
      const desc = block.desc ? `\n${block.desc}` : '';
      return `[${title}](${url})${desc}`;
    }

    case 'space': {
      // Represent spacer as blank lines
      const lines = Math.max(1, Math.floor((block.h || 40) / 20));
      return '\n'.repeat(lines);
    }

    default: {
      // Unknown block type - try to extract content
      const unknownBlock = block as Record<string, unknown>;
      if ('c' in unknownBlock && typeof unknownBlock.c === 'string') {
        return htmlToMarkdown(unknownBlock.c);
      }
      return '';
    }
  }
}

/**
 * Serialize ContentBlock array to Markdown string
 */
export function serializeToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map(block => blockToMarkdown(block))
    .filter(md => md.trim() !== '')
    .join('\n\n');
}

/**
 * Generate a full Markdown document with frontmatter
 */
export function serializeToMarkdownWithMeta(
  blocks: ContentBlock[],
  meta: { title?: string; description?: string; author?: string }
): string {
  const content = serializeToMarkdown(blocks);

  // Add title as H1 if not already present
  const firstBlock = blocks[0];
  const hasTitle = firstBlock?.t === 'h' && firstBlock.l === 1;

  let result = '';

  if (meta.title && !hasTitle) {
    result += `# ${meta.title}\n\n`;
  }

  if (meta.description) {
    result += `${meta.description}\n\n`;
  }

  if (meta.author) {
    result += `*By ${meta.author}*\n\n`;
  }

  result += content;

  return result;
}
