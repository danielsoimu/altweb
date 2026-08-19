/**
 * Lightweight Markdown to HTML converter
 * Supports common Markdown syntax for paste operations
 */

/**
 * Convert Markdown text to HTML
 * Supports: headings, bold, italic, strikethrough, code, links, lists, blockquotes, hr, images
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Normalize line endings
  html = html.replace(/\r\n/g, '\n');

  // Escape HTML entities (but preserve our markdown)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (``` ... ```) - must be before inline code
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code (`code`)
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Headings (# to ######)
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Horizontal rule (---, ***, ___)
  html = html.replace(/^([-*_]){3,}\s*$/gm, '<hr>');

  // Bold and italic combinations
  // ***bold italic*** or ___bold italic___ - non-greedy
  html = html.replace(/(\*\*\*|___)(.+?)\1/g, '<strong><em>$2</em></strong>');

  // Bold (**text** or __text__) - non-greedy
  html = html.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');

  // Italic (*text* or _text_) - non-greedy, be careful not to match inside words
  html = html.replace(/(\*|_)(.+?)\1/g, '<em>$2</em>');

  // Strikethrough (~~text~~) - non-greedy
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // Highlight (==text==) - non-greedy
  html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');

  // Blockquotes (> text)
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Unordered lists (- item or * item)
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');

  // Ordered lists (1. item)
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul> or <ol>
  // This is a simplified approach - wraps all li in ul
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });

  // Task lists (- [ ] or - [x])
  html = html.replace(/<li>\[ \]\s*/g, '<li><input type="checkbox" disabled> ');
  html = html.replace(/<li>\[x\]\s*/gi, '<li><input type="checkbox" disabled checked> ');

  // Paragraphs - wrap remaining text lines
  // Split by double newlines for paragraphs
  const blocks = html.split(/\n\n+/);
  html = blocks
    .map((block) => {
      block = block.trim();
      if (!block) return '';
      // Don't wrap if already wrapped in block-level element
      if (
        block.startsWith('<h') ||
        block.startsWith('<p') ||
        block.startsWith('<ul') ||
        block.startsWith('<ol') ||
        block.startsWith('<blockquote') ||
        block.startsWith('<pre') ||
        block.startsWith('<hr') ||
        block.startsWith('<img')
      ) {
        return block;
      }
      // Replace single newlines with <br> within paragraphs
      block = block.replace(/\n/g, '<br>');
      return `<p>${block}</p>`;
    })
    .join('\n');

  return html;
}

/**
 * Check if text looks like Markdown
 * Returns true if text contains common Markdown patterns
 * Made conservative to avoid false positives with plain text
 */
export function looksLikeMarkdown(text: string): boolean {
  // High-confidence patterns - these are unambiguous markdown
  const highConfidencePatterns = [
    /^#{1,6}\s+/m, // Headings (# at start of line)
    /\*\*[^*\n]+\*\*/, // Bold with asterisks
    /```[\s\S]*?```/, // Code blocks
    /\[.+\]\(https?:\/\/.+\)/, // Links with full URLs
    /!\[.*\]\(.+\)/, // Images
  ];

  // Check for high-confidence patterns first
  for (const pattern of highConfidencePatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Lower confidence patterns - need multiple matches
  const lowerConfidencePatterns = [
    /`[^`\n]+`/, // Inline code
    /~~[^~\n]+~~/, // Strikethrough
    /^\s*>\s+.+/m, // Blockquote
    /^([-*_]){3,}\s*$/m, // Horizontal rule
  ];

  let matchCount = 0;
  for (const pattern of lowerConfidencePatterns) {
    if (pattern.test(text)) {
      matchCount++;
    }
  }

  // Need at least 2 lower-confidence patterns to be considered markdown
  return matchCount >= 2;
}

/**
 * Check if text is likely already HTML
 */
export function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}
