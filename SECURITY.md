# Security Policy

ALTWEB's entire purpose is verifiable context — security reports are the most
valuable contribution this project can receive.

## Reporting a vulnerability

**Please use [GitHub private vulnerability reporting](https://github.com/danielsoimu/altweb/security/advisories/new)**
(Security tab → "Report a vulnerability"). Do not open a public issue for
anything you believe is exploitable.

What to expect:

- Acknowledgment within **72 hours**.
- An assessment and a fix timeline within **7 days** for anything that breaks a
  security guarantee below.
- Coordinated disclosure: we publish an advisory and credit you (unless you
  prefer otherwise) once a fixed release is out.

There is no bug bounty — this is an independent open-source project. You get
fast fixes, public credit, and our genuine gratitude.

## What counts as a vulnerability here

The guarantees that must hold — a break in any of these is a valid report:

1. **Provenance**: no way to obtain `verified: true` (or the verified badge)
   for content the keyholder did not sign — in any mode (public, full,
   partial encryption), in the core decoder, the CLI, the MCP loader, or the
   standalone HTML runtime.
2. **Refuse-by-default**: no way to make the MCP loader hand content to an
   agent from a capsule that is unsigned, tampered with, or signed by a key
   not in the trust file.
3. **Confidentiality**: no way to recover encrypted capsule content or a
   passphrase/private key from the artifacts or the tooling.
4. **Sandbox of the standalone runtime**: no script execution or exfiltration
   from a hostile `.altweb.html` opened in a browser (XSS, CSP bypass,
   resource-exhaustion that freezes the reader's tab).
5. **The tooling itself**: SSRF in the loader, path/terminal escapes in the
   CLI, supply-chain issues in the published packages.

Denial-of-service on your own machine with your own flags, and issues
requiring a compromised OS or browser, are generally out of scope — report
them anyway if you think the boundary is interesting.

## Supported versions

Only the latest release line receives security fixes.

| Version | Supported |
| ------- | --------- |
| 1.1.x   | yes       |
| < 1.1   | no — upgrade; 1.1.0 contains the remediation of a full-surface audit |

## Verification, not trust

The claims above are testable: the test suite executes the actual embedded
runtime (with the real sanitizer), recomputes the CSP hashes from emitted
bytes, and includes forged-capsule, malleated-signature, and
decompression-bomb regressions. `npm test` from the repo root runs it all.
