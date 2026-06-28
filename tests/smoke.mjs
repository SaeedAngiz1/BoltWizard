#!/usr/bin/env node
/**
 * Smoke test for the BoltWizard rebrand + supporting scaffolding.
 *
 * Runs under `npm test`. Pure Node — no extra dependencies, so it works the
 * moment `node_modules` is populated. If any of these assertions fail, the
 * "npm run watch" watcher (which delegates to `npm test`) reports red.
 *
 * Exits 0 on success, 1 on any failure.
 */
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const mustExist = (rel, msg) => {
  assert.ok(existsSync(resolve(ROOT, rel)), msg || `missing: ${rel}`);
};

const readRoot = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const scripts = [
  'scripts/diagnose-layout.mjs',
  'scripts/render-pipeline.mjs',
  'scripts/live-run.mjs',
];

// --- 1. Rebrand surfaces --------------------------------------------------
mustExist('public/logo.svg', 'logo mark missing');
mustExist('public/icon.svg', 'square app icon missing');
mustExist('public/logo-mono.svg', 'mono logo variant missing');
mustExist('src/components/Footer.tsx', 'Footer component missing');
mustExist('src/components/Legal.tsx', 'Legal pages component missing');

const indexHtml = readRoot('index.html');
assert.match(indexHtml, /BoltWizard/, 'index.html must mention BoltWizard');
assert.doesNotMatch(indexHtml, /BoltGLM/, 'index.html must NOT contain legacy BoltGLM');
assert.match(
  indexHtml,
  /Mohammad Saeed Angiz/,
  'index.html must include the creator credit in meta tags',
);
assert.match(indexHtml, /og:title/, 'index.html must have og:title');

const pkg = JSON.parse(readRoot('package.json'));
assert.equal(pkg.name, 'bolt-wizard', 'package.json name must be "bolt-wizard"');
assert.match(
  pkg.description ?? '',
  /BoltWizard/,
  'package.json description must mention BoltWizard',
);

const styles = readRoot('src/styles.css');
assert.match(styles, /BoltWizard/, 'styles.css must mention BoltWizard');
assert.doesNotMatch(styles, /BoltGLM/, 'styles.css must not contain BoltGLM');

const footer = readRoot('src/components/Footer.tsx');
assert.match(footer, /BoltWizard/, 'Footer must mention BoltWizard');
assert.match(
  footer,
  /Mohammad Saeed Angiz/,
  'Footer must credit Mohammad Saeed Angiz',
);
assert.match(footer, /#\/terms/, 'Footer must link /terms');
assert.match(footer, /#\/privacy/, 'Footer must link /privacy');
assert.match(footer, /#\/about/, 'Footer must link /about');

const legal = readRoot('src/components/Legal.tsx');
assert.match(legal, /\/about/, 'Legal must render /about');
assert.match(legal, /\/terms/, 'Legal must render /terms');
assert.match(legal, /\/privacy/, 'Legal must render /privacy');
assert.match(legal, /Mohammad Saeed Angiz/, 'Legal /about page must credit creator');

const topbar = readRoot('src/components/TopBar.tsx');
// The wordmark is intentionally split across two spans ("Bolt" in violet,
// "Wizard" in the bolt accent color), so the string never appears contiguously
// in source. Assert each half is present and that the split markup wraps them.
assert.match(topbar, /\bBolt\b/, 'TopBar must contain the "Bolt" half of the wordmark');
assert.match(topbar, /\bWizard\b/, 'TopBar must contain the "Wizard" half of the wordmark');
assert.match(
  topbar,
  /topbar__title-bolt[\s\S]*?topbar__title-wizard/,
  'TopBar wordmark must be colour-split across the two halves',
);
assert.doesNotMatch(topbar, /BoltGLM/, 'TopBar must not show legacy BoltGLM');

const boot = readRoot('src/components/BootOverlay.tsx');
assert.match(boot, /BoltWizard/, 'BootOverlay must say BoltWizard');

const systemPrompt = readRoot('src/lib/llm/tools.ts');
assert.match(
  systemPrompt,
  /You are BoltWizard/,
  'LLM system prompt must introduce itself as BoltWizard',
);

// --- 1a. README / GitHub-facing project landing --------------------------
mustExist('README.md', 'README.md missing — the GitHub landing page must exist');
const readme = readRoot('README.md');
assert.match(readme, /BoltWizard/, 'README must mention BoltWizard');
assert.match(
  readme,
  /Mohammad Saeed Angiz/,
  'README must credit the creator Mohammad Saeed Angiz',
);
assert.match(
  readme,
  /<animate/,
  'README must contain at least one <animate> element (animation requirement)',
);
assert.match(
  readme,
  /mermaid/,
  'README should contain a mermaid block for the architecture diagram',
);
assert.match(readme, /WebContainers/, 'README must reference WebContainers');
assert.doesNotMatch(readme, /BoltGLM/, 'README must NOT contain legacy BoltGLM');

// --- 2. WebContainer / COOP-COEP isolation unchanged ----------------------
const vite = readRoot('vite.config.ts');
assert.match(
  vite,
  /Cross-Origin-Opener-Policy/,
  'vite.config.ts must still set COOP header (do not regress WebContainer isolation)',
);
assert.match(
  vite,
  /Cross-Origin-Embedder-Policy/,
  'vite.config.ts must still set COEP header (do not regress WebContainer isolation)',
);

// --- 3. The three required package-script entry-points exist and parse ----
for (const s of scripts) {
  const r = spawnSync(process.execPath, ['--check', resolve(ROOT, s)], {
    encoding: 'utf8',
  });
  assert.equal(
    r.status,
    0,
    `${s} did not parse cleanly:\n${r.stderr || r.stdout}\n(script must run via its npm command)`,
  );
}

console.log('✓ smoke: BoltWizard rebrand surfaces intact');
console.log('✓ smoke: legal pages present and credited');
console.log('✓ smoke: WebContainer COOP/COEP isolation preserved');
console.log('✓ smoke: diagnose-layout / render-pipeline / live-run scripts parse');
