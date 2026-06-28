import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const SHOT = 'C:/Users/angiz/Desktop/old Desktop/Desktop/CODEX/C GLM5.2/Editor js/scripts/layout-shot.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleMsgs = [];
const errors = [];
const failedReq = [];
page.on('console', (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => errors.push(e.stack || String(e)));
page.on('requestfailed', (r) => failedReq.push(`${r.url()} :: ${r.failure()?.errorText}`));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
// Give WebContainer time to boot (or fail).
await page.waitForTimeout(8000);

const bootOverlay = await page.$('.boot-overlay');
const bootText = bootOverlay ? (await bootOverlay.innerText()).replace(/\s+/g, ' ').slice(0, 200) : null;

// Dump computed sizes of every layout-relevant element.
const metrics = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, missing: true };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      sel, w: Math.round(r.width), h: Math.round(r.height),
      display: cs.display, flexDir: cs.flexDirection,
      overflow: cs.overflow, gap: cs.gap, padding: cs.padding,
    };
  };
  const all = (sel) => [...document.querySelectorAll(sel)].map((el) => {
    const r = el.getBoundingClientRect();
    return { tag: el.hasAttribute('data-panel') ? 'panel' : el.className, w: Math.round(r.width), h: Math.round(r.height) };
  });
  return {
    root: pick('#root'),
    appShell: pick('.app-shell'),
    topbar: pick('.topbar'),
    workspace: pick('.workspace'),
    panels: all('[data-panel]'),
    innerPanels: [...document.querySelectorAll('[data-panel] > .panel')].map((el) => {
      const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) };
    }),
    chat: pick('.chat'),
    chatHead: pick('.chat__head'),
    chatLog: pick('.chat__log'),
    chatInput: pick('.chat__input'),
    fileTree: pick('.file-tree'),
    editor: pick('.editor'),
    editorTabs: pick('.editor__tabs'),
    editorBody: pick('.editor__body'),
    monaco: pick('.monaco-editor'),
    preview: pick('.preview'),
    terminal: pick('.terminal'),
    xterm: pick('.xterm'),
  };
});

// Reveal the shell even if the boot overlay is up, then screenshot.
await page.evaluate(() => document.querySelector('.boot-overlay')?.remove());
await page.waitForTimeout(500);
await page.screenshot({ path: SHOT, fullPage: false });

console.log(JSON.stringify({ bootText, metrics, consoleMsgs: consoleMsgs.slice(0, 25), errors: errors.slice(0, 15), failedReq: failedReq.slice(0, 15) }, null, 2));

await browser.close();
