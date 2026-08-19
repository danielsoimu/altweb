// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const SITE = 'https://altweb.software';

// Canonical MASTER description — the full positioning line. Short, slot-sized
// tiers (headline / meta / rallying cry) derive from it; this is the one that
// goes wherever there is room: JSON-LD, README, package.json, llms.txt.
const MASTER =
	'Signed context capsules for AI agents — Markdown compiled into self-contained, ' +
	'verifiable, optionally encrypted artifacts + an MCP loader that refuses unsigned ' +
	'or untrusted context. Verify before you inject.';

// schema.org graph for rich results: the site, the software, and the author.
const JSON_LD = JSON.stringify({
	'@context': 'https://schema.org',
	'@graph': [
		{
			'@type': 'WebSite',
			'@id': `${SITE}/#website`,
			url: `${SITE}/`,
			name: 'ALTWEB',
			description: MASTER,
			inLanguage: 'en',
			publisher: { '@id': `${SITE}/#person` },
		},
		{
			'@type': 'SoftwareApplication',
			name: 'ALTWEB',
			applicationCategory: 'DeveloperApplication',
			operatingSystem: 'Any (browser, Node.js)',
			description: MASTER,
			url: `${SITE}/`,
			softwareVersion: '1.0.0',
			license: 'https://www.gnu.org/licenses/agpl-3.0.html',
			codeRepository: 'https://github.com/danielsoimu/altweb',
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
			author: { '@id': `${SITE}/#person` },
		},
		{
			'@type': 'Person',
			'@id': `${SITE}/#person`,
			name: 'Daniel C. Șoimu',
			url: 'https://github.com/danielsoimu',
		},
	],
});

// ALTWEB public site: product presentation + documentation.
// English only. Local Pagefind search, self-hosted fonts, no external
// services. Diagrams render client-side from a locally bundled mermaid.
export default defineConfig({
	site: 'https://altweb.software',
	integrations: [
		starlight({
			title: 'ALTWEB',
			description:
				'Signed context capsules for AI agents: verifiable, optionally encrypted markdown artifacts + an MCP loader that refuses untrusted context.',
			favicon: '/favicon.svg',
			customCss: ['./src/styles/altweb.css'],
			components: {
				ThemeProvider: './src/components/ThemeProvider.astro',
				SiteTitle: './src/components/SiteTitle.astro',
				Footer: './src/components/Footer.astro',
				PageTitle: './src/components/PageTitle.astro',
				Search: './src/components/Search.astro',
			},
			head: [
				{
					tag: 'link',
					attrs: {
						rel: 'apple-touch-icon',
						href: '/icons/icon-192.png',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'preload',
						href: '/fonts/InterVariable.woff2',
						as: 'font',
						type: 'font/woff2',
						crossorigin: 'anonymous',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'preload',
						href: '/fonts/JetBrainsMono-Regular.woff2',
						as: 'font',
						type: 'font/woff2',
						crossorigin: 'anonymous',
					},
				},
				// Social card image (Starlight already emits twitter:card=summary_large_image).
				{ tag: 'meta', attrs: { property: 'og:image', content: `${SITE}/og-image.png` } },
				{ tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
				{ tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
				{
					tag: 'meta',
					attrs: {
						property: 'og:image:alt',
						content: 'ALTWEB — Signed context capsules for AI agents. Verify before you inject.',
					},
				},
				{ tag: 'meta', attrs: { name: 'twitter:image', content: `${SITE}/og-image.png` } },
				// Structured data for rich results.
				{ tag: 'script', attrs: { type: 'application/ld+json' }, content: JSON_LD },
			],
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/danielsoimu/altweb',
				},
			],
			pagination: true,
			lastUpdated: false,
			sidebar: [
				{
					label: 'Start here',
					items: [
						{ label: 'Quickstart', slug: 'quickstart' },
						{ label: 'Live demo capsule', slug: 'demo' },
						{
							label: 'Open the editor ↗',
							link: 'https://capsule.altweb.software',
							attrs: { target: '_blank', rel: 'noopener' },
						},
					],
				},
				{
					label: 'The capsule',
					items: [
						{ label: 'Capsule format', slug: 'capsule-format' },
						{ label: 'Security model', slug: 'security-model' },
					],
				},
				{
					label: 'Tools',
					items: [
						{ label: 'CLI reference', slug: 'cli' },
						{ label: 'MCP loader (altweb-context)', slug: 'mcp-loader' },
						{ label: 'Editor', slug: 'editor' },
					],
				},
				{
					label: 'Project',
					items: [
						{ label: 'FAQ', slug: 'faq' },
						{ label: 'Credits', slug: 'credits' },
					],
				},
			],
		}),
	],
});
