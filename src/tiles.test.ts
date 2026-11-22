import { describe, it, expect } from 'vitest';
import { lng2x, lat2y, bboxOf, tilesFor, contains, metres } from './tiles';
import { BERLIN } from './berlin';

describe('map tiles', () => {
  it('finds the tile Berlin sits in', () => {
    // Brandenburg Gate at zoom 14 is tile 8800 across, 5373 down (OpenStreetMap numbering).
    expect(lng2x(13.3777, 14)).toBe(8800);
    expect(lat2y(52.5163, 14)).toBe(5373);
  });
  it('covers the Berlin trip with a modest number of tiles', () => {
    const b = bboxOf(BERLIN.places.map(([, , , , lat, lng]) => ({ lat, lng })))!;
    const n = tilesFor(b).length;
    expect(n).toBeGreaterThan(100);
    expect(n).toBeLessThan(1500);
  });
  it('widens the box by the margin', () => {
    const b = bboxOf([{ lat: 52.5, lng: 13.4 }], 1)!;
    expect(metres({ lat: b[1], lng: 13.4 }, { lat: b[3], lng: 13.4 })).toBeCloseTo(2000, -2);
    expect(contains(b, bboxOf([{ lat: 52.5, lng: 13.4 }], 0.5)!)).toBe(true);
    expect(contains(bboxOf([{ lat: 52.5, lng: 13.4 }], 0.5)!, b)).toBe(false);
  });
  it('measures a walk', () => {
    // Brandenburg Gate to Reichstag, about 300 m.
    expect(metres({ lat: 52.5163, lng: 13.3777 }, { lat: 52.5186, lng: 13.3762 })).toBeGreaterThan(250);
  });
});
