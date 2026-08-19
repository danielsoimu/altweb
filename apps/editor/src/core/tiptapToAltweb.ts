/**
 * TipTap JSON -> ALTWEB Format Transformer
 * Converts TipTap editor output to ALTWEB compact format with markdown inline
 */

import type {
  ContentBlock,
  HeadingBlock,
  TextBlock,
  ImageBlock,
  CodeBlock,
  QuoteBlock,
  ListBlock,
  TableBlock,
  TextAlign,
  DividerBlock,
} from '@altweb/core';

// TipTap JSON types
// Mark type is intentionally open (string): unknown marks pass through applyMarks unchanged.
interface TipTapMark {
  type: string; // 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link' | 'highlight'
  attrs?: Record<string, unknown>;
}

interface TipTapTextNode {
  type: 'text';
  text: string;
  marks?: TipTapMark[];
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: (TipTapNode | TipTapTextNode)[];
  text?: string;
  marks?: TipTapMark[];
}

export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

/**
 * Convert TipTap marks to markdown syntax
 */
function applyMarks(text: string, marks?: TipTapMark[]): string {
  if (!marks || marks.length === 0) return text;

  let result = text;

  // Apply marks in order (nested)
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'underline':
        result = `__${result}__`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      case 'link': {
        const href = (mark.attrs?.href as string) || '';
        result = `[${result}](${href})`;
        break;
      }
      case 'highlight':
        result = `==${result}==`;
        break;
    }
  }

  return result;
}

/**
 * Extract text content from TipTap node with markdown formatting
 */
function extractText(node: TipTapNode): string {
  if (!node.content) return '';

  return node.content.map(child => {
    if (child.type === 'text') {
      const textNode = child as TipTapTextNode;
      return applyMarks(textNode.text || '', textNode.marks);
    }
    if (child.type === 'hardBreak') {
      return '\n';
    }
    // Recursively handle nested nodes
    return extractText(child as TipTapNode);
  }).join('');
}

/**
 * Extract plain text (no formatting) for items like code blocks
 */
function extractPlainText(node: TipTapNode): string {
  if (!node.content) return '';

  return node.content.map(child => {
    if (child.type === 'text') {
      return (child as TipTapTextNode).text || '';
    }
    if (child.type === 'hardBreak') {
      return '\n';
    }
    return extractPlainText(child as TipTapNode);
  }).join('');
}

/**
 * Get text alignment from node attrs
 */
function getTextAlign(attrs?: Record<string, unknown>): TextAlign | undefined {
  const align = attrs?.textAlign as string;
  if (align && ['left', 'center', 'right', 'justify'].includes(align)) {
    return align as TextAlign;
  }
  return undefined;
}

/**
 * Convert a single TipTap node to ALTWEB ContentBlock
 */
