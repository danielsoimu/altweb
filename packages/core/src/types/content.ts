/**
 * ALTWEB Content Types
 * JSON structure for an ALTWEB page
 */

export interface AltPage {
  v: 1;
  meta: PageMeta;
  blocks: ContentBlock[];
  nav?: NavigationConfig;
  style: PageStyle;
  indexHash?: string; // Hash of the index page for multi-page navigation
}

export interface PageMeta {
  title: string;
  description?: string;
  author?: string;
  created: number;
  modified: number;
  lang: string;
  // Page header/footer
  header?: PageHeader;
  footer?: PageFooter;
}

export interface PageHeader {
  logo?: string;        // data URI for logo image
  showAuthor?: boolean; // show author name
  showDate?: boolean;   // show creation date
  customText?: string;  // custom text/tagline
}

export interface PageFooter {
  copyright?: string;   // copyright text
  links?: FooterLink[]; // footer links
  poweredBy?: boolean;  // show "Powered by ALTWEB"
  customText?: string;  // custom footer text
}

export interface FooterLink {
  label: string;
  url: string;
}

// Content blocks — modular system
export type ContentBlock =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | LinkBlock
  | CodeBlock
  | QuoteBlock
  | DividerBlock
  | ColumnBreakBlock
  | SpacerBlock
  | ListBlock
  | TableBlock;

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

/** Slide layout types for PPTX-style layouts */
export type SlideLayout = 'default' | 'title' | 'two-column' | 'three-column' | 'grid-2x2' | 'grid-2x3';

export interface HeadingBlock {
  t: 'h';
  l: 1 | 2 | 3 | 4 | 5 | 6;
  c: string;
  align?: TextAlign;
  lh?: string; // line-height (e.g., "1.5", "2")
}

export interface TextBlock {
  t: 'p';
  c: string;
  align?: TextAlign;
  lh?: string; // line-height
}

export interface ImageBlock {
  t: 'img';
  d: string; // data URI
  alt?: string;
  w?: number;
  cap?: string;
}

export interface LinkBlock {
  t: 'a';
  title: string;
  url: string;
  desc?: string;
  icon?: string;
}

export interface CodeBlock {
  t: 'code';
  c: string;
  lang?: string;
}

export interface QuoteBlock {
  t: 'q';
  c: string;
  src?: string;
}

/** Delimiter variant types */
export type DividerVariant = 'default' | 'slide' | 'endslide' | 'card' | 'endcard';

/** Vertical alignment for slides/cards */
export type VerticalAlign = 'top' | 'center' | 'bottom';

/** Horizontal alignment for slides/cards */
export type HorizontalAlign = 'left' | 'center' | 'right';

/** Padding size for slides/cards */
export type PaddingSize = 'sm' | 'md' | 'lg';

/**
 * DividerBlock - Delimiter for slides and cards
 *
 * Syntax examples:
 * - ---slide---                      (default)
 * - ---slide:title---                (shorthand for layout)
 * - ---slide:2col---                 (shorthand for layout)
 * - ---slide[layout=2col]---         (explicit params)
 * - ---slide:title[bg=#000 fg=#fff]--- (shorthand + params)
 * - ---card---                       (default card)
 * - ---card:ig---                    (Instagram shorthand)
 * - ---card[platform=li ratio=1.91:1]--- (explicit params)
 */
export interface DividerBlock {
  t: 'hr';
  /**
   * Delimiter variant:
   * - 'default': visual divider only (---)
   * - 'slide' / 'endslide': slide boundaries
   * - 'card' / 'endcard': card boundaries
   */
  variant?: DividerVariant;

  // === SLIDE PROPERTIES ===
  /** Slide layout (only for variant='slide') */
  layout?: SlideLayout;

  // === SHARED PROPERTIES (slides & cards) ===
  /** Vertical content alignment */
  valign?: VerticalAlign;
  /** Horizontal content alignment */
  halign?: HorizontalAlign;
  /** Background color (hex or named) */
  bg?: string;
  /** Foreground/text color (hex or named) */
  fg?: string;
  /** Padding size */
  pad?: PaddingSize;

  // === CARD PROPERTIES ===
  /** Social platform (only for variant='card') */
  platform?: SocialPlatform;
  /** Aspect ratio (only for variant='card') */
  ratio?: SocialAspectRatio;
}

/** Column break - separates content into columns within a slide */
export interface ColumnBreakBlock {
  t: 'col-break';
}

export interface SpacerBlock {
  t: 'space';
  h: number; // height in pixels
}

// List element with nesting and task state.
// Children inherit `ordered` from the parent block (a deliberate limitation of
// the v1 model: ul/ol cannot be mixed within the same tree).
export interface ListItem {
  c: string; // inline content (same format as items[])
  task?: boolean;
  done?: boolean;
  children?: ListItem[];
}

export interface ListBlock {
  t: 'list';
  ordered: boolean;
  // Flattened fallback — always written, so already-deployed renderers
  // (existing standalones) degrade gracefully.
  items: string[];
  // The real tree (nesting + task state); renderers prefer it when present.
  nodes?: ListItem[];
  align?: TextAlign;
}

export interface TableBlock {
  t: 'tbl';
  headers: string[];
  rows: string[][];
}

export interface PageStyle {
  bg?: string;
  bgImg?: string;
  fg?: string;
  accent?: string;
  font?: 'sans' | 'serif' | 'mono';
  maxW?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'light' | 'dark' | 'auto';
  showTimestamp?: 'none' | 'date' | 'datetime'; // none = hidden, date = only date, datetime = date + time
  slideMode?: SlideConfig;
  socialMode?: SocialConfig;
}

export interface SlideConfig {
  enabled: boolean;
  aspectRatio?: '16:9' | '4:3'; // default: 16:9
}

// ============ SOCIAL MODE TYPES ============

export type SocialPlatform = 'instagram' | 'facebook' | 'twitter' | 'linkedin';

export type SocialAspectRatio = '1:1' | '4:5' | '9:16' | '16:9' | '1.91:1';

export interface SocialCard {
  id: string;
  platform: SocialPlatform;
  aspectRatio: SocialAspectRatio;
  blocks: ContentBlock[];
  caption?: string;
  order: number;
}

export interface SocialConfig {
  enabled: boolean;
  cards: SocialCard[];
  activePlatform: SocialPlatform;
  activeCardId: string | null;
}

export interface NavigationConfig {
  pages: NavPage[];
  home?: string;
}

export interface NavPage {
  id: string;
  label: string;
  hash: string;
}

// UI language for rendered artifacts (subset shared with the app's i18n)
export type Language = 'ro' | 'en';
