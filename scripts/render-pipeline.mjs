import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const DIR = 'C:/Users/angiz/Desktop/old Desktop/Desktop/CODEX/C GLM5.2/Editor js/scripts';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await page.evaluate(() => document.querySelector('.boot-overlay')?.remove());

// Open Settings FIRST (drawer would cover the gear) to view the Roles section
await page.click('button[aria-label="Open settings"]').catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${DIR}/shot-roles.png` });

// Measure Roles section WHILE settings is open
const rolesMetrics = await page.evaluate(() => {
  const pick = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    modal: pick('.modal'),
    rolesSection: pick('.modal__section'),
    roleRows: document.querySelectorAll('.role-row').length,
    roleRowDims: [...document.querySelectorAll('.role-row')].map((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }),
    maxIterInput: pick('#set-max-iter'),
  };
});

// Close settings, then open the Supervised pipeline drawer
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('button[aria-label="Open supervised pipeline"]').catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: `${DIR}/shot-drawer.png` });

const drawerMetrics = await page.evaluate(() => {
  const pick = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    drawer: pick('.pipeline-drawer'),
    phaseStepper: pick('.phase-stepper'),
    resourceChip: pick('.resource-chip'),
  };
});

console.log(JSON.stringify({ errors, rolesMetrics, drawerMetrics }, null, 2));
await browser.close();
