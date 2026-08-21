// ASCII slugger - a thin wrapper over github-slugger.
//
// Why: starlight-blog derives an author's URL slug from the display name via
// github-slugger's named slug(), which keeps diacritics. The author display
// name carries a Romanian s-comma-below (U+0219) and must stay verbatim wherever
// it is shown, but the derived slug then keeps that letter percent-encoded
// (%C8%99), leaking into the author-page URL, the sitemap, and the BlogPosting id.
//
// Policy: rendered name stays verbatim; links/encoding stay ASCII ("soimu"). To
// hold both, we fold diacritics to ASCII inside slug() only. The default export
// (the GithubSlugger class Starlight uses for heading anchors) is passed through
// untouched, and every other slug in this project is already ASCII - so this
// changes exactly the author slug and nothing else.
//
// Aliased in for the bare github-slugger specifier via astro.config's vite
// resolve. The real implementation is imported by explicit subpath so the alias
// does not recurse into this file.
import GithubSlugger, { slug as rawSlug } from 'github-slugger/index.js';

// NFKD splits accented letters into base + combining marks; dropping the
// U+0300-U+036F combining block leaves the ASCII base (s-comma/t-comma -> s/t,
// a-breve/a-circumflex -> a, i-circumflex -> i).
const foldToAscii = (value) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

export function slug(value, maintainCase) {
	return rawSlug(foldToAscii(value), maintainCase);
}

export default GithubSlugger;
