import { describe, expect, it } from 'vitest';
import { hoursOn, hoursText } from './hours';

const t = (spec: string, date: string) => { const h = hoursOn(spec, date); return h && hoursText(h); };

describe('opening hours for one date', () => {
  it('reads the Gropius Bau as OpenStreetMap has it', () => {
    const g = 'Sa-Su 10:00-19:00; Mo, We-Fr 12:00-19:00';
    expect(t(g, '2026-11-23')).toBe('12:00 to 19:00'); // Monday
    expect(t(g, '2026-11-24')).toBe('Closed'); // Tuesday is in no rule
    expect(t(g, '2026-11-22')).toBe('10:00 to 19:00'); // Sunday
  });
  it('lets a later rule override, and knows off', () => {
    expect(t('Mo-Su 10:00-18:00; Mo off', '2026-11-23')).toBe('Closed');
    expect(t('Mo-Su 10:00-18:00; Mo off', '2026-11-24')).toBe('10:00 to 18:00');
  });
  it('reads split days, all day, and skips holiday rules', () => {
    expect(t('Mo-Fr 11:30-14:30,17:30-22:00; PH off', '2026-11-23')).toBe('11:30 to 14:30, 17:30 to 22:00');
    expect(t('24/7', '2026-11-23')).toBe('open all day');
    expect(t('10:00-18:00', '2026-11-23')).toBe('10:00 to 18:00');
    expect(t('Fr-Mo 18:00-02:00+', '2026-11-23')).toBe('18:00 to 02:00');
  });
  it('gives up on shapes it does not know', () => {
    expect(hoursOn('Nov-Mar Mo-Fr 10:00-16:00', '2026-11-23')).toBeUndefined();
    expect(hoursOn('sunrise-sunset', '2026-11-23')).toBeUndefined();
    expect(hoursOn(undefined, '2026-11-23')).toBeUndefined();
  });
});
