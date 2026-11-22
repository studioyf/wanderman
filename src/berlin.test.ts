import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { db } from './db';
import { loadBerlin, BERLIN_ID } from './berlin';

describe('the Berlin test trip', () => {
  it('loads whole, every stop pointing at a real place and day', async () => {
    await loadBerlin();
    const places = await db.places.where('tripId').equals(BERLIN_ID).toArray();
    const ids = new Set(places.map((p) => p.id));
    const days = new Set((await db.days.toArray()).map((d) => d.id));
    const areas = new Set((await db.areas.toArray()).map((a) => a.id));
    const stops = await db.stops.toArray();
    expect(places.length).toBeGreaterThan(25);
    expect(stops.length).toBe(12);
    expect(stops.filter((s) => s.state === 'done').length).toBe(5);
    for (const s of stops) { expect(ids.has(s.placeId)).toBe(true); expect(days.has(s.dayId)).toBe(true); }
    for (const p of places) if (p.lat != null) expect(areas.has(p.areaId!)).toBe(true);
    // One link with no location waits in the Inbox.
    expect(places.filter((p) => p.lat == null).length).toBe(2);
    const trip = await db.trips.get(BERLIN_ID);
    expect(ids.has(trip!.baseId!)).toBe(true);
    // Everything starts marked to be sent to the server.
    expect(await db.places.where('dirty').equals(1).count()).toBe(places.length);
  });
  it('replaces an older Berlin, removing the stops and bookings it no longer has', async () => {
    const { BERLIN_ID: T } = await import('./berlin');
    await db.stops.put({ id: 'old-stop', tripId: T, dayId: 'x', placeId: 'y', order: 9, state: 'planned', updatedAt: 1, deleted: 0, dirty: 0 });
    await loadBerlin();
    expect((await db.stops.get('old-stop'))!.deleted).toBe(1);
    expect((await db.anchors.filter((a) => !a.deleted).toArray()).map((a) => a.title)).not.toContain('Reichstag dome');
  });
  it('loads twice without making a second trip', async () => {
    await loadBerlin();
    expect(await db.trips.count()).toBe(1);
  });
});
