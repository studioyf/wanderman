import { db, save } from './db';
import { uid, type Area, type Day, type Place, type Stop, type Trip } from './model';
import { metres } from './tiles';
import type { Tidy } from './plan';

// Every change a person makes to a trip's days, in one place.

export async function ensureDays(trip: Trip) {
  const have = new Set((await db.days.where('tripId').equals(trip.id).toArray()).filter((d) => !d.deleted).map((d) => d.date));
  for (let d = new Date(trip.start + 'T12:00:00Z'); d <= new Date(trip.end + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    if (!have.has(date)) await save<Day>('days', { id: uid(), tripId: trip.id, date, title: '' });
  }
}

const dayList = async (dayId: string) =>
  (await db.stops.where('dayId').equals(dayId).toArray()).filter((s) => !s.deleted && (s.state === 'planned' || s.state === 'done')).sort((a, b) => a.order - b.order);

// Give the day's stops the order given, numbering them 0, 1, 2...
export async function reorder(dayId: string, ids: string[]) {
  const list = await dayList(dayId);
  const byId = new Map(list.map((s) => [s.id, s]));
  let i = 0;
  for (const id of ids) { const s = byId.get(id); if (s && s.order !== i) await save<Stop>('stops', { ...s, order: i }); i++; }
}

export const markDone = (s: Stop) => save<Stop>('stops', { ...s, state: s.state === 'done' ? 'planned' : 'done' });

export async function laterToday(s: Stop) {
  const list = await dayList(s.dayId);
  await save<Stop>('stops', { ...s, order: (list[list.length - 1]?.order ?? 0) + 1 });
}
export async function moveToDay(s: Stop, dayId: string) {
  const list = await dayList(dayId);
  await save<Stop>('stops', { ...s, dayId, state: 'planned', order: (list[list.length - 1]?.order ?? -1) + 1 });
}
// Next time: off the day and back on the list to pick from.
export const nextTime = (s: Stop) => save<Stop>('stops', { ...s, state: 'later' });

export async function addToDay(tripId: string, placeId: string, dayId: string, after?: Stop) {
  const list = await dayList(dayId);
  const order = after ? after.order + 0.5 : (list[list.length - 1]?.order ?? -1) + 1;
  const s = await save<Stop>('stops', { id: uid(), tripId, dayId, placeId, order, state: 'planned' });
  if (after) await reorder(dayId, [...list, s].sort((a, b) => a.order - b.order).map((x) => x.id));
  return s;
}

export async function applyTidy(t: Tidy, dayId: string) {
  if (t.swap) await save<Stop>('stops', { ...t.swap.stop, placeId: t.swap.with.id });
  for (const s of t.push) await nextTime(s);
  const done = (await dayList(dayId)).filter((s) => s.state === 'done').map((s) => s.id);
  await reorder(dayId, [...done, ...t.order.map((s) => s.id)]);
}

// A new place joins the area of its district, else the nearest area within a kilometre, else a new
// area named after its district.
const PALETTE = ['#d9411e', '#2f6b4f', '#1f4fb4', '#b07a12', '#7a3e8f', '#0f7c86', '#a3324f'];
export async function addPlace(tripId: string, p: { name: string; lat: number; lng: number; address?: string; district?: string; kind?: Place['kind']; url?: string }) {
  const areas = (await db.areas.where('tripId').equals(tripId).toArray()).filter((a) => !a.deleted);
  const located = (await db.places.where('tripId').equals(tripId).toArray()).filter((q) => !q.deleted && q.lat != null);
  let area: Area | undefined = p.district ? areas.find((a) => a.name.toLowerCase() === p.district!.toLowerCase()) : undefined;
  if (!area) {
    let best: [number, string | undefined] = [1000, undefined];
    for (const q of located) { const d = metres(q as { lat: number; lng: number }, p); if (d < best[0] && q.areaId) best = [d, q.areaId]; }
    area = areas.find((a) => a.id === best[1]);
  }
  if (!area && p.district) area = await save<Area>('areas', { id: uid(), tripId, name: p.district, color: PALETTE[areas.length % PALETTE.length] });
  return save<Place>('places', { id: uid(), tripId, name: p.name, kind: p.kind || 'other', lat: p.lat, lng: p.lng, address: p.address, url: p.url, areaId: area?.id });
}

// Directions open in the phone's own maps: Apple Maps on Apple devices, Google Maps elsewhere.
const apple = typeof navigator !== 'undefined' && /iPhone|iPad|Macintosh/.test(navigator.userAgent);
export const walkLink = (p: { lat?: number; lng?: number }) => apple
  ? `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=w`
  : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`;
export const googleSearchNear = (q: string, p: { lat?: number; lng?: number }) =>
  `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${p.lat},${p.lng},16z`;
