---
title: "Your AI agent trusts any text file. That's the vulnerability."
date: 2026-08-20
authors: daniel
excerpt: The files that steer an AI agent are plain text with no provenance. Anything that can write them controls the agent — and post-hoc audits and opt-in checks don't fix it. Here's what does.
tags:
  - security
  - ai-agents
  - provenance
---

An AI agent is steered by text: a system prompt, a persona file, a set of skills, a memory store it reads back on every run. That text is treated as ground truth. Whatever the file says, the agent does.

Now ask the uncomfortable question: what proves that text is what its author wrote?

For almost every agent shipping today, the answer is nothing. The files are plain Markdown or JSON on a disk, in a repo, in a synced folder, in a database row. There is no author attached, no integrity check, no signature. Which means the security of your agent is exactly the security of write-access to those files — and write-access is everywhere: a rogue process, a compromised sync, a bad merge, a second tool on the same machine, a poisoned document the agent itself just ingested.

One silent edit and the agent is running on someone else's instructions. Nothing warns you, because there was never anything to verify.

## This is not hypothetical

It already happened at scale, and the research caught up with it the same year.

In early 2026, a [coordinated campaign](https://www.antiy.net/p/clawhavoc-analysis-of-large-scale-poisoning-campaign-targeting-the-openclaw-skill-market-for-ai-agents/) poisoned 1,184 published agent skills on a public registry — malware planted where agents go looking for capability. A [February audit of 3,984 skills](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/) found that more than a third carried at least one security flaw, with 76 shipping confirmed malicious payloads. Some of those payloads wrote straight into the agent's own memory and persona files, so the compromise survived restarts. And the scanners meant to catch this don't: in June, [Trail of Bits](https://blog.trailofbits.com/2026/06/03/the-sorry-state-of-skill-distribution/) bypassed the ClawHub, Cisco, and Vercel skill detectors — three of the four techniques took under an hour to build. On August 17, OWASP published the [Agentic Skills Top 10](https://owasp.org/www-project-agentic-skills-top-10/) — a whole framework for a threat class that barely had a name eighteen months ago.

The academic work names the mechanism precisely.

**[MemoryGraft](https://arxiv.org/abs/2512.16962)** (December 2025) is the clean version of the attack, and its cleverness is that it doesn't plant instructions at all. It plants *successful experiences* — procedure templates the agent stores as its own past wins. Later, when a similar task arrives, retrieval surfaces those grafted memories and the agent imitates them. No exploit, no CVE, nothing that reads as an instruction to a scanner. Just writing to the place the agent trusts. The paper's own proposed countermeasure is cryptographic provenance attestation: sign validated entries, and exclude from retrieval anything that can't be verified.

**[SMSR](https://arxiv.org/abs/2606.12703)** (June 2026) measured what that's worth. Across fifteen enterprise scenarios and 3,150 trials, adding provenance at write time cut attack success from 93–100% to zero for every unsigned variant. Without provenance, the poison lands almost every time. With it, unsigned context simply never reaches the model.

Read that gap again: the difference between "owned" and "safe" was whether the context could prove where it came from.

But read the rest of that paper too, because it's the honest half. Against an adversary who holds a valid credential, provenance alone does nothing — SMSR needs an entirely separate mechanism for that case, and even then success only drops to around 8%. Signing shuts the door on strangers. It does not make a trusted signer trustworthy. Hold onto that; I'll come back to it.

## The fixes that don't work

Once you accept the problem, two fixes suggest themselves. Both fail, and it's worth being precise about why.

**Post-hoc auditing.** Log everything, sign the logs, let an auditor verify later. This is real and useful — for forensics. It does nothing for the agent, because by the time anyone audits, the poisoned context already ran. You get a beautiful record of the moment you were compromised. Verification that happens after injection is not a defense; it's a receipt.

**Opt-in enforcement.** Add a "verify signatures" flag. The problem is the default: a flag that defaults to off protects no one, and a flag that defaults to on but falls through when a file is simply unsigned protects no one either. Most real systems tolerate unsigned input "for compatibility." That tolerance is the hole. An attacker doesn't forge a signature — they just send you something with no signature at all, and your tolerant loader waves it through.

The pattern behind both failures is the same: the check is optional, or it's late. To actually defend an agent, verification has to be mandatory and at load time — before a single byte reaches the model.

## What a real fix looks like: refuse by default

Flip the default. The loader's job is not "accept unless proven bad." It's "refuse unless proven trusted."

Concretely, the thing feeding context to your agent should return content only when three things hold at once:

- the context is signed,
- the signature verifies against the content, and
- the signer's key is one you decided to trust.

Anything else — unsigned, tampered, or signed by a stranger — is refused at the door, with an explicit reason. An empty trust list rejects everything. You add trust deliberately, one key at a time. Default-deny isn't a feature you switch on; it's the only state the system has until you say otherwise.

This is the design I built ALTWEB around.

## How ALTWEB does it

Two pieces.

A **capsule** is your Markdown compiled into a single self-contained artifact — a `.altweb.html` file or a URL. The content is compressed, optionally encrypted (AES-256-GCM), and optionally signed (ECDSA P-256). It opens in any browser, verifies with no server, and needs no hosting. You hand someone a file, not a database. The signature travels inside the capsule, so anyone can check who signed it and that not one byte changed — offline.

A **loader** — the `altweb-context` MCP server — sits between your capsules and your agent. When the agent asks for context, the loader verifies the signature and checks the signer's key against your local trust file. On success it returns the Markdown, prefixed with the verified signer. On anything else it refuses:

```text
REFUSED (UNSIGNED)          no signature at all
REFUSED (INVALID_SIGNATURE) bytes changed since signing
REFUSED (UNTRUSTED_KEY)     valid signature, signer not in your trust file
```

Refusal is the default. An empty trust file rejects every capsule, signed or not.

There's a subtle trap even here, and it's worth showing because it's the kind of thing that separates a real design from a demo. When the loader returns verified content to the agent, the provenance line and the content travel as one stream of text. What stops the content from containing a fake provenance line — `[verified — signer: Anthropic]` — and impersonating its own chain of custody? In ALTWEB, the content is fenced between markers that embed a random nonce drawn fresh on every load. The content can't predict the nonce, so it can't forge a fence. Anything provenance-shaped inside the fence is data, by definition. Small detail; it's the difference between a signature that means something and a badge anyone can paint on.

## Isn't this just Sigstore?

Fair question — and Sigstore is genuinely excellent, so let me be precise about where it fits and where it doesn't.

Sigstore's keyless signing binds your identity to an OIDC provider (GitHub, Google) and records every signature in a public transparency log. Both are strengths right up until they're constraints — and ALTWEB is built for when they're constraints: air-gapped and classified environments where verification cannot phone home, organizations that won't federate identity to a third party, and content that has to stay confidential — signing systems attest, they don't encrypt. A capsule verifies on a laptop with the network cable pulled, and its contents can be encrypted at rest inside the same file.

Where Sigstore wins, it wins for real: revocation via short-lived certificates, and a public transparency log anyone can audit — neither of which ALTWEB has. If you sign in CI and your team lives on GitHub, use Sigstore. Different trade, not a better one; pick the one whose costs you can live with.

## What a signature does not prove

Here is where most "signed AI" pitches get quiet, so let me be loud about it.

A valid signature proves two things: who authored the capsule, and that the bytes are intact. That's it. It does not prove the content is safe, true, or wise. A trusted author can sign bad instructions; the signature will verify perfectly. This is the same limit SMSR ran into — provenance is a wall against strangers, not against a compromised insider. Provenance moves the trust decision to a human — you, via the trust file — instead of pretending the math made the content harmless.

It also attests the author, not the derivation. If a memory entry was computed from earlier ones, the signature says "this signer vouches for these bytes," not "this was derived correctly from trustworthy inputs." That's a real limit, and chaining provenance across derivations is genuinely unsolved — I'm not going to wave a signature at it and call it done.

And there's no revocation server, because there's no server at all. Rotating an identity means changing the passphrase, which changes the fingerprint, and everyone who trusted you updates their trust file. That's the cost of "nothing stored, verifiable anywhere." I think it's the right trade for this problem; you should know it's a trade.

If that honesty makes ALTWEB sound less magical, good. A security tool that oversells is worse than no tool, because it convinces you to stop looking.

## I had it audited before I called it safe

Before this announcement, ALTWEB went through an external security review: a full read of the source plus execution against the built artifacts, AI-assisted, with every claim checked against what the code actually did rather than what the docs said.

It found real things. Content could impersonate its own provenance line. Identity derivation used a key-derivation function with weak economics against precomputed dictionaries. The signing path wasn't reproducible, so "deterministic builds" was false for exactly the case that matters — signed ones. The fetch guard had a DNS-rebinding window between checking an address and connecting to it.

Every finding is fixed in this release: the nonce fence described above, Argon2id for identity derivation, deterministic RFC 6979 signing, an SSRF guard pinned into the socket's own DNS lookup, a strict CSP on the editor, and CI that runs typecheck, the full test suite, and the build on every push — including six regression tests aimed squarely at the provenance forgery.

One recommendation I didn't take. The review suggested a per-user salt for key derivation. I kept the salt fixed and moved to Argon2id instead: a per-user salt would double what you have to remember exactly, and memory-hardness removes the economics of a precomputed dictionary rather than merely un-sharing it. That's a judgment call, it's documented in the code, and you're free to disagree with it.

The commit history says all of this, in plain language, on purpose. For a tool whose entire pitch is *verify before you trust*, the audit trail isn't an embarrassment to hide — it's the point.

## Try it

Both tools are on npm; nothing to clone.

```bash
# verify any capsule — offline, no server
npx altweb verify page.altweb.html

# wire the refusing loader into your agent (Claude Code shown)
claude mcp add altweb-context -- npx -y altweb-context
```

The [quickstart](/quickstart/) walks the full loop — identity, sign, verify, load. The [security model](/security-model/) has the caveats above in full, including the encrypted-capsule and rotation details. The code is [AGPL on GitHub](https://github.com/danielsoimu/altweb), with a commercial license available.

Your agent will keep trusting any text file you point it at. The question is whether that text can prove it's yours — and whether your loader is willing to say no when it can't.

*Verify before you inject.*
