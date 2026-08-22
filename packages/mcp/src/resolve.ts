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

/**
 * Parse an IPv6 textual address into its 8 hextets, handling '::'
 * compression and a trailing embedded dotted-quad. Returns null when the
 * text is not a well-formed IPv6 address.
 *
 * The checks below run on NUMERIC values, not string prefixes: an IP-literal
 * URL never touches DNS (so guardedLookup cannot normalize it), and textual
 * variants like '0:0:0:0:0:0:0:1' or '0064:ff9b::1' would sail past any
 * startsWith() comparison.
 */
function parseHextets(addr: string): number[] | null {
  let s = addr;
  // Trailing dotted-quad (e.g. ::ffff:127.0.0.1 or 64:ff9b::10.0.0.1)
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    if (isIP(tail) !== 4) return null;
    const [a, b, c, d] = tail.split('.').map(Number);
    s =
      s.slice(0, lastColon + 1) +
      ((a << 8) | b).toString(16) +
      ':' +
      ((c << 8) | d).toString(16);
  }
  const doubleColons = s.split('::');
  if (doubleColons.length > 2) return null;
  const parseGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const groups: number[] = [];
    for (const g of part.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      groups.push(parseInt(g, 16));
    }
    return groups;
  };
  const head = parseGroups(doubleColons[0]);
  const tailGroups = doubleColons.length === 2 ? parseGroups(doubleColons[1]) : [];
  if (head === null || tailGroups === null) return null;
  if (doubleColons.length === 2) {
    const fill = 8 - head.length - tailGroups.length;
    if (fill < 1) return null;
    return [...head, ...new Array(fill).fill(0), ...tailGroups];
  }
  return head.length === 8 ? head : null;
}

function embeddedV4(hi: number, lo: number): string {
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

export function isPrivateAddress(addr: string): boolean {
  if (isIP(addr) === 4) return isPrivateV4(addr);

  const h = parseHextets(addr);
  // Anything v6-shaped that we cannot parse is refused (fail closed).
  if (h === null) return true;

  // Unspecified (::), loopback (::1), and the whole reserved ::/96 —
  // including deprecated IPv4-compatible forms like ::127.0.0.1 (fail closed).
  if (h.slice(0, 6).every((x) => x === 0)) return true;
  // v4-mapped ::ffff:0:0/96 — judge the embedded v4
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) {
    return isPrivateV4(embeddedV4(h[6], h[7]));
  }
  // Link-local fe80::/10
  if ((h[0] & 0xffc0) === 0xfe80) return true;
  // ULA fc00::/7
  if ((h[0] & 0xfe00) === 0xfc00) return true;
  // NAT64 well-known prefix 64:ff9b::/96 — a v4 reached through a
  // translator; the embedded target may be internal, refuse outright.
  if (h[0] === 0x0064 && h[1] === 0xff9b) return true;
  // 6to4 2002::/16 — embeds a v4 the same way; archaic for capsule
  // hosting, refuse outright.
  if (h[0] === 0x2002) return true;

  return false;
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
