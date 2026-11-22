import { describe, expect, it } from 'vitest';
import { lightOn } from './light';
declare const process: { env: Record<string, string | undefined> };

const mins = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const near = (got: string, want: string, slack = 3) => expect(Math.abs(mins(got) - mins(want))).toBeLessThanOrEqual(slack);

describe('light per day', () => {
  // Berlin, Mon 23 Nov 2026: sunrise 07:42, sunset 16:03, by NOAA's solar arithmetic and api.sunrise-sunset.org alike.
  const l = lightOn('2026-11-23', 52.52, 13.405, 'Europe/Berlin');
  it('gives Berlin sunrise and sunset in Berlin time', () => { near(l.sunrise, '07:42'); near(l.sunset, '16:03'); });
  it('keeps everything in order through the day', () => {
    const seq = [l.blueAm[0], l.blueAm[1], l.sunrise, l.goldenAm, l.goldenPm, l.sunset, l.bluePm[0], l.bluePm[1]].map(mins);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
  });
  it('knows the sun stays low in late November', () => { expect(l.noonAlt).toBeGreaterThan(14); expect(l.noonAlt).toBeLessThan(19); });
  it('is the same whatever zone the device is in', () => {
    const was = process.env.TZ;
    process.env.TZ = 'Asia/Tokyo';
    const tokyo = lightOn('2026-11-23', 52.52, 13.405, 'Europe/Berlin');
    process.env.TZ = 'America/Los_Angeles';
    const la = lightOn('2026-11-23', 52.52, 13.405, 'Europe/Berlin');
    process.env.TZ = was;
    expect(tokyo).toEqual(l); expect(la).toEqual(l);
  });
});
