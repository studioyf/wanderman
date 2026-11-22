import { useMemo, useState } from 'react';
import type { Day, Place } from '../model';
import { pickable, nearWalk, dayStops } from '../plan';
import { addToDay, addPlace } from '../actions';
import { KIND, dayLabel } from './format';
import { PlaceSearch } from './PlaceSearch';
import { Overlay } from './Overlay';
import type { TripData } from './useTrip';

// Everything saved for the trip that is on no day, by area, the nearest to the day's walk first.
// + puts it on the day shown; hold it (or right-click) to choose another day.
const FILTERS: { id: string; label: string; test: (p: Place) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'see', label: 'To see', test: (p) => ['museum', 'sight', 'walk', 'market'].includes(p.kind) },
  { id: 'food', label: 'Food and drink', test: (p) => p.kind === 'food' || p.kind === 'drink' },
  { id: 'inbox', label: 'Inbox', test: (p) => p.lat == null },
];

export function PickList({ t, day, selected, onSelect }: { t: TripData; day?: Day; selected?: string; onSelect: (placeId: string) => void }) {
  const [filter, setFilter] = useState('all'), [choose, setChoose] = useState<Place>();
  const walk = useMemo(() => (day ? dayStops(t.stops, t.byId, day.id).map((x) => x.place).filter(Boolean) as Place[] : []), [t.stops, t.byId, day?.id]);
  const all = useMemo(() => pickable(t.places, t.stops, t.trip?.baseId), [t.places, t.stops, t.trip?.baseId]);
  const f = FILTERS.find((x) => x.id === filter)!;
  const list = all.filter(f.test);
  const near = (p: Place) => nearWalk(p, walk);
  const groups = new Map<string, Place[]>();
  for (const p of list) { const k = p.lat == null ? 'inbox' : p.areaId || 'none'; groups.set(k, [...(groups.get(k) || []), p]); }
  for (const g of groups.values()) g.sort((a, b) => near(a) - near(b));
  const order = [...groups.keys()].sort((a, b) => (a === 'inbox' ? 1 : b === 'inbox' ? -1 : 0) || Math.min(...groups.get(a)!.map(near)) - Math.min(...groups.get(b)!.map(near)));
  let pressTimer: any;

  return (
    <div className="pick" data-pick>
      <PlaceSearch near={walk[0] || (t.trip?.baseId ? t.byId.get(t.trip.baseId) : undefined)} onPick={async (h) => { const p = await addPlace(t.trip!.id, h); onSelect(p.id); }} />
      <div className="chips">
        {FILTERS.map((x) => <button key={x.id} className={'chip' + (filter === x.id ? ' on' : '')} onClick={() => setFilter(x.id)}>{x.label}{x.id === 'inbox' ? ` ${all.filter(x.test).length}` : ''}</button>)}
      </div>
      {!list.length && <p className="muted">Nothing waiting here: everything saved is on a day.</p>}
      {order.map((k) => {
        const area = t.areaById.get(k);
        const onWalk = walk.length > 0 && Math.min(...groups.get(k)!.map(near)) < 1200;
        return (
          <div key={k} className="pick-group" data-area={area?.name || k}>
            <h4>{area && <i className="swatch" style={{ background: area.color }} />}{area?.name || (k === 'inbox' ? 'Inbox, no location yet' : 'No area')}{onWalk && <span className="muted small"> · on {day ? 'the day' : ''}’s walk</span>}</h4>
            {groups.get(k)!.map((p) => (
              <div key={p.id} className={'pick-row' + (p.id === selected ? ' sel' : '')} data-place={p.id} draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/wm-place', p.id); e.dataTransfer.effectAllowed = 'copy'; }}
                onContextMenu={(e) => { e.preventDefault(); setChoose(p); }}
                onPointerDown={(e) => { if (e.pointerType === 'touch') pressTimer = setTimeout(() => setChoose(p), 550); }}
                onPointerUp={() => clearTimeout(pressTimer)} onPointerMove={() => clearTimeout(pressTimer)}>
                <button className="pick-name" onClick={() => onSelect(p.id)}>
                  <span className="name">{p.name}</span>
                  <span className="sub">{KIND[p.kind]}{isFinite(near(p)) && walk.length ? ` · ${Math.max(1, Math.round((near(p) * 1.3) / 80))} min from the walk` : ''}</span>
                </button>
                {day && <button className="add" aria-label={`Add ${p.name} to ${dayLabel(day.date)}`} data-add={p.id} onClick={() => addToDay(t.trip!.id, p.id, day.id)}>+</button>}
              </div>
            ))}
          </div>
        );
      })}
      {choose && (
        <Overlay title={`Add ${choose.name} to`} onClose={() => setChoose(undefined)}>
          {t.days.map((d) => <button key={d.id} className="menu-item" onClick={() => { addToDay(t.trip!.id, choose.id, d.id); setChoose(undefined); }}>{dayLabel(d.date)}<span className="muted small">{d.title}</span></button>)}
        </Overlay>
      )}
    </div>
  );
}
