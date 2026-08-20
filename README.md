# ALTWEB — signed context capsules

**Signed context capsules for AI agents — Markdown compiled into self-contained,
verifiable, optionally encrypted artifacts + an MCP loader that refuses unsigned
or untrusted context. Verify before you inject.**

AI agents run on plain-text context: instructions, personas, skills, memory
files. None of it has provenance — anything that can write those files can
poison them. ALTWEB gives context a chain of custody, and makes the loader
refuse anything that lacks one:

- **Capsule** — markdown compiled into a single `.altweb.html` file (or URL):
  content compressed (deflate), optionally encrypted (AES-256-GCM), optionally
  signed (ECDSA P-256). Self-contained — opens in any browser, verifies offline,
  needs no server: you hand someone a file, not a database.
- **Verified context loading** — the `altweb-context` MCP server loads a capsule
  into your agent *only* when the signature is valid **and** the signer's public
  key is in your trust file. Unsigned, tampered, or untrusted capsules are
  refused at load time, with an explicit reason. Refusal is the default: an
  empty trust file rejects everything, signed or not.

```
you write MD ──► altweb compile --sign ──► capsule (.altweb.html / URL)
                                              │
agent asks for context ──► altweb-context ──► verify signature + trust
                                              │
                              trusted ──► markdown injected
                          everything else ──► REFUSED (reason)
```

## Packages

| Package | What it is |
|---|---|
| [`altweb`](https://www.npmjs.com/package/altweb) | CLI: `altweb compile / decode / verify / keygen` (`packages/cli`) |
| [`altweb-context`](https://www.npmjs.com/package/altweb-context) | MCP server: `load_capsule`, `verify_capsule`, `list_trusted_keys` (`packages/mcp`) |
| `@altweb/core` | Headless engine: content model, codec, crypto, markdown, sanitize (bundled into both; npm release planned) |
| `@altweb/editor` | Notion-style editor (built on [Novel](https://github.com/steven-tey/novel)) with one-click capsule export |
| `site/` | Documentation site (Astro + Starlight) |

## Quickstart

Both tools are on npm — nothing to clone:

```bash
# create your signing identity (deterministic from a passphrase; only the
# public key + fingerprint are stored, in ~/.altweb/identity.json)
npx altweb keygen --save

# write, compile, sign
echo "# My agent's operating notes" > notes.md
npx altweb compile notes.md -o notes.altweb.html --sign

# verify anywhere, offline
npx altweb verify notes.altweb.html
```

Wire the loader into an MCP client (Claude Code example):

```bash
claude mcp add altweb-context -- npx -y altweb-context
```

(From source: `npm install && npm run build`, then use the bundles under
`packages/*/dist/`.)

Trust a signer by adding its **full public key** to `~/.altweb/trusted-keys.json`
(the `UNTRUSTED_KEY` refusal message hands you the ready-made entry; the short
fingerprint is a human label, not the trust anchor):

```json
{ "keys": [ { "name": "Me", "publicKey": "<base64url SPKI>", "fingerprint": "ab:12:..." } ] }
```

## What a signature proves — and what it does not

A valid signature proves **who** authored the capsule and that the bytes are
**intact**. It does not make the content safe or true. The trust file is your
policy; keep it short.

**Pick a long passphrase.** Identities derive deterministically from your
passphrase via Argon2id with a fixed protocol salt (that is what makes them
portable with nothing stored). Memory-hardness makes mass dictionary attacks
economically hostile, but the passphrase's entropy is still the identity's
foundation. Use a 16+ character diceware-style phrase; the tooling enforces
a minimum strength.

## Security

Content is sanitized with DOMPurify on decode; artifacts carry a CSP; the
codec validates structure with zod. See `site/` docs → Security model for the
full write-up, including the encrypted-capsule caveat (the signature covers
the decrypted payload, so verification completes after decryption).

## Roadmap

Near-term, in rough order:

- **`@altweb/core` on npm** — the engine as an installable library, for
  programmatic use (the CLI and loader already ship it bundled).
- **Hardware-backed identity (FIDO2 / passkeys)** — an *optional* identity
  type alongside the passphrase one: the private key lives in a security key
  or secure enclave, never extractable, signing requires physical presence.
  The passphrase identity stays the default — "a passphrase is a keypair"
  — hardware keys add *something you have* for those who want it.

## Credits

Built on excellent open source: [Novel](https://github.com/steven-tey/novel)
(Apache-2.0) and [Tiptap](https://github.com/ueberdosis/tiptap) (MIT) for the
editor; DOMPurify, marked, pako, zod, @noble/curves in the engine. See NOTICE.

## License

ALTWEB is **dual-licensed**:

- **Open source: [AGPL-3.0-or-later](./LICENSE).** Free to use, study, modify,
  and share — with one core obligation: if you modify ALTWEB and distribute it
  **or run it as a network service** (e.g. hosting `altweb-context` for others),
  you must release your modified source under the AGPL.
- **Commercial: by agreement.** To use ALTWEB in a closed-source product, or as
  a hosted service without publishing your changes, you need a separate
  commercial license. See [COMMERCIAL.md](./COMMERCIAL.md).

Copyright © 2026 Daniel C. ȘOIMU. Bundled third-party components keep their own
(permissive) licenses — see [NOTICE](./NOTICE).
