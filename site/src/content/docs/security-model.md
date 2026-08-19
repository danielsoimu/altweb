---
title: Security model
description: What a signature proves, what it does not, where the trust decisions live, and the caveats you should actually know.
---

ALTWEB's claims are narrow on purpose. This page states exactly what the
cryptography gives you — and where it stops.

## What a valid signature proves

1. **Signer identity.** The capsule was signed by the holder of the
   passphrase behind the fingerprint. Same passphrase, same keypair, same
   fingerprint — the fingerprint is a stable, publishable identity.
2. **Integrity.** Not one byte of the signed payload changed since signing.
   Any modification — a character, a whitespace — makes verification fail.

## What it does not prove

- **Content safety.** A signature says nothing about whether the content is
  correct, honest, or safe to follow. A trusted signer can still write a bad
  instruction; a malicious actor can sign malicious content with their own
  valid key.
- **Authorship in the legal sense.** The signature binds to a passphrase,
  not to a person. Whoever knows the passphrase *is* that identity.
- **Freshness.** A capsule verifies forever. Verification alone does not
  tell you whether a newer version exists.

Provenance is necessary for trustworthy context; it is not sufficient.
The signature answers "who wrote this, and is it intact?" — you still decide
"do I take instructions from this signer?"

## The trust file is the policy

The MCP loader separates two questions deliberately:

- **Verification** (cryptography): is the signature valid? — computed, not
  configurable.
- **Trust** (policy): do I accept this signer? — decided entirely by your
  local `~/.altweb/trusted-keys.json`. Trust is matched on the **full
  public key** (base64url SPKI); the 8-byte fingerprint is a display label
  only — at 64 bits it is too short to anchor trust against a targeted
  collision, so entries without `publicKey` never match.

Nothing is trusted by default. An empty trust file means every capsule is
refused, including validly signed ones. Adding a key is the explicit,
auditable act of extending trust — keep the list short.

## Encrypted capsules verify after decryption

For encrypted capsules the signature covers the compressed **plaintext**, so
verification is only possible once the capsule is decrypted with the right
password. Until then, inspection reports "signed, unverifiable without the
password" — a deliberately honest tri-state (`verified: null`) rather than a
false yes or no. The MCP loader therefore refuses encrypted capsules unless a
password is supplied.

## Identity: strengths and consequences

The deterministic passphrase identity (PBKDF2, 600,000 iterations, SHA-256,
into a P-256 scalar) has clean consequences — read them both ways:

- **No key files to lose.** The private key never touches disk and is
  re-derived on each use. `~/.altweb/identity.json` holds only the public
  key and fingerprint.
- **The passphrase is everything.** Anyone who learns it can sign as you;
  there is no revocation server to call. Treat it like a root credential,
  and pick a long one — the derivation is deliberately slow, but a weak
  passphrase is still a weak identity.
- **Rotation is manual.** Changing identity means changing the passphrase,
  which changes the fingerprint — and everyone who trusts you must update
  their trust files.

## Defense in depth around the content

Independent of signatures, the pipeline hardens the rendering path:

- **Sanitization** — decoded content passes through DOMPurify before it is
  ever rendered; the standalone artifact inlines DOMPurify so this holds
  offline too.
- **CSP** — standalone artifacts carry a strict Content-Security-Policy
  (`default-src 'none'`), so an intact capsule cannot phone home or load
  remote code. The policy travels inside the file, so it binds artifacts
  whose runtime is intact — for a file from untrusted hands, rely on the
  independent verification described in the next section.
- **Structural validation** — envelopes and pages are validated with zod
  before use; malformed input fails closed.

## The standalone badge is a convenience, not a proof

A standalone `.altweb.html` file carries its own verifier: the JavaScript
that checks the signature and draws the badge travels in the same file as
the content. The signature covers the capsule payload — never the HTML
wrapper around it. Whoever controls the file also controls the code that
renders the badge, and a rebuilt file can draw whatever it wants. This is
a limit of self-verification in principle, not a bug to patch.

Trustworthy verification runs code that is **independent of the file**:

- **CLI** — `altweb verify <file>` extracts the capsule from the
  `altweb-hash` meta tag and verifies it with the CLI's own cryptography,
  ignoring any JavaScript inside the file. Add `--expect-key` (or
  `--expect-fingerprint`) to also pin *who* must have signed it.
- **MCP loader** — parses the capsule out and verifies with
  `@altweb/core`, then applies your trust file. It never executes the
  file, so the agent path is safe by construction.
- **Editor "Open"** — same rule: the editor re-verifies with its own
  core, not with the file's embedded runtime.

Rule of thumb: **a badge inside a file you received is a courtesy, not
evidence** — evidence is your own verifier saying so. The standalone page
states this next to its badge.

When you serve capsules from infrastructure you control, you can pin the
runtime out-of-band as well: deliver the CSP as an HTTP header with
`script-src 'sha256-<runtime hash>'`, so a modified runtime is refused by
the browser before it runs.

## Threat model in one line

ALTWEB defends the path **from author to agent**: silent modification and
anonymous authorship of context are detectable and refusable. It does not
defend against a trusted signer writing something harmful, a stolen
passphrase, or a compromised machine at either end.
