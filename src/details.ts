import { db, save } from './db';
import type { Place } from './model';
import { metres } from './tiles';

// What a place card shows beyond your own notes: a photo and two sentences (Wikipedia), opening hours, entry fee
// and website (OpenStreetMap). Looked up once with signal, saved on the place, so the card reads offline.
// Nominatim finds the place on OpenStreetMap with its details, Wikidata and Wikipedia give the rest, in batches. The photos are kept by the service worker (vite.config.ts, wm-photos).

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
export function sameName(a: string, b: string) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.replace(/ /g, '').includes(y.replace(/ /g, '')) || y.replace(/ /g, '').includes(x.replace(/ /g, ''))) return 0.8;
  const tx = new Set(x.split(' ').filter((w) => w.length > 2)), ty = y.split(' ').filter((w) => w.length > 2);
  if (!tx.size || !ty.length) return 0;
  const shared = ty.filter((w) => tx.has(w)).length;
  return shared / Math.max(tx.size, ty.length);
}

type Found = { place: Place; osm?: string; tags?: Record<string, string>; qid?: string; wikiTitle?: { lang: string; title: string } };

// Nominatim, one place a second as its rules ask, searched inside a small box around where the place was saved.
// (Photon turns a burst like this away, and then Find near here stops working too.)
async function findOnOsm(p: Place): Promise<{ key: string; tags: Record<string, string> } | undefined> {
  const d = 0.005, box = [p.lng! - d * 1.6, p.lat! + d, p.lng! + d * 1.6, p.lat! - d].join(',');
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(p.name)}&format=jsonv2&extratags=1&limit=8&viewbox=${box}&bounded=1&accept-language=en`);
  if (!r.ok) throw new Error(String(r.status));
  let best: [number, { key: string; tags: Record<string, string> } | undefined] = [0.45, undefined];
  // Nominatim also matches other names ("Holocaust Memorial" finds the Memorial to the Murdered Jews of Europe),
  // so its first answer counts as a name match even when the names differ.
  for (const [rank, x] of ((await r.json()) as any[]).entries()) {
    const dist = metres({ lat: +x.lat, lng: +x.lon }, p as { lat: number; lng: number });
    if (dist > 400 || !x.name) continue;
    const good = /^(tourism|amenity|historic|leisure|shop|craft|building|railway|public_transport|aeroway)$/.test(x.category) && !(x.category === 'building' && /residential|house|apartments/.test(x.type));
    const score = Math.max(sameName(p.name, x.name), rank === 0 ? 0.7 : 0) + (good ? 0.15 : -0.3) - dist / 2000;
    if (score > best[0]) best = [score, { key: `${x.osm_type[0].toUpperCase()}${x.osm_id}`, tags: x.extratags || {} }];
  }
  return best[1];
}

const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };

let running: Promise<number> | undefined;
// Fills every place of the trip that has a location and has not been looked up yet. Returns how many changed.
export function fillDetails(tripId: string, only?: string[]) {
  if (running) return running;
  running = fill(tripId, only).finally(() => { running = undefined; });
  return running;
}

async function fill(tripId: string, only?: string[]) {
  const all = (await db.places.where('tripId').equals(tripId).toArray())
    .filter((p) => !p.deleted && p.lat != null && !p.detailsAt && (!only || only.includes(p.id)));
  if (!all.length || !navigator.onLine) return 0;
  const found: Found[] = [];
  for (const p of all) {
    const f: Found = { place: p };
    try {
      const hit = await findOnOsm(p);
      if (hit) {
        f.osm = hit.key; f.tags = hit.tags;
        if (hit.tags.wikidata) f.qid = hit.tags.wikidata.split(';')[0];
        const w = hit.tags.wikipedia?.match(/^([a-z]{2,3}):(.+)$/);
        if (w) f.wikiTitle = { lang: w[1], title: w[2] };
      }
    } catch {}
    found.push(f);
    await pause(1100); // Nominatim asks for one request a second
  }
  // Wikidata: the English article if there is one, the picture and the official website.
  const photoFile = new Map<Found, string>(), site = new Map<Found, string>();
  for (const c of chunks(found.filter((f) => f.qid), 50)) {
    try {
      const j = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${c.map((f) => f.qid).join('|')}&props=sitelinks|claims&sitefilter=enwiki|dewiki&format=json&origin=*`);
      for (const f of c) {
        const e = j.entities?.[f.qid!]; if (!e) continue;
        const en = e.sitelinks?.enwiki?.title, de = e.sitelinks?.dewiki?.title;
        if (en) f.wikiTitle = { lang: 'en', title: en }; else if (de && !f.wikiTitle) f.wikiTitle = { lang: 'de', title: de };
        const img = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value; if (img) photoFile.set(f, img);
        const web = e.claims?.P856?.[0]?.mainsnak?.datavalue?.value; if (web) site.set(f, web);
      }
    } catch {}
  }
  // No article found through OpenStreetMap: an English article on the map within 400 m with the same name.
  for (const f of found.filter((x) => !x.wikiTitle)) {
    try {
      const j = await json(`https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${f.place.lat}|${f.place.lng}&gsradius=400&gslimit=30&format=json&origin=*`);
      const hit = (j.query?.geosearch || []).map((g: any) => [sameName(f.place.name, g.title), g.title] as const).sort((a: any, b: any) => b[0] - a[0])[0];
      if (hit && hit[0] >= 0.6) f.wikiTitle = { lang: 'en', title: hit[1] };
    } catch {}
  }
  // Wikipedia: two sentences and the article's picture, twenty articles at a time per language.
  const text = new Map<Found, { blurb?: string; photo?: string; url: string }>();
  for (const lang of ['en', 'de']) {
    const mine = found.filter((f) => f.wikiTitle?.lang === lang);
    for (const c of chunks(mine, 20)) {
      try {
        const j = await json(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&exsentences=2&pithumbsize=800&redirects=1&format=json&origin=*&titles=${c.map((f) => encodeURIComponent(f.wikiTitle!.title)).join('|')}`);
        const alias = new Map<string, string>();
        for (const n of [...(j.query?.normalized || []), ...(j.query?.redirects || [])]) alias.set(n.from, n.to);
        const pages = Object.values(j.query?.pages || {}) as any[];
        for (const f of c) {
          let tt = f.wikiTitle!.title.replace(/_/g, ' ');
          while (alias.has(tt)) tt = alias.get(tt)!;
          const pg = pages.find((x) => x.title === tt); if (!pg || pg.missing !== undefined) continue;
          text.set(f, { blurb: pg.extract?.trim() || undefined, photo: pg.thumbnail?.source?.replace(/\?utm_.*$/, ''), url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pg.title.replace(/ /g, '_'))}` });
        }
      } catch {}
    }
  }
  let changed = 0;
  for (const f of found) {
    const fresh = (await db.places.get(f.place.id)) || f.place; // the person may have edited it meanwhile
    const tg = f.tags || {}, w = text.get(f);
    const file = photoFile.get(f);
    const photo = w?.photo || (file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=800` : undefined);
    const website = tg.website || tg['contact:website'] || site.get(f);
    const fee = tg.fee === 'yes' || tg.fee === 'no' ? tg.fee : undefined;
    await save<Place>('places', {
      ...fresh,
      photo: fresh.photo || photo, blurb: fresh.blurb || w?.blurb, wiki: fresh.wiki || w?.url,
      hours: fresh.hours || tg.opening_hours, fee: fresh.fee || fee, url: fresh.url || website, detailsAt: Date.now(),
    });
    if (photo) fetch(photo, { mode: 'no-cors' }).catch(() => {}); // through the service worker, so it is kept for offline
    if (photo || w || tg.opening_hours) changed++;
  }
  return changed;
}
