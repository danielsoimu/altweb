# altweb — CLI

**Signed context capsules for AI agents — Markdown compiled into self-contained,
verifiable, optionally encrypted artifacts + an MCP loader that refuses unsigned
or untrusted context. Verify before you inject.**

This is the command line. Full docs: **[altweb.software](https://altweb.software)** ·
Source: [github.com/danielsoimu/altweb](https://github.com/danielsoimu/altweb) ·
MCP loader: [`altweb-context`](https://www.npmjs.com/package/altweb-context)

## Quick start

```bash
# verify a capsule — file, #hash URL, or raw hash; fully offline, no network
npx altweb verify page.altweb.html

# create your signing identity (a passphrase IS a keypair — nothing stored)
npx altweb keygen --save

# markdown in, signed self-contained artifact out
npx altweb compile notes.md --sign
```

## Commands

| Command | What it does |
|---|---|
| `compile <input.md>` | Markdown → capsule (`--sign`, `--encrypt`, `--format html\|hash\|url\|json`) |
| `verify <source>` | Check the signature; exit code makes it a build step (`--expect-fingerprint`, `--expect-key`) |
| `decode <source>` | Capsule → markdown |
| `keygen` | Derive the deterministic identity (Argon2id) from your passphrase |

Signatures are deterministic ECDSA P-256 (RFC 6979): recompiling the same file
produces the same artifact byte for byte. Verification is pure cryptography —
offline, no key server, no registry.

## License

AGPL-3.0-or-later + commercial — see the
[repository](https://github.com/danielsoimu/altweb#license).
