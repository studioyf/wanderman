import { useState } from 'react';
import type { Day, Place, Stop } from '../model';
import { KIND, dayLabel } from './format';
import { markDone, moveToDay, nextTime, addToDay, walkLink, laterToday } from '../actions';
import { leg, legLabel } from '../plan';
import { FindNearby } from './FindNearby';
import { Overlay } from './Overlay';
import type { TripData } from './useTrip';

// A place, opened: what it is, what you noted, and what to do with it.
export function StopCard({ t, place, stop, day, onClose, onAdded }: { t: TripData; place: Place; stop?: Stop; day?: Day; onClose: () => void; onAdded: (p: Place) => void }) {
  const [later, setLater] = useState(false), [pickDay, setPickDay] = useState(false);
  const base = t.trip?.baseId ? t.byId.get(t.trip.baseId) : undefined;
  const fromBase = base && base.id !== place.id ? leg(base, place) : undefined;
  const area = place.areaId ? t.areaById.get(place.areaId) : undefined;
  const live = stop && (stop.state === 'planned' || stop.state === 'done') ? stop : undefined;
  return (
    <div className="card" data-card={place.id}>
      <div className="card-head">
        <div>
          <h3>{place.name}</h3>
          <div className="muted small">{KIND[place.kind]}{area ? ` · ${area.name}` : ''}{fromBase ? ` · ${legLabel(fromBase)} from the base` : ''}</div>
        </div>
        <button className="icon" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {place.address && <div className="muted small">{place.address}</div>}
      {live?.note && <p className="card-note">{live.note}</p>}
      {place.note && <p className="card-note">{place.note}</p>}
      <div className="card-actions">
        {live ? (<>
          <button className={live.state === 'done' ? 'secondary' : 'primary'} data-done onClick={() => markDone(live)}>{live.state === 'done' ? 'Not done' : 'Done'}</button>
          <button className="secondary" onClick={() => setLater(true)}>Later</button>
        </>) : day && (
          <button className="primary" data-add-day onClick={() => addToDay(place.tripId, place.id, day.id)}>Add to {dayLabel(day.date)}</button>
        )}
        {!live && <button className="secondary" onClick={() => setPickDay(true)}>Another day</button>}
        {place.lat != null && <a className="secondary" href={walkLink(place)} target="_blank" rel="noreferrer">Walk there</a>}
      </div>
      {place.url && <a className="card-link" href={place.url} target="_blank" rel="noreferrer">{place.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>}
      {place.lat != null && <FindNearby t={t} near={place} after={live} day={day} onAdded={onAdded} />}
      {later && live && (
        <Overlay title={`Later: ${place.name}`} onClose={() => setLater(false)}>
          <button className="menu-item" onClick={() => { laterToday(live); setLater(false); }}>Later today<span className="muted small">to the end of the day</span></button>
          {t.days.filter((d) => d.id !== live.dayId).map((d) => <button key={d.id} className="menu-item" onClick={() => { moveToDay(live, d.id); setLater(false); }}>{dayLabel(d.date)}<span className="muted small">{d.title}</span></button>)}
          <button className="menu-item" onClick={() => { nextTime(live); setLater(false); }}>Next time<span className="muted small">back to the list to pick from</span></button>
        </Overlay>
      )}
      {pickDay && (
        <Overlay title={`Add ${place.name} to`} onClose={() => setPickDay(false)}>
          {t.days.map((d) => <button key={d.id} className="menu-item" onClick={() => { addToDay(place.tripId, place.id, d.id); setPickDay(false); }}>{dayLabel(d.date)}<span className="muted small">{d.title}</span></button>)}
        </Overlay>
      )}
    </div>
  );
}
