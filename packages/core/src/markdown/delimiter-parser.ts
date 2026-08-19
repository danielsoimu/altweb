/**
 * Delimiter Parser for ALTWEB
 *
 * Parses slide and card delimiters with optional parameters.
 *
 * Syntax:
 * - ---slide---                        (default slide)
 * - ---slide:title---                  (shorthand layout)
 * - ---slide:2col---                   (shorthand layout)
 * - ---slide[layout=2col valign=top]--- (explicit params)
 * - ---slide:title[bg=#000]---         (shorthand + params)
 * - ---card---                         (default card)
 * - ---card:ig---                      (platform shorthand)
 * - ---card[platform=li ratio=1.91:1]--- (explicit params)
 * - ---endslide---                     (closing tag, no params)
 * - ---endcard---                      (closing tag, no params)
 */

import type {
  DividerBlock,
  SlideLayout,
  VerticalAlign,
  HorizontalAlign,
  PaddingSize,
  SocialPlatform,
  SocialAspectRatio,
} from '../types/content';

// Shorthand mappings for layouts
const LAYOUT_SHORTHANDS: Record<string, SlideLayout> = {
  'default': 'default',
  'title': 'title',
  '2col': 'two-column',
  '2-col': 'two-column',
  'two-column': 'two-column',
  '3col': 'three-column',
  '3-col': 'three-column',
  'three-column': 'three-column',
  '2x2': 'grid-2x2',
  'grid-2x2': 'grid-2x2',
  '2x3': 'grid-2x3',
  'grid-2x3': 'grid-2x3',
};

// Shorthand mappings for platforms
const PLATFORM_SHORTHANDS: Record<string, SocialPlatform> = {
  'ig': 'instagram',
  'instagram': 'instagram',
  'fb': 'facebook',
  'facebook': 'facebook',
  'x': 'twitter',
  'twitter': 'twitter',
  'li': 'linkedin',
  'linkedin': 'linkedin',
};

// Valid values for validation
const VALID_VALIGN: VerticalAlign[] = ['top', 'center', 'bottom'];
const VALID_HALIGN: HorizontalAlign[] = ['left', 'center', 'right'];
const VALID_PAD: PaddingSize[] = ['sm', 'md', 'lg'];
const VALID_RATIOS: SocialAspectRatio[] = ['1:1', '4:5', '9:16', '16:9', '1.91:1'];

/**
 * Parse delimiter line into DividerBlock
 *
 * @param line - The delimiter line (e.g., "---slide:title[bg=#000]---")
 * @returns DividerBlock or null if not a valid delimiter
 */
export function parseDelimiter(line: string): DividerBlock | null {
  const trimmed = line.trim();

  // Must start and end with ---
  if (!trimmed.startsWith('---') || !trimmed.endsWith('---')) {
    return null;
  }

  // Remove outer dashes
  const inner = trimmed.slice(3, -3);

  // Empty = plain divider
  if (!inner) {
    return { t: 'hr', variant: 'default' };
  }

  // Check for closing tags (no params allowed)
  if (inner === 'endslide') {
    return { t: 'hr', variant: 'endslide' };
  }
  if (inner === 'endcard') {
    return { t: 'hr', variant: 'endcard' };
  }

  // Parse slide or card
  if (inner.startsWith('slide')) {
    return parseSlideDelimiter(inner);
  }
  if (inner.startsWith('card')) {
    return parseCardDelimiter(inner);
  }

  // Unknown delimiter type - treat as plain divider
  return { t: 'hr', variant: 'default' };
}

/**
 * Parse slide delimiter
 * Examples: "slide", "slide:title", "slide[layout=2col]", "slide:title[bg=#000]"
 */
