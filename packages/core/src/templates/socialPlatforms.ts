/**
 * Social Media Platform Configurations
 * Platform-specific settings for social content generation
 */

import type { SocialPlatform, SocialAspectRatio } from '../types/content';

export interface PlatformConfig {
  platform: SocialPlatform;
  name: string;
  nameRo: string;
  aspectRatios: SocialAspectRatio[];
  defaultAspectRatio: SocialAspectRatio;
  maxCharacters: number;
  icon: string; // SVG path
}

export const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  instagram: {
    platform: 'instagram',
    name: 'Instagram',
    nameRo: 'Instagram',
    aspectRatios: ['1:1', '4:5', '9:16'],
    defaultAspectRatio: '1:1',
    maxCharacters: 2200,
    icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z'
  },
  facebook: {
    platform: 'facebook',
    name: 'Facebook',
    nameRo: 'Facebook',
    aspectRatios: ['1.91:1', '1:1', '9:16'],
    defaultAspectRatio: '1:1',
    maxCharacters: 63206,
    icon: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z'
  },
  twitter: {
    platform: 'twitter',
    name: 'X (Twitter)',
    nameRo: 'X (Twitter)',
    aspectRatios: ['16:9', '1:1'],
    defaultAspectRatio: '16:9',
    maxCharacters: 280,
    icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
  },
  linkedin: {
    platform: 'linkedin',
    name: 'LinkedIn',
    nameRo: 'LinkedIn',
    aspectRatios: ['1:1', '1.91:1'],
    defaultAspectRatio: '1:1',
    maxCharacters: 3000,
    icon: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z M2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
  }
};

// Aspect ratio display names
export const ASPECT_RATIO_NAMES: Record<SocialAspectRatio, { en: string; ro: string }> = {
  '1:1': { en: 'Square', ro: 'Square' },
  '4:5': { en: 'Portrait', ro: 'Portrait' },
  '9:16': { en: 'Story', ro: 'Story' },
  '16:9': { en: 'Landscape', ro: 'Landscape' },
  '1.91:1': { en: 'Link Preview', ro: 'Link Preview' }
};

// Export dimensions (base width 1080px for quality)
export const ASPECT_RATIO_DIMENSIONS: Record<SocialAspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1.91:1': { width: 1200, height: 628 }
};

// Platform order for UI
export const PLATFORM_ORDER: SocialPlatform[] = ['instagram', 'facebook', 'twitter', 'linkedin'];

/**
 * Get CSS aspect-ratio value from aspect ratio string
 */
export function getAspectRatioCSS(ratio: SocialAspectRatio): string {
  const [w, h] = ratio.split(':').map(Number);
  return `${w} / ${h}`;
}

/**
 * Get padding-top percentage for aspect ratio (for responsive containers)
 */
export function getAspectRatioPadding(ratio: SocialAspectRatio): number {
  const [w, h] = ratio.split(':').map(Number);
  return (h / w) * 100;
}
