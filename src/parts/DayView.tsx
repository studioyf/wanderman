import { useMemo, useRef, useState } from 'react';
import type { Day, Place, Stop } from '../model';
import { lightOn } from '../light';
import { DayAnchors } from './Anchors';
import { dayStops, detours, legLabel, load, fmtH, tidy, tidyChanges, pickable, type Tidy } from '../plan';
import { reorder, markDone, laterToday, moveToDay, nextTime, applyTidy } from '../actions';
import { usePace } from '../pace';
import { dayLabel } from './format';
import { Overlay } from './Overlay';
import type { TripData } from './useTrip';

type Props = { t: TripData; day: Day; selected?: string; onSelect: (placeId: string, stopId?: string) => void; onDay: (id: string) => void; wide: boolean };

// One day: its stops in order with the way between them, how full it is, and the means to change it:
// hold the handle and drag to reorder, swipe right for Done and left for Later, Tidy for a proposal.
export function DayView({ t, day, selected, onSelect, onDay, wide }: Props) {
  const pace = usePace();
  const items = useMemo(() => dayStops(t.stops, t.byId, day.id), [t.stops, t.byId, day.id]);
  const base = t.trip?.baseId ? t.byId.get(t.trip.baseId) : undefined;
  const far = useMemo(() => detours([base, ...items.map((x) => x.place)]), [items, base]);
  const l = load(items, pace);
  const [order, setOrder] = useState<string[] | null>(null); // the order while a stop is being dragged
  const orderRef = useRef(order); orderRef.current = order;
  const [later, setLater] = useState<Stop>();
  const [proposal, setProposal] = useState<Tidy>();
  const idx = t.days.findIndex((d) => d.id === day.id);
  const shown = order ? order.map((id) => items.find((x) => x.stop.id === id)!).filter(Boolean) : items;

  const openTidy = () => setProposal(tidy(t.stops, t.byId, day.id, base, pace, pickable(t.places, t.stops, t.trip?.baseId)));

  return (
    <div className="day" data-day={day.date}>
      <div className="day-head">
        {!wide && <button className="icon" aria-label="Previous day" disabled={idx <= 0} onClick={() => onDay(t.days[idx - 1].id)}>‹</button>}
        <div className="day-title">
          <h2>{longDay(day.date)}</h2>
          <span className="muted small">{items.length ? `${items.length} stop${items.length > 1 ? 's' : ''} · ${fmtH(l.free)} free` : day.title || 'Nothing planned'}</span>
        </div>
        {!wide && <button className="icon" aria-label="Next day" disabled={idx >= t.days.length - 1} onClick={() => onDay(t.days[idx + 1].id)}>›</button>}
        {items.some((x) => x.stop.state === 'planned') && <button className="secondary small" data-tidy onClick={openTidy}>Tidy</button>}
      </div>
      <LightStrip t={t} date={day.date} />
      <DayAnchors t={t} date={day.date} />
      {l.over && <button className="warn" data-warn onClick={openTidy}>Full day: {l.reasons.join(', ')}. <b>Tidy?</b></button>}
      {!items.length && <p className="muted">Add places from Places, or long-press the map.</p>}
      <ol className="stops">
        {shown.map((x, i) => (
          <StopRow key={x.stop.id} n={i + 1} stop={x.stop} place={x.place} legText={x.leg && i > 0 ? legLabel(x.leg) : undefined} far={far.has(i + 1)} farNext={far.has(i + 2)}
            sel={x.place?.id === selected} wide={wide}
            onTap={() => x.place && onSelect(x.place.id, x.stop.id)}
            onDone={() => markDone(x.stop)} onLater={() => setLater(x.stop)}
            drag={{
              start: () => setOrder(items.map((y) => y.stop.id)),
              over: (to) => setOrder((o) => { if (!o) return o; const from = o.indexOf(x.stop.id); if (from === to || to < 0 || to >= o.length) return o; const n = [...o]; n.splice(from, 1); n.splice(to, 0, x.stop.id); return n; }),
              end: () => { const o = orderRef.current; setOrder(null); if (o) reorder(day.id, o); },
              index: i,
            }} />
        ))}
      </ol>
      {later && (
        <Overlay title={`Later: ${t.byId.get(later.placeId)?.name || ''}`} onClose={() => setLater(undefined)}>
          <button className="menu-item" onClick={() => { laterToday(later); setLater(undefined); }}>Later today<span className="muted small">to the end of the day</span></button>
          {t.days.filter((d) => d.id !== day.id).map((d) => (
            <button key={d.id} className="menu-item" onClick={() => { moveToDay(later, d.id); setLater(undefined); }}>{dayLabel(d.date)}<span className="muted small">{d.title}</span></button>
          ))}
          <button className="menu-item" data-next-time onClick={() => { nextTime(later); setLater(undefined); }}>Next time<span className="muted small">back to the list to pick from</span></button>
        </Overlay>
      )}
      {proposal && <TidyPanel t={t} p={proposal} dayId={day.id} onClose={() => setProposal(undefined)} />}
    </div>
  );
}

