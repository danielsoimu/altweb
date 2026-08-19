/**
 * Content Sanitization using DOMPurify
 * Prevents XSS and other attacks
 */

import DOMPurify from 'dompurify';
import type { AltPage, ContentBlock, ListItem, PageStyle } from '../types/content';

function sanitizeListItems(nodes: ListItem[]): ListItem[] {
  return nodes.map((node) => ({
    ...node,
    c: DOMPurify.sanitize(node.c, {
      ALLOWED_TAGS: ['strong', 'em', 'code'],
      ALLOWED_ATTR: [],
    }),
    children: node.children ? sanitizeListItems(node.children) : undefined,
  }));
}

export function sanitizePage(page: AltPage): AltPage {
  return {
    ...page,
    meta: {
      ...page.meta,
      title: DOMPurify.sanitize(page.meta.title, { ALLOWED_TAGS: [] }),
      description: page.meta.description
        ? DOMPurify.sanitize(page.meta.description, { ALLOWED_TAGS: [] })
        : undefined,
      author: page.meta.author
        ? DOMPurify.sanitize(page.meta.author, { ALLOWED_TAGS: [] })
        : undefined,
    },
    blocks: page.blocks.map(sanitizeBlock),
    style: sanitizeStyle(page.style),
  };
}

function sanitizeBlock(block: ContentBlock): ContentBlock {
  switch (block.t) {
    case 'h':
      return {
        ...block,
        c: DOMPurify.sanitize(block.c, {
          ALLOWED_TAGS: ['strong', 'em', 'code', 'br'],
          ALLOWED_ATTR: [],
        }),
      };
    case 'p':
      return {
        ...block,
        c: DOMPurify.sanitize(block.c, {
          ALLOWED_TAGS: ['strong', 'em', 'code', 'br'],
          ALLOWED_ATTR: [],
        }),
      };
    case 'q':
      return {
        ...block,
        c: DOMPurify.sanitize(block.c, {
          ALLOWED_TAGS: ['strong', 'em', 'code', 'br'],
          ALLOWED_ATTR: [],
        }),
        src: block.src
          ? DOMPurify.sanitize(block.src, { ALLOWED_TAGS: [] })
          : undefined,
      };
    case 'a':
      return {
        ...block,
        title: DOMPurify.sanitize(block.title, { ALLOWED_TAGS: [] }),
        url: sanitizeUrl(block.url),
        desc: block.desc
          ? DOMPurify.sanitize(block.desc, { ALLOWED_TAGS: [] })
          : undefined,
      };
    case 'img':
      return {
        ...block,
        d: validateDataUri(block.d),
        alt: block.alt
          ? DOMPurify.sanitize(block.alt, { ALLOWED_TAGS: [] })
          : undefined,
        cap: block.cap
          ? DOMPurify.sanitize(block.cap, { ALLOWED_TAGS: [] })
          : undefined,
      };
    case 'code':
      return {
        ...block,
        c: DOMPurify.sanitize(block.c, { ALLOWED_TAGS: [] }),
        lang: block.lang
          ? DOMPurify.sanitize(block.lang, { ALLOWED_TAGS: [] })
          : undefined,
      };
    case 'list':
      return {
        ...block,
        items: block.items.map((item) =>
          DOMPurify.sanitize(item, {
            ALLOWED_TAGS: ['strong', 'em', 'code'],
            ALLOWED_ATTR: [],
          })
        ),
        nodes: block.nodes ? sanitizeListItems(block.nodes) : undefined,
      };
    case 'tbl':
      return {
        ...block,
        headers: block.headers.map((h) =>
          DOMPurify.sanitize(h, { ALLOWED_TAGS: [] })
        ),
        rows: block.rows.map((row) =>
          row.map((cell) => DOMPurify.sanitize(cell, { ALLOWED_TAGS: [] }))
        ),
      };
    case 'hr':
      return block;
    default:
      return block;
  }
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return url;
    }
    return '#blocked';
  } catch {
    return '#invalid';
  }
}

function validateDataUri(dataUri: string): string {
  // Pattern for raster images (safe as-is)
  const rasterPattern =
    /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
  if (rasterPattern.test(dataUri)) {
    return dataUri;
  }

  // Pattern for SVG (needs sanitization)
  const svgPattern = /^data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)$/;
  const svgMatch = dataUri.match(svgPattern);
  if (svgMatch) {
    try {
      // Decode base64 SVG content
      const svgContent = atob(svgMatch[1]);

      // Sanitize SVG with DOMPurify - strict settings to prevent external resources & XSS
      const cleanSvg = DOMPurify.sanitize(svgContent, {
        USE_PROFILES: { svg: true, svgFilters: true },
        // Block dangerous elements that can load external resources or execute code
        FORBID_TAGS: [
          'script',
          'foreignObject',
          'use', // Can reference external SVGs
          'a', // Can have href to external resources
          'animate', // Can trigger events
          'set', // Can modify attributes
          'animateTransform',
          'animateMotion',
          'animateColor',
        ],
        // Block attributes that load external resources or execute code
        FORBID_ATTR: [
          'href',
          'xlink:href',
          'onclick',
          'onload',
          'onerror',
          'onmouseover',
          'onfocus',
          'onblur',
          'onanimationend',
          'onanimationstart',
        ],
        // Additional safety: no data attributes
        ALLOW_DATA_ATTR: false,
      });

      // Verify result is still valid SVG
      if (
        cleanSvg &&
        cleanSvg.includes('<svg') &&
        !cleanSvg.includes('<script') &&
        !cleanSvg.includes('javascript:') &&
        !cleanSvg.includes('xlink:href') &&
        !cleanSvg.includes('<foreignObject')
      ) {
        // Re-encode to base64
        return 'data:image/svg+xml;base64,' + btoa(cleanSvg);
      }
    } catch {
      // Decode/sanitize failed - reject SVG
      return '';
    }
  }

  return '';
}

function sanitizeStyle(style: PageStyle): PageStyle {
  const hexPattern = /^#[0-9A-Fa-f]{3,8}$/;
  const namedAccents = ['blue', 'green', 'purple', 'rose', 'orange', 'cyan'];

  // Validate accent - can be named color or hex
  let sanitizedAccent: string | undefined;
  if (style.accent) {
    if (namedAccents.includes(style.accent) || hexPattern.test(style.accent)) {
      sanitizedAccent = style.accent;
    }
  }

  return {
    bg: style.bg && hexPattern.test(style.bg) ? style.bg : undefined,
    fg: style.fg && hexPattern.test(style.fg) ? style.fg : undefined,
    accent: sanitizedAccent,
    font: ['sans', 'serif', 'mono'].includes(style.font || '')
      ? style.font
      : 'sans',
    maxW: ['sm', 'md', 'lg', 'xl'].includes(style.maxW || '') ? style.maxW : 'md',
    theme: ['light', 'dark', 'auto'].includes(style.theme || '')
      ? style.theme
      : 'auto',
    bgImg: style.bgImg ? validateDataUri(style.bgImg) : undefined,
    showTimestamp: ['none', 'date', 'datetime'].includes(style.showTimestamp || '')
      ? style.showTimestamp
      : undefined,
    slideMode: style.slideMode
      ? {
          enabled: !!style.slideMode.enabled,
          aspectRatio: ['16:9', '4:3'].includes(style.slideMode.aspectRatio || '')
            ? style.slideMode.aspectRatio
            : '16:9',
        }
      : undefined,
  };
}

export { sanitizeUrl, validateDataUri };
