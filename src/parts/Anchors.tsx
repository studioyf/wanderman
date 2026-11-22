import { useEffect, useState } from 'react';
import { db, save, remove } from '../db';
import { uid, type Anchor, type AnchorKind } from '../model';
import { dayLabel } from './format';
import { Overlay } from './Overlay';
import type { TripData } from './useTrip';

// Flights, trains, stays and bookings: the only things with a time. Each shows on its day (a stay on the day you
// check in and the day you check out), opens to its details and its ticket, which opens even with no signal.

export const ICON: Record<AnchorKind, string> = { flight: '✈', train: '🚆', stay: '🛏', booking: '🎟' };
const KINDS: [AnchorKind, string][] = [['flight', 'Flight'], ['train', 'Train'], ['stay', 'Stay'], ['booking', 'Booking']];

// What an anchor puts on a given day: zero, one or (a one-night stay) two moments.
export function onDate(a: Anchor, date: string): { time: string; label: string }[] {
  const out: { time: string; label: string }[] = [];
  if (a.start.slice(0, 10) === date) out.push({ time: a.start.slice(11, 16), label: a.kind === 'stay' ? `Check in, ${a.title}` : a.title });
  if (a.end && a.end.slice(0, 10) === date) out.push({ time: a.end.slice(11, 16), label: a.kind === 'stay' ? `Check out, ${a.title}` : `${a.title} ends` });
  return out;
}

export function DayAnchors({ t, date }: { t: TripData; date: string }) {
  const [open, setOpen] = useState<Anchor>();
  const rows = t.anchors.flatMap((a) => onDate(a, date).map((m) => ({ a, ...m }))).sort((x, y) => x.time.localeCompare(y.time));
  if (!rows.length && !open) return null;
  return (
    <>
      <div className="day-anchors" data-day-anchors>
        {rows.map((r, i) => (
          <button key={i} className="anchor-row" data-anchor={r.a.id} onClick={() => setOpen(r.a)}>
            <span className="anchor-time">{r.time}</span><span className="anchor-icon">{ICON[r.a.kind]}</span>
            <span className="anchor-label">{r.label}</span>{r.a.ticket && <span className="anchor-ticket">Ticket</span>}
          </button>
        ))}
      </div>
      {open && <AnchorSheet t={t} a={open} onClose={() => setOpen(undefined)} />}
    </>
  );
}

export function AnchorList({ t }: { t: TripData }) {
  const [open, setOpen] = useState<Anchor | 'new'>();
  return (
    <div className="anchor-list" data-anchors>
      {[...t.anchors].sort((a, b) => a.start.localeCompare(b.start)).map((a) => (
        <button key={a.id} className="anchor-row" data-anchor={a.id} onClick={() => setOpen(a)}>
          <span className="anchor-time">{dayLabel(a.start.slice(0, 10))} {a.start.slice(11, 16)}</span><span className="anchor-icon">{ICON[a.kind]}</span>
          <span className="anchor-label">{a.title}</span>{a.ticket && <span className="anchor-ticket">Ticket</span>}
        </button>
      ))}
      <button className="secondary small" data-anchor-add onClick={() => setOpen('new')}>Add a flight, train or stay</button>
      {open === 'new' && <AnchorEdit t={t} onClose={() => setOpen(undefined)} />}
      {open && open !== 'new' && <AnchorSheet t={t} a={open} onClose={() => setOpen(undefined)} />}
    </div>
  );
}