const longDay = (d: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));

type RowProps = {
  n: number; stop: Stop; place?: Place; legText?: string; far: boolean; farNext: boolean; sel: boolean; wide: boolean;
  onTap: () => void; onDone: () => void; onLater: () => void;
  drag: { start: () => void; over: (to: number) => void; end: () => void; index: number };
};

function StopRow({ n, stop, place, legText, far, sel, wide, onTap, onDone, onLater, drag }: RowProps) {
  const el = useRef<HTMLLIElement>(null);
  const [dx, setDx] = useState(0), [lift, setLift] = useState(false);
  const g = useRef<{ x: number; y: number; mode?: 'swipe' | 'scroll'; id: number; dx?: number } | null>(null);

  // Swipe: a sideways move on the row. Vertical moves are left to the list's own scrolling.
  const down = (e: React.PointerEvent) => { if (wide || (e.target as HTMLElement).closest('.handle')) return; g.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
  const move = (e: React.PointerEvent) => {
    const s = g.current; if (!s) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    // Capture on the row's own surface, where the move and up handlers live; capturing on the outer row sent them elsewhere.
    if (!s.mode && (Math.abs(mx) > 10 || Math.abs(my) > 10)) { s.mode = Math.abs(mx) > Math.abs(my) ? 'swipe' : 'scroll'; if (s.mode === 'swipe') (e.currentTarget as HTMLElement).setPointerCapture(s.id); }
    if (s.mode === 'swipe') { s.dx = mx; setDx(mx); }
  };
  const up = () => {
    const s = g.current; g.current = null;
    if (s?.mode === 'swipe') { const d = s.dx || 0; if (d > 80) onDone(); else if (d < -80) onLater(); setDx(0); return; }
    if (!s?.mode && s) onTap();
  };

  // Reorder: hold the handle and drag; the row swaps with its neighbour once the finger passes its middle.
  // Followed on the whole window: when the row moves in the list, the browser can drop its hold on the handle.
  const dragRef = useRef(drag); dragRef.current = drag;
  const handleDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    setLift(true); drag.start();
    const move = (ev: PointerEvent) => {
      const list = el.current?.parentElement; if (!list) return;
      const d = dragRef.current;
      const rows = [...list.querySelectorAll<HTMLElement>(':scope > li')];
      let to = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
      if (to < 0) to = rows.length - 1; else if (to > d.index) to -= 1;
      if (to !== d.index) d.over(to);
    };
    const end = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
      setLift(false); dragRef.current.end();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  };

  const done = stop.state === 'done';
  return (
    <li ref={el} className={'stop-row' + (sel ? ' sel' : '') + (done ? ' done' : '') + (lift ? ' lift' : '')} data-stop={stop.state} data-stop-id={stop.id}
      draggable={wide} onDragStart={(e) => { e.dataTransfer.setData('text/wm-stop', stop.id); e.dataTransfer.effectAllowed = 'move'; }}>
      {legText && <div className={'leg' + (far ? ' far' : '')}>{legText}{far ? ' · far off the walk' : ''}</div>}
      <div className="swipe-under"><span className="ok">Done</span><span className="later">Later</span></div>
      <div className="stop-main" style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onClick={wide ? onTap : undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { g.current = null; setDx(0); }}>
        <span className="num" style={{ background: done ? undefined : areaColor(place) }}>{done ? '✓' : n}</span>
        <span className="stop-text">
          <span className="name">{place?.name || 'A removed place'}</span>
          {(stop.note || place?.note) && <span className="sub">{stop.note || firstLine(place!.note!)}</span>}
        </span>
        {stop.time && <span className="time">{stop.time}</span>}
        <span className="handle" aria-label="Hold to move" onPointerDown={handleDown}>≡</span>
      </div>
    </li>
  );
}
let colors = new Map<string, string>();
export const setAreaColors = (m: Map<string, string>) => { colors = m; };
const areaColor = (p?: Place) => (p?.areaId && colors.get(p.areaId)) || '#6b6b6b';
const firstLine = (s: string) => s.split(/(?<=\.)\s/)[0];

