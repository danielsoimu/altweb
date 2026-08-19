/**
 * Slide Layout Templates
 * PPTX-style layout presets for slide presentations
 */

import type { SlideLayout } from '../types/content';

export interface LayoutTemplate {
  id: SlideLayout;
  name: string;
  nameRo: string;
  /** Number of dashes in Markdown syntax */
  dashes: number;
  /** Description of the layout */
  description: string;
  descriptionRo: string;
}

export const layoutTemplates: LayoutTemplate[] = [
  {
    id: 'default',
    name: 'Default',
    nameRo: 'Standard',
    dashes: 3,
    description: 'Standard vertical layout',
    descriptionRo: 'Layout vertical standard',
  },
  {
    id: 'title',
    name: 'Title',
    nameRo: 'Titlu',
    dashes: 4,
    description: 'Centered title slide',
    descriptionRo: 'Slide titlu centrat',
  },
  {
    id: 'two-column',
    name: 'Two Columns',
    nameRo: 'Două Coloane',
    dashes: 5,
    description: 'Two equal columns',
    descriptionRo: 'Două coloane egale',
  },
  {
    id: 'three-column',
    name: 'Three Columns',
    nameRo: 'Trei Coloane',
    dashes: 6,
    description: 'Three equal columns',
    descriptionRo: 'Trei coloane egale',
  },
  {
    id: 'grid-2x2',
    name: 'Grid 2×2',
    nameRo: 'Grilă 2×2',
    dashes: 7,
    description: '2 rows × 2 columns grid',
    descriptionRo: 'Grilă cu 2 rânduri × 2 coloane',
  },
  {
    id: 'grid-2x3',
    name: 'Grid 2×3',
    nameRo: 'Grilă 2×3',
    dashes: 8,
    description: '2 rows × 3 columns grid',
    descriptionRo: 'Grilă cu 2 rânduri × 3 coloane',
  },
];

/**
 * SVG icon paths for layout previews
 * These represent the column arrangement in a mini preview
 */
export const layoutIcons: Record<SlideLayout, string> = {
  'default': `
    <rect x="8" y="4" width="32" height="40" rx="2" fill="currentColor" opacity="0.3"/>
    <rect x="10" y="6" width="28" height="4" rx="1" fill="currentColor"/>
    <rect x="10" y="12" width="28" height="2" rx="0.5" fill="currentColor" opacity="0.6"/>
    <rect x="10" y="16" width="28" height="2" rx="0.5" fill="currentColor" opacity="0.6"/>
    <rect x="10" y="20" width="20" height="2" rx="0.5" fill="currentColor" opacity="0.6"/>
  `,
  'title': `
    <rect x="8" y="4" width="32" height="40" rx="2" fill="currentColor" opacity="0.3"/>
    <rect x="12" y="18" width="24" height="6" rx="1" fill="currentColor"/>
    <rect x="16" y="26" width="16" height="2" rx="0.5" fill="currentColor" opacity="0.6"/>
  `,
  'two-column': `
    <rect x="8" y="4" width="32" height="40" rx="2" fill="currentColor" opacity="0.3"/>
    <rect x="10" y="6" width="14" height="36" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="26" y="6" width="14" height="36" rx="1" fill="currentColor" opacity="0.5"/>
  `,
  'three-column': `
    <rect x="8" y="4" width="32" height="40" rx="2" fill="currentColor" opacity="0.3"/>
    <rect x="10" y="6" width="8" height="36" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="20" y="6" width="8" height="36" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="30" y="6" width="8" height="36" rx="1" fill="currentColor" opacity="0.5"/>
  `,
  'grid-2x2': `
    <rect x="8" y="4" width="32" height="40" rx="2" fill="currentColor" opacity="0.3"/>
    <rect x="10" y="6" width="14" height="17" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="26" y="6" width="14" height="17" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="10" y="25" width="14" height="17" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="26" y="25" width="14" height="17" rx="1" fill="currentColor" opacity="0.5"/>
  `,
  'grid-2x3': `
    <rect x="8" y="4" width="32" height="40" rx="2" fill="currentColor" opacity="0.3"/>
    <rect x="10" y="6" width="8" height="17" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="20" y="6" width="8" height="17" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="30" y="6" width="8" height="17" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="10" y="25" width="8" height="17" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="20" y="25" width="8" height="17" rx="1" fill="currentColor" opacity="0.5"/>
    <rect x="30" y="25" width="8" height="17" rx="1" fill="currentColor" opacity="0.5"/>
  `,
};

/**
 * Get CSS classes for layout rendering
 */
export function getLayoutClasses(layout: SlideLayout): string {
  switch (layout) {
    case 'title':
      return 'flex flex-col items-center justify-center text-center h-full';
    case 'two-column':
      return 'grid grid-cols-2 gap-8 h-full items-start';
    case 'three-column':
      return 'grid grid-cols-3 gap-6 h-full items-start';
    case 'grid-2x2':
      return 'grid grid-cols-2 grid-rows-2 gap-4 h-full';
    case 'grid-2x3':
      return 'grid grid-cols-3 grid-rows-2 gap-4 h-full';
    default:
      return 'space-y-4';
  }
}

/**
 * Get the number of cells for a layout
 */
export function getLayoutCellCount(layout: SlideLayout): number {
  switch (layout) {
    case 'two-column': return 2;
    case 'three-column': return 3;
    case 'grid-2x2': return 4;
    case 'grid-2x3': return 6;
    default: return 1;
  }
}

/**
 * Check if layout is a multi-cell layout
 */
export function isMultiCellLayout(layout: SlideLayout): boolean {
  return ['two-column', 'three-column', 'grid-2x2', 'grid-2x3'].includes(layout);
}

/**
 * Get layout from template ID
 */
export function getLayoutTemplate(id: SlideLayout): LayoutTemplate | undefined {
  return layoutTemplates.find(t => t.id === id);
}
