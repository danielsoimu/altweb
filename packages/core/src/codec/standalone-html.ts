/**
 * ALTWEB Standalone HTML Generator
 * Generates a self-contained HTML file that matches PageRenderer exactly
 */

import type { Language } from '../types';
import { DOMPURIFY_CODE } from './dompurify-blob.generated';

export interface StandaloneOptions {
  hash: string;
  title?: string;
  isEncrypted: boolean;
  lang?: Language;
}

// Embedded translations for standalone HTML (minimal subset needed)

const standaloneTranslations = {
  ro: {
    loading: 'Se încarcă...',
    encryptedContent: 'Conținut criptat',
    enterPassword: 'Introdu parola pentru a accesa conținutul',
    passwordLabel: 'Parolă',
    passwordPlaceholder: 'Parola...',
    decrypt: 'Decriptează',
    decrypting: 'Se decriptează...',
    error: 'Eroare',
    wrongPassword: 'Parolă incorectă sau date corupte',
    verified: '✓ Verificat',
    signed: 'Semnat — verificarea rulează după decriptare',
    invalidSignature: '⚠ Semnătură invalidă — conținut modificat după semnare',
    metaUnsigned: '✓ Conținut verificat — titlul și antetul nu sunt semnate',
    independentNote: 'Insigna e afișată de fișierul însuși — pentru dovadă independentă rulează: altweb verify',
    publicKeyLabel: 'Cheia publică a semnatarului',
    authorPrefix: 'Autor:',
    incompatibleBrowser: 'Browser incompatibil. Necesită Chrome 80+, Firefox 113+, sau Safari 16.4+',
    branding: 'Capsule de context semnate',
  },
  en: {
    loading: 'Loading...',
    encryptedContent: 'Encrypted content',
    enterPassword: 'Enter password to access the content',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Password...',
    decrypt: 'Decrypt',
    decrypting: 'Decrypting...',
    error: 'Error',
    wrongPassword: 'Wrong password or corrupted data',
    verified: '✓ Verified',
    signed: 'Signed — verification runs after decryption',
    invalidSignature: '⚠ Invalid signature — content was modified after signing',
    metaUnsigned: '✓ Content verified — title and header are not signed',
    independentNote: 'This badge is rendered by the file itself — for independent proof run: altweb verify',
    publicKeyLabel: 'Signer public key',
    authorPrefix: 'Author:',
    incompatibleBrowser: 'Incompatible browser. Requires Chrome 80+, Firefox 113+, or Safari 16.4+',
    branding: 'Signed context capsules',
  },
};

