/**
 * Resolve a capsule source to its base64url hash.
 * Accepts: a standalone .altweb.html file (meta altweb-hash), a raw .altweb
 * hash file, a URL with a #hash fragment, a URL to a hosted standalone
 * artifact (fetched, hash extracted from the meta tag), or the hash itself.
 *
 * Network fetches are SSRF-guarded: private/loopback/link-local/ULA addresses
 * are refused, redirects are not followed, and the response is time- and
 * size-capped. The MCP client (an AI agent) chooses the URL, so it must be
 * treated as untrusted input. The address check runs INSIDE the connection's
 * own DNS lookup — the socket connects to the exact addresses that passed the
 * check, so a rebinding DNS server cannot answer the check with a public
 * address and the connection with a private one (TOCTOU).
 */
import { existsSync, readFileSync } from 'node:fs';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingMessage } from 'node:http';

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

function isPrivateV4(addr: string): boolean {
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

export function isPrivateAddress(addr: string): boolean {
  const lower = addr.toLowerCase();
  // v4-mapped IPv6 (::ffff:a.b.c.d): judge the embedded v4 — public stays
  // public, private stays refused. A ::ffff:-shaped address that does not
  // carry a v4 is refused outright.
  if (lower.startsWith('::ffff:')) {
    const embedded = lower.slice(7);
    return isIP(embedded) === 4 ? isPrivateV4(embedded) : true;
  }
  if (isIP(addr) === 4) return isPrivateV4(addr);
  return (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fe80:') || // link-local
    lower.startsWith('fc') || // ULA fc00::/7
    lower.startsWith('fd')
  );
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address?: unknown,
  family?: number
) => void;

/**
 * net/tls-compatible lookup that refuses private addresses at resolution
 * time. The socket connects to the very addresses this callback approves —
 * there is no second, unguarded resolution to rebind.
 */
function guardedLookup(
  hostname: string,
  options: Record<string, unknown>,
  callback: LookupCallback
): void {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses)
      ? addresses
      : [{ address: String(addresses), family: 4 }];
    for (const { address } of list) {
      if (isPrivateAddress(address)) {
        return callback(
          Object.assign(
            new Error(`${hostname} resolves to a private/internal address — refused`),
            { code: 'ERR_ALTWEB_PRIVATE_ADDRESS' }
          )
        );
      }
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

/** Fetch with the SSRF guard pinned into the socket's own DNS lookup. */
function fetchGuarded(url: URL, source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    // IP-literal URLs never hit DNS — check them up front.
    if (isIP(host) && isPrivateAddress(host)) {
      return reject(new Error(`${source}: refusing to fetch a private/internal address`));
    }

    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(
      url,
      // The type cast is unavoidable: node's LookupFunction types don't model
      // the { all: true } array form the runtime fully supports.
      { lookup: guardedLookup as never, timeout: FETCH_TIMEOUT_MS },
      (res: IncomingMessage) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return reject(new Error(`${source}: redirects are not followed (HTTP ${status})`));
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new Error(`${source}: fetch failed with HTTP ${status}`));
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_RESPONSE_BYTES) {
            req.destroy();
            return reject(
              new Error(`${source}: response exceeds the ${MAX_RESPONSE_BYTES} byte limit`)
            );
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error(`${source}: fetch timed out`)));
    req.on('error', reject);
    req.end();
  });
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

    return hashFromHtml(await fetchGuarded(url, source), source);
  }

  return source.replace(/^alt\s+/, '').replace(/^#/, '');
}
