// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// ALTWEB public site: product presentation + documentation.
// English only. Local Pagefind search, self-hosted fonts, no external
// services. Diagrams render client-side from a locally bundled mermaid.
export default defineConfig({
	site: 'https://altweb.software',
	integrations: [
		starlight({
			title: 'ALTWEB',
			description:
				'Signed context capsules for AI agents: markdown compiled into self-contained, verifiable artifacts. Verify before you inject.',
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
							link: 'https://editor.altweb.software',
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
