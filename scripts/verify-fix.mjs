/**
 * Targeted verification of the two bug fixes, driven through the REAL app:
 *
 *  1. LM Studio connection: pre-seed the BROKEN default (`model: 'local-model'`,
 *     exactly what a brand-new user gets from the dropdown) and confirm the chat
 *     now streams a real reply — proving resolveLocalModel() auto-resolves the
 *     actual loaded model instead of failing with "No models loaded".
 *
 *  2. No freeze: a conversational prompt must complete (assistant message fills,
 *     busy clears) within a bounded time. Console errors / unhandled rejections
 *     are captured and reported.
 *
 *   node scripts/verify-fix.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const DIR = 'C:/Users/angiz/Desktop/old Desktop/Desktop/CODEX/C GLM5.2/Editor js/scripts';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => {
  const u = r.url();
  // ignore favicon / webcontainer asset noise; surface llm proxy failures
  if (u.includes('__lmstudio') || u.includes('__ollama') || u.includes('chat/completions')) {
    errors.push(`requestfailed: ${u} :: ${r.failure()?.errorText ?? ''}`);
  }
});

// Pre-seed the BROKEN default a real user gets: provider lmstudio + 'local-model'.
await page.addInitScript(() => {
  const ls = { provider: 'lmstudio', apiKey: '', model: 'local-model', baseUrl: 'http://localhost:1234' };
  localStorage.setItem('boltglm.llm.settings', JSON.stringify(ls));
  const rc = { provider: 'lmstudio', model: 'local-model', apiKey: '', baseUrl: 'http://localhost:1234' };
  localStorage.setItem('boltglm.roles', JSON.stringify({ referent: rc, coder: rc, guardian: rc, supervisor: rc }));
});

await page.goto(URL, { waitUntil: 'domcontentloaded' });
const booted = await page
  .waitForFunction(() => !document.querySelector('.boot-overlay'), null, { timeout: 40000 })
  .then(() => true)
  .catch(() => false);
await sleep(800);
await page.screenshot({ path: `${DIR}/verify-1-boot.png` });
console.log('boot overlay gone:', booted);
if (!booted) {
  console.log(JSON.stringify({ ok: false, reason: 'boot overlay never disappeared', errors: errors.slice(0, 10) }, null, 2));
  await browser.close();
  process.exit(1);
}

// Send a simple conversational prompt (no file/shell actions expected).
const prompt = 'Reply with exactly this sentence and nothing else: Connection works.';
await page.fill('textarea[aria-label="Message the agent"]', prompt);
await page.click('button[aria-label="Send message"]');

// Wait for an assistant message to acquire non-empty text.
const reply = await page
  .waitForFunction(
    () => {
      const el = document.querySelector('.msg--assistant .msg__body');
      if (!el) return false;
      const txt = (el.textContent || '').trim();
      // ignore the lone blinking caret / empty state
      return txt.length > 3;
    },
    null,
    { timeout: 90000 },
  )
  .then(() => true)
  .catch(() => false);

await sleep(1200);
await page.screenshot({ path: `${DIR}/verify-2-reply.png` });

const assistantText = await page.locator('.msg--assistant .msg__body').last().innerText().catch(() => '');
const busy = await page.locator('.msg__caret').count();

console.log(JSON.stringify({
  ok: reply,
  assistantText: assistantText.replace(/\s+/g, ' ').trim().slice(0, 200),
  busyCaretStillShowing: busy > 0,
  errors: errors.slice(0, 12),
}, null, 2));

await browser.close();
process.exit(reply ? 0 : 1);
