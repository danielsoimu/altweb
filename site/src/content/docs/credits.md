---
title: Credits
description: The open source projects ALTWEB builds on.
---

ALTWEB is built on excellent open source. The load-bearing pieces:

| Project | License | Used for |
|---|---|---|
| [Novel](https://github.com/steven-tey/novel) | Apache-2.0 | The Notion-style editor foundation of `@altweb/editor` |
| [Tiptap](https://github.com/ueberdosis/tiptap) | MIT | The block editor engine underneath Novel |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Apache-2.0 / MPL-2.0 | Sanitizing decoded content before it is rendered — including inlined in every standalone artifact |
| [pako](https://github.com/nodeca/pako) | MIT | Deflate compression of the capsule payload |
| [zod](https://github.com/colinhacks/zod) | MIT | Structural validation of envelopes and pages |
| [@noble/curves](https://github.com/paulmillr/noble-curves) | MIT | P-256 public key derivation for the deterministic passphrase identity |

The signing, verification, and encryption primitives themselves (ECDSA P-256,
SHA-256, AES-256-GCM, PBKDF2) come from the platform's native
**Web Crypto API** — no custom cryptography.

Full attribution, including transitive notices, lives in the `NOTICE` file in
the repository.

This site is built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build), with self-hosted
[Inter](https://rsms.me/inter/) and
[JetBrains Mono](https://www.jetbrains.com/lp/mono/) fonts. Search is local
(Pagefind); the site makes no external requests.
