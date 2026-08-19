/**
 * Open flow: drop a .altweb.html file or paste a URL/hash -> inspectArtifact
 * (provenance badge) -> decodePage (password prompt when encrypted) -> load
 * the blocks into the editor.
 */

import { useRef, useState, type DragEvent } from 'react';
import {
  inspectArtifact,
  decodePage,
  DecryptionError,
  type ArtifactInfo,
} from '@altweb/core';
import { FileUp, Lock, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { JSONContent } from 'novel';
import { Modal } from './Modal';
import { extractHash } from '../core/capsule';
import type { Provenance } from '../core/provenance';
import { altwebToTiptap } from '../core/altwebToTiptap';

interface OpenPanelProps {
  onOpen: (doc: JSONContent, provenance: Provenance) => void;
  onClose: () => void;
}

function ProvenanceBadge({ info }: { info: ArtifactInfo }) {
  const rows: { icon: typeof ShieldCheck; text: string }[] = [];

  if (info.signed && info.verified === true) {
    rows.push({ icon: ShieldCheck, text: `Signed and verified — ${info.fingerprint}` });
  } else if (info.signed && info.verified === null) {
    rows.push({
      icon: ShieldQuestion,
      text: `Signed by ${info.fingerprint} — verified after decryption`,
    });
  } else if (info.signed && info.verified === false) {
    rows.push({ icon: ShieldAlert, text: 'Signature INVALID — content may have been tampered with' });
  } else {
    rows.push({ icon: ShieldQuestion, text: 'Unsigned — authorship not provable' });
  }

  if (info.encrypted) {
    rows.push({ icon: Lock, text: 'Encrypted — password required' });
  }

  return (
    <div className="space-y-1.5 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/60">
      {info.title ? (
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{info.title}</p>
      ) : null}
      {rows.map((row, i) => {
        const Icon = row.icon;
        return (
          <p key={i} className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-300">
            <Icon size={14} className="shrink-0" /> {row.text}
          </p>
        );
      })}
    </div>
  );
}

export function OpenPanel({ onOpen, onClose }: OpenPanelProps) {
  const [input, setInput] = useState('');
  const [hash, setHash] = useState<string | null>(null);
  const [info, setInfo] = useState<ArtifactInfo | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inspect = async (raw: string) => {
    setError(null);
    setInfo(null);
    setHash(null);
    const extracted = extractHash(raw);
    if (!extracted) {
      setError('No capsule found. Paste a full URL, a raw hash, or drop a .altweb.html file.');
      return;
    }
    try {
      const artifactInfo = await inspectArtifact(extracted);
      setHash(extracted);
      setInfo(artifactInfo);
    } catch {
      setError('Not a valid ALTWEB capsule.');
    }
  };

  const readFile = async (file: File) => {
    const text = await file.text();
    setInput(file.name);
    await inspect(text);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await readFile(file);
  };

  const openCapsule = async () => {
    if (!hash || !info) return;
    setBusy(true);
    setError(null);
    try {
      const result = await decodePage(hash, info.encrypted ? password : undefined);
      const doc = altwebToTiptap(result.page.blocks) as JSONContent;
      onOpen(doc, {
        encrypted: info.encrypted,
        signed: info.signed,
        verified: info.signed ? result.verified : null,
        fingerprint: result.publicKeyFingerprint ?? info.fingerprint,
        title: result.page.meta.title,
      });
    } catch (e) {
      if (e instanceof DecryptionError) {
        setError(info.encrypted && !password ? 'This capsule is encrypted — enter the password.' : 'Incorrect password or corrupted data.');
      } else {
        setError('Could not decode this capsule.');
      }
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
    'placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none ' +
    'dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';

  return (
    <Modal
      title="Open capsule"
      subtitle="Inspect provenance before the content is loaded."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragActive
              ? 'border-neutral-500 bg-neutral-50 dark:bg-neutral-800'
              : 'border-neutral-300 dark:border-neutral-700'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <FileUp size={22} className="text-neutral-400" />
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Drop a <code className="font-mono text-xs">.altweb.html</code> file here, or click to choose
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.altweb.html,text/html"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = '';
            }}
          />
        </div>

        <div className="flex gap-2">
          <input
            className={inputClass}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void inspect(input);
            }}
            placeholder="…or paste a capsule URL / hash"
          />
          <button
            type="button"
            onClick={() => void inspect(input)}
            className="shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Inspect
          </button>
        </div>

        {info ? <ProvenanceBadge info={info} /> : null}

        {info?.encrypted ? (
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void openCapsule();
            }}
            placeholder="Password"
            autoComplete="off"
          />
        ) : null}

        {error ? (
          <p className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200">
            {error}
          </p>
        ) : null}

        {info ? (
          <button
            type="button"
            onClick={() => void openCapsule()}
            disabled={busy || (info.encrypted && !password)}
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {busy ? 'Opening…' : info.encrypted ? 'Decrypt and open' : 'Open in editor'}
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
