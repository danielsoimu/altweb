// Post-build: esbuild's printer re-splits long calls, so the bundle ends up
// with registerTool(\n "name", ... even when the source is single-line. MCP
// directory scanners read the tool surface statically (some from the
// published package, some from the repo) and their matchers expect the name
// on the registerTool( line. This pass normalizes the bundle and FAILS the
// build if any tool declaration is not single-line afterwards - so the
// guarantee can never silently drift.
import { readFileSync, writeFileSync } from 'node:fs';

const TOOLS = ['load_capsule', 'verify_capsule', 'list_trusted_keys'];
const bundlePath = new URL('../dist/altweb-context.mjs', import.meta.url);

let bundle = readFileSync(bundlePath, 'utf8');

bundle = bundle.replace(
  /registerTool\(\s*\n\s*"(load_capsule|verify_capsule|list_trusted_keys)",\s*\n\s*\{/g,
  'registerTool("$1", {'
);

const missing = TOOLS.filter((name) => !bundle.includes(`registerTool("${name}", {`));
if (missing.length > 0) {
  console.error(
    `flatten-tool-declarations: NOT single-line in dist bundle: ${missing.join(', ')}`
  );
  process.exit(1);
}

writeFileSync(bundlePath, bundle);
console.log(`flatten-tool-declarations: ${TOOLS.length} tool declarations single-line in bundle`);
