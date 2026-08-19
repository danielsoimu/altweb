/**
 * ALTWEB Editor — write markdown beautifully, export it as a signed
 * context capsule. Fully local: no fonts CDN, no analytics, no API calls.
 */

import { useEffect, useRef, useState } from 'react';
import type { DerivedIdentity } from '@altweb/core';
import type { EditorInstance, JSONContent } from 'novel';
import {
  FolderOpen,
  Fingerprint,
  Lock,
  Moon,
  Package,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sun,
  X,
} from 'lucide-react';
import { Editor } from './components/Editor';
import { ExportPanel } from './components/ExportPanel';
import { OpenPanel } from './components/OpenPanel';
import { IdentityPanel } from './components/IdentityPanel';
import { convertEditorContent } from './core/tiptapToAltweb';
import { loadSavedIdentity, type SavedIdentity } from './core/identity';
import type { Provenance } from './core/provenance';

const THEME_KEY = 'altweb.editor.theme';

type Panel = 'export' | 'open' | 'identity' | null;

function ProvenanceStrip({ provenance, onDismiss }: { provenance: Provenance; onDismiss: () => void }) {
  let Icon = ShieldQuestion;
  let text = 'Opened capsule — unsigned';
  if (provenance.signed && provenance.verified === true) {
    Icon = ShieldCheck;
    text = `Opened capsule — signed and verified · ${provenance.fingerprint}`;
  } else if (provenance.signed && provenance.verified === false) {
    Icon = ShieldAlert;
    text = 'Opened capsule — signature INVALID';
  } else if (provenance.signed) {
    Icon = ShieldQuestion;
    text = `Opened capsule — signed · ${provenance.fingerprint}`;
  }

  return (
    <div className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2 text-xs text-neutral-600 sm:px-6 dark:text-neutral-300">
        <Icon size={14} className="shrink-0" />
        <span className="min-w-0 truncate">
          {provenance.title ? `"${provenance.title}" · ` : ''}
          {text}
          {provenance.encrypted ? ' · was encrypted' : ''}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto shrink-0 rounded p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          aria-label="Dismiss provenance banner"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

const DOCS = 'https://altweb.software';

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-500">
        {title}
      </h2>
      {links.map(([label, href]) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          {label}
        </a>
      ))}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  );
  const [panel, setPanel] = useState<Panel>(null);
  const [initialDoc, setInitialDoc] = useState<JSONContent | undefined>(undefined);
  const [docKey, setDocKey] = useState(0);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [savedIdentity, setSavedIdentity] = useState<SavedIdentity | null>(loadSavedIdentity);
  const [unlockedIdentity, setUnlockedIdentity] = useState<DerivedIdentity | null>(null);
  const editorRef = useRef<EditorInstance | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const getBlocks = () => {
    const editor = editorRef.current;
    if (!editor) return [];
    return convertEditorContent(editor.getJSON());
  };

  const handleCapsuleOpen = (doc: JSONContent, capsuleProvenance: Provenance) => {
    setInitialDoc(doc);
    setDocKey((key) => key + 1);
    setProvenance(capsuleProvenance);
    setPanel(null);
  };

  const handleIdentityUnlocked = (identity: DerivedIdentity, saved: SavedIdentity) => {
    setUnlockedIdentity(identity);
    setSavedIdentity(saved);
  };

  const handleIdentityForgotten = () => {
    setUnlockedIdentity(null);
    setSavedIdentity(null);
  };

  const headerButton =
    'inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm ' +
    'font-medium text-neutral-700 transition-colors hover:bg-neutral-100 ' +
    'dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800';

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2" aria-label="ALTWEB">
            <img src="/favicon.svg" alt="" width="24" height="24" className="h-6 w-6" />
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-bold tracking-[0.2em]">ALTWEB</span>
              <span className="text-sm text-neutral-400">editor</span>
            </span>
          </div>
          <nav className="flex items-center gap-2" aria-label="Main actions">
            <button type="button" className={headerButton} onClick={() => setPanel('open')}>
              <FolderOpen size={15} />
              <span className="hidden sm:inline">Open</span>
            </button>
            <button type="button" className={headerButton} onClick={() => setPanel('export')}>
              <Package size={15} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              type="button"
              className={headerButton}
              onClick={() => setPanel('identity')}
              title={savedIdentity ? `Identity ${savedIdentity.fingerprint}` : 'Identity'}
            >
              <Fingerprint size={15} />
              {savedIdentity ? (
                <code className="hidden font-mono text-xs text-neutral-500 md:inline">
                  {savedIdentity.fingerprint.slice(0, 11)}
                </code>
              ) : (
                <span className="hidden sm:inline">Identity</span>
              )}
              {unlockedIdentity ? <Lock size={11} className="text-neutral-400" /> : null}
            </button>
            <button
              type="button"
              className={headerButton}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </nav>
        </div>
      </header>

      {provenance ? (
        <ProvenanceStrip provenance={provenance} onDismiss={() => setProvenance(null)} />
      ) : null}

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Editor
          key={docKey}
          initialContent={initialDoc}
          onReady={(editor) => {
            editorRef.current = editor;
          }}
        />
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6">
          <div className="flex flex-wrap justify-between gap-x-10 gap-y-8">
            <div className="max-w-xs">
              <span className="inline-flex items-center gap-2 text-sm font-bold tracking-[0.18em]">
                <img src="/favicon.svg" alt="" width="22" height="22" className="h-[22px] w-[22px]" />
                ALTWEB
              </span>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                Signed context capsules for AI agents. Verify before you inject.
              </p>
              <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
                Made with <span className="text-[#e0245e]">♥</span> by Daniel &amp; Claude
              </p>
            </div>
            <nav className="flex flex-wrap gap-10" aria-label="Footer">
              <FooterColumn
                title="Product"
                links={[
                  ['Quickstart', `${DOCS}/quickstart/`],
                  ['Editor', `${DOCS}/editor/`],
                  ['Live demo', `${DOCS}/demo/`],
                ]}
              />
              <FooterColumn
                title="Reference"
                links={[
                  ['CLI', `${DOCS}/cli/`],
                  ['MCP loader', `${DOCS}/mcp-loader/`],
                  ['Security model', `${DOCS}/security-model/`],
                ]}
              />
              <FooterColumn
                title="Project"
                links={[
                  ['FAQ', `${DOCS}/faq/`],
                  ['Credits', `${DOCS}/credits/`],
                  ['GitHub', 'https://github.com/danielsoimu/altweb'],
                ]}
              />
            </nav>
          </div>

          <p className="mt-8 border-t border-neutral-100 pt-5 text-center text-xs leading-relaxed text-neutral-400 dark:border-neutral-900 dark:text-neutral-500">
            © 2026 Daniel C. ȘOIMU · Dual-licensed{' '}
            <a
              href="https://github.com/danielsoimu/altweb/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              AGPL-3.0-or-later
            </a>{' '}
            +{' '}
            <a
              href={`${DOCS}/faq/#how-is-altweb-licensed`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              commercial
            </a>{' '}
            ·{' '}
            <a
              href="mailto:daniel@soimu.ro"
              className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              daniel@soimu.ro
            </a>
          </p>
        </div>
      </footer>

      {panel === 'export' ? (
        <ExportPanel
          getBlocks={getBlocks}
          savedIdentity={savedIdentity}
          unlockedIdentity={unlockedIdentity}
          onIdentityUnlocked={handleIdentityUnlocked}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel === 'open' ? (
        <OpenPanel onOpen={handleCapsuleOpen} onClose={() => setPanel(null)} />
      ) : null}
      {panel === 'identity' ? (
        <IdentityPanel
          savedIdentity={savedIdentity}
          unlockedIdentity={unlockedIdentity}
          onIdentityUnlocked={handleIdentityUnlocked}
          onForget={handleIdentityForgotten}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </div>
  );
}
