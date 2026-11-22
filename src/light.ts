import SunCalc from 'suncalc';

// The day's light for a photographer, in the trip city's own time: blue hour (sun 4 to 8 degrees below the
// horizon), sunrise, golden hour (sun below 6 degrees above), sunset, and the evening's blue hour.
SunCalc.addTime(-4, 'blueRiseEnd', 'blueSetStart');
SunCalc.addTime(-8, 'blueRiseStart', 'blueSetEnd');

export type Light = { blueAm: [string, string]; sunrise: string; goldenAm: string; goldenPm: string; sunset: string; bluePm: [string, string]; noonAlt: number };

const at = (d: Date, tz: string) => (isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d));

// Midday in the trip's city on that date, so SunCalc picks the right day whatever the device's own zone.
function middayIn(date: string, tz: string) {
  const guess = new Date(date + 'T12:00:00Z');
  const local = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(guess);
  return new Date(guess.getTime() - (Number(local) - 12) * 3600_000);
}

export function lightOn(date: string, lat: number, lng: number, tz: string): Light {
  const t = SunCalc.getTimes(middayIn(date, tz), lat, lng) as SunCalc.GetTimesResult & Record<string, Date>;
  const noonAlt = (SunCalc.getPosition(t.solarNoon, lat, lng).altitude * 180) / Math.PI;
  return {
    blueAm: [at(t.blueRiseStart, tz), at(t.blueRiseEnd, tz)],
    sunrise: at(t.sunrise, tz), goldenAm: at(t.goldenHourEnd, tz),
    goldenPm: at(t.goldenHour, tz), sunset: at(t.sunset, tz),
    bluePm: [at(t.blueSetStart, tz), at(t.blueSetEnd, tz)],
    noonAlt: Math.round(noonAlt),
  };
}
