---
title: CLI reference
description: altweb compile, decode, verify, keygen — flags, inputs, outputs, and exit codes.
---

The CLI lives at `packages/cli/dist/altweb.mjs` after `npm run build`:

```bash
node packages/cli/dist/altweb.mjs <command> [...]
```

Every command that takes an artifact accepts the same inputs: a standalone
`.altweb.html` file, a raw `.altweb` hash file, a URL with `#hash`, or the
hash string itself.

## `compile`

```bash
altweb compile <input.md> [-o <out>] [--format html|hash|url|json] [--sign]
               [--title <t>] [--lang ro|en] [--base-url <url>]
```

Compiles a markdown file into a capsule.

| Flag | Effect |
|---|---|
| `-o, --output` | Output path (HTML format). Default: `<input>.altweb.html` |
| `--format` | `html` (default) standalone file · `hash` raw hash to stdout · `url` full `#hash` URL · `json` the decoded page |
| `--sign` | Sign the capsule with your identity (passphrase via `ALTWEB_PASSPHRASE` or TTY prompt) |
| `--title` | Override the title (default: first heading of the markdown) |
| `--lang` | Content language for the standalone artifact UI |
| `--base-url` | Base for `--format url` output |
| `--encrypt` | Encrypt the capsule; the password comes from the flag value or `ALTWEB_ENCRYPT_PASSWORD` |

Timestamps derive from the source file's mtime, so recompiling the same file
produces the same artifact — capsule builds are deterministic.

When signing, the signer fingerprint is printed to stderr so pipelines that
capture stdout stay clean.

## `decode`

```bash
altweb decode <artifact|url|hash> [--to md|json] [--password <p>]
```

Decodes a capsule back to markdown (default) or to the page JSON. Encrypted
capsules require `--password`.

## `verify`

```bash
altweb verify <artifact|url|hash> [--require-signature] [--password <p>]
```

Prints the title, the number of content blocks, and the signature status —
`VALID` with the signer fingerprint, `INVALID`, or unsigned.

Exit codes are the contract:

| Exit | Meaning |
|---|---|
| `0` | Decodes, validates structurally, and any present signature is valid |
| `1` | Any failure — including `--require-signature` on an unsigned capsule |

This makes verification scriptable: an agent, a CI job, or a pre-commit hook
can assert an artifact's integrity with one command.

## `keygen`

```bash
altweb keygen [--save] [--force]
```

Derives the deterministic identity from the passphrase and prints the
fingerprint.

- `--save` writes **only the public part** — `{publicKey, fingerprint,
  created}` — to `~/.altweb/identity.json` (mode `0600`). The private key
  never touches disk; it is re-derived from the passphrase on every run.
- `--force` replaces an existing saved identity.

With a saved identity in place, signing commands cross-check the derived
fingerprint against the saved one — a mistyped passphrase fails loudly
instead of silently signing as a different identity.

## Identity resolution

All signing operations resolve the passphrase the same way:

1. `ALTWEB_PASSPHRASE` environment variable, if set;
2. otherwise a hidden TTY prompt (never echoed).

In non-interactive contexts (CI, agents) set the environment variable;
without a TTY and without the variable, signing fails rather than blocking.
