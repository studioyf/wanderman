import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { go } from '../App';
import { loadBerlin, BERLIN_ID } from '../berlin';
import { datesLabel } from '../parts/format';
import { SyncBadge } from '../parts/SyncBadge';

export function Home() {
  const trips = useLiveQuery(() => db.trips.filter((t) => !t.deleted).toArray(), []) || [];
  trips.sort((a, b) => b.start.localeCompare(a.start));
  const hasBerlin = trips.some((t) => t.id === BERLIN_ID);
  return (
    <div className="page home">
      <header className="bar">
        <h1 className="brand">WanderMan</h1>
        <SyncBadge />
        <button className="ghost" onClick={() => go('settings')}>Settings</button>
      </header>
      <main className="list">
        {trips.map((t) => (
          <button key={t.id} className="trip-card" data-trip={t.id} onClick={() => go('trip/' + t.id)}>
            <span className="trip-name">{t.name}</span>
            <span className="muted">{datesLabel(t.start, t.end)}</span>
            <span className={'offline-tag ' + (t.offline ? 'yes' : '')}>{t.offline ? 'Works offline' : 'Map not saved yet'}</span>
          </button>
        ))}
        {!trips.length && <p className="empty">No trips yet.</p>}
        <div className="actions">
          <button className="primary" onClick={() => go('new')}>New trip</button>
          {!hasBerlin && <button className="secondary" id="add-berlin" onClick={async () => { const t = await loadBerlin(); go('trip/' + t.id); }}>Add the Berlin test trip</button>}
        </div>
      </main>
    </div>
  );
}
