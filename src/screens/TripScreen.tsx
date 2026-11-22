import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, save, remove } from '../db';
import { go } from '../App';
import { uid, type Place, type Area } from '../model';
import { MapView } from '../parts/MapView';
import { OfflineStatus } from '../parts/OfflineStatus';
import { PlaceSearch } from '../parts/PlaceSearch';
import { datesLabel, dayLabel, timeOf, KIND } from '../parts/format';
import { metres } from '../tiles';

type Tab = 'places' | 'days' | 'arrival';

export function TripScreen({ id }: { id: string }) {
  const trip = useLiveQuery(() => db.trips.get(id), [id]);
  const places = useLiveQuery(() => db.places.where('tripId').equals(id).filter((p) => !p.deleted).toArray(), [id]) || [];
  const areas = useLiveQuery(() => db.areas.where('tripId').equals(id).filter((a) => !a.deleted).toArray(), [id]) || [];
  const days = useLiveQuery(() => db.days.where('tripId').equals(id).filter((d) => !d.deleted).sortBy('date'), [id]) || [];
  const stops = useLiveQuery(() => db.stops.where('tripId').equals(id).filter((s) => !s.deleted).toArray(), [id]) || [];
  const anchors = useLiveQuery(() => db.anchors.where('tripId').equals(id).filter((a) => !a.deleted).toArray(), [id]) || [];
  const guide = useLiveQuery(() => db.guides.where('tripId').equals(id).first(), [id]);
  const [tab, setTab] = useState<Tab>('places');
  const [sel, setSel] = useState<string>();

  useEffect(() => { if (sel) document.querySelector(`[data-place="${sel}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [sel]);

  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  if (trip === undefined) return <div className="page"><p className="empty">Loading.</p></div>;
  if (!trip || trip.deleted) return <div className="page"><p className="empty">This trip is gone. <button className="ghost" onClick={() => go('')}>Back</button></p></div>;

  const located = places.filter((p) => p.lat != null);
  const inbox = places.filter((p) => p.lat == null);
  const groups = [...areas].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ area: a, list: located.filter((p) => p.areaId === a.id) }));
  const loose = located.filter((p) => !p.areaId || !areas.some((a) => a.id === p.areaId));
  const base = trip.baseId ? byId.get(trip.baseId) : undefined;

  // A place added by search or by a long press joins the area it falls in, else the nearest area
  // within a kilometre, else a new area named after its district.
  async function addPlace(p: { name: string; lat: number; lng: number; address?: string; district?: string; kind?: Place['kind'] }) {
    let area: Area | undefined = p.district ? areas.find((a) => a.name.toLowerCase() === p.district!.toLowerCase()) : undefined;
    if (!area) {
      let best: [number, string | undefined] = [1000, undefined];
      for (const q of located) { const d = metres(q as { lat: number; lng: number }, p); if (d < best[0] && q.areaId) best = [d, q.areaId]; }
      area = areas.find((a) => a.id === best[1]);
    }
    if (!area && p.district) {
      const palette = ['#d9411e', '#2f6b4f', '#1f4fb4', '#b07a12', '#7a3e8f', '#0f7c86', '#a3324f'];
      area = await save<Area>('areas', { id: uid(), tripId: id, name: p.district, color: palette[areas.length % palette.length] });
    }
    const place = await save<Place>('places', { id: uid(), tripId: id, name: p.name, kind: p.kind || 'other', lat: p.lat, lng: p.lng, address: p.address, areaId: area?.id });
    setSel(place.id);
  }

  const sp = sel ? byId.get(sel) : undefined;
  return (
    <div className="page trip">
      <header className="bar">
        <button className="ghost" onClick={() => go('')}>Trips</button>
        <div className="title"><h1>{trip.name}</h1><span className="muted">{datesLabel(trip.start, trip.end)}</span></div>
        <OfflineStatus trip={trip} places={places} />
      </header>
      <div className="trip-body">
        <MapView places={located} areas={areas} baseId={trip.baseId} template={trip.offline?.template} selected={sel} onSelect={setSel}
          onLongPress={(lat, lng) => { const name = prompt('Name this place'); if (name?.trim()) addPlace({ name: name.trim(), lat, lng }); }} />
        <section className="panel">
          {sp && (
            <div className="peek" data-peek={sp.id}>
              <div><strong>{sp.name}</strong><span className="muted"> · {KIND[sp.kind]}</span></div>
              {sp.address && <div className="muted">{sp.address}</div>}
              {sp.note && <div>{sp.note}</div>}
              <div className="row">
                {sp.lat != null && <a className="secondary small" href={`https://maps.apple.com/?daddr=${sp.lat},${sp.lng}&dirflg=w`}>Walk there</a>}
                {sp.url && <a className="secondary small" href={sp.url} target="_blank" rel="noreferrer">Website</a>}
                {base && sp.id !== base.id && sp.lat != null && <span className="muted small">{Math.round((metres(base as any, sp as any) * 1.3) / 80)} min walk from the base</span>}
                <button className="ghost small" onClick={() => setSel(undefined)}>Close</button>
              </div>
            </div>
          )}
          <nav className="tabs">
            {(['places', 'days', 'arrival'] as Tab[]).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'places' ? 'Places' : t === 'days' ? 'Days' : 'Arrival'}</button>)}
          </nav>
          {tab === 'places' && (
            <div className="scroll">
              <PlaceSearch near={base || located[0]} onPick={addPlace} />
              {anchors.length > 0 && (
                <div className="group">
                  <h2>Anchors</h2>
                  {[...anchors].sort((a, b) => a.start.localeCompare(b.start)).map((a) => (
                    <div key={a.id} className="anchor"><span className="time">{dayLabel(a.start.slice(0, 10))} {timeOf(a.start)}</span><span>{a.title}</span></div>
                  ))}
                </div>
              )}
              {groups.filter((g) => g.list.length).map(({ area, list }) => (
                <div key={area.id} className="group" data-area={area.name}>
                  <h2><i className="swatch" style={{ background: area.color }} />{area.name}<span className="count">{list.length}</span></h2>
                  {list.map((p) => <PlaceRow key={p.id} p={p} base={p.id === trip.baseId} sel={p.id === sel} onSelect={setSel} />)}
                </div>
              ))}
              {loose.length > 0 && <div className="group"><h2>No area yet</h2>{loose.map((p) => <PlaceRow key={p.id} p={p} sel={p.id === sel} onSelect={setSel} />)}</div>}
              {inbox.length > 0 && <div className="group"><h2>Inbox<span className="count">{inbox.length}</span></h2><p className="muted small">Saved without a location yet.</p>{inbox.map((p) => <PlaceRow key={p.id} p={p} sel={false} onSelect={() => {}} />)}</div>}
            </div>
          )}
          {tab === 'days' && (
            <div className="scroll">
              <p className="muted small">The day itself, loose and in walking order, arrives in round 2. For now, the days as planned.</p>
              {days.map((d) => (
                <div key={d.id} className="group">
                  <h2>{dayLabel(d.date)}<span className="muted"> · {d.title}</span></h2>
                  {stops.filter((s) => s.dayId === d.id).sort((a, b) => a.order - b.order).map((s) => { const p = byId.get(s.placeId); return p ? (
                    <button key={s.id} className="place" onClick={() => setSel(p.id)}><span className="name">{p.name}</span>{s.time && <span className="muted small">planned {s.time}</span>}</button>) : null; })}
                </div>
              ))}
              {!days.length && <p className="empty">No days yet.</p>}
            </div>
          )}
          {tab === 'arrival' && (
            <div className="scroll">
              {guide ? guide.sections.map((s) => <div key={s.title} className="group"><h2>{s.title}</h2>{s.lines.map((l, i) => <p key={i}>{l}</p>)}</div>)
                : <p className="empty">No arrival guide for {trip.city} yet.</p>}
            </div>
          )}
        </section>
      </div>
      <footer className="trip-foot"><button className="ghost small danger" onClick={async () => { if (confirm(`Remove the ${trip.name} trip?`)) { await remove('trips', trip.id); go(''); } }}>Remove trip</button></footer>
    </div>
  );
}

function PlaceRow({ p, base, sel, onSelect }: { p: Place; base?: boolean; sel: boolean; onSelect: (id: string) => void }) {
  return (
    <button className={'place' + (sel ? ' sel' : '')} data-place={p.id} onClick={() => onSelect(p.id)}>
      <span className="name">{p.name}{base && <span className="tag">Base</span>}</span>
      <span className="muted small">{KIND[p.kind]}</span>
    </button>
  );
}
