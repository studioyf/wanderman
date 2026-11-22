import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, remove } from '../db';
import type { Note } from '../model';
import { blobUrl } from '../notes';
import { dayLabel } from './format';
import type { TripData } from './useTrip';

// Every quick note of the trip, newest first, by day in the city's own time.
export function NotesList({ t, onPlace, onNew }: { t: TripData; onPlace: (placeId: string) => void; onNew: () => void }) {
  const tz = t.trip?.tz || 'UTC';
  const notes = useLiveQuery(() => db.notes.where('tripId').equals(t.trip?.id || '').filter((n) => !n.deleted).toArray(), [t.trip?.id]) || [];
  const dateOf = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
  const timeOf = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
  const byDay = new Map<string, Note[]>();
  for (const n of [...notes].sort((a, b) => b.at - a.at)) { const d = dateOf(n.at); byDay.set(d, [...(byDay.get(d) || []), n]); }
  return (
    <div className="notes" data-notes>
      <button className="primary new-note" onClick={onNew}>New note</button>
      {!notes.length && <p className="muted">Nothing yet. A note, a photo or a voice memo, stamped with the time and the place.</p>}
      {[...byDay].map(([d, ns]) => (
        <section key={d}>
          <h4 className="notes-day">{dayLabel(d)}</h4>
          {ns.map((n) => {
            const place = n.placeId ? t.byId.get(n.placeId) : undefined;
            return (
              <article key={n.id} className="note" data-note={n.id}>
                <div className="note-head">
                  <span className="note-time">{timeOf(n.at)}</span>
                  {place ? <button className="link" onClick={() => onPlace(place.id)}>{place.name}</button> : n.lat != null ? <span className="muted small">{n.lat.toFixed(4)}, {n.lng!.toFixed(4)}</span> : null}
                  <button className="link quiet" aria-label="Delete note" onClick={() => { if (confirm('Delete this note?')) remove('notes', n.id); }}>Delete</button>
                </div>
                {n.text && <p className="note-body">{n.text}</p>}
                {n.media && <Media m={n.media} />}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function Media({ m }: { m: NonNullable<Note['media']> }) {
  const [url, setUrl] = useState<string | null>();
  useEffect(() => { let u: string | undefined; blobUrl(m.id).then((x) => { u = x; setUrl(x || null); }); return () => { if (u) URL.revokeObjectURL(u); }; }, [m.id]);
  if (url === null) return <p className="muted small">{m.kind === 'photo' ? 'Photo' : 'Voice memo'} kept on another device.</p>;
  if (!url) return null;
  return m.kind === 'photo' ? <img className="note-photo-img" src={url} alt="" /> : <audio controls src={url} preload="metadata" />;
}