function TidyPanel({ t, p, dayId, onClose }: { t: TripData; p: Tidy; dayId: string; onClose: () => void }) {
  const name = (id: string) => t.byId.get(id)?.name || '';
  const items = dayStops(t.stops, t.byId, dayId);
  const changes = tidyChanges(p, t.stops, dayId);
  return (
    <Overlay title="Tidy the day" onClose={onClose}>
      {!changes ? <p>Already in walking order and within your pace.</p> : (
        <>
          <p className="muted small">In walking order from {items.some((x) => x.stop.state === 'done') ? 'your last stop' : 'the base'}, and back to your pace.</p>
          <div className="tidy-cols">
            <div><b>Now</b>{items.map((x) => <div key={x.stop.id} className={x.stop.state === 'done' ? 'muted' : ''}>{x.place?.name}</div>)}
              <div className="muted small">{p.before.stops} stops · {fmtH(p.before.travel)} travel</div></div>
            <div><b>Tidied</b>{items.filter((x) => x.stop.state === 'done').map((x) => <div key={x.stop.id} className="muted">{x.place?.name}</div>)}
              {p.order.map((s) => <div key={s.id}>{p.swap?.stop.id === s.id ? <span className="okc">{p.swap.with.name}</span> : name(s.placeId)}</div>)}
              {p.push.map((s) => <div key={s.id} className="muted"><s>{name(s.placeId)}</s> → next time</div>)}
              {p.swap && <div className="muted"><s>{name(p.swap.stop.placeId)}</s> → swapped, far off the walk</div>}
              <div className="muted small">{p.after.stops} stops · {fmtH(p.after.travel)} travel</div></div>
          </div>
          <button className="primary" data-tidy-accept onClick={async () => { await applyTidy(p, dayId); onClose(); }}>Tidy it</button>
        </>
      )}
    </Overlay>
  );
}

// The day's light, one line: blue hour, sunrise, golden hour, sunset, blue hour, in the city's own time.
function LightStrip({ t, date }: { t: TripData; date: string }) {
  const base = t.trip?.baseId ? t.byId.get(t.trip.baseId) : undefined;
  const at = base?.lat != null ? base : t.places.find((p) => p.lat != null);
  if (!at || !t.trip) return null;
  const x = lightOn(date, at.lat!, at.lng!, t.trip.tz);
  return (
    <div className="light" data-light aria-label="The day's light">
      {([['Blue', x.blueAm[0], 'blue'], ['Sunrise', x.sunrise, ''], ['Gold till', x.goldenAm, 'gold'], ['Gold from', x.goldenPm, 'gold'], ['Sunset', x.sunset, ''], ['Blue', x.bluePm[0], 'blue']] as const).map(([k, v, c], i) => (
        <span key={i} className={c}><small>{k}</small>{v}</span>
      ))}
    </div>
  );
}
