/**
 * altweb-context — MCP server for ALTWEB signed context capsules.
 *
 * The contract is strict by design: load_capsule returns content ONLY for
 * capsules that are signed, cryptographically verified, and signed by a
 * public key present in the local trust file. Everything else is refused
 * with an explicit reason. Use verify_capsule for a provenance report
 * without loading content.
 *
 * Import order matters: node-dom MUST come first — it initializes
 * window/document (JSDOM) before dompurify self-initializes at import
 * time; otherwise sanitization does not exist under Node.
 */
import '@altweb/core/node-dom';
import {
  base64urlDecode,
  decodePage,
  inspectArtifact,
  isEncryptedContent,
  serializeToMarkdownWithMeta,
} from '@altweb/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolveHash } from './resolve';
import { findTrusted, loadTrustedKeys, trustFilePath } from './trust';

const SOURCE_DESC =
  'Capsule source: path to a .altweb.html or .altweb file, a URL with #hash, ' +
  'a URL to a hosted standalone capsule, or the raw hash string';

function refusal(reason: string, detail: string): never {
  throw new Error(`REFUSED (${reason}): ${detail}`);
}

/** Full signer public key (base64url SPKI) straight from the envelope. */
function envelopePublicKey(hash: string): string | undefined {
  try {
    const envelope = JSON.parse(new TextDecoder().decode(base64urlDecode(hash)));
    return typeof envelope?.pk === 'string' ? envelope.pk : undefined;
  } catch {
    return undefined;
  }
}

const server = new McpServer({ name: 'altweb-context', version: '1.0.0' });

server.registerTool(
  'load_capsule',
  {
    title: 'Load a signed context capsule',
    description:
      'Verify an ALTWEB capsule and, only if its signature is valid AND the signer ' +
      'fingerprint is trusted, return its markdown content. Refuses unsigned, ' +
      'tampered, and untrusted capsules.',
    inputSchema: {
      source: z.string().describe(SOURCE_DESC),
      password: z.string().optional().describe('Password for encrypted capsules'),
    },
  },
  async ({ source, password }) => {
    const hash = await resolveHash(source);
    const info = await inspectArtifact(hash);

    if (!info.signed) {
      refusal(
        'UNSIGNED',
        'this capsule carries no signature; only signed capsules can be loaded. ' +
          'Use verify_capsule for a report.'
      );
    }
    if (isEncryptedContent(hash) && !password) {
      refusal('PASSWORD_REQUIRED', 'capsule is encrypted; pass the password argument.');
    }

    const result = await decodePage(hash, password);
    if (!result.verified || !result.publicKeyFingerprint) {
      refusal('INVALID_SIGNATURE', 'signature verification failed — content may be tampered.');
    }

    // Trust is anchored on the FULL public key; the 8-byte fingerprint is
    // only a human label (64 bits is too short as a trust anchor).
    const publicKey = envelopePublicKey(hash);
    const trusted = publicKey ? findTrusted(publicKey) : undefined;
    if (!trusted) {
      refusal(
        'UNTRUSTED_KEY',
        `signature is valid (fingerprint ${result.publicKeyFingerprint}) but the signer is not in ` +
          `${trustFilePath()}. To trust this signer, add: ` +
          `{"name": "...", "fingerprint": "${result.publicKeyFingerprint}", "publicKey": "${publicKey ?? ''}"}`
      );
    }

    const markdown = serializeToMarkdownWithMeta(result.page.blocks, {
      title: result.page.meta.title,
      description: result.page.meta.description,
      author: result.page.meta.author,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text:
            `[capsule verified — signer: ${trusted.name} (${result.publicKeyFingerprint})]\n\n` +
            markdown,
        },
      ],
    };
  }
);

server.registerTool(
  'verify_capsule',
  {
    title: 'Verify a capsule and report provenance',
    description:
      'Provenance report for an ALTWEB capsule (signed? verified? trusted? encrypted?) ' +
      'without returning its content.',
    inputSchema: {
      source: z.string().describe(SOURCE_DESC),
      password: z
        .string()
        .optional()
        .describe('Password: for encrypted capsules the signature covers the decrypted payload'),
    },
  },
  async ({ source, password }) => {
    const hash = await resolveHash(source);
    const info = await inspectArtifact(hash);

    let verified: boolean | null = info.verified;
    let fingerprint = info.fingerprint;
    if (info.encrypted && info.signed && password) {
      try {
        const result = await decodePage(hash, password);
        verified = result.verified;
        fingerprint = result.publicKeyFingerprint;
      } catch {
        verified = false;
        fingerprint = undefined;
      }
    }

    const publicKey = envelopePublicKey(hash);
    const trusted = verified && publicKey ? findTrusted(publicKey) : undefined;
    const report = {
      source,
      hashLength: hash.length,
      title: info.title ?? null,
      encrypted: info.encrypted,
      signed: info.signed,
      verified,
      fingerprint: fingerprint ?? null,
      publicKey: publicKey ?? null,
      trusted: Boolean(trusted),
      signerName: trusted?.name ?? null,
      trustFile: trustFilePath(),
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }] };
  }
);

server.registerTool(
  'list_trusted_keys',
  {
    title: 'List trusted signer fingerprints',
    description: 'Show the signers currently allowed by the local trust file.',
    inputSchema: {},
  },
  async () => {
    const keys = loadTrustedKeys();
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ trustFile: trustFilePath(), keys }, null, 2),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