function parseSlideDelimiter(inner: string): DividerBlock {
  const block: DividerBlock = { t: 'hr', variant: 'slide' };

  // Remove "slide" prefix
  let rest = inner.slice(5);

  // Parse shorthand (e.g., ":title")
  if (rest.startsWith(':')) {
    const colonEnd = rest.indexOf('[');
    const shorthand = colonEnd === -1 ? rest.slice(1) : rest.slice(1, colonEnd);

    if (shorthand && LAYOUT_SHORTHANDS[shorthand]) {
      block.layout = LAYOUT_SHORTHANDS[shorthand];
    }

    rest = colonEnd === -1 ? '' : rest.slice(colonEnd);
  }

  // Parse params (e.g., "[layout=2col valign=top]")
  if (rest.startsWith('[') && rest.endsWith(']')) {
    const params = parseParams(rest.slice(1, -1));
    applySlideParams(block, params);
  }

  return block;
}

/**
 * Parse card delimiter
 * Examples: "card", "card:ig", "card[platform=li]", "card:fb[ratio=4:5]"
 */
function parseCardDelimiter(inner: string): DividerBlock {
  const block: DividerBlock = { t: 'hr', variant: 'card' };

  // Remove "card" prefix
  let rest = inner.slice(4);

  // Parse shorthand (e.g., ":ig")
  if (rest.startsWith(':')) {
    const colonEnd = rest.indexOf('[');
    const shorthand = colonEnd === -1 ? rest.slice(1) : rest.slice(1, colonEnd);

    if (shorthand && PLATFORM_SHORTHANDS[shorthand]) {
      block.platform = PLATFORM_SHORTHANDS[shorthand];
    }

    rest = colonEnd === -1 ? '' : rest.slice(colonEnd);
  }

  // Parse params (e.g., "[platform=li ratio=4:5]")
  if (rest.startsWith('[') && rest.endsWith(']')) {
    const params = parseParams(rest.slice(1, -1));
    applyCardParams(block, params);
  }

  return block;
}

/**
 * Parse key=value params from string
 * Example: "layout=2col valign=top bg=#000" -> { layout: "2col", valign: "top", bg: "#000" }
 */
function parseParams(paramsStr: string): Record<string, string> {
  const params: Record<string, string> = {};

  // Split by spaces, but handle quoted values
  const regex = /(\w+)=("[^"]*"|'[^']*'|[^\s]+)/g;
  let match;

  while ((match = regex.exec(paramsStr)) !== null) {
    const key = match[1];
    let value = match[2];

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    params[key] = value;
  }

  return params;
}

/**
 * Apply parsed params to slide block
 */
function applySlideParams(block: DividerBlock, params: Record<string, string>): void {
  // Layout
  if (params.layout) {
    const layout = LAYOUT_SHORTHANDS[params.layout];
    if (layout) block.layout = layout;
  }

  // Vertical align
  if (params.valign && VALID_VALIGN.includes(params.valign as VerticalAlign)) {
    block.valign = params.valign as VerticalAlign;
  }

  // Horizontal align
  if (params.halign && VALID_HALIGN.includes(params.halign as HorizontalAlign)) {
    block.halign = params.halign as HorizontalAlign;
  }

  // Background
  if (params.bg) {
    block.bg = params.bg;
  }

  // Foreground
  if (params.fg) {
    block.fg = params.fg;
  }

  // Padding
  if (params.pad && VALID_PAD.includes(params.pad as PaddingSize)) {
    block.pad = params.pad as PaddingSize;
  }
}

/**
 * Apply parsed params to card block
 */
function applyCardParams(block: DividerBlock, params: Record<string, string>): void {
  // Platform
  if (params.platform) {
    const platform = PLATFORM_SHORTHANDS[params.platform];
    if (platform) block.platform = platform;
  }

  // Ratio
  if (params.ratio && VALID_RATIOS.includes(params.ratio as SocialAspectRatio)) {
    block.ratio = params.ratio as SocialAspectRatio;
  }

  // Shared params
  if (params.valign && VALID_VALIGN.includes(params.valign as VerticalAlign)) {
    block.valign = params.valign as VerticalAlign;
  }

  if (params.halign && VALID_HALIGN.includes(params.halign as HorizontalAlign)) {
    block.halign = params.halign as HorizontalAlign;
  }

  if (params.bg) {
    block.bg = params.bg;
  }

  if (params.fg) {
    block.fg = params.fg;
  }

  if (params.pad && VALID_PAD.includes(params.pad as PaddingSize)) {
    block.pad = params.pad as PaddingSize;
  }
}

