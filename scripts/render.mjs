import { chromium } from 'playwright-core';
const C = (o) => o;
const hero = { spin: -0.55, el: 0.2, dist: 8.6, ty: 0.95, pop: 1, heat: 0.25, level: 0.5 };
const SHOTS = [
  ['hero-34', 1600, 1180, C(hero)],
  ['display', 1600, 1180, C({ spin: -0.0, el: 0.04, dist: 4.1, tx: -0.28, ty: 0.78, pop: 0, heat: 0, level: 0, display: { mode: 'toast', level: 3.7, progress: 0.62, clock: '00:43', bread: 'SOURDOUGH', conf: '94.2%' } })],
  ['top', 1600, 1180, C({ spin: 0.0, el: 1.15, dist: 8.2, ty: 1.0, pop: 0.45, heat: 0.9, level: 0.5 })],
  ['slot', 1600, 1180, C({ spin: -0.45, el: 0.5, dist: 4.2, ty: 1.55, pop: 0.85, heat: 0.9, level: 0.55 })],
  ['obsidian', 1600, 1180, C({ ...hero, color: 'obsidian', spin: -0.62 })],
  ['ember', 1600, 1180, C({ ...hero, color: 'ember', spin: -0.5 })],
  ['oat', 1600, 1180, C({ ...hero, color: 'oat', spin: -0.5 })],
  ['exploded', 1600, 1180, C({ explode: 1, dist: 24, ty: 4.9, el: 0.3, spin: -0.3, pop: 0.35, heat: 0.6, display: { mode: 'anatomy' } })],
  ['og', 1200, 630, C({ ...hero, dist: 9.2, tx: 0, ty: 1.0, shift: 0.0 })],
];
const only = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, w, h, cfg] of SHOTS) {
  if (only.length && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:5173/render.html?p=' + encodeURIComponent(JSON.stringify(cfg)), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `public/img/${name}.jpg`, type: 'jpeg', quality: 90 });
  console.log('rendered', name);
  await page.close();
}
await browser.close();
