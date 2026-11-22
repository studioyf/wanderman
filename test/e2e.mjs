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
// Let the map settle first: a frame asked for mid-flight can stall software drawing past the timeout.
const shot = async (n) => {
  await p.waitForFunction(() => { const m = window.__wmMap; return !m || (!m.isMoving() && m.areTilesLoaded()); }, null, { timeout: 15000, polling: 250 }).catch(() => {});
  await p.screenshot({ path: `${OUT}/${n}.png`, timeout: 60000 });
};
const mapDrawn = (ms = 60000) => p.waitForFunction(() => { const m = window.__wmMap; return m && m.loaded() && m.areTilesLoaded() && document.querySelector('.map')?.dataset.ready === '1'; }, null, { timeout: ms, polling: 500 });

try {
  const TRIP = URL_ + '#/trip/0b3e1100-0000-4000-8000-000000000001';
  const dots = () => p.evaluate(() => (window.__wmMap?.querySourceFeatures('stops').length || 0) + (window.__wmMap?.querySourceFeatures('others').length || 0));
  const stopNames = () => p.locator('.stops .stop-main .name').allTextContents();
  // Go to a day of the Berlin trip through the Trip tab, whatever today is.
  const openDay = async (label) => { await p.click('[data-tab="trip"]'); await p.locator('.info .menu-item', { hasText: label }).click(); await p.waitForSelector('[data-day]'); };

  await p.goto(URL_);
  await p.waitForSelector('#add-berlin');
  ok('the app opens with no trips and offers Berlin', (await p.locator('.trip-card').count()) === 0);
  await shot('01-home');

  await p.click('#add-berlin');
  await p.waitForSelector('.trip-phone .sheet');
  await mapDrawn();
  ok('Berlin opens on the map, the day in a sheet, four tabs and a note button', (await p.locator('.tabbar [data-tab]').count()) === 4 && (await p.locator('[data-quick-note]').count()) === 1 && (await dots()) >= 25, `${await dots()} dots`);
  await shot('02-berlin');

  await p.waitForSelector('[data-offline="saved"]', { timeout: 180000 });
  const saved = await p.evaluate(async () => { const c = await caches.open('wm-map'); const k = (await c.keys()).map((r) => r.url); return { n: k.length, extras: k.filter((u) => /sprites|fonts/.test(u)).length }; });
  ok('the map saves itself for offline', saved.n > 100 && saved.extras >= 13, `${saved.n} pieces kept`);

  // Sunday as it went: all done.
  await openDay('Sun 22 Nov');
  ok('Sunday shows what was done', (await p.locator('.stops [data-stop="done"]').count()) === 3);

  // Monday as planned: seven stops, too full, Gazzo far off the walk.
  await openDay('Mon 23 Nov');
  const monday = await stopNames();
  ok('Monday reads in order with the way between stops', monday.length === 7 && monday[0] === 'Berlin Wall Memorial' && (await p.locator('.stops .leg').count()) === 6, monday.join(', '));
  ok('Monday says it is too full', await p.locator('[data-warn]').isVisible());
  const light = (await p.textContent('[data-light]')) || '';
  ok('Monday shows its light: blue hour, sunrise, golden hour, sunset', /06:4\d/.test(light) && /07:4\d/.test(light) && /Sunset16:0\d/.test(light), light);
  ok('Gazzo is flagged far off the walk', /Gazzo/.test(await p.locator('.stop-row', { has: p.locator('.leg.far') }).first().textContent()));
  await p.click('[data-tab="today"]'); // back to the sheet's day view: Today shows the last day opened
  await shot('03-monday');

  // Tidy: before and after, then accepted.
  await p.click('[data-tidy]');
  await p.waitForSelector('.tidy-cols');
  await shot('04-tidy');
  await p.click('[data-tidy-accept]');
  await p.waitForFunction(() => document.querySelectorAll('.stops .stop-main').length < 7);
  const tidied = await stopNames();
  ok('Tidy swaps Gazzo for a meal near the walk and pushes Topographie', !tidied.includes('Gazzo') && !tidied.includes('Topographie des Terrors') && tidied[0] === 'Berlin Wall Memorial', tidied.join(', '));

  // Swipe the first stop right: done.
  const first = p.locator('.stops .stop-main').first();
  await first.scrollIntoViewIfNeeded();
  // Wait for the row to sit still: after Tidy the list and the sheet can still be settling.
  let fb = await first.boundingBox();
  for (let i = 0; i < 20; i++) { await p.waitForTimeout(150); const nb = await first.boundingBox(); if (nb && Math.abs(nb.y - fb.y) < 1 && Math.abs(nb.x - fb.x) < 1) break; fb = nb; }
  const under = await p.evaluate(([x, y]) => { let e = document.elementFromPoint(x, y), out = []; while (e && out.length < 5) { out.push(e.tagName + '.' + String(e.className).split(' ')[0]); e = e.parentElement; } return out.join('<'); }, [fb.x + 60, fb.y + fb.height / 2]);
  await p.evaluate(() => { window.__ev = []; for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(t, (e) => window.__ev.push(t.replace('pointer', '') + ':' + String(e.target.className).split(' ')[0]), true); });
  await p.mouse.move(fb.x + 60, fb.y + fb.height / 2); await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(fb.x + 60 + i * 20, fb.y + fb.height / 2);
  const mid = await first.evaluate((e) => e.style.transform || 'none');
  await p.mouse.up();
  await p.waitForSelector('.stops [data-stop="done"]', { timeout: 5000 }).catch(() => {});
  const states = await p.locator('.stops > li').evaluateAll((ls) => ls.map((l) => l.dataset.stop).join(' '));
  ok('a swipe to the right marks a stop done', (await p.locator('.stops [data-stop="done"]').count()) === 1, `moved ${mid}, rows ${states}, under ${under}, events ${(await p.evaluate(() => window.__ev)).slice(0, 8).join(' ')}`);

  // Hold the third stop's handle and drag it to second place (rows further down sit under the tab bar).
  const before = await stopNames();
  await p.locator('.stops .handle').nth(2).scrollIntoViewIfNeeded();
  const h = await p.locator('.stops .handle').nth(2).boundingBox(), target = await p.locator('.stops .stop-main').nth(1).boundingBox();
  await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await p.mouse.down();
  for (let i = 1; i <= 12; i++) await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + ((target.y + 6) - (h.y + h.height / 2)) * i / 12);
  await p.mouse.up();
  await p.waitForTimeout(400);
  const after = await stopNames();
  ok('holding the handle and dragging reorders the day', after[1] === before[2] && after[2] === before[1], after.join(', '));

  // A stop's card, and finding something near it.
  await p.locator('.stops .stop-main', { hasText: 'Berlinische Galerie' }).click();
  await p.waitForSelector('[data-card]');
  ok('tapping a stop opens its card in the sheet', /Lovis Corinth/.test(await p.textContent('[data-card]')));
  await p.locator('[data-nearby] .chip', { hasText: 'Pizzeria' }).click();
  await p.waitForSelector('[data-google]');
  const g = await p.getAttribute('[data-google]', 'href');
  ok('Find near here searches around the stop, here and in Google Maps', /google\.com\/maps\/search\/Pizzeria\/@52\.50/.test(g), g);
  const hits = await p.waitForSelector('[data-hit]', { timeout: 10000 }).then(() => p.locator('[data-hit]').count()).catch(() => 0);
  console.log(`     (${hits} pizzerias found on OpenStreetMap near Berlinische Galerie)`);
  await shot('05-card-nearby');
  await p.click('[data-card] .icon[aria-label="Close"]');

  // The preview card: photo, two lines, Monday's hours, the way from the stop before, ticket, website, Maps, remove.
  await p.locator('.stops .stop-main', { hasText: 'Gropius Bau' }).click();
  await p.waitForSelector('[data-card]');
  const photo = await p.waitForSelector('[data-card-photo]', { timeout: 60000 }).then(() => true).catch(() => false);
  await p.waitForFunction(() => document.querySelector('[data-card-photo]')?.complete, null, { timeout: 15000 }).catch(() => {});
  const card = async (sel) => (await p.locator(sel).count()) ? (await p.textContent(sel)).trim() : '';
  const facts = { hours: await card('[data-card-hours]'), way: await card('[data-card-way]'), ticket: await card('[data-card-ticket]'), blurb: await card('[data-card-blurb]') };
  ok('the card has a photo and two lines from Wikipedia', photo && /exhibition/i.test(facts.blurb), facts.blurb.slice(0, 80));
  ok('the card gives the hours of the day it is planned on', facts.hours === '12:00 to 19:00', facts.hours);
  ok('the card says how to get there and about tickets', /from Berlin Wall Memorial|from /.test(facts.way) && /Ticket|Booked|Free/.test(facts.ticket), `${facts.way} · ${facts.ticket}`);
  ok('the card links to the website and to Maps, and offers Remove', (await p.locator('[data-card-site]').count()) === 1 && /maps/.test(await p.getAttribute('[data-card-maps]', 'href')) && (await p.locator('[data-card-remove]').count()) === 1);
  await p.locator('[data-card]').evaluate((e) => e.closest('.sheet-body, .sheet, .floatcard')?.scrollTo?.(0, 0));
  await shot('05b-card-preview');
  await p.click('[data-card] .icon[aria-label="Close"]');

  // To pick from: + puts a place on the day.
  await p.click('[data-tab="places"]');
  await p.waitForSelector('[data-pick]');
  const pick = p.locator('.pick-row', { hasText: 'Checkpoint Charlie' });
  ok('Places lists what is saved and on no day', (await pick.count()) === 1 && (await p.locator('.pick-row', { hasText: 'Gropius Bau' }).count()) === 0);
  await shot('06-pick');
  await pick.locator('.add').click();
  await p.click('[data-tab="today"]');
  ok('+ puts it on the day', (await stopNames()).includes('Checkpoint Charlie'));

  // Make sure the service worker is in charge of the page before the signal goes.
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload(); await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
  ok('the app is installed for offline use', await p.evaluate(() => !!navigator.serviceWorker.controller));

  // Flight mode.
  await ctx.setOffline(true);
  const fromNet = [], failed = [];
  p.on('response', (r) => { if (/openfreemap/.test(r.url()) && !r.fromServiceWorker()) fromNet.push(r.url()); });
  p.on('requestfailed', (r) => { if (/openfreemap/.test(r.url())) failed.push(r.url()); });
  await p.reload();
  await p.waitForSelector('.trip-phone .sheet', { timeout: 20000 });
  await mapDrawn(60000).catch(() => {});
  const tilesShown = await p.evaluate(() => window.__wmMap?.querySourceFeatures('openmaptiles', { sourceLayer: 'transportation' }).length || 0);
  ok('with no signal, the trip and its map open from what was saved', (await dots()) >= 25 && tilesShown > 0 && failed.length === 0, `${await dots()} dots, ${tilesShown} streets drawn, ${failed.length} failed ${failed[0] || ''}`);
  ok('with no signal, nothing is asked of the network', fromNet.length === 0, fromNet[0]);
  ok('the screen says so', /Works offline/.test(await p.textContent('.floats')));
  await shot('07-offline');
  await p.evaluate(() => window.__wmMap.jumpTo({ center: [13.3675, 52.5069], zoom: 16 }));
  await mapDrawn(30000).catch(() => {});
  ok('street level draws offline', failed.length === 0, failed[0]);
  await ctx.setOffline(false);

  // The three looks.
  await p.goto(URL_ + '#/settings');
  await p.waitForSelector('[data-look-choice]');
  ok('three looks to choose from', (await p.locator('[data-look-choice]').count()) === 3);
  for (const look of ['paper', 'signal', 'atlas']) {
    await p.goto(URL_ + '#/settings'); await p.click(`[data-look-choice="${look}"]`);
    const set = await p.evaluate(() => document.documentElement.dataset.look);
    await p.goto(TRIP); await p.waitForSelector('.sheet'); await mapDrawn().catch(() => {});
    await shot('08-look-' + look);
    ok(`the ${look} look applies and stays`, set === look && (await p.evaluate(() => document.documentElement.dataset.look)) === look);
  }
  await p.goto(URL_ + '#/settings'); await p.click('[data-look-choice="paper"]');

  // Pace is a setting.
  await p.waitForSelector('.stepper');
  await p.locator('.stepper').first().getByLabel('Less').click();
  ok('pace can be changed', (await p.locator('.stepper strong').first().textContent()) === '3');
  await p.locator('.stepper').first().getByLabel('More').click();

  // Quick notes: from a stop's card, and a photo from the note button; both still there after a reload.
  await p.goto(TRIP); await p.waitForSelector('.trip-phone .sheet');
  await openDay('Mon 23 Nov'); await p.click('[data-tab="today"]');
  await p.locator('.stops .stop-main', { hasText: 'Gropius Bau' }).click();
  await p.click('[data-card-note]');
  await p.fill('[data-note-text]', 'Stötzer room upstairs, the light through the atrium');
  await p.click('[data-note-save]');
  await p.click('[data-card] .icon[aria-label="Close"]');
  await p.click('[data-quick-note]');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
  await p.setInputFiles('.note-photo input', { name: 'shot.png', mimeType: 'image/png', buffer: png });
  await p.waitForFunction(() => !document.querySelector('.overlay'), null, { timeout: 5000 }).catch(() => {});
  await p.reload(); await p.waitForSelector('.trip-phone .sheet');
  await p.click('[data-tab="notes"]');
  await p.waitForSelector('[data-note]', { timeout: 5000 }).catch(() => {});
  const noteText = (await p.textContent('[data-notes]')) || '';
  ok('a note on a stop is kept with its time and place after a reload', /Stötzer room upstairs/.test(noteText) && /Gropius Bau/.test(noteText) && /\d\d:\d\d/.test(noteText), noteText.slice(0, 120));
  ok('a photo note is kept on the device', (await p.locator('.note-photo-img').count()) === 1);
  await shot('11-notes');

  // Fixed times: Tuesday shows the check-out and the flight home; a ticket PDF attaches and opens.
  await openDay('Tue 24 Nov'); await p.click('[data-tab="today"]');
  const anchorsText = (await p.textContent('[data-day-anchors]').catch(() => '')) || '';
  ok('Tuesday shows its fixed times in order', /11:00.*Check out.*12:00.*Flight home/s.test(anchorsText), anchorsText);
  await p.locator('[data-day-anchors] .anchor-row', { hasText: 'Flight home' }).click();
  const pdf = Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  await p.setInputFiles('[data-ticket-file]', { name: 'boarding-pass.pdf', mimeType: 'application/pdf', buffer: pdf });
  await p.waitForSelector('[data-ticket-open]', { timeout: 5000 }).catch(() => {});
  const [popup] = await Promise.all([p.waitForEvent('popup', { timeout: 8000 }).catch(() => null), p.click('[data-ticket-open]').catch(() => {})]);
  const href = await p.getAttribute('[data-ticket-open]', 'href').catch(() => '');
  const head = href ? await p.evaluate(async (u) => (await (await fetch(u)).text()).slice(0, 8), href) : '';
  ok('a ticket PDF attaches to the flight and opens', !!popup && head.startsWith('%PDF'), `${popup ? 'opened' : 'no window'} · ${head}`);
  if (popup) await popup.close();
  await shot('12-anchor');
  await p.locator('.overlay-box .ghost', { hasText: 'Cancel' }).click();
  await p.reload(); await p.waitForSelector('.trip-phone .sheet');
  await openDay('Tue 24 Nov'); await p.click('[data-tab="today"]');
  ok('the ticket is still there after a reload', (await p.locator('[data-day-anchors] .anchor-row', { hasText: 'Flight home' }).locator('.anchor-ticket').count()) === 1);

  // On the Mac: three columns, and a place dragged from the list onto a day.
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto(TRIP); await p.waitForSelector('.trip-wide'); await mapDrawn().catch(() => {});
  ok('on a wide screen: days, the day, the map', (await p.locator('[data-side-day]').count()) === 4 && (await p.locator('.trip-wide .mid [data-day]').count()) === 1);
  await p.click('[data-side-day="2026-11-23"]');
  await p.locator('.mid .stop-main', { hasText: 'Gropius Bau' }).click();
  await p.waitForSelector('.floatcard [data-card]');
  await shot('09-mac');
  await p.click('[data-side="pick"]');
  await p.locator('.pick-row', { hasText: 'Gemäldegalerie' }).dragTo(p.locator('[data-side-day="2026-11-24"]'));
  await p.click('[data-side-day="2026-11-24"]');
  ok('on the Mac a place dragged onto a day goes to that day', (await stopNames()).includes('Gemäldegalerie'));
  await shot('10-mac-pick');
} catch (e) {
  ok('the run finished', false, e.message);
  await shot('99-failure').catch(() => {});
} finally {
  await b.close(); srv.close();
  const bad = results.filter((r) => !r[1]);
  console.log(`\n${results.length - bad.length} of ${results.length} held. Screenshots in ${OUT}`);
  process.exit(bad.length ? 1 : 0);
}
