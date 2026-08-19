import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// /llms-full.txt — every substantive docs page concatenated into one plain-text
// file for LLMs that want the whole thing. Generated at build from the markdown
// sources, so it never drifts from the docs. The marketing splash (index.mdx)
// and the component-heavy demo (demo.mdx) are intentionally skipped; the reader
// order below is the order a human should meet the docs in.
const ORDER = [
	'quickstart',
	'capsule-format',
	'security-model',
	'cli',
	'mcp-loader',
	'editor',
	'faq',
	'credits',
];

const HEADER =
	'# ALTWEB — full documentation\n\n' +
	'Signed context capsules for AI agents — Markdown compiled into self-contained, ' +
	'verifiable, optionally encrypted artifacts + an MCP loader that refuses unsigned ' +
	'or untrusted context. Verify before you inject.\n\n' +
	'Site: https://altweb.software · Source: https://github.com/danielsoimu/altweb\n' +
	'Curated index: https://altweb.software/llms.txt';

function splitFrontmatter(raw: string): { title: string; body: string } {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) return { title: '', body: raw.trim() };
	const titleLine = match[1].match(/^title:\s*(.+)$/m);
	const title = titleLine ? titleLine[1].trim().replace(/^["']|["']$/g, '') : '';
	return { title, body: match[2].trim() };
}

export const GET: APIRoute = () => {
	// process.cwd() is the site root during `astro build` — reliable regardless
	// of how this endpoint is bundled (import.meta.url is not, once bundled).
	const docsDir = join(process.cwd(), 'src', 'content', 'docs');
	const sections = ORDER.map((slug) => {
		let raw: string;
		try {
			raw = readFileSync(join(docsDir, `${slug}.md`), 'utf-8');
		} catch {
			return null;
		}
		const { title, body } = splitFrontmatter(raw);
		return `# ${title || slug}\n\n${body}`;
	}).filter(Boolean);

	const text = [HEADER, ...sections].join('\n\n---\n\n') + '\n';
	return new Response(text, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
