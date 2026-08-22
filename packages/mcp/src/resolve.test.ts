/**
 * SSRF guard tests (audit S4): the address filter itself, the v4-mapped fix
 * (public mapped addresses pass, private ones are refused — no dead code),
 * and the guard wired into a real connection against localhost.
 */
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isPrivateAddress, resolveHash } from './resolve';

describe('isPrivateAddress', () => {
  it('refuses private/special v4 ranges', () => {
    for (const addr of [
      '0.0.0.0',
      '10.1.2.3',
      '127.0.0.1',
      '100.64.0.1', // CGNAT
      '169.254.169.254', // cloud metadata
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
    ]) {
      expect(isPrivateAddress(addr), addr).toBe(true);
    }
  });

  it('allows public v4', () => {
    for (const addr of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '169.253.1.1']) {
      expect(isPrivateAddress(addr), addr).toBe(false);
    }
  });

  it('v4-mapped: judges the embedded v4 (public passes, private refused)', () => {
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
    expect(isPrivateAddress('::FFFF:1.1.1.1')).toBe(false);
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:169.254.169.254')).toBe(true);
    // ::ffff: without an embedded v4 — refuse outright
    expect(isPrivateAddress('::ffff:dead')).toBe(true);
  });

  it('refuses v6 loopback / link-local / ULA, allows public v6', () => {
    for (const addr of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1']) {
      expect(isPrivateAddress(addr), addr).toBe(true);
    }
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
  });

  it('judges NUMERIC values, not textual prefixes (audit hardening)', () => {
    // Uncompressed / zero-padded textual variants of private addresses:
    // IP-literal URLs skip DNS entirely, so the string reaching this check
    // is attacker-formatted.
    for (const addr of [
      '0:0:0:0:0:0:0:1', // ::1 uncompressed
      '0000:0000:0000:0000:0000:0000:0000:0001',
      'FE80::1', // uppercase link-local
      '0:0:0:0:0:ffff:7f00:1', // ::ffff:127.0.0.1 in hex form
      '::127.0.0.1', // deprecated IPv4-compatible, reserved ::/96
    ]) {
      expect(isPrivateAddress(addr), addr).toBe(true);
    }
  });

  it('refuses NAT64 (64:ff9b::/96) and 6to4 (2002::/16) v4 embeddings', () => {
    for (const addr of [
      '64:ff9b::10.0.0.1',
      '64:ff9b::a00:1',
      '0064:ff9b::8.8.8.8', // zero-padded prefix, public embed — still refused
      '2002:7f00:101::', // 6to4 of 127.0.0.1
      '2002:808:808::1',
    ]) {
      expect(isPrivateAddress(addr), addr).toBe(true);
    }
  });

  it('fails closed on malformed v6-shaped strings', () => {
    for (const addr of ['fe80::1%eth0', ':::', '1:2:3:4:5:6:7:8:9', 'gggg::1', 'not-an-ip']) {
      expect(isPrivateAddress(addr), addr).toBe(true);
    }
  });
});

describe('resolveHash network guard', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<meta name="altweb-hash" content="abc123">');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(() => server.close());

  it('refuses IP-literal private URLs before connecting', async () => {
    await expect(resolveHash(`http://127.0.0.1:${port}/x.html`)).rejects.toThrow(
      /private\/internal/
    );
  });

  it('refuses hostnames that resolve to private addresses (pinned lookup)', async () => {
    // "localhost" resolves via the real system resolver to 127.0.0.1/::1 —
    // the guard must reject inside the connection's own lookup.
    await expect(resolveHash(`http://localhost:${port}/x.html`)).rejects.toThrow(
      /private\/internal/
    );
  });

  it('still returns the fragment directly for #hash URLs (no fetch at all)', async () => {
    await expect(resolveHash('http://127.0.0.1/#somehash123')).resolves.toBe('somehash123');
  });
});
