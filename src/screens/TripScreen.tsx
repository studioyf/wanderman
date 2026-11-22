import { useEffect, useMemo, useState } from 'react';
import { go } from '../App';
import { useTrip } from '../parts/useTrip';
import { MapView, type MapStop } from '../parts/MapView';
import { OfflineStatus } from '../parts/OfflineStatus';
import { DayView, setAreaColors } from '../parts/DayView';
import { StopCard } from '../parts/StopCard';
import { PickList } from '../parts/PickList';
import { TripInfo } from '../parts/TripInfo';
import { Sheet, sheetHeight, type Snap } from '../parts/Sheet';
import { dayStops, pickable, todayIn } from '../plan';
import { ensureDays, addPlace, addToDay, moveToDay } from '../actions';
import { db } from '../db';
import { dayLabel, datesLabel } from '../parts/format';

// The trip. On the phone (layout A, ANSWERS 8): the map fills the screen, the day sits in a sheet
// pulled up or down, four tabs along the bottom. On the Mac and iPad (layout M): days in a sidebar,
// the day or the list to pick from in the middle, the map on the right with the stop's card over it.
type Tab = 'today' | 'places' | 'trip' | 'notes';
type Mid = 'day' | 'pick' | 'anchors' | 'arrival' | 'notes';

function useWide() {
  const q = '(min-width: 900px)';
  const [wide, setWide] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q), f = () => setWide(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return wide;
}