function convertNode(node: TipTapNode): ContentBlock | ContentBlock[] | null {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) || 2;
      // ALTWEB supports levels 1-6
      const l = Math.max(1, Math.min(6, level)) as 1 | 2 | 3 | 4 | 5 | 6;
      const block: HeadingBlock = {
        t: 'h',
        l,
        c: extractText(node),
      };
      const align = getTextAlign(node.attrs);
      if (align && align !== 'left') block.align = align;
      if (node.attrs?.lineHeight) block.lh = node.attrs.lineHeight as string;
      return block;
    }

    case 'paragraph': {
      const text = extractText(node);
      // Skip empty paragraphs
      if (!text.trim()) return null;

      const block: TextBlock = {
        t: 'p',
        c: text,
      };
      const align = getTextAlign(node.attrs);
      if (align && align !== 'left') block.align = align;
      if (node.attrs?.lineHeight) block.lh = node.attrs.lineHeight as string;
      return block;
    }

    case 'image': {
      const block: ImageBlock = {
        t: 'img',
        d: (node.attrs?.src as string) || '',
      };
      if (node.attrs?.alt) block.alt = node.attrs.alt as string;
      if (node.attrs?.title) block.cap = node.attrs.title as string;
      return block;
    }

    case 'codeBlock': {
      const block: CodeBlock = {
        t: 'code',
        c: extractPlainText(node),
      };
      if (node.attrs?.language) block.lang = node.attrs.language as string;
      return block;
    }

    case 'blockquote': {
      // Blockquote can contain multiple paragraphs, join them
      const lines = node.content?.map(child => {
        if (child.type === 'paragraph') {
          return extractText(child as TipTapNode);
        }
        return '';
      }).filter(Boolean) || [];

      const block: QuoteBlock = {
        t: 'q',
        c: '',
      };

      // A trailing "— source" line is treated as the quote source (mirrors
      // altwebToTiptap and the markdown serializer). Pull it back into `src`.
      const lastLine = lines[lines.length - 1];
      const srcMatch = lastLine?.match(/^—\s+(.+)$/);
      if (srcMatch && lines.length > 1) {
        block.src = srcMatch[1];
        lines.pop();
      }

      block.c = lines.join('\n');
      return block;
    }

    case 'horizontalRule': {
      const block: DividerBlock = { t: 'hr' };
      return block;
    }

    case 'bulletList':
    case 'orderedList': {
      const items: string[] = [];
      node.content?.forEach(listItem => {
        if (listItem.type === 'listItem') {
          // List items contain paragraphs
          const itemContent = (listItem as TipTapNode).content?.map(child => {
            if (child.type === 'paragraph') {
              return extractText(child as TipTapNode);
            }
            return '';
          }).filter(Boolean).join('\n') || '';
          items.push(itemContent);
        }
      });

      const block: ListBlock = {
        t: 'list',
        ordered: node.type === 'orderedList',
        items,
      };
      return block;
    }

    case 'taskList': {
      // Task list items have a checked attribute
      const items: string[] = [];
      node.content?.forEach(taskItem => {
        if (taskItem.type === 'taskItem') {
          const checked = (taskItem as TipTapNode).attrs?.checked ? '[x]' : '[ ]';
          const itemContent = (taskItem as TipTapNode).content?.map(child => {
            if (child.type === 'paragraph') {
              return extractText(child as TipTapNode);
            }
            return '';
          }).filter(Boolean).join('\n') || '';
          items.push(`${checked} ${itemContent}`);
        }
      });

      const block: ListBlock = {
        t: 'list',
        ordered: false,
        items,
      };
      return block;
    }

    case 'table': {
      const headers: string[] = [];
      const rows: string[][] = [];

      node.content?.forEach((row, rowIndex) => {
        if (row.type === 'tableRow') {
          const cells: string[] = [];
          (row as TipTapNode).content?.forEach(cell => {
            const cellType = cell.type;
            const cellContent = (cell as TipTapNode).content?.map(child => {
              if (child.type === 'paragraph') {
                return extractText(child as TipTapNode);
              }
              return '';
            }).join(' ') || '';

            if (cellType === 'tableHeader' || rowIndex === 0) {
              headers.push(cellContent);
            } else {
              cells.push(cellContent);
            }
          });

          if (cells.length > 0) {
            rows.push(cells);
          }
        }
      });

      // If first row was treated as headers but we have no headers array, fix it
      if (headers.length === 0 && rows.length > 0) {
        const firstRow = rows.shift();
        if (firstRow) headers.push(...firstRow);
      }

      const block: TableBlock = {
        t: 'tbl',
        headers,
        rows,
      };
      return block;
    }

    default: {
      // Unknown node type, try to extract text as paragraph
      const text = extractText(node);
      if (text.trim()) {
        return { t: 'p', c: text };
      }
      return null;
    }
  }
}

/**
 * Convert TipTap JSON document to ALTWEB blocks array
 */
export function tiptapToAltweb(doc: TipTapDoc): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  if (!doc.content) return blocks;

  for (const node of doc.content) {
    const result = convertNode(node);
    if (result) {
      if (Array.isArray(result)) {
        blocks.push(...result);
      } else {
        blocks.push(result);
      }
    }
  }

  return blocks;
}

/**
 * Extract editor JSON and convert to ALTWEB format
 * Use this with editor.getJSON()
 */
export function convertEditorContent(editorJson: unknown): ContentBlock[] {
  return tiptapToAltweb(editorJson as TipTapDoc);
}