/**
 * Serialize DividerBlock to markdown delimiter string
 */
export function serializeDelimiter(block: DividerBlock): string {
  // Plain divider
  if (!block.variant || block.variant === 'default') {
    return '---';
  }

  // Closing tags
  if (block.variant === 'endslide') {
    return '---endslide---';
  }
  if (block.variant === 'endcard') {
    return '---endcard---';
  }

  // Slide
  if (block.variant === 'slide') {
    return serializeSlideDelimiter(block);
  }

  // Card
  if (block.variant === 'card') {
    return serializeCardDelimiter(block);
  }

  return '---';
}

/**
 * Serialize slide delimiter
 */
function serializeSlideDelimiter(block: DividerBlock): string {
  const parts: string[] = [];
  let shorthand = '';

  // Check if we can use a shorthand for layout
  if (block.layout && block.layout !== 'default') {
    // Use shortest shorthand
    const shorthandMap: Record<SlideLayout, string> = {
      'default': '',
      'title': 'title',
      'two-column': '2col',
      'three-column': '3col',
      'grid-2x2': '2x2',
      'grid-2x3': '2x3',
    };
    shorthand = shorthandMap[block.layout] || '';
  }

  // Collect params (excluding layout if using shorthand)
  if (block.valign && block.valign !== 'center') {
    parts.push(`valign=${block.valign}`);
  }
  if (block.halign && block.halign !== 'left') {
    parts.push(`halign=${block.halign}`);
  }
  if (block.bg) {
    parts.push(`bg=${block.bg}`);
  }
  if (block.fg) {
    parts.push(`fg=${block.fg}`);
  }
  if (block.pad && block.pad !== 'md') {
    parts.push(`pad=${block.pad}`);
  }

  // Build string
  let result = '---slide';

  if (shorthand) {
    result += `:${shorthand}`;
  }

  if (parts.length > 0) {
    result += `[${parts.join(' ')}]`;
  }

  result += '---';

  return result;
}

/**
 * Serialize card delimiter
 */
function serializeCardDelimiter(block: DividerBlock): string {
  const parts: string[] = [];
  let shorthand = '';

  // Check if we can use a shorthand for platform
  if (block.platform) {
    const shorthandMap: Record<SocialPlatform, string> = {
      'instagram': 'ig',
      'facebook': 'fb',
      'twitter': 'x',
      'linkedin': 'li',
    };
    shorthand = shorthandMap[block.platform] || '';
  }

  // Collect params (excluding platform if using shorthand)
  if (block.ratio) {
    parts.push(`ratio=${block.ratio}`);
  }
  if (block.valign && block.valign !== 'center') {
    parts.push(`valign=${block.valign}`);
  }
  if (block.halign && block.halign !== 'center') {
    parts.push(`halign=${block.halign}`);
  }
  if (block.bg) {
    parts.push(`bg=${block.bg}`);
  }
  if (block.fg) {
    parts.push(`fg=${block.fg}`);
  }
  if (block.pad && block.pad !== 'md') {
    parts.push(`pad=${block.pad}`);
  }

  // Build string
  let result = '---card';

  if (shorthand) {
    result += `:${shorthand}`;
  }

  if (parts.length > 0) {
    result += `[${parts.join(' ')}]`;
  }

  result += '---';

  return result;
}

/**
 * Check if a line is a delimiter
 */
export function isDelimiter(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('---') && trimmed.endsWith('---');
}

/**
 * Check if a line is a slide delimiter
 */
export function isSlideDelimiter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('---') || !trimmed.endsWith('---')) return false;
  const inner = trimmed.slice(3, -3);
  return inner === '' || inner.startsWith('slide') || inner === 'endslide';
}

/**
 * Check if a line is a card delimiter
 */
export function isCardDelimiter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('---') || !trimmed.endsWith('---')) return false;
  const inner = trimmed.slice(3, -3);
  return inner.startsWith('card') || inner === 'endcard';
}
