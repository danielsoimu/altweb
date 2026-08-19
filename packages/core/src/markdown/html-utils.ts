/**
 * Shared HTML ↔ text/markdown utilities.
 * Single source of truth for entity decoding, tag stripping, and inline-HTML → Markdown.
 * (Previously duplicated across markdown-parser.ts and markdown-serializer.ts.)
 */

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Decode a small set of common HTML entities back to characters. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, match => HTML_ENTITIES[match] || match);
}

/** Strip all HTML tags and decode entities to get plain text. */
export function stripHtml(html: string): string {
  if (!html) return '';
  const stripped = html.replace(/<[^>]*>/g, '');
  return decodeHtmlEntities(stripped);
}

/**
 * Convert inline HTML back to Markdown.
 * Handles <strong>/<b>, <em>/<i>, <code>, <a href>. Any remaining tags are stripped, entities decoded.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let md = html;
  // Bold: <strong> or <b> → **text**
  md = md.replace(/<(?:strong|b)>(.*?)<\/(?:strong|b)>/gi, '**$1**');
  // Italic: <em> or <i> → *text*
  md = md.replace(/<(?:em|i)>(.*?)<\/(?:em|i)>/gi, '*$1*');
  // Code: <code> → `text`
  md = md.replace(/<code>(.*?)<\/code>/gi, '`$1`');
  // Links: <a href="url">text</a> → [text](url)
  md = md.replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  // Remove any remaining HTML tags
  md = md.replace(/<[^>]*>/g, '');

  return decodeHtmlEntities(md);
}
