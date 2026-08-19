/**
 * @altweb/core — ALTWEB headless engine
 * Browser-safe barrel: types, codec, crypto, compression, markdown, sanitize, validate, templates.
 * Modules touching Node fs/DOM live under separate exports ("./node-dom").
 */

export * from './types';

export { encodePage, generateFullUrl, type EncodeOptions } from './codec/encoder';
export {
  decodePage,
  isEncryptedContent,
  hasSignature,
  hasVisibleMeta,
  getVisibleMeta,
  DecryptionError,
  ValidationError,
} from './codec/decoder';
export {
  generateStandaloneHTML,
  downloadStandaloneHTML,
  type StandaloneOptions,
} from './codec/standalone-html';
export { calculateUrlSize, formatSize, getSizeWarningKey } from './codec/size-calculator';
export { inspectArtifact, type ArtifactInfo } from './codec/inspect';

export * from './crypto';
export { compress, decompress } from './compression';

export { parseMarkdown, extractTitle, extractDescription } from './markdown/markdown-parser';
export * from './markdown/markdown-serializer';
export * from './markdown/markdown';
export * from './markdown/delimiter-parser';

export { sanitizePage, sanitizeUrl, validateDataUri } from './sanitize/sanitize';
export { validatePageStructure, AltPageSchema } from './validate/validators';

export * from './templates/layoutTemplates';
export * from './templates/slideTemplates';
export * from './templates/socialPlatforms';
