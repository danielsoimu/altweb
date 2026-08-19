# altweb-context — MCP server for signed context capsules

Load ALTWEB capsules into AI agents with **verification before injection**:
content is returned only when the capsule is signed, the signature verifies,
and the signer's public key is in your local trust file. Everything else is
refused with an explicit reason — and the refusal is the default: an empty
trust file rejects every capsule, signed or not.

## Why

The context that steers an agent — instructions, personas, skills, memory —
is usually plain Markdown with no provenance, so anything that can write it
can poison it. A capsule is Markdown compiled into a self-contained artifact
with an ECDSA P-256 signature. This server is the gatekeeper: your agent
loads only context signed by keys you trust, and refuses the rest at load
time before any content reaches the model.

## Tools

| Tool | What it does |
|---|---|
| `load_capsule` | Verify + return markdown content (refuses unsigned / tampered / untrusted) |
| `verify_capsule` | Provenance report (signed? verified? trusted? encrypted?) without content |
| `list_trusted_keys` | Show the signers currently trusted |

`source` accepts: a `.altweb.html` file path, a raw `.altweb` hash file, a URL
with `#hash`, a URL to a hosted standalone capsule, or the hash string itself.

## Trust file

`~/.altweb/trusted-keys.json` (override with `ALTWEB_TRUST_FILE`):

```json
{
  "keys": [
    {
      "name": "Alice",
      "publicKey": "<base64url SPKI public key>",
      "fingerprint": "ab:12:cd:34:ef:56:78:90"
    }
  ]
}
```

Trust is matched on the **full public key** (the same base64url SPKI string a
capsule carries in its envelope). The 8-byte fingerprint printed by
`altweb keygen`/`verify` is a human-readable label only — 64 bits is too
short to anchor trust — so entries without `publicKey` are never matched.
The easiest way to trust a signer: attempt `load_capsule` once and copy the
ready-made entry from the `UNTRUSTED_KEY` refusal message (it includes the
full public key), or take `publicKey` from the signer's
`~/.altweb/identity.json`.

## Setup (Claude Code example)

```bash
npm run build -w @altweb/mcp
claude mcp add altweb-context -- node /path/to/altweb/packages/mcp/dist/altweb-context.mjs
```

Or in any MCP client config:

```json
{
  "mcpServers": {
    "altweb-context": {
      "command": "node",
      "args": ["/path/to/altweb/packages/mcp/dist/altweb-context.mjs"]
    }
  }
}
```

## Guarantees and limits

- A valid signature proves **who** authored the capsule and that the bytes are
  intact — it does not make the content safe. Trust decisions stay with you:
  the trust file is the policy.
- Encrypted capsules need the `password` argument; the signature covers the
  decrypted payload, so verification happens after decryption.
