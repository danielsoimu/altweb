/**
 * URL Size Calculator
 */

export type SizeWarningKey = 'over2mb' | 'over100kb' | 'over15kb';

export function calculateUrlSize(hash: string, baseUrl: string): number {
  return baseUrl.length + 1 + hash.length; // baseUrl + '#' + hash
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Returns a warning key for translation, or null if no warning needed.
 * Consumer should use this key to look up the localized message.
 */
export function getSizeWarningKey(bytes: number): SizeWarningKey | null {
  if (bytes > 2 * 1024 * 1024) {
    return 'over2mb';
  }
  if (bytes > 100 * 1024) {
    return 'over100kb';
  }
  if (bytes > 15 * 1024) {
    return 'over15kb';
  }
  return null;
}
