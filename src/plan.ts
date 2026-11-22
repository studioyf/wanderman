import type { Place, Stop, PlaceKind } from './model';
import type { Pace } from './pace';
import { metres } from './tiles';

// The arithmetic of a day: how long between stops, whether it is too full, and what a tidy would do.
// Kept apart from the screens so it can be tested on its own. All times are estimates and say so.

type LL = { lat: number; lng: number };
const located = (p?: Place): p is Place & LL => !!p && p.lat != null && p.lng != null;

// Walking is straight-line distance stretched by a third for streets, at 4.8 km/h.
export const walkMinutes = (a: LL, b: LL) => Math.round((metres(a, b) * 1.3) / 80);
// Beyond a 25-minute walk, public transport: a wait and a walk at each end, then the ride.
export const transitMinutes = (a: LL, b: LL) => Math.round(12 + metres(a, b) / 1000 * 2.4);

export type Leg = { minutes: number; by: 'walk' | 'transit'; far: boolean };
export function leg(a?: Place, b?: Place): Leg | undefined {
  if (!located(a) || !located(b)) return undefined;
  const w = walkMinutes(a, b);
  if (w <= 25) return { minutes: Math.max(1, w), by: 'walk', far: false };
  return { minutes: transitMinutes(a, b), by: 'transit', far: false };
}
export const legLabel = (l: Leg) => l.by === 'walk' ? `${l.minutes} min walk` : `about ${l.minutes} min by public transport`;

// How long a stop usually takes, unless its note says ("about 1h30").
const STAY: Record<PlaceKind, number> = { museum: 90, sight: 40, food: 60, drink: 60, stay: 30, transport: 20, walk: 45, market: 45, other: 45 };
export function stayMinutes(p: Place, s?: Stop) {
  const m = `${s?.note || ''} ${p.note || ''}`.match(/about (\d+)\s*h(?:\s*(\d+))?/i);
  if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
  return STAY[p.kind] ?? 45;
}

export const active = (s: Stop) => !s.deleted && (s.state === 'planned' || s.state === 'done');

// A day's stops as they stand, in order, each with its place and the leg that leads to it.
export function dayStops(stops: Stop[], places: Map<string, Place>, dayId: string) {
  const list = stops.filter((s) => s.dayId === dayId && active(s)).sort((a, b) => a.order - b.order);
  return list.map((s, i) => {
    const p = places.get(s.placeId);
    const prev = i > 0 ? places.get(list[i - 1].placeId) : undefined;
    return { stop: s, place: p, leg: leg(prev, p) };
  });
}

// A stop is a detour when getting to it and back costs much more than going straight on.
export function detours(order: (Place | undefined)[]): Set<number> {
  const out = new Set<number>();
  for (let i = 1; i < order.length - 1; i++) {
    const a = order[i - 1], b = order[i], c = order[i + 1];
    if (!located(a) || !located(b) || !located(c)) continue;
    const via = metres(a, b) + metres(b, c), direct = metres(a, c);
    if (via > 2500 && via > direct * 2.2) out.add(i);
  }
  return out;
}

