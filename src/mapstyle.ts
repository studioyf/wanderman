import type { StyleSpecification } from 'maplibre-gl';
import { getMeta, setMeta } from './db';
import { lookOf } from './looks';
import { toCached } from './mapcache';

// The map's look comes from OpenFreeMap's light style, kept on the device so the map still draws
// with no signal. It is refreshed when online at most once a week.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
type Saved = { style: StyleSpecification; template: string; fetchedAt: number };

async function fetchStyle(): Promise<Saved> {
  const style = (await (await fetch(STYLE_URL)).json()) as StyleSpecification;
  const src = style.sources.openmaptiles as any;
  const tj = await (await fetch(src.url)).json();
  const template = tj.tiles[0] as string;
  style.sources.openmaptiles = { type: 'vector', tiles: [template], minzoom: tj.minzoom ?? 0, maxzoom: tj.maxzoom ?? 14, attribution: tj.attribution } as any;
  const used = new Set(style.layers.map((l: any) => l.source).filter(Boolean));
  for (const k of Object.keys(style.sources)) if (!used.has(k)) delete (style.sources as any)[k];
  return { style, template, fetchedAt: Date.now() };
}

export async function baseStyle(): Promise<Saved> {
  const saved = await getMeta<Saved>('style');
  const stale = !saved || Date.now() - saved.fetchedAt > 7 * 864e5;
  if (saved && (!stale || !navigator.onLine)) return saved;
  try { const fresh = await fetchStyle(); await setMeta('style', fresh); return fresh; }
  catch (e) { if (saved) return saved; throw e; }
}

// The same style with the look's colours, and the tiles of a trip's saved map if it has one, so
// an offline trip always asks for exactly the tiles that were saved.
export function tinted(base: Saved, look: string, template?: string): StyleSpecification {
  const s = structuredClone(base.style), c = lookOf(look).map;
  (s.sources.openmaptiles as any).tiles = [toCached(template || base.template)];
  if (typeof s.sprite === 'string') s.sprite = toCached(s.sprite);
  if (s.glyphs) s.glyphs = toCached(s.glyphs);
  const set = (id: string, prop: string, v: string) => { const l: any = s.layers.find((x) => x.id === id); if (l) l.paint = { ...l.paint, [prop]: v }; };
  set('background', 'background-color', c.background);
  set('park', 'fill-color', c.park);
  set('water', 'fill-color', c.water);
  set('building', 'fill-color', c.building);
  set('landuse_residential', 'fill-color', c.residential);
  set('landcover_wood', 'fill-color', c.wood);
  return s;
}

export function styleAssets(s: StyleSpecification): string[] {
  const urls: string[] = [];
  if (typeof s.sprite === 'string') for (const sfx of ['.json', '.png', '@2x.json', '@2x.png']) urls.push(s.sprite + sfx);
  const fonts = new Set<string>();
  for (const l of s.layers as any[]) { const f = l.layout?.['text-font']; if (Array.isArray(f)) fonts.add(f.join(',')); }
  if (s.glyphs) for (const f of fonts) for (const r of ['0-255', '256-511', '8192-8447'])
    urls.push(s.glyphs.replace('{fontstack}', encodeURIComponent(f).replace(/%2C/g, ',')).replace('{range}', r));
  return urls;
}
