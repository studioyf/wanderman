import type { Bbox } from './model';

// Map arithmetic, kept apart from the browser so it can be tested on its own.
// The map is cut into square tiles; at zoom z the world is 2^z tiles across.
export const lng2x = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
export const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

// The box around a set of points, widened by a margin in kilometres on every side.
export function bboxOf(points: { lat: number; lng: number }[], marginKm = 1.5): Bbox | undefined {
  if (!points.length) return undefined;
  let w = 180, s = 90, e = -180, n = -90;
  for (const p of points) { w = Math.min(w, p.lng); e = Math.max(e, p.lng); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
  const dLat = marginKm / 111, dLng = marginKm / (111 * Math.cos((((s + n) / 2) * Math.PI) / 180));
  return [w - dLng, s - dLat, e + dLng, n + dLat];
}

export const contains = (outer: Bbox, inner: Bbox) =>
  inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];

// Every tile that covers the box, from a whole-country view down to street level. OpenFreeMap's
// tiles stop at zoom 14 and the map draws closer views from those, so 14 is enough for walking.
export function tilesFor(b: Bbox, minZ = 0, maxZ = 14): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let z = minZ; z <= maxZ; z++) {
    const x0 = lng2x(b[0], z), x1 = lng2x(b[2], z), y0 = lat2y(b[3], z), y1 = lat2y(b[1], z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([z, x, y]);
  }
  return out;
}

export const tileUrl = (template: string, [z, x, y]: [number, number, number]) =>
  template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

// Straight-line distance in metres, good enough for walking.
export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