// The day's load against the person's pace: a day runs about twelve hours, 10:00 to 22:00.
export const DAY_MINUTES = 12 * 60;
export function load(items: { place?: Place; stop: Stop; leg?: Leg }[], pace: Pace) {
  const busy = items.reduce((n, it) => n + (it.place ? stayMinutes(it.place, it.stop) : 45) + (it.leg?.minutes || 0), 0);
  const free = DAY_MINUTES - busy;
  const max = pace.stopsPerHalfDay * 2;
  const reasons: string[] = [];
  if (items.length > max) reasons.push(`${items.length} stops, your pace is ${pace.stopsPerHalfDay} per half day`);
  if (free < pace.freeHours * 60) reasons.push(free <= 0 ? 'no free time left' : `about ${fmtH(free)} free, you like ${pace.freeHours}h`);
  return { busy, free, over: reasons.length > 0, reasons };
}
export const fmtH = (m: number) => { const h = Math.floor(Math.max(0, m) / 60), r = Math.max(0, m) % 60; return h ? (r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`) : `${r} min`; };

// Walking order: from where the day starts (the last stop done, else the base), always the nearest next.
export function walkingOrder<T extends { place?: Place }>(start: LL | undefined, items: T[]): T[] {
  const left = [...items], out: T[] = [];
  let here = start;
  while (left.length) {
    let best = 0;
    if (here) { let d = Infinity; left.forEach((it, i) => { if (located(it.place)) { const m = metres(here!, it.place); if (m < d) { d = m; best = i; } } }); }
    const [next] = left.splice(best, 1);
    out.push(next);
    if (located(next.place)) here = next.place;
  }
  return out;
}

export type Tidy = {
  order: Stop[];                       // the planned stops, in their new order (done ones stay first, as they were)
  push: Stop[];                        // stops suggested to move off the day
  swap?: { stop: Stop; with: Place };  // a far meal swapped for one near the walk
  before: { stops: number; travel: number }; after: { stops: number; travel: number };
};

const travel = (ps: (Place | undefined)[]) => ps.reduce((n, p, i) => n + (i ? leg(ps[i - 1], p)?.minutes || 0 : 0), 0);

// When a stop wants to happen: its planned time, else lunch at 13:00 and dinner at 19:00 from its note.
const when = (s: Stop) => s.time || (/\blunch\b/i.test(s.note || '') ? '13:00' : /\bdinner\b/i.test(s.note || '') ? '19:00' : undefined);

// The walking order that respects the day's shape: stops with a time keep their order by time, the
// others go wherever they add the least walking. With no times at all, nearest next from the start.
export function shapeDay<T extends { stop: Stop; place?: Place }>(start: Place | undefined, items: T[]): T[] {
  const timed = items.filter((x) => when(x.stop)).sort((a, b) => when(a.stop)!.localeCompare(when(b.stop)!));
  const loose = items.filter((x) => !when(x.stop));
  if (!timed.length) return walkingOrder(located(start) ? start : undefined, loose);
  const seq = [...timed];
  for (const x of loose) {
    let best = seq.length, cost = Infinity;
    for (let i = 0; i <= seq.length; i++) {
      const a = i ? seq[i - 1].place : start, b = seq[i]?.place;
      const add = (leg(a, x.place)?.minutes ?? 0) + (b ? leg(x.place, b)?.minutes ?? 0 : 0) - (b ? leg(a, b)?.minutes ?? 0 : 0);
      if (add < cost) { cost = add; best = i; }
    }
    seq.splice(best, 0, x);
  }
  return seq;
}

export function tidy(stops: Stop[], places: Map<string, Place>, dayId: string, base: Place | undefined, pace: Pace, pickable: Place[]): Tidy {
  const items = dayStops(stops, places, dayId);
  const done = items.filter((x) => x.stop.state === 'done');
  const todo = items.filter((x) => x.stop.state === 'planned');
  const last = done[done.length - 1]?.place;
  const start = located(last) ? last : located(base) ? base : undefined;

  // A meal far off the walk, as planned, is swapped for the nearest saved one on it.
  let swap: Tidy['swap'];
  const far = detours([start, ...todo.map((x) => x.place)]);
  for (const i of far) {
    const it = todo[i - 1];
    if (!it?.place || it.place.kind !== 'food') continue;
    const near = [todo[i - 2]?.place, todo[i]?.place].filter(located);
    const cand = pickable.filter((p) => located(p) && p.kind === 'food' && near.some((n) => metres(n, p as LL) < 1200))
      .sort((a, b) => Math.min(...near.map((n) => metres(n, a as LL))) - Math.min(...near.map((n) => metres(n, b as LL))))[0];
    if (cand) { swap = { stop: it.stop, with: cand }; break; }
  }
  let keep = todo.map((x) => (swap && x.stop.id === swap.stop.id ? { ...x, place: swap.with } : x));
  const full = (k: typeof keep) => load(dayStopsFrom([...done, ...shapeDay(start, k)]), pace).over;

  // Over the pace: push what the notes say can go first, then what costs the walk most; never a meal.
  const push: Stop[] = [];
  while (keep.length > 1 && full(keep)) {
    let idx = keep.findIndex((x) => /\bdrop\b|optional|too full/i.test(x.stop.note || ''));
    if (idx < 0) {
      let saved = -1;
      const ord = shapeDay(start, keep);
      const total = travel([start, ...ord.map((y) => y.place)]);
      ord.forEach((x) => {
        if (x.place?.kind === 'food') return;
        const s = total - travel([start, ...ord.filter((y) => y !== x).map((y) => y.place)]) + (x.place ? stayMinutes(x.place, x.stop) / 10 : 0);
        if (s > saved) { saved = s; idx = keep.indexOf(x); }
      });
    }
    if (idx < 0) break;
    push.push(keep[idx].stop);
    keep = keep.filter((_, j) => j !== idx);
  }
  const order = shapeDay(start, keep);
  return {
    order: order.map((x) => x.stop), push, swap,
    before: { stops: items.length, travel: travel([start, ...items.map((x) => x.place)]) },
    after: { stops: done.length + order.length, travel: travel([start, ...done.map((x) => x.place), ...order.map((x) => x.place)]) },
  };
}
function dayStopsFrom(xs: { stop: Stop; place?: Place }[]) {
  return xs.map((x, i) => ({ ...x, leg: i ? leg(xs[i - 1].place, x.place) : undefined }));
}

// Nothing to change: the order is already the walking order and the day is within pace.
export const tidyChanges = (t: Tidy, stops: Stop[], dayId: string) => {
  const now = stops.filter((s) => s.dayId === dayId && s.state === 'planned' && !s.deleted).sort((a, b) => a.order - b.order).map((s) => s.id);
  return t.push.length > 0 || !!t.swap || now.join() !== t.order.map((s) => s.id).join();
};

// The places saved for the trip that are on no day, the nearest to the day's walk first.
export function pickable(places: Place[], stops: Stop[], baseId?: string) {
  const used = new Set(stops.filter(active).map((s) => s.placeId));
  return places.filter((p) => !p.deleted && p.id !== baseId && !used.has(p.id));
}
export function nearWalk(p: Place, walk: Place[]) {
  if (!located(p)) return Infinity;
  const pts = walk.filter(located);
  return pts.length ? Math.min(...pts.map((w) => metres(w, p as LL))) : Infinity;
}

// Today in the trip's own time zone, as yyyy-mm-dd.
export const todayIn = (tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
