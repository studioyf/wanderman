const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export const dayLabel = (d: string) => day.format(new Date(d + 'T12:00:00Z')).replace(',', '');
export function datesLabel(start: string, end: string) {
  const a = new Date(start + 'T12:00:00Z'), b = new Date(end + 'T12:00:00Z');
  const m = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()} to ${b.getUTCDate()} ${m.format(b)} ${b.getUTCFullYear()}`
    : `${a.getUTCDate()} ${m.format(a)} to ${b.getUTCDate()} ${m.format(b)} ${b.getUTCFullYear()}`;
}
export const timeOf = (iso: string) => iso.slice(11, 16);
export const mb = (bytes: number) => bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1e3))} kB` : `${(bytes / 1e6).toFixed(1)} MB`;
export const KIND: Record<string, string> = { sight: 'Sight', museum: 'Museum', food: 'Food', drink: 'Drinks', stay: 'Stay', transport: 'Transport', walk: 'Walk', market: 'Market', other: 'Place' };
