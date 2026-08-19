/**
 * Resolve a capsule source to its base64url hash.
 * Accepts: a standalone .altweb.html file (meta altweb-hash), a raw .altweb
 * hash file, a URL with a #hash fragment, a URL to a hosted standalone
 * artifact (fetched, hash extracted from the meta tag), or the hash itself.
 *
 * Network fetches are SSRF-guarded: the hostname is resolved first and
 * private/loopback/link-local/ULA addresses are refused, redirects are not
 * followed, and the response is time- and size-capped. The MCP client (an
 * AI agent) chooses the URL, so it must be treated as untrusted input.
 */
import { existsSync, readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const HASH_META_RE = /<meta name="altweb-hash" content="([A-Za-z0-9_-]+)">/;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function hashFromHtml(html: string, source: string): string {
  const match = html.match(HASH_META_RE);
  if (!match) {
    throw new Error(
      `${source}: no altweb-hash meta tag found — not a standalone ALTWEB capsule`
    );
  }
  return match[1];
}

function isPrivateAddress(addr: string): boolean {
  if (isIP(addr) === 4) {
    const [a, b] = addr.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const lower = addr.toLowerCase();
  return (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fe80:') || // link-local
    lower.startsWith('fc') || // ULA fc00::/7
    lower.startsWith('fd') ||
    lower.startsWith('::ffff:') // v4-mapped — re-checked below via embedded v4
  );
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new Error(`${url}: refusing to fetch a private/internal address`);
    }
    return;
  }
  const results = await lookup(host, { all: true });
  for (const { address } of results) {
    const embedded = address.toLowerCase().startsWith('::ffff:')
      ? address.slice(7)
      : address;
    if (isPrivateAddress(address) || (isIP(embedded) === 4 && isPrivateAddress(embedded))) {
      throw new Error(
        `${url}: refusing to fetch — ${host} resolves to a private/internal address`
      );
    }
  }
}

async function readCapped(res: Response, source: string): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_RESPONSE_BYTES) {
      reader.cancel().catch(() => {});
      throw new Error(`${source}: response exceeds the ${MAX_RESPONSE_BYTES} byte limit`);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(merged);
}

export async function resolveHash(source: string): Promise<string> {
  if (existsSync(source)) {
    const content = readFileSync(source, 'utf8').trim();
    if (content.startsWith('<')) return hashFromHtml(content, source);
    // .altweb or plain text file holding a raw hash (tolerates the "alt " prefix)
    return content.replace(/^alt\s+/, '');
  }

  if (source.startsWith('http://') || source.startsWith('https://')) {
    const url = new URL(source);
    const fragment = source.split('#')[1];
    if (fragment) return fragment;

    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`${source}: fetch failed with HTTP ${res.status}`);
    }
    return hashFromHtml(await readCapped(res, source), source);
  }

  return source.replace(/^alt\s+/, '').replace(/^#/, '');
}
