import { useEffect, useState } from 'react';
import type { Place } from '../model';
import { useOnline } from './SyncBadge';

type Hit = { name: string; lat: number; lng: number; address?: string; district?: string; kind?: Place['kind']; what?: string };

// Search by OpenStreetMap's Photon, the free place search, weighted towards the trip's base.
function kindOf(key: string, value: string): Place['kind'] {
  if (value === 'museum' || value === 'gallery') return 'museum';
  if (['restaurant', 'cafe', 'fast_food', 'food_court', 'bakery'].includes(value)) return 'food';
  if (['bar', 'pub', 'biergarten', 'nightclub'].includes(value)) return 'drink';
  if (['hotel', 'hostel', 'guest_house', 'apartment'].includes(value)) return 'stay';
  if (value === 'marketplace') return 'market';
  if (key === 'railway' || key === 'aeroway' || value === 'station') return 'transport';
  if (key === 'tourism' || key === 'historic' || key === 'building' || key === 'leisure') return 'sight';
  return 'other';
}

export function PlaceSearch({ near, onPick }: { near?: { lat?: number; lng?: number }; onPick: (h: Hit) => void }) {
  const [q, setQ] = useState(''), [hits, setHits] = useState<Hit[]>([]), [busy, setBusy] = useState(false);
  const online = useOnline();
  useEffect(() => {
    if (q.trim().length < 3 || !online) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const bias = near?.lat != null ? `&lat=${near.lat}&lon=${near.lng}&location_bias_scale=0.4` : '';
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en${bias}`, { signal: ctl.signal });
        const j = await r.json();
        setHits((j.features || []).map((f: any) => {
          const p = f.properties;
          return { name: p.name || [p.street, p.housenumber].filter(Boolean).join(' '), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
            address: [[p.street, p.housenumber].filter(Boolean).join(' '), [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
            district: p.district || p.locality, kind: kindOf(p.osm_key, p.osm_value), what: [p.district || p.locality, p.city].filter(Boolean).join(', ') };
        }).filter((h: Hit) => h.name));
      } catch {} finally { setBusy(false); }
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, online]);
  return (
    <div className="search">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={online ? 'Add a place' : 'Search needs signal. Long-press the map to add a place'} disabled={!online} />
      {busy && <span className="muted small">Searching</span>}
      {hits.length > 0 && (
        <div className="hits">
          {hits.map((h, i) => <button key={i} className="place" onClick={() => { onPick(h); setQ(''); setHits([]); }}><span className="name">{h.name}</span><span className="muted small">{h.what}</span></button>)}
        </div>
      )}
    </div>
  );
}
