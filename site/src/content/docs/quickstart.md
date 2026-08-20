---
title: Quickstart
description: From a markdown file to a signed, verified capsule loaded into your agent — the whole loop in five steps.
---

This walks the complete loop: install, create a signing identity, compile and
sign a capsule, verify it, and wire the verified loader into an MCP client.

## 1. Install

Nothing to install — both tools are on npm and run straight through `npx`:

- [`altweb`](https://www.npmjs.com/package/altweb) — the CLI
- [`altweb-context`](https://www.npmjs.com/package/altweb-context) — the MCP server

Prefer a global install? `npm i -g altweb` and drop the `npx` prefix below.
Working from source instead: `git clone https://github.com/danielsoimu/altweb.git
&& cd altweb && npm install && npm run build`, then use
`node packages/cli/dist/altweb.mjs` wherever `npx altweb` appears.

## 2. Create your signing identity

Your identity is derived **deterministically from a passphrase** — the same
passphrase always produces the same ECDSA P-256 keypair. The private key is
never written to disk; it is re-derived on every run. Only the public key and
fingerprint are saved.

```bash
npx altweb keygen --save
```

The passphrase comes from the `ALTWEB_PASSPHRASE` environment variable or,
interactively, from a hidden TTY prompt. Output:

```
fingerprint: ab:12:cd:34:ef:56:78:90
saved: ~/.altweb/identity.json (public key + fingerprint only)
```

The fingerprint is your public signer identity — share it with anyone who
should trust your capsules.

## 3. Compile and sign

```bash
echo "# My agent's operating notes" > notes.md
npx altweb compile notes.md --sign -o notes.altweb.html
```

The result is a single self-contained HTML file: content compressed, signed,
and embedded. It opens in any browser and needs no server.

## 4. Verify — anywhere, offline

```bash
npx altweb verify notes.altweb.html
```

The command prints the title, block count, and the signature status with the
signer fingerprint. The exit code is `0` only when the artifact decodes,
validates, and (if signed) the signature is valid — so verification can be a
build step or a pre-flight check in a script.

## 5. Wire the loader into your agent

Register the MCP server (Claude Code example):

```bash
claude mcp add altweb-context -- npx -y altweb-context
```

Then tell the loader which signers you trust. Create
`~/.altweb/trusted-keys.json`:

```json
{
  "keys": [
    {
      "name": "Me",
      "publicKey": "<base64url SPKI from ~/.altweb/identity.json>",
      "fingerprint": "ab:12:cd:34:ef:56:78:90"
    }
  ]
}
```

From now on, `load_capsule` returns content only for capsules signed by a
full public key in that file (the fingerprint is a human-readable label;
trust is matched on the complete key). Unsigned, tampered, or untrusted capsules are
refused with an explicit reason — see the
[MCP loader reference](/mcp-loader/) for the exact semantics.

## Next

- Inspect and verify a [real signed capsule](/demo/) published on this site.
- Read what a signature [does and does not prove](/security-model/).
- See the full [CLI reference](/cli/).