export function generateStandaloneHTML(options: StandaloneOptions): string {
  const { hash, title = 'ALTWEB Page', isEncrypted, lang = 'en' } = options;
  // The hash is interpolated into an HTML attribute and a JS string literal
  // below; enforcing the base64url charset here closes any injection path
  // for callers that pass an untrusted string instead of encodePage() output.
  if (!/^[A-Za-z0-9_-]+$/.test(hash)) {
    throw new Error('generateStandaloneHTML: hash must be base64url ([A-Za-z0-9_-])');
  }
  const t = standaloneTranslations[lang];

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none';">
  <meta name="altweb-hash" content="${hash}">
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { min-height: 100%; }
    body { min-height: 100vh; margin: 0; }

    :root {
      --accent-color: #3b82f6;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
    }

    /* Theme colors - matches PageRenderer themeColors */
    body { background: #ffffff; color: #1a1a1a; }
    body.theme-dark { background: #121212; color: #f5f5f5; }
    body.theme-light { background: #ffffff; color: #1a1a1a; }

    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) { background: #121212; color: #f5f5f5; }
    }

    /* Page wrapper - matches PageRenderer min-h-screen */
    .page-wrapper {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Signature header - matches PageRenderer verified header */
    .sig-header {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    body.theme-dark .sig-header { border-color: rgba(255,255,255,0.1); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .sig-header { border-color: rgba(255,255,255,0.1); }
    }
    .sig-content {
      max-width: 42rem;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: #16a34a;
    }
    .sig-fingerprint {
      font-family: monospace;
      font-size: 0.75rem;
      background: rgba(22, 163, 74, 0.1);
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      color: #15803d;
    }
    body.theme-dark .sig-fingerprint { background: rgba(22, 163, 74, 0.2); color: #4ade80; }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .sig-fingerprint { background: rgba(22, 163, 74, 0.2); color: #4ade80; }
    }
    /* Invalid signature banner: loud, red, impossible to miss */
    .sig-header.sig-invalid {
      background: #dc2626;
      border-bottom: 2px solid #991b1b;
    }
    .sig-invalid .sig-content {
      color: #ffffff;
      font-weight: 600;
      font-size: 0.85rem;
      justify-content: center;
    }
    /* Expandable full signer key (trust pinning aid) */
    .sig-key summary {
      cursor: pointer;
      font-size: 0.7rem;
      opacity: 0.7;
    }
    .sig-key code {
      display: block;
      font-family: monospace;
      font-size: 0.65rem;
      word-break: break-all;
      max-width: 24rem;
      padding: 0.25rem 0.5rem;
      background: rgba(22, 163, 74, 0.1);
      border-radius: 0.25rem;
      margin-top: 0.25rem;
    }
    /* Honesty note: the badge is self-rendered; point at independent verification */
    .sig-note {
      text-align: right;
      font-size: 0.65rem;
      opacity: 0.55;
      padding-top: 0.25rem;
    }
    .sig-invalid .sig-note {
      color: #ffffff;
      opacity: 0.85;
      text-align: center;
    }

    /* Main content - matches PageRenderer */
    .page-main {
      flex: 1;
      padding: 2rem 1rem;
    }
    .page-container {
      max-width: 42rem;
      margin: 0 auto;
    }
    .page-container.max-sm { max-width: 36rem; }
    .page-container.max-md { max-width: 42rem; }
    .page-container.max-lg { max-width: 56rem; }
    .page-container.max-xl { max-width: 1100px; }

    /* Document header (Word-style) - 3 column layout */
    .doc-header {
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    body.theme-dark .doc-header { border-color: rgba(255,255,255,0.1); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .doc-header { border-color: rgba(255,255,255,0.1); }
    }
    .doc-header-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0;
    }
    .doc-header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      justify-self: start;
    }
    .doc-header-center {
      justify-self: center;
      text-align: center;
    }
    .doc-header-title {
      font-size: 1.125rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .doc-header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
      opacity: 0.6;
      justify-self: end;
    }
    .doc-header-logo {
      height: 2rem;
      width: auto;
      object-fit: contain;
    }
    .doc-header-tagline {
      font-size: 0.875rem;
      opacity: 0.8;
    }

    /* Document sub-header (description as foreword) */
    .doc-subheader {
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    body.theme-dark .doc-subheader { border-color: rgba(255,255,255,0.1); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .doc-subheader { border-color: rgba(255,255,255,0.1); }
    }
    .doc-subheader-desc {
      text-align: center;
      font-size: 0.875rem;
      font-style: italic;
      opacity: 0.8;
      max-width: 42rem;
      margin: 0 auto;
      padding: 1rem 0;
    }

    /* Page header - matches PageRenderer header */
    .page-header { margin-bottom: 2rem; }
    .page-title {
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.025em;
      margin-bottom: 0.5rem;
    }
    .page-desc { opacity: 0.8; }
    .page-author {
      font-size: 0.875rem;
      margin-top: 0.5rem;
      opacity: 0.6;
    }

    /* Document footer (Word-style) - matches PageRenderer DocumentFooter */
    .doc-footer {
      border-top: 1px solid rgba(0,0,0,0.1);
      margin-top: 2rem;
    }
    body.theme-dark .doc-footer { border-color: rgba(255,255,255,0.1); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .doc-footer { border-color: rgba(255,255,255,0.1); }
    }
    .doc-footer-inner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1rem 0;
      font-size: 0.875rem;
      opacity: 0.6;
    }
    .doc-footer-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .doc-footer-links {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .doc-footer-links a {
      color: var(--accent-color);
      text-decoration: none;
    }
    .doc-footer-links a:hover { text-decoration: underline; }

    /* Footer - matches PageRenderer footer */
    .page-footer {
      border-top: 1px solid rgba(0,0,0,0.1);
      padding: 1.5rem 1rem;
      text-align: center;
      font-size: 0.75rem;
      opacity: 0.6;
    }
    body.theme-dark .page-footer { border-color: rgba(255,255,255,0.1); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .page-footer { border-color: rgba(255,255,255,0.1); }
    }
    .footer-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }
    .footer-content > span:first-child { font-weight: 500; }
    .footer-dot { opacity: 0.4; }
    .footer-timestamp {
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
      opacity: 0.6;
      letter-spacing: -0.02em;
    }

    /* Block styles - matches BlockRenderer */
    .block { margin-bottom: 1rem; }

    /* Headings */
    h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 1rem; }
    h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; }
    h3 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    h4 { font-size: 1.125rem; font-weight: 500; margin-bottom: 0.5rem; }

    /* Paragraph */
    p { margin-bottom: 1rem; line-height: 1.625; }

    /* Link card - matches BlockRenderer LinkBlock */
    .link-card {
      display: block;
      margin: 0.75rem 0;
      padding: 1rem;
      border-radius: 0.5rem;
      border: 1px solid rgba(0,0,0,0.1);
      text-decoration: none;
      color: inherit;
      transition: background-color 0.15s, border-color 0.15s;
    }
    body.theme-dark .link-card { border-color: rgba(255,255,255,0.15); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .link-card { border-color: rgba(255,255,255,0.15); }
    }
    .link-card:hover { background: rgba(0,0,0,0.03); }
    body.theme-dark .link-card:hover { background: rgba(255,255,255,0.05); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .link-card:hover { background: rgba(255,255,255,0.05); }
    }
    .link-inner { display: flex; align-items: center; gap: 0.75rem; }
    .link-icon { font-size: 1.5rem; }
    .link-title { font-weight: 500; color: var(--accent-color); }
    .link-desc { font-size: 0.875rem; opacity: 0.6; }

    /* Code block - matches BlockRenderer CodeBlock */
    .code-wrapper { margin: 1rem 0; }
    .code-lang { font-size: 0.75rem; margin-bottom: 0.25rem; font-family: monospace; opacity: 0.6; }
    pre {
      background: #1f2937;
      color: #f3f4f6;
      padding: 1rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      font-family: monospace;
      font-size: 0.875rem;
    }
    code { font-family: monospace; }

    /* Quote - matches BlockRenderer QuoteBlock */
    blockquote {
      margin: 1.5rem 0;
      padding-left: 1rem;
      border-left: 4px solid var(--accent-color);
    }
    blockquote p { font-style: italic; margin-bottom: 0; }
    .quote-source {
      display: block;
      margin-top: 0.5rem;
      font-size: 0.875rem;
      opacity: 0.6;
    }

    /* Lists - matches BlockRenderer ListBlock */
    ul, ol { margin: 1rem 0; padding-left: 1.5rem; }
    li ul, li ol { margin: 0.25rem 0; }
    li.task-item { list-style: none; margin-left: -1.25rem; }
    li.task-item input[type="checkbox"] { accent-color: var(--accent-color); vertical-align: middle; margin-right: 0.4rem; }
    li { margin-bottom: 0.25rem; }

    /* Divider - matches BlockRenderer hr */
    hr {
      border: none;
      border-top: 1px solid rgba(0,0,0,0.1);
      margin: 2rem 0;
    }
    body.theme-dark hr { border-color: rgba(255,255,255,0.15); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) hr { border-color: rgba(255,255,255,0.15); }
    }

    /* Image - matches BlockRenderer ImageBlock */
    figure { margin: 1.5rem 0; }
    figure img { max-width: 100%; height: auto; border-radius: 0.5rem; display: block; margin: 0 auto; }
    figcaption { margin-top: 0.5rem; text-align: center; font-size: 0.875rem; opacity: 0.6; }

    /* Table - matches BlockRenderer TableBlock */
    .table-wrapper { margin: 1.5rem 0; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.5rem 1rem; text-align: left; font-size: 0.875rem; border-bottom: 1px solid rgba(0,0,0,0.1); }
    body.theme-dark th, body.theme-dark td { border-color: rgba(255,255,255,0.15); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) th, body:not(.theme-light) td { border-color: rgba(255,255,255,0.15); }
    }
    th { font-weight: 600; background: rgba(0,0,0,0.03); }
    body.theme-dark th { background: rgba(255,255,255,0.05); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) th { background: rgba(255,255,255,0.05); }
    }
    tr:last-child td { border-bottom: none; }

    /* Fonts */
    .font-sans { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .font-serif { font-family: Georgia, Cambria, 'Times New Roman', Times, serif; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace; }

    /* Text alignment */
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-justify { text-align: justify; }

    /* Decrypt prompt - matches DecryptPrompt.tsx exactly */
    .decrypt-screen {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: #f5f5f5;
    }
    body.theme-dark .decrypt-screen { background: #0a0a0a; }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .decrypt-screen { background: #0a0a0a; }
    }
    .decrypt-container { width: 100%; max-width: 28rem; }

    .decrypt-card {
      background: white;
      border-radius: 1rem;
      border: 1px solid rgba(0,0,0,0.1);
      overflow: hidden;
    }
    body.theme-dark .decrypt-card { background: #1a1a1a; border-color: rgba(255,255,255,0.1); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .decrypt-card { background: #1a1a1a; border-color: rgba(255,255,255,0.1); }
    }

    /* Header section */
    .decrypt-header {
      padding: 1.5rem;
      text-align: center;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    body.theme-dark .decrypt-header { border-color: rgba(255,255,255,0.1); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .decrypt-header { border-color: rgba(255,255,255,0.1); }
    }
    .decrypt-icon {
      width: 4rem;
      height: 4rem;
      border-radius: 50%;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.875rem;
      margin: 0 auto 1rem;
    }
    body.theme-dark .decrypt-icon { background: #262626; }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .decrypt-icon { background: #262626; }
    }
    .decrypt-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    .decrypt-subtitle {
      font-size: 0.875rem;
      opacity: 0.6;
    }

    /* Visible meta header style */
    .decrypt-header-meta { text-align: left; }
    .meta-row {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }
    .meta-icon {
      width: 3rem;
      height: 3rem;
      border-radius: 0.75rem;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      flex-shrink: 0;
    }
    body.theme-dark .meta-icon { background: #262626; }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .meta-icon { background: #262626; }
    }
    .meta-info { flex: 1; min-width: 0; }
    .meta-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta-desc {
      font-size: 0.875rem;
      opacity: 0.8;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .meta-author {
      font-size: 0.75rem;
      opacity: 0.6;
      margin-top: 0.5rem;
    }

    /* Form section */
    .decrypt-form { padding: 1.5rem; }
    .decrypt-form > * + * { margin-top: 1rem; }

    .form-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.6;
      margin-bottom: 0.5rem;
    }
    .input-wrapper { position: relative; }
    .decrypt-input {
      width: 100%;
      height: 3rem;
      padding: 0 3.5rem 0 1rem;
      border-radius: 0.75rem;
      border: 1px solid rgba(0,0,0,0.15);
      background: transparent;
      color: inherit;
      font-size: 1rem;
      transition: border-color 0.15s;
    }
    body.theme-dark .decrypt-input { border-color: rgba(255,255,255,0.15); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .decrypt-input { border-color: rgba(255,255,255,0.15); }
    }
    .decrypt-input:focus { outline: none; border-color: rgba(0,0,0,0.3); }
    body.theme-dark .decrypt-input:focus { border-color: rgba(255,255,255,0.3); }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .decrypt-input:focus { border-color: rgba(255,255,255,0.3); }
    }
    .decrypt-input::placeholder { opacity: 0.4; }

    .toggle-password {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      opacity: 0.5;
      cursor: pointer;
      color: inherit;
    }
    .toggle-password:hover { opacity: 0.8; }

    .decrypt-error {
      padding: 0.75rem;
      background: #f5f5f5;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      text-align: center;
      color: #dc2626;
    }
    body.theme-dark .decrypt-error { background: #262626; }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .decrypt-error { background: #262626; }
    }

    .decrypt-button {
      width: 100%;
      height: 3rem;
      padding: 0 1rem;
      background: #1a1a1a;
      color: white;
      font-weight: 500;
      border: none;
      border-radius: 0.75rem;
      font-size: 1rem;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    body.theme-dark .decrypt-button { background: #f5f5f5; color: #1a1a1a; }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .decrypt-button { background: #f5f5f5; color: #1a1a1a; }
    }
    .decrypt-button:hover { opacity: 0.8; }
    .decrypt-button:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Footer section */
    .decrypt-footer { padding: 0 1.5rem 1.5rem; }
    .signed-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      padding: 0.75rem;
      background: #f5f5f5;
      border-radius: 0.75rem;
    }
    body.theme-dark .signed-badge { background: #262626; }
    @media (prefers-color-scheme: dark) {
      body:not(.theme-light) .signed-badge { background: #262626; }
    }
    .signed-badge .check { color: #22c55e; }
    .signed-badge span { opacity: 0.8; }

    /* Branding */
    .decrypt-branding {
      margin-top: 1.5rem;
      text-align: center;
      font-size: 0.75rem;
      opacity: 0.6;
    }
    .decrypt-branding strong { font-weight: 600; }

    .error { color: #dc2626; font-size: 0.875rem; margin-bottom: 1rem; }

    /* Loading state */
    .loading { text-align: center; padding: 4rem; opacity: 0.6; }
  </style>
</head>
<body>
  <div id="app">
    <div class="loading">${escapeHtml(t.loading)}</div>
  </div>

  <!-- DOMPurify 3.4.13 - XSS Protection -->
  <script>
  /*! @license DOMPurify 3.4.13 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.13/LICENSE */
${DOMPURIFY_CODE}
  </script>

  <script>
  (function() {
    const DATA = '${hash}';
    const IS_ENCRYPTED = ${isEncrypted};
    const T = ${JSON.stringify(t)};
    const app = document.getElementById('app');

    // Accent color palette with theme-aware variants
    const accentColors = {
      blue: { light: '#2563eb', dark: '#93c5fd' },
      green: { light: '#059669', dark: '#6ee7b7' },
      purple: { light: '#7c3aed', dark: '#c4b5fd' },
      rose: { light: '#e11d48', dark: '#fda4af' },
      orange: { light: '#ea580c', dark: '#fdba74' },
      cyan: { light: '#0891b2', dark: '#67e8f9' },
    };

    function getAccentHex(colorName, theme, prefersDark) {
      const name = colorName || 'blue';
      const color = accentColors[name] || accentColors.blue;
      const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
      return isDark ? color.dark : color.light;
    }

    function b64urlDecode(str) {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';
      const binary = atob(str);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }

    async function deriveKey(password, salt) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
    }

    async function decrypt(encrypted, password) {
      const salt = b64urlDecode(encrypted.salt);
      const iv = b64urlDecode(encrypted.iv);
      const ciphertext = b64urlDecode(encrypted.ct);
      const key = await deriveKey(password, salt);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return new Uint8Array(decrypted);
    }

    async function decompress(data) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error(T.incompatibleBrowser);
      }
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(data);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    }

    // Mirrors the core verify(): ECDSA P-256 / SHA-256, SPKI public key,
    // raw signature — over the exact compressed bytes that were signed.
    async function verifySignature(signedBytes, signatureB64, publicKeyB64) {
      try {
        const key = await crypto.subtle.importKey(
          'spki',
          b64urlDecode(publicKeyB64),
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify']
        );
        return await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          key,
          b64urlDecode(signatureB64),
          signedBytes
        );
      } catch (e) {
        return false;
      }
    }

    async function decodePage(password) {
      const envelopeBytes = b64urlDecode(DATA);
      const envelopeJson = new TextDecoder().decode(envelopeBytes);
      const envelope = JSON.parse(envelopeJson);

      let page;
      // The signature covers the compressed payload bytes; each branch
      // already holds them — keep them for real verification below.
      let signedBytes = null;

      if (envelope.enc) {
        if (!password) throw new Error('Password required');

        // Check for partial encryption (visible meta in envelope.m)
        if (envelope.m) {
          // Partial encryption: meta visible, blocks encrypted
          const metaCompressed = b64urlDecode(envelope.m);
          const metaBytes = await decompress(metaCompressed);
          const visibleMeta = JSON.parse(new TextDecoder().decode(metaBytes));

          // Decrypt blocks
          const blocksCompressed = await decrypt(envelope.e, password);
          // Partial mode signs meta || blocks, so the visible meta is covered too.
          signedBytes = new Uint8Array(metaCompressed.length + blocksCompressed.length);
          signedBytes.set(metaCompressed, 0);
          signedBytes.set(blocksCompressed, metaCompressed.length);
          const blocksBytes = await decompress(blocksCompressed);
          const blocksData = JSON.parse(new TextDecoder().decode(blocksBytes));

          // Merge visible meta with decrypted blocks
          page = {
            v: blocksData.v || 1,
            meta: visibleMeta.meta,
            style: visibleMeta.style,
            blocks: blocksData.blocks || [],
            nav: blocksData.nav,
            indexHash: blocksData.indexHash,
          };
        } else {
          // Full encryption: everything encrypted
          const compressed = await decrypt(envelope.e, password);
          signedBytes = compressed;
          const jsonBytes = await decompress(compressed);
          page = JSON.parse(new TextDecoder().decode(jsonBytes));
        }
      } else {
        // Public content
        const compressed = b64urlDecode(envelope.d);
        signedBytes = compressed;
        const jsonBytes = await decompress(compressed);
        page = JSON.parse(new TextDecoder().decode(jsonBytes));
      }

      // REAL cryptographic verification — a present-but-invalid signature
      // must come back loud, never as "verified".
      const signed = !!(envelope.s && envelope.pk);
      const verified = signed
        ? await verifySignature(signedBytes, envelope.s, envelope.pk)
        : false;
      const signatureInvalid = signed && !verified;
      const fingerprint = verified ? await computeFingerprint(envelope.pk) : null;

      return {
        page,
        signed,
        verified,
        signatureInvalid,
        // Partial-mode signatures now cover meta || blocks, so the visible
        // meta (title/description/author) is protected too — no weaker
        // "meta unsigned" state remains.
        partialSigned: false,
        fingerprint,
        publicKey: verified ? envelope.pk : null,
      };
    }

    async function computeFingerprint(publicKeyBase64) {
      const publicKeyData = b64urlDecode(publicKeyBase64);
      const hash = await crypto.subtle.digest('SHA-256', publicKeyData);
      const hashArray = new Uint8Array(hash);
      // Format: first 8 bytes as hex with colons
      return Array.from(hashArray.slice(0, 8))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(':');
    }

    // Helper to get visible meta from envelope (for password prompt)
    async function getVisibleMeta() {
      try {
        const envelopeBytes = b64urlDecode(DATA);
        const envelopeJson = new TextDecoder().decode(envelopeBytes);
        const envelope = JSON.parse(envelopeJson);

        if (envelope.m) {
          const metaCompressed = b64urlDecode(envelope.m);
          const metaBytes = await decompress(metaCompressed);
          return JSON.parse(new TextDecoder().decode(metaBytes));
        }
      } catch (e) {
        console.error('Error getting visible meta:', e);
      }
      return null;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // URL scheme guards mirror core's sanitize.ts so the standalone path is as
    // safe as the core path, not just CSP-dependent. encodePage() already
    // sanitizes at build time; this re-guards at render time because the
    // runtime decodes whatever hash it is handed, including a hand-crafted
    // envelope that never went through the encoder.
    function safeHref(url) {
      try {
        var p = new URL(String(url));
        if (p.protocol === 'http:' || p.protocol === 'https:' || p.protocol === 'mailto:') return url;
        return '#blocked';
      } catch (e) {
        return '#invalid';
      }
    }
    function safeImgSrc(url) {
      var s = String(url);
      if (/^data:image\\/(png|jpe?g|gif|webp|svg\\+xml);base64,[A-Za-z0-9+/=]+$/i.test(s)) return s;
      try {
        var p = new URL(s);
        if (p.protocol === 'http:' || p.protocol === 'https:') return s;
      } catch (e) {}
      return '';
    }

    function formatTimestamp(timestamp, mode) {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      if (mode === 'date') {
        return year + '-' + month + '-' + day;
      }

      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
    }

    // Convert inline markdown to HTML
    // Handles: **bold**, *italic*, __underline__, ~~strike~~, ==highlight==, \`code\`, [link](url)
    function inlineMarkdownToHtml(text) {
      if (!text) return '';
      var html = text;
      // Escape HTML entities first (but preserve our markdown)
      html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // Links [text](url) - do first to avoid interference
      html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      // Bold **text** - non-greedy to handle nested/adjacent
      html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      // Italic *text* - non-greedy
      html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
      // Underline __text__ - non-greedy
      html = html.replace(/__(.+?)__/g, '<u>$1</u>');
      // Strikethrough ~~text~~ - non-greedy
      html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
      // Highlight ==text== - non-greedy
      html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');
      // Inline code \`text\`
      html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
      // Convert newlines to <br>
      html = html.replace(/\\n/g, '<br>');
      return html;
    }

    function formatText(str) {
      if (!str) return '';
      // First convert markdown to HTML, then sanitize
      var html = inlineMarkdownToHtml(str);
      // Use DOMPurify for secure HTML sanitization
      // Allow only safe inline formatting tags, no attributes except href on links
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'code', 'br', 'a', 'u', 's', 'mark', 'sub', 'sup'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ALLOW_DATA_ATTR: false,
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'svg', 'math'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
      });
    }

    function renderListNodes(nodes, tag, alignClass) {
      return '<' + tag + (alignClass ? ' class="' + alignClass + '"' : '') + '>' +
        nodes.map(function(node) {
          var task = node.task
            ? '<input type="checkbox" disabled' + (node.done ? ' checked' : '') + '> '
            : '';
          var children = (node.children && node.children.length)
            ? renderListNodes(node.children, tag, '')
            : '';
          return '<li' + (node.task ? ' class="task-item"' : '') + '>' +
            task + formatText(node.c) + children + '</li>';
        }).join('') +
        '</' + tag + '>';
    }

    // Structure fields that land in attribute/tag positions must never reach the
    // HTML string raw: the runtime decodes whatever envelope it is handed, including
    // a hand-crafted one that never passed the encoder's schema pass. Allowlist /
    // coerce them here (align, heading level, spacer height) so a fabricated block
    // cannot break out of its attribute and inject an event handler.
    const SAFE_ALIGN = { left: 1, center: 1, right: 1, justify: 1 };
    function alignClassOf(block) {
      // hasOwnProperty so inherited keys (toString/constructor/__proto__) never
      // match — the guard must be an allowlist, not a truthy prototype lookup.
      return (block.align && Object.prototype.hasOwnProperty.call(SAFE_ALIGN, block.align))
        ? ' text-' + block.align : '';
    }
    function safeLevel(l) {
      const n = parseInt(l, 10);
      return (n >= 1 && n <= 6) ? n : 2;
    }
    function safeSpacerHeight(h) {
      const n = parseInt(h, 10);
      return (n >= 0 && n <= 400) ? n : 40;
    }

    function renderBlock(block) {
      const alignClass = alignClassOf(block);

      switch(block.t) {
        case 'h':
          const level = safeLevel(block.l);
          return '<h' + level + ' class="' + alignClass + '">' + formatText(block.c) + '</h' + level + '>';
        case 'p':
          return '<p class="' + alignClass + '">' + formatText(block.c) + '</p>';
        case 'a':
          return '<a href="' + escapeHtml(safeHref(block.url)) + '" target="_blank" rel="noopener noreferrer" class="link-card">' +
            '<div class="link-inner">' +
            (block.icon ? '<span class="link-icon">' + escapeHtml(block.icon) + '</span>' : '') +
            '<div>' +
            '<div class="link-title">' + escapeHtml(block.title) + '</div>' +
            (block.desc ? '<div class="link-desc">' + escapeHtml(block.desc) + '</div>' : '') +
            '</div></div></a>';
        case 'code':
          return '<div class="code-wrapper">' +
            (block.lang ? '<div class="code-lang">' + escapeHtml(block.lang) + '</div>' : '') +
            '<pre><code>' + escapeHtml(block.c) + '</code></pre></div>';
        case 'q':
          return '<blockquote><p>' + formatText(block.c) + '</p>' +
            (block.src ? '<cite class="quote-source">— ' + escapeHtml(block.src) + '</cite>' : '') +
            '</blockquote>';
        case 'list':
          const tag = block.ordered ? 'ol' : 'ul';
          // the nodes tree (nesting + task state) takes priority; items[] = fallback
          const listTree = (block.nodes && block.nodes.length)
            ? block.nodes
            : (block.items || []).map(function(c) { return { c: c }; });
          return renderListNodes(listTree, tag, alignClass);
        case 'hr':
          return '<hr>';
        case 'space':
          return '<div style="height:' + safeSpacerHeight(block.h) + 'px"></div>';
        case 'img':
          if (!block.d) return '';
          return '<figure><img src="' + escapeHtml(safeImgSrc(block.d)) + '" alt="' + escapeHtml(block.alt || '') + '">' +
            (block.cap ? '<figcaption>' + escapeHtml(block.cap) + '</figcaption>' : '') + '</figure>';
        case 'tbl':
          return '<div class="table-wrapper"><table>' +
            '<thead><tr>' + (block.headers || []).map(function(h) {
              return '<th>' + escapeHtml(h) + '</th>';
            }).join('') + '</tr></thead>' +
            '<tbody>' + (block.rows || []).map(function(row) {
              return '<tr>' + row.map(function(cell) {
                return '<td>' + escapeHtml(cell) + '</td>';
              }).join('') + '</tr>';
            }).join('') + '</tbody></table></div>';
        default:
          return '';
      }
    }

    function renderPage(result) {
      const { page, verified, signatureInvalid, partialSigned, fingerprint, publicKey } = result;
      const style = page.style || {};
      const meta = page.meta || {};

      // The signed title is authoritative at runtime: the static <title>
      // of the HTML shell is not covered by the signature and can be
      // spoofed, so sync it from the decoded (and, when signed, verified)
      // page metadata. Invalid signatures get a loud prefix.
      if (typeof meta.title === 'string' && meta.title) {
        document.title = (signatureInvalid ? '⚠ ' : '') + meta.title;
      } else if (signatureInvalid) {
        document.title = '⚠ ' + document.title;
      }

      // Apply theme class to body. ALTWEB is light-first: anything that is not
      // explicitly 'dark' renders light (adding .theme-light neutralizes the
      // prefers-color-scheme:dark media queries), so an 'auto'/unset capsule
      // does NOT flip to dark just because the reader's OS is in dark mode.
      if (style.theme === 'dark') {
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.add('theme-light');
      }

      // Apply custom colors
      if (style.bg) document.body.style.backgroundColor = style.bg;
      if (style.fg) document.body.style.color = style.fg;

      // Apply theme-aware accent color
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const accentHex = getAccentHex(style.accent, style.theme || 'auto', prefersDark);
      document.documentElement.style.setProperty('--accent-color', accentHex);

      // Determine max width class
      const maxWClass = { sm: 'max-sm', md: 'max-md', lg: 'max-lg', xl: 'max-xl' }[style.maxW] || 'max-md';

      // Determine font class
      const fontClass = { sans: 'font-sans', serif: 'font-serif', mono: 'font-mono' }[style.font] || 'font-sans';

      let html = '<div class="page-wrapper ' + fontClass + '">';

      // Signature header: three states — verified (green), invalid (red
      // banner), unsigned (no badge at all).
      if (verified && fingerprint) {
        const sigLabel = partialSigned ? T.metaUnsigned : T.verified;
        html += '<div class="sig-header"><div class="sig-content page-container ' + maxWClass + '">' +
          '<span>' + sigLabel + '</span>' +
          '<code class="sig-fingerprint">' + escapeHtml(fingerprint) + '</code>' +
          (publicKey
            ? '<details class="sig-key"><summary>' + T.publicKeyLabel + '</summary>' +
              '<code>' + escapeHtml(publicKey) + '</code></details>'
            : '') +
          '</div>' +
          '<div class="sig-note page-container ' + maxWClass + '">' + T.independentNote + '</div>' +
          '</div>';
      } else if (signatureInvalid) {
        html += '<div class="sig-header sig-invalid"><div class="sig-content page-container ' + maxWClass + '">' +
          '<span>' + T.invalidSignature + '</span>' +
          '</div>' +
          '<div class="sig-note page-container ' + maxWClass + '">' + T.independentNote + '</div>' +
          '</div>';
      }

      // Document header (3-column: logo+tagline | title | author+date)
      const header = meta.header || {};
      const hasDocHeader = header.logo || header.customText || meta.title || header.showAuthor || header.showDate;
      if (hasDocHeader) {
        html += '<div class="doc-header"><div class="page-container ' + maxWClass + '">';

        // Main row: Logo+Tagline | Document Name | Author+Date
        html += '<div class="doc-header-row">';

        // Left side: logo + tagline
        html += '<div class="doc-header-left">';
        if (header.logo) {
          html += '<img src="' + escapeHtml(safeImgSrc(header.logo)) + '" alt="Logo" class="doc-header-logo">';
        }
        if (header.customText) {
          html += '<span class="doc-header-tagline">' + escapeHtml(header.customText) + '</span>';
        }
        html += '</div>';

        // Center: Document name (title)
        html += '<div class="doc-header-center">';
        if (meta.title) {
          html += '<span class="doc-header-title">' + escapeHtml(meta.title) + '</span>';
        }
        html += '</div>';

        // Right side: author + date
        html += '<div class="doc-header-right">';
        if (header.showAuthor && meta.author) {
          html += '<span>' + escapeHtml(meta.author) + '</span>';
        }
        if (header.showDate && meta.created) {
          html += '<time datetime="' + new Date(meta.created).toISOString() + '">' +
            formatTimestamp(meta.created, 'date') + '</time>';
        }
        html += '</div>';

        html += '</div>';
        html += '</div></div>';
      }

      // Document sub-header (description as foreword - italic)
      if (meta.description) {
        html += '<div class="doc-subheader"><div class="page-container ' + maxWClass + '">';
        html += '<p class="doc-subheader-desc">' + escapeHtml(meta.description) + '</p>';
        html += '</div></div>';
      }

      // Main content
      html += '<main class="page-main"><div class="page-container ' + maxWClass + '">';

      // Page header - fallback for title/author when no doc-header (description is in sub-header)
      if (!hasDocHeader && (meta.title || meta.author)) {
        html += '<header class="page-header">';
        if (meta.title) {
          html += '<h1 class="page-title">' + escapeHtml(meta.title) + '</h1>';
        }
        if (meta.author) {
          html += '<p class="page-author">' + T.authorPrefix + ' ' + escapeHtml(meta.author) + '</p>';
        }
        html += '</header>';
      }

      // Blocks
      html += '<article>';
      (page.blocks || []).forEach(function(block) {
        html += '<div class="block">' + renderBlock(block) + '</div>';
      });
      html += '</article>';

      html += '</div></main>';

      // Document footer (Word-style: copyright + custom | links)
      const footer = meta.footer || {};
      const hasDocFooter = footer.copyright || footer.customText || (footer.links && footer.links.length > 0);
      if (hasDocFooter) {
        html += '<div class="doc-footer"><div class="page-container ' + maxWClass + '">';
        html += '<div class="doc-footer-inner">';

        // Left side: copyright + custom text
        html += '<div class="doc-footer-left">';
        if (footer.copyright) {
          html += '<span>' + escapeHtml(footer.copyright) + '</span>';
        }
        if (footer.customText) {
          html += '<span>' + escapeHtml(footer.customText) + '</span>';
        }
        html += '</div>';

        // Right side: links
        if (footer.links && footer.links.length > 0) {
          html += '<div class="doc-footer-links">';
          footer.links.forEach(function(link) {
            html += '<a href="' + escapeHtml(safeHref(link.url)) + '" target="_blank" rel="noopener noreferrer">' +
              escapeHtml(link.label) + '</a>';
          });
          html += '</div>';
        }

        html += '</div></div></div>';
      }

      // Footer (powered by + timestamp)
      const showPoweredBy = footer.poweredBy !== false;
      html += '<footer class="page-footer"><div class="page-container ' + maxWClass + '">';
      html += '<div class="footer-content">';
      if (showPoweredBy) {
        html += '<span>ALTWEB</span>';
      }

      // Timestamp display
      if (style.showTimestamp && style.showTimestamp !== 'none' && meta.modified) {
        if (showPoweredBy) {
          html += '<span class="footer-dot">•</span>';
        }
        html += '<time class="footer-timestamp" datetime="' + new Date(meta.modified).toISOString() + '">';
        html += formatTimestamp(meta.modified, style.showTimestamp);
        html += '</time>';
      }

      html += '</div></div></footer>';

      html += '</div>';
      app.innerHTML = html;
    }

    async function showPasswordModal() {
      // Check envelope for signature and visible meta
      let hasSignature = false;
      let visibleMeta = null;
      try {
        const envelopeBytes = b64urlDecode(DATA);
        const envelopeJson = new TextDecoder().decode(envelopeBytes);
        const envelope = JSON.parse(envelopeJson);
        hasSignature = !!envelope.s;
        visibleMeta = await getVisibleMeta();
      } catch (e) {
        console.error('Error parsing envelope:', e);
      }

      // Build header HTML based on visible meta
      let headerHtml;
      if (visibleMeta && visibleMeta.meta) {
        const meta = visibleMeta.meta;
        headerHtml = \`
          <div class="decrypt-header decrypt-header-meta">
            <div class="meta-row">
              <div class="meta-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
              <div class="meta-info">
                <h1 class="meta-title">\${escapeHtml(meta.title) || T.encryptedContent}</h1>
                \${meta.description ? '<p class="meta-desc">' + escapeHtml(meta.description) + '</p>' : ''}
                \${meta.author ? '<p class="meta-author">' + T.authorPrefix + ' ' + escapeHtml(meta.author) + '</p>' : ''}
              </div>
            </div>
          </div>
        \`;
      } else {
        headerHtml = \`
          <div class="decrypt-header">
            <div class="decrypt-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <h1 class="decrypt-title">\${T.encryptedContent}</h1>
            <p class="decrypt-subtitle">\${T.enterPassword}</p>
          </div>
        \`;
      }

      app.innerHTML = \`
        <div class="decrypt-screen">
          <div class="decrypt-container">
            <div class="decrypt-card">
              \${headerHtml}

              <form class="decrypt-form" id="decrypt-form">
                <div>
                  <label class="form-label">\${T.passwordLabel}</label>
                  <div class="input-wrapper">
                    <input
                      type="password"
                      id="password"
                      class="decrypt-input"
                      placeholder="\${T.passwordPlaceholder}"
                      autofocus
                    >
                    <button type="button" id="toggle-pwd" class="toggle-password"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></button>
                  </div>
                </div>

                <div id="error" class="decrypt-error" style="display:none"></div>

                <button type="submit" id="submit" class="decrypt-button">\${T.decrypt}</button>
              </form>

              \${hasSignature ? \`
                <div class="decrypt-footer">
                  <div class="signed-badge">
                    <svg class="check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>\${T.signed}</span>
                  </div>
                </div>
              \` : ''}
            </div>

            <div class="decrypt-branding">
              <p><strong>ALTWEB</strong> — \${T.branding}</p>
            </div>
          </div>
        </div>
      \`;

      let showPwd = false;
      const pwdInput = document.getElementById('password');
      const toggleBtn = document.getElementById('toggle-pwd');

      toggleBtn.onclick = () => {
        showPwd = !showPwd;
        pwdInput.type = showPwd ? 'text' : 'password';
        toggleBtn.innerHTML = showPwd
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      };

      const submit = async (e) => {
        if (e) e.preventDefault();
        const pwd = pwdInput.value;
        const errEl = document.getElementById('error');
        const submitBtn = document.getElementById('submit');

        if (!pwd.trim()) return;

        submitBtn.disabled = true;
        submitBtn.textContent = T.decrypting;

        try {
          const result = await decodePage(pwd);
          renderPage(result);
        } catch (err) {
          console.error('Decryption error:', err);
          errEl.textContent = err.message || T.wrongPassword;
          errEl.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = T.decrypt;
        }
      };

      document.getElementById('decrypt-form').onsubmit = submit;
    }

    async function init() {
      try {
        if (IS_ENCRYPTED) {
          await showPasswordModal();
        } else {
          const result = await decodePage();
          renderPage(result);
        }
      } catch (e) {
        app.innerHTML = '<div class="page-main"><div class="page-container max-md"><p class="error">' + T.error + ': ' + escapeHtml(e.message) + '</p></div></div>';
      }
    }

    init();
  })();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function downloadStandaloneHTML(options: StandaloneOptions): void {
  const html = generateStandaloneHTML(options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `altweb-page-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
