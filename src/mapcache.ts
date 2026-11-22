import maplibregl from 'maplibre-gl';
import { CACHE } from './offline';

// The map asks for its pieces (tiles, symbols, lettering) through this, not straight from the network:
// what was saved for a trip is read from the device first, and anything new is fetched and kept, so
// the map draws the same with or without signal. Addresses starting wm:// are OpenFreeMap's, rewritten.
export const toCached = (url: string) => url.replace('https://tiles.openfreemap.org/', 'wm://tiles.openfreemap.org/');

maplibregl.addProtocol('wm', async (params, abort) => {
  const url = params.url.replace('wm://', 'https://');
  const cache = await caches.open(CACHE);
  let r = await cache.match(url, { ignoreVary: true });
  if (!r) {
    const f = await fetch(url, { mode: 'cors', signal: abort.signal });
    if (!f.ok) throw new Error(`${f.status} ${url}`);
    await cache.put(url, f.clone());
    r = f;
  }
  if (params.type === 'json') return { data: await r.json() };
  if (params.type === 'string') return { data: await r.text() };
  return { data: await r.arrayBuffer() };
});
