---
title: FAQ
description: Short, honest answers — including the things ALTWEB deliberately does not do.
---

## Does verification need a server?

No. The signature and the signer's public key travel inside the capsule.
Verification is a local computation — it works offline, from a file on disk,
with no registry, no key server, and no network request.

## Is this a blockchain?

No. There is no ledger, no token, no consensus. A capsule is a compressed,
optionally encrypted, optionally signed blob plus plain ECDSA verification.

## What exactly ships in v1?

Four pieces, all in one repository: `@altweb/core` (the headless engine),
`@altweb/cli` (`compile` / `decode` / `verify` / `keygen`), `@altweb/mcp`
(the `altweb-context` loader), and `@altweb/editor` (the Novel-based visual
editor, under active development). That is the complete list — there is no
browser extension and no hosted service.

## How is ALTWEB licensed?

Dual-licensed. The open-source license is **AGPL-3.0-or-later**: free to use,
study, modify, and share — with the copyleft obligation that if you modify
ALTWEB and either distribute it or run it as a network service (for example,
hosting the `altweb-context` loader for others), you release your modified
source under the same license. For closed-source or hosted-without-sharing use,
there is a separate **commercial license by agreement** — see `COMMERCIAL.md`
in the repository. Bundled third-party components keep their own permissive
licenses; see [Credits](/credits/).

## If a capsule is signed, is it safe to load?

No — signed means *attributable and intact*, not safe. A signature tells you
who wrote the content and that it has not changed. Whether you take
instructions from that signer is your decision, expressed in the trust file.
See the [security model](/security-model/).

## What happens if I lose my passphrase?

The identity is unrecoverable — there is no reset, because there is no
server. Pick a new passphrase, publish the new fingerprint, and ask the
people who trust you to update their trust files. (The flip side: there is
also no account to compromise centrally.)

## Can two people share one signing identity?

Technically yes — anyone who knows the passphrase derives the same keypair.
That is a feature for teams and a warning for individuals: the passphrase is
the identity, so share it only if you mean "we sign as one".

## Why does an encrypted capsule show "signed but unverifiable"?

The signature covers the decrypted payload. Without the password, the
verifier cannot recompute what was signed, so it honestly reports the
tri-state instead of guessing. Supply the password and verification completes.

## Do capsules expire?

No. A capsule verifies forever, and verification says nothing about
freshness. If you need "latest version" semantics, that is a distribution
concern — publish capsules at a stable URL and re-fetch.

## Does the standalone HTML file load anything from the network?

No. The renderer and sanitizer (DOMPurify) are inlined, and the file carries
a strict Content-Security-Policy (`default-src 'none'`). It works from disk,
in a browser, with the network cable unplugged.

## Why markdown?

Because that is what agent context already is: `CLAUDE.md`, personas, skills,
notes. ALTWEB adds provenance to the format teams already use, rather than
inventing a new one.
