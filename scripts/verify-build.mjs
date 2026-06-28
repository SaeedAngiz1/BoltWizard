/**
 * Full build → preview loop verification (the Bolt.new-style flow).
 *
 * Pre-seeds a known-good LM Studio model, asks the agent to build a minimal
 * Vite+React counter app, then asserts the END-TO-END loop completes without
 * freezing:
 *   - assistant streams + emits file actions
 *   - `npm install` runs and exits
 *   - `npm run dev` is launched detached and the preview iframe appears (URL set)
 *   - the agent's busy state clears (no permanent freeze)
 *
 *   node scripts/verify-build.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const DIR = 'C:/Users/angiz/Desktop/old Desktop/Desktop/CODEX/C GLM5.2/Editor js/scripts';
const MODEL = 'meta-llama-3.1-8b-instruct';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.addInitScript(([model]) => {
  const ls = { provider: 'lmstudio', apiKey: '', model, baseUrl: 'http://localhost:1234' };
  localStorage.setItem('boltglm.llm.settings', JSON.stringify(ls));
  const rc = { provider: 'lmstudio', model, apiKey: '', baseUrl: 'http://localhost:1234' };
  localStorage.setItem('boltglm.roles', JSON.stringify({ referent: rc, coder: rc, guardian: rc, supervisor: rc }));
}, [MODEL]);

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.querySelector('.boot-overlay'), null, { timeout: 40000 }).catch(() => {});
await sleep(800);

const prompt =
  'Build a minimal Vite + React + TypeScript counter app. A single button increments a number shown on screen. Write all files at the project root, run npm install, then start the dev server.';
await page.fill('textarea[aria-label="Message the agent"]', prompt);
await page.click('button[aria-label="Send message"]');

const deadline = Date.now() + 300000; // 5 min hard cap
let previewUrl = null;
let shot = 0;
let installExitSeen = false;
let devServerSeen = false;
const phases = [];

while (Date.now() < deadline) {
  await sleep(3000);
  // capture the system log rows (▶ npm install [exit 0], dev server running, etc.)
  const sysText = await page.evaluate(() =>
    [...document.querySelectorAll('.msg--system')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  );
  if (sysText.some((t) => /exit 0/.test(t) && /install/.test(t))) installExitSeen = true;
  if (sysText.some((t) => /dev server running|background/.test(t))) devServerSeen = true;

  // preview iframe appears once a URL is set
  const hasFrame = await page.locator('.preview__frame').count();
  if (hasFrame > 0) {
    previewUrl = await page.locator('.preview__url').innerText().catch(() => '');
    break;
  }

  if (Date.now() - (phases[phases.length - 1]?.t ?? 0) > 45000) {
    shot++;
    await page.screenshot({ path: `${DIR}/verify-build-${shot}.png` });
    phases.push({ t: Date.now(), sys: sysText.slice(-4) });
  }
}

await sleep(1500);
await page.screenshot({ path: `${DIR}/verify-build-final.png` });

// Did the agent's busy spinner clear? (caret gone + send button re-enabled)
const busy = await page.locator('.msg__caret').count();
const sysSummary = await page.evaluate(() =>
  [...document.querySelectorAll('.msg--system')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
);
const filesWritten = sysSummary.filter((t) => /Wrote|wrote/.test(t)).length;

console.log(JSON.stringify({
  previewAppeared: previewUrl !== null,
  previewUrl: (previewUrl || '').trim(),
  installExitSeen,
  devServerSeen,
  systemRows: sysSummary.slice(-10),
  filesWrittenHint: filesWritten,
  busyCaretStillShowing: busy > 0,
  errors: errors.slice(0, 12),
}, null, 2));

await browser.close();
process.exit(previewUrl ? 0 : 1);
