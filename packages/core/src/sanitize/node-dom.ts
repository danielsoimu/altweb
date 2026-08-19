/**
 * DOM shim for headless execution (CLI, extension host, Node scripts).
 *
 * DOMPurify auto-initializes AT IMPORT TIME with the existing global window,
 * so this module must be imported before any module that pulls in
 * dompurify (directly or via @altweb/core). In the browser it is a no-op.
 */
import { JSDOM } from 'jsdom';

if (typeof globalThis.window === 'undefined') {
  const dom = new JSDOM('');
  (globalThis as Record<string, unknown>).window = dom.window;
  (globalThis as Record<string, unknown>).document = dom.window.document;
}
