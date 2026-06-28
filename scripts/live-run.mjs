/**
 * Live end-to-end Presence pipeline run (Playwright). Pre-seeds LM Studio as the
 * provider for every role, then drives: brainstorm -> generate PIF -> approve ->
 * build (auto-approving iteration/escalation gates) -> guardian. Screenshots each
 * phase and reports task statuses + any errors. Local-first: no API key.
 *
 *   npm run live:run
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const DIR = 'C:/Users/angiz/Desktop/old Desktop/Desktop/CODEX/C GLM5.2/Editor js/scripts';
const MODEL = 'meta-llama-3.1-8b-instruct';
const BASE = 'http://localhost:1234';
const IDEA = 'A Node.js command-line script that prints the current date and time when run.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitStable(getter, { stableMs = 4000, timeout = 90000 } = {}) {
  const start = Date.now();
  let last = '';
  let since = Date.now();
  while (Date.now() - start < timeout) {
    const cur = await getter().catch(() => '');
    if (cur === last) {
      if (Date.now() - since >= stableMs) return cur;
    } else {
      last = cur;
      since = Date.now();
    }
    await sleep(1000);
  }
  return last;
}

async function clickApprove(page) {
  for (const t of ['Approve & Build', 'Approve', 'Escalate', 'Continue']) {
    const btn = page.locator(`:visible:has-text("${t}")`, { hasText: t }).first();
    try {
      if (await btn.count()) { await btn.click({ timeout: 2000 }); return true; }
    } catch { /* try next */ }
  }
  // broad fallback: any button with approve-like text
  try {
    await page.locator(`button:has-text(/approve|build|escalate|continue/i)`).first().click({ timeout: 2000 });
    return true;
  } catch { return false; }
}

// Normal launch. Local LLM calls go through the Vite /__local same-origin proxy
// (no CORS), and WebContainer boots normally via COOP/COEP.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const failed = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText ?? ''}`));

// Pre-seed LM Studio for base settings + every role, before the app loads.
await page.addInitScript(([model, base]) => {
  const ls = { provider: 'lmstudio', apiKey: '', model, baseUrl: base };
  localStorage.setItem('boltglm.llm.settings', JSON.stringify(ls));
  const rc = { provider: 'lmstudio', model, apiKey: '', baseUrl: base };
  localStorage.setItem('boltglm.roles', JSON.stringify({ referent: rc, coder: rc, guardian: rc, supervisor: rc }));
}, [MODEL, BASE]);

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.querySelector('.boot-overlay'), null, { timeout: 30000 }).catch(() => {});
await sleep(1000);
await page.screenshot({ path: `${DIR}/live-1-boot.png` });
console.log('phase: boot done');

// 1) Brainstorm
await page.click('button[aria-label="Open supervised pipeline"]').catch(() => {});
await page.waitForSelector('.pipeline-drawer', { timeout: 8000 });
await page.fill('.pipeline-drawer textarea', IDEA).catch(async () => { await page.fill('textarea', IDEA).catch(() => {}); });
await page.click('button:has-text("Begin")').catch(async () => { await page.click('button:has-text("Send")').catch(() => {}); });
await page.waitForSelector('.msg--assistant', { timeout: 90000 }).catch(() => {});
await waitStable(() => page.locator('.msg--assistant').last().innerText().catch(() => ''), { stableMs: 5000, timeout: 120000 });
await page.screenshot({ path: `${DIR}/live-2-brainstorm.png` });
console.log('phase: brainstorm captured');

// 2) Generate PIF + plan approval
await page.click('button:has-text("Generate PIF")').catch(async () => { await page.click('button:has-text("Generate")').catch(() => {}); });
await page.waitForSelector('.modal-overlay, .approval-dialog', { timeout: 120000 }).catch(() => {});
await sleep(1000);
await page.screenshot({ path: `${DIR}/live-3-pif.png` });
console.log('phase: PIF captured');
await clickApprove(page); // approve the plan
await sleep(2000);

// 3) Build: auto-approve iteration/escalation gates; screenshot periodically
const deadline = Date.now() + 240000;
let lastShot = 0;
while (Date.now() < deadline) {
  await sleep(2500);
  if ((await page.locator('.modal-overlay').count()) > 0) { await clickApprove(page); await sleep(1500); }
  if (Date.now() - lastShot > 18000) { await page.screenshot({ path: `${DIR}/live-4-build.png` }); lastShot = Date.now(); }
  // stop if every task row reached a terminal-ish state
  const states = await page.evaluate(() => [...document.querySelectorAll('.task-row .badge, .task-row [class*=badge]')].map((e) => e.textContent?.trim() || ''));
  const terminal = states.length > 0 && states.every((s) => /validated|approved|failed|rejected/i.test(s));
  if (terminal) break;
}

// 4) Final state
await sleep(1500);
await page.screenshot({ path: `${DIR}/live-5-final.png` });
const summary = await page.evaluate(() => {
  const active = document.querySelector('.phase-step--active')?.textContent?.trim() ?? null;
  const rows = [...document.querySelectorAll('.task-row')].map((r) => ({
    text: (r.textContent || '').replace(/\s+/g, ' ').slice(0, 120),
  }));
  return { activeStep: active, taskRows: rows };
});
console.log(JSON.stringify({ errors: errors.slice(0, 12), failedRequests: failed.slice(0, 12), summary }, null, 2));
await browser.close();
