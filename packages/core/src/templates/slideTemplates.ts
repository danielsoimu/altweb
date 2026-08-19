/**
 * Slide Design Templates
 * Pre-defined style presets for slide presentations
 */

import type { PageStyle } from '../types/content';

export interface SlideTemplate {
  id: string;
  name: string;
  nameRo: string;
  preview: {
    bg: string;
    fg: string;
    accent: string;
  };
  style: Partial<PageStyle>;
}

export const slideTemplates: SlideTemplate[] = [
  // Minimal themes
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    nameRo: 'Minimal Deschis',
    preview: { bg: '#ffffff', fg: '#1a1a1a', accent: '#2563eb' },
    style: { theme: 'light', font: 'sans', accent: 'blue', bg: undefined, fg: undefined }
  },
  {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    nameRo: 'Minimal Închis',
    preview: { bg: '#121212', fg: '#f5f5f5', accent: '#93c5fd' },
    style: { theme: 'dark', font: 'sans', accent: 'blue', bg: undefined, fg: undefined }
  },

  // Professional themes
  {
    id: 'corporate-blue',
    name: 'Corporate',
    nameRo: 'Corporate',
    preview: { bg: '#1e3a5f', fg: '#ffffff', accent: '#f59e0b' },
    style: { bg: '#1e3a5f', fg: '#ffffff', accent: 'orange', font: 'sans' }
  },
  {
    id: 'executive',
    name: 'Executive',
    nameRo: 'Executiv',
    preview: { bg: '#1f2937', fg: '#f9fafb', accent: '#10b981' },
    style: { bg: '#1f2937', fg: '#f9fafb', accent: 'green', font: 'sans' }
  },

  // Creative themes
  {
    id: 'elegant-cream',
    name: 'Elegant',
    nameRo: 'Elegant',
    preview: { bg: '#faf7f2', fg: '#2d2d2d', accent: '#8b5cf6' },
    style: { bg: '#faf7f2', fg: '#2d2d2d', accent: 'purple', font: 'serif' }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    nameRo: 'Apus',
    preview: { bg: '#1a1a2e', fg: '#eaeaea', accent: '#e94560' },
    style: { bg: '#1a1a2e', fg: '#eaeaea', accent: 'rose', font: 'sans' }
  },
  {
    id: 'forest',
    name: 'Forest',
    nameRo: 'Pădure',
    preview: { bg: '#1a2f1a', fg: '#e8f5e8', accent: '#4ade80' },
    style: { bg: '#1a2f1a', fg: '#e8f5e8', accent: 'green', font: 'sans' }
  },

  // High contrast
  {
    id: 'high-contrast',
    name: 'High Contrast',
    nameRo: 'Contrast Ridicat',
    preview: { bg: '#000000', fg: '#ffffff', accent: '#06b6d4' },
    style: { bg: '#000000', fg: '#ffffff', accent: 'cyan', font: 'sans' }
  },
];

/**
 * Check if current style matches a template
 */
export function getActiveTemplateId(style: PageStyle): string | null {
  for (const template of slideTemplates) {
    const ts = template.style;
    const matches =
      (ts.theme === undefined || ts.theme === style.theme) &&
      (ts.font === undefined || ts.font === style.font) &&
      (ts.accent === undefined || ts.accent === style.accent) &&
      (ts.bg === undefined ? !style.bg : ts.bg === style.bg) &&
      (ts.fg === undefined ? !style.fg : ts.fg === style.fg);

    if (matches) {
      return template.id;
    }
  }
  return null;
}
