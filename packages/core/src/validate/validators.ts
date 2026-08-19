/**
 * Zod validators for the ALTWEB structure
 */

import { z } from 'zod';
import type { AltPage } from '../types/content';

const TextAlignSchema = z.enum(['left', 'center', 'right', 'justify']).optional();
const LineHeightSchema = z.string().max(10).optional();

// List item tree with capped depth (anti-abuse). The schema is built
// iteratively up to MAX_LIST_DEPTH; below the cap, a present `children` =
// validation error (no silent strip — content loss must be loud).
const MAX_LIST_DEPTH = 6;

function listItemSchema(depth: number): z.ZodTypeAny {
  const base = {
    c: z.string().max(1000),
    task: z.boolean().optional(),
    done: z.boolean().optional(),
  };
  if (depth <= 1) {
    return z.object({ ...base, children: z.never().optional() });
  }
  return z.object({
    ...base,
    children: z.array(listItemSchema(depth - 1)).max(100).optional(),
  });
}

const ListNodesSchema = z.array(listItemSchema(MAX_LIST_DEPTH)).max(100).optional();

const ContentBlockSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('h'), l: z.number().min(1).max(6), c: z.string().max(500), align: TextAlignSchema, lh: LineHeightSchema }),
  z.object({ t: z.literal('p'), c: z.string().max(10000), align: TextAlignSchema, lh: LineHeightSchema }),
  z.object({
    t: z.literal('a'),
    title: z.string().max(200),
    url: z.string().max(2000),
    desc: z.string().max(500).optional(),
    icon: z.string().max(50).optional(),
  }),
  z.object({
    t: z.literal('img'),
    d: z.string().max(200000),
    alt: z.string().max(200).optional(),
    w: z.number().max(2000).optional(),
    cap: z.string().max(500).optional(),
  }),
  z.object({
    t: z.literal('code'),
    c: z.string().max(50000),
    lang: z.string().max(30).optional(),
  }),
  z.object({
    t: z.literal('q'),
    c: z.string().max(2000),
    src: z.string().max(200).optional(),
  }),
  z.object({ t: z.literal('hr') }),
  z.object({
    t: z.literal('space'),
    h: z.number().min(1).max(200).optional(),
  }),
  z.object({
    t: z.literal('list'),
    ordered: z.boolean(),
    items: z.array(z.string().max(1000)).max(100),
    nodes: ListNodesSchema,
    align: TextAlignSchema,
  }),
  z.object({
    t: z.literal('tbl'),
    headers: z.array(z.string().max(200)).max(20),
    rows: z.array(z.array(z.string().max(1000)).max(20)).max(100),
  }),
]);

// Accent can be either a named color or a hex value
const AccentSchema = z.union([
  z.enum(['blue', 'green', 'purple', 'rose', 'orange', 'cyan']),
  z.string().regex(/^#[0-9A-Fa-f]{3,8}$/),
]);

const SlideConfigSchema = z.object({
  enabled: z.boolean(),
  aspectRatio: z.enum(['16:9', '4:3']).optional(),
});

const PageStyleSchema = z.object({
  bg: z.string().regex(/^#[0-9A-Fa-f]{3,8}$/).optional(),
  bgImg: z.string().max(200000).optional(),
  fg: z.string().regex(/^#[0-9A-Fa-f]{3,8}$/).optional(),
  accent: AccentSchema.optional(),
  font: z.enum(['sans', 'serif', 'mono']).optional(),
  maxW: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  showTimestamp: z.enum(['none', 'date', 'datetime']).optional(),
  slideMode: SlideConfigSchema.optional(),
});

const NavigationConfigSchema = z.object({
  pages: z.array(
    z.object({
      id: z.string().max(50),
      label: z.string().max(100),
      hash: z.string().max(10000), // Reduced from 100000 to prevent memory DoS (MED-02, audit Feb 2026)
    })
  ).max(50),
  home: z.string().max(50).optional(),
});

const FooterLinkSchema = z.object({
  label: z.string().max(100),
  url: z.string().max(2000),
});

const PageHeaderSchema = z.object({
  logo: z.string().max(200000).optional(),
  showAuthor: z.boolean().optional(),
  showDate: z.boolean().optional(),
  customText: z.string().max(200).optional(),
}).optional();

const PageFooterSchema = z.object({
  copyright: z.string().max(200).optional(),
  links: z.array(FooterLinkSchema).max(10).optional(),
  poweredBy: z.boolean().optional(),
  customText: z.string().max(500).optional(),
}).optional();

const AltPageSchema = z.object({
  v: z.literal(1),
  meta: z.object({
    title: z.string().max(200),
    description: z.string().max(500).optional(),
    author: z.string().max(100).optional(),
    created: z.number(),
    modified: z.number(),
    lang: z.string().length(2),
    header: PageHeaderSchema,
    footer: PageFooterSchema,
  }),
  blocks: z.array(ContentBlockSchema).max(200),
  nav: NavigationConfigSchema.optional(),
  style: PageStyleSchema,
  indexHash: z.string().max(100000).optional(),
});

export function validatePageStructure(data: unknown): AltPage {
  return AltPageSchema.parse(data) as AltPage;
}

export { AltPageSchema, ContentBlockSchema, PageStyleSchema };
