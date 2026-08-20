---
title: Capsule format
description: The envelope, the compression, and the cryptography — what is actually inside a .altweb.html file or URL hash.
---

A capsule is one base64url string — the **hash** — that carries everything:
content, metadata, optional encryption, optional signature. The hash can live
in three places, interchangeably:

| Form | What it is |
|---|---|
| `.altweb.html` | A standalone HTML file with the hash embedded; opens and renders in any browser, offline |
| URL | `https://host/#<hash>` — the content travels in the URL fragment, which never reaches a server |
| raw hash | The bare string, e.g. stored in a `.altweb` file or passed on the command line |

All tools (`decode`, `verify`, the MCP loader) accept any of the three.

## The envelope

Decoding the base64url hash yields a JSON envelope:

| Field | Meaning |
|---|---|
| `v` | Protocol version — currently `1` |
| `enc` | `true` when the content is encrypted, `false` for public capsules |
| `d` | Public mode: the page, compressed, base64url-encoded |
| `e` | Encrypted mode: `{ iv, salt, ct, v }` — IV (12 bytes), PBKDF2 salt (16 bytes), ciphertext, all base64url |
| `m` | Partial encryption: visible metadata (title, style), compressed — content stays in `e` |
| `s` | Optional: ECDSA signature, base64url |
| `pk` | Optional: signer public key (SPKI), base64url |

The page itself is a small JSON document — metadata (title, description,
timestamps, language) plus a list of content blocks parsed from markdown.

## Compression

The page JSON is compressed with **deflate** (pako, maximum level) before
anything else happens. Compression is what makes URL-sized capsules practical.

## Encryption (optional)

Encrypted capsules use **AES-256-GCM** via the Web Crypto API. The key is
derived from the password with PBKDF2; the salt and IV are random per capsule
and stored in the envelope. Two modes exist:

- **Full** — metadata and content are both encrypted.
- **Partial** — title and style stay visible (`m`), the content blocks are
  encrypted (`e`), so a capsule can be identifiable without being readable.

## Signature (optional)

Signing uses **ECDSA P-256 with SHA-256** over the *compressed payload bytes*:

- Public capsules: the signature covers the compressed page.
- Encrypted capsules: the signature covers the compressed **plaintext** —
  which means verification completes only after decryption. A signed,
  encrypted capsule reports "signed, unverifiable without the password"
  until the password is supplied.

The envelope carries the signature (`s`) and the signer's public key (`pk`).
Verification is therefore fully offline: decode, recompute, check — no
key server, no registry, no network.

## Identity and fingerprints

A signing identity is derived deterministically from a passphrase:
Argon2id (64 MiB memory, 3 passes, a fixed protocol salt) stretches the
passphrase into a P-256 private scalar. The same passphrase always yields the
same keypair, on any machine — your passphrase *is* your identity. The salt
is fixed on purpose (nothing stored, reproducible anywhere); Argon2id's
memory-hardness is what keeps precomputed dictionaries uneconomical despite it.

The **fingerprint** is the SHA-256 of the public key (SPKI bytes), first
8 bytes, hex with colons — e.g. `ab:12:cd:34:ef:56:78:90`. It is short enough
to publish and compare by eye, and it is what trust files match on.

## The standalone artifact

`altweb compile` (HTML format) wraps the hash in a self-rendering HTML file:

- the hash is embedded in a `<meta name="altweb-hash">` tag;
- a small inline renderer decodes, sanitizes (DOMPurify is inlined — no
  external fetch), and displays the content, including a password prompt for
  encrypted capsules and a "verified" badge for signed ones;
- a strict Content-Security-Policy (`default-src 'none'`) keeps the artifact
  from loading anything remote.

One file, no dependencies, works from disk.
