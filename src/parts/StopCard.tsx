import { useEffect, useState } from 'react';
import type { Day, Place, Stop } from '../model';
import { KIND, dayLabel } from './format';
import { markDone, moveToDay, nextTime, addToDay, walkLink, laterToday, mapsLink, removePlace } from '../actions';
import { fillDetails } from '../details';
import { hoursOn, hoursText } from '../hours';
import { useOnline } from './SyncBadge';
import { dayStops, leg, legLabel, todayIn } from '../plan';
import { FindNearby } from './FindNearby';
import { Overlay } from './Overlay';
import type { TripData } from './useTrip';

// A place, opened: what it is, what you noted, and what to do with it.
export function StopCard({ t, place, stop, day, onClose, onAdded }: { t: TripData; place: Place; stop?: Stop; day?: Day; onClose: () => void; onAdded: (p: Place) => void }) {
  const [later, setLater] = useState(false), [pickDay, setPickDay] = useState(false), [gone, setGone] = useState(false), [noPhoto, setNoPhoto] = useState(false);
  const online = useOnline();
  // First time this place is opened with signal and it was never looked up: fetch its photo, hours and text now.
  useEffect(() => { if (online && !place.detailsAt && place.lat != null) fillDetails(place.tripId, [place.id]).catch(() => {}); }, [place.id, online]);
  useEffect(() => setNoPhoto(false), [place.photo]);
  const base = t.trip?.baseId ? t.byId.get(t.trip.baseId) : undefined;
  const area = place.areaId ? t.areaById.get(place.areaId) : undefined;
  const live = stop && (stop.state === 'planned' || stop.state === 'done') ? stop : undefined;
  // Walking time from the stop before it on its day, else from the base.
  const onDay = live ? dayStops(t.stops, t.byId, live.dayId) : [];
  const i = live ? onDay.findIndex((x) => x.stop.id === live.id) : -1;
  const prev = i > 0 ? onDay[i - 1].place : base && base.id !== place.id ? base : undefined;
  const way = prev ? leg(prev, place) : undefined;
  // Hours for the day it is planned on, else today in the trip's city.
  const stopDay = live ? t.days.find((d) => d.id === live.dayId) : day;
  const date = stopDay?.date || todayIn(t.trip?.tz || 'UTC');
  const h = hoursOn(place.hours, date);
  const booking = t.anchors.find((a) => a.placeId === place.id && !a.deleted);
  const ticket = booking ? `Booked: ${booking.title}${booking.start ? `, ${booking.start.replace('T', ' ')}` : ''}`
    : place.fee === 'yes' ? 'Ticket at the door, nothing booked' : place.fee === 'no' ? 'Free entry' : undefined;
  const site = place.url;
  return (
    <div className="card" data-card={place.id}>
      {place.photo && !noPhoto && <img className="card-photo" data-card-photo src={place.photo} alt="" loading="lazy" onError={() => setNoPhoto(true)} />}
      <div className="card-head">
        <div>
          <h3>{place.name}</h3>
          <div className="muted small">{KIND[place.kind]}{area ? ` · ${area.name}` : ''}</div>
        </div>
        <button className="icon" aria-label="Close" onClick={onClose}>×</button>
      </div>
      <dl className="card-facts">
        {(h || place.hours) && <><dt>{dayLabel(date)}</dt><dd data-card-hours className={h?.closed ? 'closed' : ''}>{h ? hoursText(h) : place.hours}</dd></>}
        {way && <><dt>Getting there</dt><dd data-card-way>{legLabel(way)} from {prev === base && i <= 0 ? 'the base' : prev!.name}</dd></>}
        {ticket && <><dt>Ticket</dt><dd data-card-ticket>{ticket}</dd></>}
        {place.address && <><dt>Address</dt><dd>{place.address}</dd></>}
      </dl>
      {live?.note && <p className="card-note">{live.note}</p>}
      {place.note && <p className="card-note">{place.note}</p>}
      {place.blurb && <p className="card-blurb" data-card-blurb>{place.blurb} {place.wiki && <a href={place.wiki} target="_blank" rel="noreferrer">Wikipedia</a>}</p>}
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
      <div className="card-links">
        {site && <a data-card-site href={site} target="_blank" rel="noreferrer">Website</a>}
        <a data-card-maps href={mapsLink(place)} target="_blank" rel="noreferrer">Open in Maps</a>
        <button className="link danger" data-card-remove onClick={() => setGone(true)}>Remove</button>
      </div>
      {place.lat != null && <FindNearby t={t} near={place} after={live} day={day} onAdded={onAdded} />}
      {later && live && (
        <Overlay title={`Later: ${place.name}`} onClose={() => setLater(false)}>
          <button className="menu-item" onClick={() => { laterToday(live); setLater(false); }}>Later today<span className="muted small">to the end of the day</span></button>
          {t.days.filter((d) => d.id !== live.dayId).map((d) => <button key={d.id} className="menu-item" onClick={() => { moveToDay(live, d.id); setLater(false); }}>{dayLabel(d.date)}<span className="muted small">{d.title}</span></button>)}
          <button className="menu-item" onClick={() => { nextTime(live); setLater(false); }}>Next time<span className="muted small">back to the list to pick from</span></button>
        </Overlay>
      )}
      {gone && (
        <Overlay title={`Remove ${place.name}?`} onClose={() => setGone(false)}>
          <p className="muted">It leaves the trip and every day it is on. To keep it for another time, use Later, then Next time.</p>
          <button className="menu-item danger" data-remove-yes onClick={async () => { setGone(false); onClose(); await removePlace(place.id); }}>Remove from the trip</button>
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
