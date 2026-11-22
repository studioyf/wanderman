import { remove } from '../db';
import { go } from '../App';
import { dayLabel, timeOf, datesLabel } from './format';
import { dayStops } from '../plan';
import type { TripData } from './useTrip';

// The trip as a whole: its fixed times, its days at a glance, the arrival guide.
export function TripInfo({ t, part, onDay }: { t: TripData; part?: 'anchors' | 'arrival' | 'all'; onDay: (id: string) => void }) {
  const trip = t.trip!;
  const show = (p: string) => !part || part === 'all' || part === p;
  return (
    <div className="info">
      {(!part || part === 'all') && (<>
        <h3 className="info-title">{trip.name}</h3>
        <p className="muted small">{datesLabel(trip.start, trip.end)} · {trip.tz.replace('_', ' ')}</p>
        <h4>Days</h4>
        {t.days.map((d) => { const n = dayStops(t.stops, t.byId, d.id); const done = n.filter((x) => x.stop.state === 'done').length; return (
          <button key={d.id} className="menu-item" onClick={() => onDay(d.id)}>{dayLabel(d.date)} <span className="muted small">{d.title}{n.length ? ` · ${n.length} stops${done ? `, ${done} done` : ''}` : ''}</span></button>); })}
      </>)}
      {show('anchors') && t.anchors.length > 0 && (<>
        <h4>Fixed times</h4>
        {[...t.anchors].sort((a, b) => a.start.localeCompare(b.start)).map((a) => (
          <div key={a.id} className="anchor"><span className="time">{dayLabel(a.start.slice(0, 10))} {timeOf(a.start)}</span><span>{a.title}{a.detail && <span className="muted small"> · {a.detail}</span>}</span></div>
        ))}
      </>)}
      {show('arrival') && (<>
        <h4>Arrival guide</h4>
        {t.guide ? t.guide.sections.map((s) => <div key={s.title}><b>{s.title}</b>{s.lines.map((l, i) => <p key={i}>{l}</p>)}</div>) : <p className="muted">No arrival guide for {trip.city} yet.</p>}
      </>)}
      {(!part || part === 'all') && (
        <div className="row" style={{ marginTop: '1.5rem' }}>
          <button className="secondary small" onClick={() => go('settings')}>Settings</button>
          <button className="ghost small danger" onClick={async () => { if (confirm(`Remove the ${trip.name} trip?`)) { await remove('trips', trip.id); go(''); } }}>Remove trip</button>
        </div>
      )}
    </div>
  );
}
