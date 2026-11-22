import { remove } from '../db';
import { go } from '../App';
import { dayLabel, datesLabel } from './format';
import { AnchorList } from './Anchors';
import { transitLink } from '../actions';
import { dayStops } from '../plan';
import type { TripData } from './useTrip';

// The trip as a whole: its fixed times, its days at a glance, the arrival guide.
export function TripInfo({ t, part, onDay }: { t: TripData; part?: 'anchors' | 'arrival' | 'all'; onDay: (id: string) => void }) {
  const trip = t.trip!;
  const base = trip.baseId ? t.byId.get(trip.baseId) : undefined;
  // The airport the trip flies into: the place of its first flight.
  const firstFlight = [...t.anchors].filter((a) => a.kind === 'flight' && a.placeId).sort((a, b) => a.start.localeCompare(b.start))[0];
  const airport = firstFlight ? t.byId.get(firstFlight.placeId!) : undefined;
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
      {show('anchors') && (<>
        <h4>Fixed times</h4>
        <AnchorList t={t} />
      </>)}
      {show('arrival') && (<>
        <h4>Arrival guide</h4>
        {t.guide ? (
          <div className="guide" data-guide>
            {airport && base && <a className="secondary guide-go" data-guide-route href={transitLink(airport, base)} target="_blank" rel="noreferrer">{airport.name} to {base.name}, in Maps</a>}
            {t.guide.sections.map((s) => (
              <section key={s.title} className="guide-part">
                <h5>{s.title}</h5>
                {s.lines.map((l, i) => <p key={i}>{l}</p>)}
              </section>
            ))}
          </div>
        ) : <p className="muted">No arrival guide for {trip.city} yet.</p>}
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
