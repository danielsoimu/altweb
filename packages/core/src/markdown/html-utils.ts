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

/**
 * Remove every <...> tag span in a single linear pass. Equivalent to
 * replace(/<[^>]*>/g, ''), which is quadratic on adversarial input (each of
 * N '<'s rescans to the end looking for '>'): ~195 KB of '<' froze the
 * thread for ~14 s through the public parseMarkdown path.
 */
export function stripTags(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    const gt = html.indexOf('>', lt + 1);
    if (gt === -1) {
      // Unterminated tag: the regex would leave it untouched — keep parity.
      out += html.slice(lt);
      break;
    }
    i = gt + 1;
  }
  return out;
}

/** Strip all HTML tags and decode entities to get plain text. */
export function stripHtml(html: string): string {
  if (!html) return '';
  return decodeHtmlEntities(stripTags(html));
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
  // Remove any remaining HTML tags (linear pass, see stripTags)
  md = stripTags(md);

  return decodeHtmlEntities(md);
}
