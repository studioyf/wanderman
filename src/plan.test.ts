import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { db } from './db';
import { loadBerlin, BERLIN_ID } from './berlin';
import { dayStops, detours, load, tidy, pickable, stayMinutes, walkingOrder } from './plan';
import { DEFAULT_PACE } from './pace';

const id = (n: number) => `0b3e1100-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function berlin() {
  await loadBerlin();
  const places = await db.places.where('tripId').equals(BERLIN_ID).toArray();
  const stops = await db.stops.where('tripId').equals(BERLIN_ID).filter((s) => !s.deleted).toArray();
  return { places, stops, byId: new Map(places.map((p) => [p.id, p])), base: places.find((p) => p.id === id(100)) };
}

describe('a day in Berlin', () => {
  it('reads Monday in order, with the time between stops', async () => {
    const { stops, byId } = await berlin();
    const mon = dayStops(stops, byId, id(202));
    expect(mon.map((x) => x.place!.name)).toEqual(['Berlin Wall Memorial', 'Gropius Bau', 'Topographie des Terrors', 'Gazzo', 'Berlinische Galerie', 'C/O Berlin', 'Vegang']);
    expect(mon[2].leg!.by).toBe('walk');        // Gropius Bau to Topographie, next door
    expect(mon[2].leg!.minutes).toBeLessThan(5);
    expect(mon[1].leg!.by).toBe('transit');     // the Wall to Gropius Bau, 3.4 km
  });
  it('flags Gazzo as far off the walk', async () => {
    const { stops, byId } = await berlin();
    const mon = dayStops(stops, byId, id(202));
    expect([...detours(mon.map((x) => x.place))]).toEqual([3]);
  });
  it('finds Monday too full for the default pace', async () => {
    const { stops, byId } = await berlin();
    const l = load(dayStops(stops, byId, id(202)), DEFAULT_PACE);
    expect(l.over).toBe(true);
    expect(l.reasons.join()).toMatch(/free/);
    expect(load(dayStops(stops, byId, id(202)), { stopsPerHalfDay: 6, freeHours: 0 }).over).toBe(false);
  });
  it('reads how long a stop takes from its note', async () => {
    const { byId } = await berlin();
    expect(stayMinutes(byId.get(id(134))!)).toBe(60);              // "About 1h."
    expect(stayMinutes(byId.get(id(123))!, { note: 'About 1h30, 15 min walk' } as any)).toBe(90);
  });
  it('tidies Monday: a meal near the walk for Gazzo, Topographie pushed, in walking order', async () => {
    const { places, stops, byId, base } = await berlin();
    const t = tidy(stops, byId, id(202), base, DEFAULT_PACE, pickable(places, stops, id(100)));
    expect(t.swap?.stop.placeId).toBe(id(135));
    expect(t.swap?.with.kind).toBe('food');                          // the nearest saved meal: Saravanaa Bhavan, by Potsdamer Platz
    expect(t.order.map((s) => byId.get(s.placeId)!.name)[0]).toBe('Berlin Wall Memorial'); // the day keeps its shape
    expect(t.push.map((s) => byId.get(s.placeId)!.name)).toContain('Topographie des Terrors');
    expect(t.after.travel).toBeLessThan(t.before.travel);
    expect(load(dayStops(stops.filter((s) => !t.push.includes(s)), byId, id(202)), DEFAULT_PACE).free).toBeGreaterThan(load(dayStops(stops, byId, id(202)), DEFAULT_PACE).free);
  });
  it('leaves a day already in order alone', async () => {
    const { places, stops, byId, base } = await berlin();
    const t = tidy(stops, byId, id(201), base, DEFAULT_PACE, pickable(places, stops, id(100)));
    expect(t.push).toEqual([]); expect(t.swap).toBeUndefined(); expect(t.order).toEqual([]); // Sunday is all done
  });
  it('orders by walking, nearest next', () => {
    const p = (lat: number, lng: number) => ({ place: { lat, lng } as any });
    const out = walkingOrder({ lat: 0, lng: 0 }, [p(0, 3), p(0, 1), p(0, 2)]);
    expect(out.map((x) => x.place.lng)).toEqual([1, 2, 3]);
  });
  it('lists what is saved and on no day', async () => {
    const { places, stops } = await berlin();
    const pick = pickable(places, stops, id(100)).map((p) => p.name);
    expect(pick).toContain('Gemäldegalerie');
    expect(pick).not.toContain('Gropius Bau');
    expect(pick).not.toContain('The Hoxton, Charlottenburg');
  });
});
