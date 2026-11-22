import { db, save } from './db';
import type { Trip, Place } from './model';
import { bboxOf, tilesFor, tileUrl, contains } from './tiles';
import { baseStyle, styleAssets } from './mapstyle';

// Saving a trip's map for no signal: every tile around the trip's places, plus the map's symbols
// and lettering, put in the same store the service worker reads the map from.
export const CACHE = 'wm-map';

export function areaFor(places: Place[]) {
  const pts = places.filter((p) => !p.deleted && p.lat != null && p.lng != null) as { lat: number; lng: number }[];
  return bboxOf(pts, 1.5);
}

export function needsSaving(trip: Trip, places: Place[], template?: string) {
  const b = areaFor(places);
  if (!b) return false;
  if (!trip.offline) return true;
  if (template && trip.offline.template !== template) return true;
  return !contains(trip.offline.bbox, b);
}

let running: Promise<void> | undefined;
export function saveOffline(tripId: string, onProgress: (done: number, total: number) => void) {
  running ??= (async () => {
    try {
      const trip = await db.trips.get(tripId);
      const places = await db.places.where('tripId').equals(tripId).toArray();
      const bbox = areaFor(places);
      if (!trip || !bbox) return;
      const base = await baseStyle();
      const assets = styleAssets(base.style);
      const urls = [...assets, ...tilesFor(bbox).map((t) => tileUrl(base.template, t))];
      const missed: string[] = [];
      const cache = await caches.open(CACHE);
      let done = 0, bytes = 0, failed = 0;
      const queue = [...urls];
      const worker = async () => {
        for (let u = queue.shift(); u; u = queue.shift()) {
          try {
            let r = await cache.match(u, { ignoreVary: true });
            if (!r) { const f = await fetch(u, { mode: 'cors' }); if (f.ok) { await cache.put(u, f.clone()); r = f; } else { failed++; missed.push(u); } }
            if (r) bytes += Number(r.headers.get('content-length')) || 0;
          } catch { failed++; missed.push(u); }
          onProgress(++done, urls.length);
        }
      };
      await Promise.all(Array.from({ length: 8 }, worker));
      // The map's symbols and lettering are all needed; a few missing tiles only leave a gap.
      if (missed.some((u) => assets.includes(u))) throw new Error('The map symbols could not be saved: ' + missed.find((u) => assets.includes(u)));
      if (failed > urls.length * 0.02) throw new Error(`${failed} of ${urls.length} map pieces could not be saved`);
      try { await navigator.storage?.persist?.(); } catch {}
      await save<Trip>('trips', { ...trip, offline: { template: base.template, bbox, savedAt: Date.now(), tiles: urls.length, bytes } });
    } finally { running = undefined; }
  })();
  return running;
}
