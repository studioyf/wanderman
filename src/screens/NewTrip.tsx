import { useState } from 'react';
import { save } from '../db';
import { uid, type Trip } from '../model';
import { go } from '../App';

export function NewTrip() {
  const [city, setCity] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState('');
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ok = city.trim() && start && end && end >= start;
  return (
    <div className="page">
      <header className="bar"><button className="ghost" onClick={() => go('')}>Back</button><h1>New trip</h1><span /></header>
      <main className="form">
        <label>City<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lisbon" autoFocus /></label>
        <label>From<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>To<input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></label>
        <p className="muted">Time zone: {tz}</p>
        <button className="primary" disabled={!ok} onClick={async () => {
          const t = await save<Trip>('trips', { id: uid(), name: city.trim(), city: city.trim(), start, end, tz });
          go('trip/' + t.id);
        }}>Create</button>
      </main>
    </div>
  );
}
