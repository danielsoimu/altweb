---
title: Editor
description: A Notion-style WYSIWYG editor for writing capsules visually and exporting them as a file, URL, or QR code.
---

`@altweb/editor` is the visual way to make capsules: a Notion-style WYSIWYG
editor built on [Novel](https://github.com/steven-tey/novel) (which builds on
Tiptap). You write in a clean block editor instead of raw markdown, then
export the result as a capsule in one step.

<p>
	<a class="aw-btn aw-btn--primary" href="https://capsule.altweb.software">Open the editor →</a>
</p>

## What it does

- **Write visually** — headings, lists, quotes, code blocks and the other
  standard blocks, in a slash-command editor surface.
- **Export a capsule** — the document compiles through the same
  `@altweb/core` pipeline as the CLI, and ships as:
  - a downloadable `.altweb.html` file,
  - a shareable URL with the content in the `#hash` fragment, or
  - a QR code for moving a capsule to another device without any network hop.

The engine underneath is identical to the CLI's — same envelope, same
compression, same cryptography — so capsules made in the editor verify with
`altweb verify` and load through `altweb-context` like any other.

## Status

The editor is included in the repository and under active development. The
headless engine (`@altweb/core`), the CLI, and the MCP loader are the stable
surface today; expect the editor's UI to evolve faster than the rest.

For scripted or agent-driven workflows, the [CLI](/cli/) remains the
recommended path.
