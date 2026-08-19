/**
 * Export flow: blocks -> AltPage -> encodePage (optional encrypt + sign)
 * -> standalone .altweb.html download, shareable URL, QR code.
 */

import { useEffect, useState } from 'react';
import {
  encodePage,
  generateFullUrl,
  generateStandaloneHTML,
  calculateUrlSize,
  formatSize,
  getSizeWarningKey,
  deriveIdentityFromPassphrase,
  type ContentBlock,
  type DerivedIdentity,
} from '@altweb/core';
import QRCode from 'qrcode';
import { Check, Copy, Download, Fingerprint, Lock } from 'lucide-react';
import { Modal } from './Modal';
import { buildPage, firstHeadingText, slugify } from '../core/capsule';
import { saveIdentity, type SavedIdentity } from '../core/identity';

const SIZE_WARNINGS: Record<string, string> = {
  over15kb: 'Large URL — some apps truncate long links. The downloaded file always works.',
  over100kb: 'Very large URL — prefer sharing the downloaded .altweb.html file.',
  over2mb: 'The URL exceeds practical limits — share the downloaded file instead.',
};

interface ExportResult {
  hash: string;
  url: string;
  title: string;
  encrypted: boolean;
  fingerprint?: string;
  sizeLabel: string;
  sizeWarning: string | null;
  qrDataUrl?: string;
  qrError?: string;
}

interface ExportPanelProps {
  getBlocks: () => ContentBlock[];
  savedIdentity: SavedIdentity | null;
  unlockedIdentity: DerivedIdentity | null;
  onIdentityUnlocked: (identity: DerivedIdentity, saved: SavedIdentity) => void;
  onClose: () => void;
}

export function ExportPanel({
  getBlocks,
  savedIdentity,
  unlockedIdentity,
  onIdentityUnlocked,
  onClose,
}: ExportPanelProps) {
  const [blocks] = useState<ContentBlock[]>(() => getBlocks());
  const [title, setTitle] = useState(() => firstHeadingText(blocks) ?? '');
  const [password, setPassword] = useState('');
  const [signEnabled, setSignEnabled] = useState(false);
  const [signPassphrase, setSignPassphrase] = useState('');
  const [baseUrl, setBaseUrl] = useState(() => window.location.origin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [copied, setCopied] = useState(false);

  // A new capsule invalidates the previous result
  useEffect(() => {
    setResult(null);
    setCopied(false);
  }, [title, password, signEnabled, signPassphrase, baseUrl]);

  const createCapsule = async () => {
    setBusy(true);
    setError(null);
    try {
      if (blocks.length === 0) {
        throw new Error('The document is empty — write something first.');
      }

      let identity: DerivedIdentity | null = unlockedIdentity;
      if (signEnabled && !identity) {
        if (!signPassphrase) {
          throw new Error('Enter your identity passphrase to sign the capsule.');
        }
        identity = await deriveIdentityFromPassphrase(signPassphrase);
        if (savedIdentity && savedIdentity.fingerprint !== identity.fingerprint) {
          throw new Error(
            `Passphrase mismatch: derived ${identity.fingerprint}, but the saved identity is ` +
            `${savedIdentity.fingerprint}. Wrong passphrase? (Forget the saved identity if you changed it.)`
          );
        }
        onIdentityUnlocked(identity, saveIdentity(identity));
      }

      const page = buildPage(blocks, title);
      const hash = await encodePage(page, {
        ...(password ? { password } : {}),
        ...(signEnabled && identity ? { signingKeyPair: identity.keyPair } : {}),
      });

      const cleanBase = baseUrl.trim().replace(/\/+$/, '') || window.location.origin;
      const url = generateFullUrl(hash, cleanBase);
      const size = calculateUrlSize(hash, cleanBase);
      const warningKey = getSizeWarningKey(size);

      const exportResult: ExportResult = {
        hash,
        url,
        title: title.trim() || 'Untitled capsule',
        encrypted: Boolean(password),
        fingerprint: signEnabled && identity ? identity.fingerprint : undefined,
        sizeLabel: formatSize(size),
        sizeWarning: warningKey ? SIZE_WARNINGS[warningKey] : null,
      };

      try {
        exportResult.qrDataUrl = await QRCode.toDataURL(url, {
          errorCorrectionLevel: 'L',
          margin: 1,
          width: 220,
          color: { dark: '#171717', light: '#ffffff' },
        });
      } catch {
        exportResult.qrError = 'URL too large for a QR code — use the link or the file.';
      }

      setResult(exportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const downloadCapsule = () => {
    if (!result) return;
    const html = generateStandaloneHTML({
      hash: result.hash,
      title: result.title,
      isEncrypted: result.encrypted,
      lang: 'en',
    });
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slugify(result.title)}.altweb.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyUrl = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const inputClass =
    'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
    'placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none ' +
    'dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';

  return (
    <Modal
      title="Export capsule"
      subtitle="Your document becomes a self-contained, verifiable artifact."
      onClose={onClose}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Title</span>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled capsule"
          />
        </label>

        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            <Lock size={13} /> Password <span className="font-normal text-neutral-400">(optional — encrypts with AES-256-GCM)</span>
          </span>
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty for a public capsule"
            autoComplete="new-password"
          />
        </label>

        <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={signEnabled}
              onChange={(e) => setSignEnabled(e.target.checked)}
              className="h-4 w-4 accent-neutral-900 dark:accent-neutral-100"
            />
            <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <Fingerprint size={14} /> Sign (ECDSA P-256)
            </span>
          </label>
          {signEnabled ? (
            <div className="mt-2">
              {unlockedIdentity ? (
                <p className="text-sm text-neutral-500">
                  Signing as <code className="font-mono text-xs">{unlockedIdentity.fingerprint}</code>
                </p>
              ) : (
                <>
                  <input
                    className={inputClass}
                    type="password"
                    value={signPassphrase}
                    onChange={(e) => setSignPassphrase(e.target.value)}
                    placeholder="Identity passphrase"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    {savedIdentity
                      ? `Must match your saved identity ${savedIdentity.fingerprint}.`
                      : 'The same passphrase always derives the same identity.'}
                  </p>
                </>
              )}
            </div>
          ) : null}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Base URL <span className="font-normal text-neutral-400">(for the shareable link)</span>
          </span>
          <input
            className={inputClass}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={window.location.origin}
          />
        </label>

        {error ? (
          <p className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={createCapsule}
          disabled={busy}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {busy ? 'Creating…' : 'Create capsule'}
        </button>

        {result ? (
          <div className="space-y-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Payload: <strong>{result.sizeLabel}</strong>
              {result.encrypted ? ' · encrypted' : ''}
              {result.fingerprint ? (
                <>
                  {' · signed '}
                  <code className="font-mono text-xs">{result.fingerprint}</code>
                </>
              ) : ''}
            </p>
            {result.sizeWarning ? (
              <p className="text-xs text-neutral-500">{result.sizeWarning}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadCapsule}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <Download size={14} /> Download .altweb.html
              </button>
              <button
                type="button"
                onClick={copyUrl}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy URL'}
              </button>
            </div>

            {result.qrDataUrl ? (
              <div className="flex justify-center rounded-md border border-neutral-100 bg-white p-3 dark:border-neutral-800">
                <img src={result.qrDataUrl} alt="QR code for the capsule URL" width={220} height={220} />
              </div>
            ) : result.qrError ? (
              <p className="text-xs text-neutral-500">{result.qrError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
