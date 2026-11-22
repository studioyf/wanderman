// Opening hours as OpenStreetMap writes them ("Mo-Fr 10:00-18:00; Sa,Su 11:00-17:00; PH off"), read for one date.
// Handles the common shapes: day lists and ranges, several time ranges, off, 24/7, later rules overriding earlier
// ones. Anything else (months, weeks, sunrise, comments) gives undefined, and the card shows the hours as written.

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export type DayHours = { closed: true } | { closed: false; spans: string[] };

export function hoursOn(spec: string | undefined, date: string): DayHours | undefined {
  if (!spec) return undefined;
  const s = spec.trim();
  if (s === '24/7') return { closed: false, spans: ['open all day'] };
  const wd = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7; // Monday 0
  let result: DayHours | undefined;
  let understood = false;
  for (const raw of s.split(';')) {
    const rule = raw.trim();
    if (!rule) continue;
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?\s*,?\s*)+)?\s*(.*)$/);
    if (!m) return undefined;
    const sel = (m[1] || '').trim(), rest = m[2].trim();
    // Which weekdays the rule covers; a rule only for holidays is skipped (we do not know the holidays).
    let covers = !sel;
    if (sel) {
      const parts = sel.split(',').map((x) => x.trim()).filter(Boolean);
      const plain = parts.filter((p) => !/^(PH|SH)$/.test(p));
      if (!plain.length) continue;
      for (const p of plain) {
        const [a, b] = p.split('-').map((x) => DAYS.indexOf(x.trim()));
        if (a < 0 || (b !== undefined && b < 0)) return undefined;
        if (b === undefined ? a === wd : a <= b ? wd >= a && wd <= b : wd >= a || wd <= b) covers = true;
      }
    }
    let value: DayHours;
    if (/^(off|closed)$/i.test(rest)) value = { closed: true };
    else if (/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\+?(\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\+?)*$/.test(rest))
      value = { closed: false, spans: rest.split(',').map((x) => x.trim().replace(/\s*-\s*/, ' to ').replace('+', '')) };
    else return undefined;
    understood = true;
    if (covers) result = value;
  }
  if (!understood) return undefined;
  return result || { closed: true };
}

export const hoursText = (h: DayHours) => (h.closed ? 'Closed' : h.spans.join(', '));