export function TripScreen({ id }: { id: string }) {
  const t = useTrip(id);
  const wide = useWide();
  const [dayId, setDayId] = useState<string>();
  const [tab, setTab] = useState<Tab>('today'), [mid, setMid] = useState<Mid>('day');
  const [sel, setSel] = useState<{ placeId: string; stopId?: string }>();
  const [snap, setSnap] = useState<Snap>('half');

  useEffect(() => { if (t.trip && !t.trip.deleted) ensureDays(t.trip); }, [t.trip?.id, t.trip?.start, t.trip?.end]);
  // The day shown first: today if the trip is on, else its first day, or its last once it is over.
  useEffect(() => {
    if (dayId && t.days.some((d) => d.id === dayId) || !t.days.length || !t.trip) return;
    const today = todayIn(t.trip.tz);
    setDayId((t.days.find((d) => d.date === today) || (today > t.days[t.days.length - 1].date ? t.days[t.days.length - 1] : t.days[0])).id);
  }, [t.days, t.trip?.tz]);
  setAreaColors(new Map(t.areas.map((a) => [a.id, a.color])));

  const day = t.days.find((d) => d.id === dayId);
  const items = useMemo(() => (day ? dayStops(t.stops, t.byId, day.id) : []), [t.stops, t.byId, day?.id]);
  const mapStops: MapStop[] = items.filter((x) => x.place).map((x, i) => ({ placeId: x.place!.id, n: i + 1, done: x.stop.state === 'done' }));
  const pickCount = useMemo(() => pickable(t.places, t.stops, t.trip?.baseId).length, [t.places, t.stops, t.trip?.baseId]);

  if (t.trip === undefined) return <div className="page"><p className="empty">Loading.</p></div>;
  if (!t.trip || t.trip.deleted) return <div className="page"><p className="empty">This trip is gone. <button className="ghost" onClick={() => go('')}>Back</button></p></div>;
  const trip = t.trip;

  const select = (placeId?: string, stopId?: string) => {
    if (!placeId) return setSel(undefined);
    const s = stopId ? t.stops.find((x) => x.id === stopId) : t.stops.find((x) => x.placeId === placeId && x.dayId === dayId && !x.deleted && (x.state === 'planned' || x.state === 'done'));
    setSel({ placeId, stopId: s?.id });
    if (!wide && snap === 'peek') setSnap('half');
  };
  const longPress = async (lat: number, lng: number) => {
    const name = prompt('Name this place');
    if (name?.trim()) { const p = await addPlace(trip.id, { name: name.trim(), lat, lng }); select(p.id); }
  };
  const selPlace = sel ? t.byId.get(sel.placeId) : undefined;
  const selStop = sel?.stopId ? t.stops.find((s) => s.id === sel.stopId) : undefined;
  const card = selPlace && <StopCard t={t} place={selPlace} stop={selStop} day={day} onClose={() => setSel(undefined)} onAdded={(p) => select(p.id)} />;
  const changeDay = (id: string) => { setDayId(id); setSel(undefined); if (wide) setMid('day'); else setTab('today'); };

  const map = (pad: { top: number; bottom: number; left: number; right: number }) => (
    <MapView places={t.places} areas={t.areas} baseId={trip.baseId} template={trip.offline?.template} stops={mapStops} frameKey={(dayId || '') + (wide ? 'w' : 'p')} pad={pad}
      selected={sel?.placeId} onSelect={(pid) => select(pid)} onLongPress={longPress} />
  );

  if (!wide) {
    return (
      <div className="trip-phone">
        {map({ top: 100, bottom: sheetHeight(snap) + 74, left: 36, right: 36 })}
        <div className="floats">
          <button className="pill" onClick={() => go('')} aria-label="All trips">‹ {trip.name}</button>
          <OfflineStatus trip={trip} places={t.places} />
        </div>
        <Sheet snap={snap} onSnap={setSnap}>
          {card || (
            tab === 'today' ? (day ? <DayView t={t} day={day} selected={sel?.placeId} onSelect={select} onDay={changeDay} wide={false} /> : null)
            : tab === 'places' ? <PickList t={t} day={day} selected={sel?.placeId} onSelect={(pid) => select(pid)} />
            : tab === 'trip' ? <TripInfo t={t} onDay={changeDay} />
            : <p className="muted pad">Quick notes, a photo or a voice memo stamped with the time and place, arrive in round 4.</p>
          )}
        </Sheet>
        <nav className="tabbar">
          {(['today', 'places', 'trip', 'notes'] as Tab[]).map((x) => (
            <button key={x} className={tab === x && !card ? 'on' : ''} data-tab={x} onClick={() => { setTab(x); setSel(undefined); if (snap === 'peek') setSnap('half'); }}>
              <TabIcon tab={x} /><span>{x === 'today' ? (day && day.date === todayIn(trip.tz) ? 'Today' : 'Day') : x === 'places' ? 'Places' : x === 'trip' ? 'Trip' : 'Notes'}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  // On a wide screen: a stop or a place dropped on a day in the sidebar goes to that day.
  const dropOn = (dId: string) => ({
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.some((x) => x.startsWith('text/wm-'))) { e.preventDefault(); e.currentTarget.classList.add('drop'); } },
    onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove('drop'),
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault(); e.currentTarget.classList.remove('drop');
      const stopId = e.dataTransfer.getData('text/wm-stop'), placeId = e.dataTransfer.getData('text/wm-place');
      if (stopId) { const s = await db.stops.get(stopId); if (s && s.dayId !== dId) await moveToDay(s, dId); }
      else if (placeId) await addToDay(trip.id, placeId, dId);
    },
  });
  return (
    <div className="trip-wide">
      <aside className="side">
        <button className="ghost small" onClick={() => go('')}>‹ Trips</button>
        <h1>{trip.name}</h1>
        <div className="muted small">{datesLabel(trip.start, trip.end)}{trip.baseId && t.byId.get(trip.baseId) ? ` · ${t.byId.get(trip.baseId)!.name}` : ''}</div>
        <div style={{ margin: '.6rem 0' }}><OfflineStatus trip={trip} places={t.places} /></div>
        <h4>Days</h4>
        {t.days.map((d) => { const n = dayStops(t.stops, t.byId, d.id); const done = n.filter((x) => x.stop.state === 'done').length; return (
          <button key={d.id} className={'side-item' + (mid === 'day' && d.id === dayId ? ' on' : '')} data-side-day={d.date} onClick={() => changeDay(d.id)} {...dropOn(d.id)}>
            <span>{dayLabel(d.date)}</span><span className="count">{n.length ? (done === n.length ? `${done} ✓` : n.length) : ''}</span>
          </button>); })}
        <h4>Plan</h4>
        <button className={'side-item' + (mid === 'pick' ? ' on' : '')} data-side="pick" onClick={() => setMid('pick')}><span>To pick from</span><span className="count">{pickCount}</span></button>
        <button className={'side-item' + (mid === 'anchors' ? ' on' : '')} onClick={() => setMid('anchors')}><span>Fixed times</span><span className="count">{t.anchors.length || ''}</span></button>
        <button className={'side-item' + (mid === 'arrival' ? ' on' : '')} onClick={() => setMid('arrival')}><span>Arrival guide</span></button>
        <button className={'side-item' + (mid === 'notes' ? ' on' : '')} onClick={() => setMid('notes')}><span>Notes</span></button>
        <div className="side-foot"><button className="ghost small" onClick={() => go('settings')}>Settings</button></div>
      </aside>
      <section className="mid">
        {mid === 'day' && day && <DayView t={t} day={day} selected={sel?.placeId} onSelect={select} onDay={changeDay} wide />}
        {mid === 'pick' && (<><h2 className="mid-title">To pick from</h2><p className="muted small">Saved, not on a day. + adds to {day ? dayLabel(day.date) : 'the day'}; drag one onto a day on the left.</p><PickList t={t} day={day} selected={sel?.placeId} onSelect={(pid) => select(pid)} /></>)}
        {mid === 'anchors' && <TripInfo t={t} part="anchors" onDay={changeDay} />}
        {mid === 'arrival' && <TripInfo t={t} part="arrival" onDay={changeDay} />}
        {mid === 'notes' && <p className="muted">Quick notes arrive in round 4.</p>}
      </section>
      <div className="mapcol">
        {map({ top: 40, bottom: 40, left: 40, right: card ? 380 : 40 })}
        {card && <div className="floatcard">{card}</div>}
      </div>
    </div>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 24, height: 24 } as const;
  if (tab === 'today') return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (tab === 'places') return <svg {...p}><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  if (tab === 'trip') return <svg {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>;
  return <svg {...p}><path d="M5 4h14v12l-5 4H5z" /><path d="M14 20v-4h5" /></svg>;
}