// The ticket, ready before the tap: Safari only opens a new window straight from a tap, not after reading the file.
function useTicketUrl(a: Anchor) {
  const [url, setUrl] = useState<string | null>();
  useEffect(() => {
    if (!a.ticket) { setUrl(undefined); return; }
    let u: string | undefined;
    db.blobs.get(a.ticket.id).then((r) => { u = r ? URL.createObjectURL(r.blob) : undefined; setUrl(u || null); });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [a.ticket?.id]);
  return url;
}

export function AnchorSheet({ t, a: given, onClose }: { t: TripData; a: Anchor; onClose: () => void }) {
  const a = t.anchors.find((x) => x.id === given.id) || given;
  const [edit, setEdit] = useState(false);
  const ticket = useTicketUrl(a);
  if (edit) return <AnchorEdit t={t} a={a} onClose={() => setEdit(false)} />;
  const place = a.placeId ? t.byId.get(a.placeId) : undefined;
  return (
    <Overlay title={`${ICON[a.kind]} ${a.title}`} onClose={onClose}>
      <div className="anchor-sheet" data-anchor-sheet>
        <p><b>{dayLabel(a.start.slice(0, 10))} {a.start.slice(11, 16)}</b>{a.end ? ` to ${a.end.slice(0, 10) !== a.start.slice(0, 10) ? dayLabel(a.end.slice(0, 10)) + ' ' : ''}${a.end.slice(11, 16)}` : ''}</p>
        {place && <p className="muted">{place.name}{place.address ? `, ${place.address}` : ''}</p>}
        {a.detail && <p>{a.detail}</p>}
        {a.ticket ? (ticket ? <a className="primary ticket-open" data-ticket-open href={ticket} target="_blank" rel="noreferrer">Open the ticket</a>
          : ticket === null ? <p className="muted small">The ticket was attached on another device and is not on this one yet.</p> : null)
          : <p className="muted small">No ticket attached.</p>}
        <TicketPicker a={a} />
        <button className="menu-item" onClick={() => setEdit(true)}>Change</button>
        <button className="menu-item danger" onClick={async () => { if (confirm(`Remove ${a.title}?`)) { await remove('anchors', a.id); onClose(); } }}>Remove</button>
      </div>
    </Overlay>
  );
}

function TicketPicker({ a }: { a: Anchor }) {
  return (
    <label className="secondary ticket-pick">
      {a.ticket ? `Replace ${a.ticket.name}` : 'Attach the ticket (PDF or picture)'}
      <input type="file" accept="application/pdf,image/*" hidden data-ticket-file onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const id = uid();
        await db.blobs.put({ id, blob: f });
        if (a.ticket) await db.blobs.delete(a.ticket.id);
        await save<Anchor>('anchors', { ...a, ticket: { id, name: f.name, mime: f.type || 'application/pdf' } });
      }} />
    </label>
  );
}

function AnchorEdit({ t, a, onClose }: { t: TripData; a?: Anchor; onClose: () => void }) {
  const first = t.days[0]?.date || t.trip!.start;
  const [kind, setKind] = useState<AnchorKind>(a?.kind || 'flight');
  const [title, setTitle] = useState(a?.title || '');
  const [sd, setSd] = useState(a?.start.slice(0, 10) || first), [st, setSt] = useState(a?.start.slice(11, 16) || '10:00');
  const [ed, setEd] = useState(a?.end?.slice(0, 10) || ''), [et, setEt] = useState(a?.end?.slice(11, 16) || '');
  const [placeId, setPlaceId] = useState(a?.placeId || ''), [detail, setDetail] = useState(a?.detail || '');
  const dates = t.days.map((d) => d.date);
  const ok = title.trim() && sd && /^\d\d:\d\d$/.test(st);
  return (
    <Overlay title={a ? 'Change' : 'A fixed time'} onClose={onClose}>
      <div className="anchor-form" data-anchor-form>
        <div className="chips">{KINDS.map(([k, l]) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{ICON[k]} {l}</button>)}</div>
        <input data-anchor-title placeholder={kind === 'flight' ? 'LH 1234 to Paris' : kind === 'train' ? 'ICE to Hamburg' : kind === 'stay' ? 'Hotel name' : 'What is booked'} value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="small muted">{kind === 'stay' ? 'Check in' : 'Leaves or starts'}</label>
        <div className="row"><select value={sd} onChange={(e) => setSd(e.target.value)}>{dates.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}</select><input type="time" data-anchor-time value={st} onChange={(e) => setSt(e.target.value)} /></div>
        <label className="small muted">{kind === 'stay' ? 'Check out' : 'Arrives or ends (optional)'}</label>
        <div className="row"><select value={ed} onChange={(e) => setEd(e.target.value)}><option value="">None</option>{dates.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}</select><input type="time" value={et} onChange={(e) => setEt(e.target.value)} disabled={!ed} /></div>
        <select value={placeId} onChange={(e) => setPlaceId(e.target.value)}><option value="">No place</option>{[...t.places].sort((x, y) => x.name.localeCompare(y.name)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <textarea rows={2} placeholder="Seat, platform, booking number, what to do" value={detail} onChange={(e) => setDetail(e.target.value)} />
        <button className="primary" data-anchor-save disabled={!ok} onClick={async () => {
          await save<Anchor>('anchors', { ...(a || { id: uid(), tripId: t.trip!.id }), kind, title: title.trim(), start: `${sd}T${st}`, end: ed && et ? `${ed}T${et}` : undefined, placeId: placeId || undefined, detail: detail.trim() || undefined } as Anchor);
          onClose();
        }}>Save</button>
      </div>
    </Overlay>
  );
}
