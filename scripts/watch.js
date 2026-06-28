#!/usr/bin/env node
/**
 * Autonomous file-system monitor.
 *
 * Watches /src and /scripts for changes and, on each save (debounced), runs
 * ESLint and/or the Vitest test suite — the "Bolt Loop" automated. Designed to
 * be the single long-running process during development.
 *
 * Usage:
 *   node scripts/watch.js              # runs lint + test (default)
 *   node scripts/watch.js --lint       # lint only
 *   node scripts/watch.js --test       # test only
 *   node scripts/watch.js --lint --test
 *
 * Exit: Ctrl+C to stop. Always exits cleanly.
 */
import chokidar from 'chokidar';
import { spawn } from 'node:child_process';
import { resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const RUN_LINT = args.has('--lint') || (!args.has('--lint') && !args.has('--test'));
const RUN_TEST = args.has('--test') || (!args.has('--lint') && !args.has('--test'));

const WATCH_GLOBS = ['src/**/*', 'scripts/**/*'];
const DEBOUNCE_MS = 250;

// ---- minimal ANSI helpers (no deps) ---------------------------------------
const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m',
};
const stamp = () => new Date().toLocaleTimeString();
const log = (icon, color, msg) =>
  console.log(`${c.gray}[${stamp()}]${c.reset} ${color}${icon}${c.reset} ${msg}`);

// ---- command runner --------------------------------------------------------
let busy = false;
let pending = null;

// Spawn a CLI by joining into a single command string. Passing shell:true with a
// real args array triggers Node DEP0190; a single string is both safe and
// cross-platform (npx.cmd resolves on Windows, npx elsewhere).
function run(command, label, color) {
  return new Promise((resolveP) => {
    log('▶', color, `${label} …`);
    const proc = spawn(command, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    });
    proc.on('close', (code) => {
      if (code === 0) log('✓', c.green, `${label} passed`);
      else log('✗', c.red, `${label} FAILED (exit ${code})`);
      resolveP(code === 0);
    });
    proc.on('error', (err) => {
      log('✗', c.red, `${label} error: ${err.message}`);
      resolveP(false);
    });
  });
}

function runLint(changedPath) {
  // Lint only the changed file when it's JS/JSX; fall back to whole project.
  const jsish = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'];
  const target = changedPath && jsish.includes(extname(changedPath)) ? changedPath : '.';
  const label = `lint ${target === '.' ? '(project)' : relative(ROOT, target)}`;
  return run(`npx eslint "${target}"`, label, c.cyan);
}

function runTests() {
  return run('npx vitest run --reporter=verbose', 'vitest', c.magenta);
}

// ---- debounced change handler ----------------------------------------------
let lintOk = true, testOk = true;

async function handleChange(changedPath, reason) {
  if (busy) { pending = { changedPath, reason }; return; }
  busy = true;
  log('↻', c.yellow, `${reason}: ${relative(ROOT, changedPath)}`);

  if (RUN_LINT) lintOk = await runLint(changedPath);
  if (RUN_TEST) testOk = await runTests();

  const allOk = (!RUN_LINT || lintOk) && (!RUN_TEST || testOk);
  console.log(
    `${allOk ? c.green + c.bold + '✓ ALL GREEN' : c.red + c.bold + '✗ ISSUES FOUND'}${c.reset}` +
    `${c.gray}  — lint:${lintOk ? 'ok' : 'fail'} test:${testOk ? 'ok' : 'fail'}${c.reset}\n`
  );

  busy = false;
  if (pending) {
    const next = pending;
    pending = null;
    handleChange(next.changedPath, next.reason);
  }
}

const debounced = (() => {
  let t = null;
  return (path, reason) => {
    clearTimeout(t);
    t = setTimeout(() => handleChange(path, reason), DEBOUNCE_MS);
  };
})();

// ---- bootstrap watcher ------------------------------------------------------
console.log(`${c.bold}Editor JS — autonomous watcher${c.reset}`);
console.log(`${c.gray}root:  ${ROOT}${c.reset}`);
console.log(`${c.gray}watch: ${WATCH_GLOBS.join(', ')}${c.reset}`);
console.log(`${c.gray}mode:  lint=${RUN_LINT} test=${RUN_TEST} (debounce ${DEBOUNCE_MS}ms)${c.reset}\n`);

const watcher = chokidar.watch(WATCH_GLOBS, {
  cwd: ROOT,
  ignored: (p) => /(^|[/\\])node_modules([/\\]|$)|(^|[/\\])dist([/\\]|$)|(^|[/\\])coverage([/\\]|$)/.test(p),
  persistent: true,
  ignoreInitial: true,
});

let ready = false;
watcher
  .on('ready', () => {
    ready = true;
    log('●', c.green, 'watcher ready — make a change to trigger');
    // Kick off an initial run so the baseline state is known.
    handleChange(resolve(ROOT, 'src'), 'initial');
  })
  .on('add', (p) => ready && debounced(resolve(ROOT, p), 'add'))
  .on('change', (p) => ready && debounced(resolve(ROOT, p), 'change'))
  .on('unlink', (p) => ready && debounced(resolve(ROOT, p), 'delete'));

const shutdown = () => {
  console.log(`\n${c.gray}shutting down watcher…${c.reset}`);
  watcher.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
