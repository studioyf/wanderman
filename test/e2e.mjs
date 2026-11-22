// WanderMan in Chrome, as on the iPhone: add the Berlin test trip, let its map save itself, then cut the
// signal and reload: the app, the trip and the map must all still be there.
// Run: node test/e2e.mjs <a scratch folder>   (builds the app first; screenshots land in <scratch>/e2e/)
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const LIBS = process.env.TERRA_CHROME_LIBS || (process.env.HOME + '/.local/chrome-libs/root');
if (process.platform !== 'darwin') process.env.LD_LIBRARY_PATH = [LIBS + '/usr/lib/x86_64-linux-gnu', LIBS + '/lib/x86_64-linux-gnu', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const REPO = new URL('..', import.meta.url).pathname;
const SP = process.argv[2] || fs.mkdtempSync('/tmp/wm-e2e-');
const OUT = path.join(SP, 'e2e'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

execSync('npx vite build', { cwd: REPO, stdio: 'ignore' });

// The built app, served the way a host serves it: files as they are, every other address gets the app.
const DIST = path.join(REPO, 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${srv.address().port}/`;

const results = [];
const ok = (name, pass, extra = '') => { results.push([name, pass]); console.log((pass ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + String(extra).slice(0, 300) + ']' : '')); };
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300)));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
const mapDrawn = (ms = 60000) => p.waitForFunction(() => { const m = window.__wmMap; return m && m.loaded() && m.areTilesLoaded() && document.querySelector('.map')?.dataset.ready === '1'; }, null, { timeout: ms, polling: 500 });

try {
  await p.goto(URL_);
  await p.waitForSelector('#add-berlin');
  ok('the app opens with no trips and offers Berlin', (await p.locator('.trip-card').count()) === 0);
  await shot('01-home');

  await p.click('#add-berlin');
  await p.waitForSelector('[data-place]');
  const placeRows = await p.locator('[data-place]').count();
  ok('Berlin opens with its places listed by area', placeRows >= 27 && (await p.locator('[data-area]').count()) === 7, `${placeRows} places`);
  await mapDrawn();
  const dots = await p.evaluate(() => window.__wmMap.querySourceFeatures('places').length);
  ok('the places are on the map', dots >= 25, `${dots} dots`);
  await shot('02-berlin');

  await p.waitForSelector('[data-offline="saved"]', { timeout: 180000 });
  const saved = await p.evaluate(async () => { const c = await caches.open('wm-map'); const k = (await c.keys()).map((r) => r.url); return { n: k.length, extras: k.filter((u) => /sprites|fonts/.test(u)).map((u) => u.split('/').slice(-2).join('/')) }; });
  ok('the map saves itself for offline', saved.n > 100 && saved.extras.length >= 13, `${saved.n} pieces kept; ${saved.extras.join(' ')}`);

  // Tap a place in the list: it opens a short card.
  await p.locator('[data-place]').filter({ hasText: 'Neue Nationalgalerie' }).click();
  await p.waitForSelector('[data-peek]');
  ok('tapping a place shows its card', /Cattelan/.test(await p.textContent('[data-peek]')));
  await shot('03-place');

  // The days, with what is already done (the trip as it went, #372).
  await p.click('.tabs button:has-text("Days")');
  await p.waitForSelector('[data-stop]');
  ok('the days show what is done', (await p.locator('[data-stop="done"]').count()) === 5 && /Berlin Wall Memorial/.test(await p.textContent('.scroll')));
  await shot('03b-days');
  await p.click('.tabs button:has-text("Places")');

  // Make sure the service worker is in charge of the page before the signal goes.
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload(); await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
  ok('the app is installed for offline use', await p.evaluate(() => !!navigator.serviceWorker.controller));

  // Flight mode.
  await ctx.setOffline(true);
  const fromNet = [];
  p.on('response', (r) => { if (/openfreemap/.test(r.url()) && !r.fromServiceWorker()) fromNet.push(r.url()); });
  const failed = [];
  p.on('requestfailed', (r) => { if (/openfreemap/.test(r.url())) failed.push(r.url()); });
  await p.reload();
  await p.waitForSelector('[data-place]', { timeout: 20000 });
  ok('with no signal, the trip still opens', (await p.locator('[data-place]').count()) === placeRows);
  await mapDrawn(60000).catch(() => {});
  const offlineDots = await p.evaluate(() => window.__wmMap?.querySourceFeatures('places').length || 0);
  const tilesShown = await p.evaluate(() => window.__wmMap?.querySourceFeatures('openmaptiles', { sourceLayer: 'transportation' }).length || 0);
  ok('with no signal, the map draws from what was saved', offlineDots >= 25 && tilesShown > 0 && failed.length === 0, `${offlineDots} dots, ${tilesShown} streets drawn, ${failed.length} failed ${failed[0] || ''}`);
  ok('with no signal, nothing is asked of the network', fromNet.length === 0, fromNet[0]);
  ok('the screen says so', /Works offline/.test(await p.textContent('.bar')));
  await shot('04-offline');

  // Zoom right in on Kulturforum: street level must still draw.
  await p.evaluate(() => window.__wmMap.jumpTo({ center: [13.3675, 52.5069], zoom: 16 }));
  await mapDrawn(30000).catch(() => {});
  ok('street level draws offline', failed.length === 0, failed[0]);
  await shot('05-offline-street');
  await ctx.setOffline(false);

  // The three looks.
  await p.goto(URL_ + '#/settings');
  await p.waitForSelector('[data-look-choice]');
  ok('three looks to choose from', (await p.locator('[data-look-choice]').count()) === 3);
  for (const look of ['paper', 'signal', 'atlas']) {
    await p.goto(URL_ + '#/settings'); await p.click(`[data-look-choice="${look}"]`);
    const set = await p.evaluate(() => document.documentElement.dataset.look);
    await p.goto(URL_ + '#/trip/0b3e1100-0000-4000-8000-000000000001'); await p.waitForSelector('[data-place]'); await mapDrawn().catch(() => {});
    await shot('06-look-' + look);
    ok(`the ${look} look applies and stays`, set === look && (await p.evaluate(() => document.documentElement.dataset.look)) === look);
  }

  // Pace is a setting.
  await p.goto(URL_ + '#/settings'); await p.waitForSelector('.stepper');
  await p.locator('.stepper').first().getByLabel('Less').click();
  ok('pace can be changed', (await p.locator('.stepper strong').first().textContent()) === '3');

  // On the Mac: list beside the map.
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto(URL_ + '#/trip/0b3e1100-0000-4000-8000-000000000001'); await p.waitForSelector('[data-place]'); await mapDrawn().catch(() => {});
  await shot('07-mac');
  const panelLeft = await p.evaluate(() => document.querySelector('.panel').getBoundingClientRect().left);
  ok('on a wide screen the list sits beside the map', panelLeft < 10);
} catch (e) {
  ok('the run finished', false, e.message);
  await shot('99-failure').catch(() => {});
} finally {
  await b.close(); srv.close();
  const bad = results.filter((r) => !r[1]);
  console.log(`\n${results.length - bad.length} of ${results.length} held. Screenshots in ${OUT}`);
  process.exit(bad.length ? 1 : 0);
}
