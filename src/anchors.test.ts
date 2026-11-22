import { describe, expect, it } from 'vitest';
import { onDate } from './parts/Anchors';
import type { Anchor } from './model';

const a = (x: Partial<Anchor>) => ({ id: 'a', tripId: 't', kind: 'flight', title: 'Flight home', start: '2026-11-24T12:00', updatedAt: 0, dirty: 0, deleted: 0, ...x }) as Anchor;

describe('fixed times on their day', () => {
  it('puts a flight on the day it leaves', () => {
    expect(onDate(a({}), '2026-11-24')).toEqual([{ time: '12:00', label: 'Flight home' }]);
    expect(onDate(a({}), '2026-11-23')).toEqual([]);
  });
  it('puts a stay on the day you check in and the day you check out', () => {
    const s = a({ kind: 'stay', title: 'The Hoxton', start: '2026-11-21T14:00', end: '2026-11-24T11:00' });
    expect(onDate(s, '2026-11-21')).toEqual([{ time: '14:00', label: 'Check in, The Hoxton' }]);
    expect(onDate(s, '2026-11-22')).toEqual([]);
    expect(onDate(s, '2026-11-24')).toEqual([{ time: '11:00', label: 'Check out, The Hoxton' }]);
  });
});
