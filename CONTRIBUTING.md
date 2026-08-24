# Contributing

Thanks for considering it. ALTWEB is small on purpose — a format, a codec, and
three thin surfaces (CLI, MCP loader, editor) — and it carries security
guarantees, so contributions are reviewed strictly. Honest expectations below.

## The fast paths

- **Security issues** → [SECURITY.md](SECURITY.md), private reporting. Most
  valuable contribution there is.
- **Bug reports** → an issue with a minimal reproduction (ideally a capsule
  hash or a failing test).
- **Small, focused PRs** (a bug fix with a test, a doc correction) → welcome
  directly.
- **Features / behavior changes** → open an issue first. The format has a
  normative spec and a hard non-goals list; features that widen the attack
  surface or add network/telemetry will be declined regardless of quality.

## Ground rules for code

- **Fail closed.** Any ambiguity in decoding, verification, or trust resolves
  to refusal, never to acceptance.
- **Every fix ships with the test that would have caught it.** Security fixes
  ship with the attack as a regression test.
- English identifiers, comments, and messages. Match the style of the file you
  are in.
- No new runtime dependencies without prior discussion — the dependency
  surface is part of the security posture.

## Developing

```bash
npm install          # workspaces: packages/core, packages/cli, packages/mcp, apps/editor, site
npm test             # core + mcp + editor suites
npm run typecheck    # tsc across all packages
npm run build        # CLI + MCP bundles, editor, site
```

## Licensing of contributions

ALTWEB is dual-licensed: **AGPL-3.0-or-later** publicly, with commercial
licenses offered separately (see [COMMERCIAL.md](COMMERCIAL.md)). By submitting
a contribution you:

1. Certify the [Developer Certificate of Origin](https://developercertificate.org/)
   (sign off your commits: `git commit -s`), and
2. License your contribution under AGPL-3.0-or-later **and** grant the
   maintainer the right to include it in commercially licensed versions of
   ALTWEB.

If (2) does not work for you, open an issue instead of a PR and describe the
change — an independent implementation keeps the licensing clean.
