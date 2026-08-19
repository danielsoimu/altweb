/**
 * Identity mini-panel: derive a deterministic signing identity from a
 * passphrase. Persists ONLY the public key + fingerprint (localStorage),
 * mirroring the CLI's ~/.altweb/identity.json.
 */

import { useState } from 'react';
import {
  deriveIdentityFromPassphrase,
  validateIdentityPassphrase,
  type DerivedIdentity,
  type PassphraseFeedbackKey,
} from '@altweb/core';
import { Check, Copy, Fingerprint, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { forgetIdentity, saveIdentity, type SavedIdentity } from '../core/identity';

const STRENGTH_LABELS: Record<PassphraseFeedbackKey, string> = {
  empty: '',
  tooShort: 'Too short',
  weak: 'Weak',
  acceptable: 'Acceptable',
  good: 'Good',
  excellent: 'Excellent',
};

interface IdentityPanelProps {
  savedIdentity: SavedIdentity | null;
  unlockedIdentity: DerivedIdentity | null;
  onIdentityUnlocked: (identity: DerivedIdentity, saved: SavedIdentity) => void;
  onForget: () => void;
  onClose: () => void;
}

export function IdentityPanel({
  savedIdentity,
  unlockedIdentity,
  onIdentityUnlocked,
  onForget,
  onClose,
}: IdentityPanelProps) {
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const strength = validateIdentityPassphrase(passphrase);
  const fingerprint = unlockedIdentity?.fingerprint ?? savedIdentity?.fingerprint ?? null;

  const derive = async () => {
    setBusy(true);
    setError(null);
    try {
      const identity = await deriveIdentityFromPassphrase(passphrase);
      if (savedIdentity && savedIdentity.fingerprint !== identity.fingerprint) {
        throw new Error(
          `Derived fingerprint ${identity.fingerprint} does not match the saved identity ` +
          `${savedIdentity.fingerprint}. Wrong passphrase? (Forget the saved identity if you changed it.)`
        );
      }
      const saved = saveIdentity(identity);
      onIdentityUnlocked(identity, saved);
      setPassphrase('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not derive the identity.');
    } finally {
      setBusy(false);
    }
  };

  const copyPublicKey = async () => {
    const publicKey = unlockedIdentity?.publicKeyBase64 ?? savedIdentity?.publicKey;
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const inputClass =
    'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
    'placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none ' +
    'dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';

  return (
    <Modal
      title="Identity"
      subtitle="A deterministic ECDSA P-256 identity, derived from your passphrase."
      onClose={onClose}
    >
      <div className="space-y-4">
        {fingerprint ? (
          <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/60">
            <p className="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-neutral-200">
              <Fingerprint size={14} className="shrink-0" />
              <code className="font-mono text-xs">{fingerprint}</code>
            </p>
            <p className="text-xs text-neutral-500">
              {unlockedIdentity
                ? 'Unlocked for this session — exports can sign without re-entering the passphrase.'
                : 'Saved (public key only). Enter the passphrase below to unlock signing.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyPublicKey}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy public key'}
              </button>
              <button
                type="button"
                onClick={() => {
                  forgetIdentity();
                  onForget();
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                <Trash2 size={12} /> Forget
              </button>
            </div>
          </div>
        ) : null}

        {!unlockedIdentity ? (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Passphrase
              </span>
              <input
                className={inputClass}
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && strength.valid) void derive();
                }}
                placeholder="A long phrase only you know"
                autoComplete="off"
              />
              {passphrase ? (
                <span className="mt-1 block text-xs text-neutral-500">
                  Strength: {STRENGTH_LABELS[strength.feedbackKey]}
                </span>
              ) : null}
            </label>

            {error ? (
              <p className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void derive()}
              disabled={busy || !strength.valid}
              className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {busy ? 'Deriving…' : savedIdentity ? 'Unlock identity' : 'Derive identity'}
            </button>
          </>
        ) : null}

        <p className="text-xs leading-relaxed text-neutral-400">
          The same passphrase always produces the same keypair. Only the public key and
          fingerprint are stored in this browser — the passphrase and private key are never
          persisted anywhere.
        </p>
      </div>
    </Modal>
  );
}
