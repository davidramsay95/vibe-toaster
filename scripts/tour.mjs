import { chromium } from 'playwright-core';
// usage: node tour.mjs outPrefix w h  "sel:offsetFrac|..." e.g. "#anatomy:0.3"
const [,, prefix, w='1440', h='900', ...specs] = process.argv;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
page.on('console', m => { if (['error','warning'].includes(m.type())) console.log('[console.'+m.type()+']', m.text().slice(0,300)); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.evaluate(() => document.getElementById("cookie").style.display="none");
let i = 0;
for (const spec of specs) {
  const [sel, frac='0', px='0'] = spec.split(':');
  await page.evaluate(([sel, frac, px]) => {
    const el = document.querySelector(sel);
    const top = el.getBoundingClientRect().top + scrollY;
    const range = Math.max(0, el.offsetHeight - innerHeight);
    window.scrollTo(0, top + range * parseFloat(frac) + parseFloat(px));
  }, [sel, frac, px]);
  await page.waitForTimeout(1200);
  for (let k = 0; k < 6; k++) { await page.evaluate(() => window.__stage && window.__stage.snap()); await page.waitForTimeout(500); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${prefix}${i++}.png` });
}
await browser.close();
