import { useEffect, useState } from 'react';
import type { Day, Place, Stop } from '../model';
import { addPlace, addToDay, googleSearchNear } from '../actions';
import { metres } from '../tiles';
import { useOnline } from './SyncBadge';
import type { TripData } from './useTrip';

// "A pizzeria near this stop": what OpenStreetMap knows within a short walk, to add to the day in one
// tap, and the same search in Google Maps for its reviews and photos. Needs signal.
const QUICK: { label: string; q: string; tag: string; kind: Place['kind'] }[] = [
  { label: 'Restaurant', q: 'restaurant', tag: 'amenity:restaurant', kind: 'food' },
  { label: 'Café', q: 'cafe', tag: 'amenity:cafe', kind: 'food' },
  { label: 'Pizzeria', q: 'pizza', tag: 'amenity:restaurant', kind: 'food' },
  { label: 'Bar', q: 'bar', tag: 'amenity:bar', kind: 'drink' },
];
type Hit = { name: string; lat: number; lng: number; address: string; district?: string; m: number; what: string };

export function FindNearby({ t, near, after, day, onAdded }: { t: TripData; near: Place; after?: Stop; day?: Day; onAdded: (p: Place) => void }) {
  const online = useOnline();
  const [q, setQ] = useState(''), [chip, setChip] = useState<(typeof QUICK)[number]>(), [hits, setHits] = useState<Hit[]>(), [busy, setBusy] = useState(false);
  const term = chip ? chip.label : q.trim();
  useEffect(() => {
    const query = chip?.q || q.trim();
    if (!online || query.length < 3) { setHits(undefined); return; }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const dLat = 0.007, dLng = 0.011; // about 800 m each way
        const bbox = [near.lng! - dLng, near.lat! - dLat, near.lng! + dLng, near.lat! + dLat].join(',');
        const tag = chip ? `&osm_tag=${chip.tag}` : '';
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&bbox=${bbox}&lat=${near.lat}&lon=${near.lng}&limit=15&lang=en${tag}`, { signal: ctl.signal });
        const j = await r.json();
        setHits((j.features || []).map((f: any) => {
          const p = f.properties, lat = f.geometry.coordinates[1], lng = f.geometry.coordinates[0];
          return { name: p.name, lat, lng, m: metres({ lat, lng }, near as any), district: p.district || p.locality,
            address: [[p.street, p.housenumber].filter(Boolean).join(' '), [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
            what: String(p.osm_value || '').replace(/_/g, ' ') };
        }).filter((h: Hit) => h.name).sort((a: Hit, b: Hit) => a.m - b.m).slice(0, 8));
      } catch {} finally { setBusy(false); }
    }, 300);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [q, chip, online, near.id]);

  return (
    <div className="nearby" data-nearby>
      <div className="nearby-title">Find near here</div>
      <div className="chips">
        {QUICK.map((c) => <button key={c.label} className={'chip' + (chip === c ? ' on' : '')} onClick={() => { setChip(chip === c ? undefined : c); setQ(''); }}>{c.label}</button>)}
      </div>
      <input value={q} placeholder={online ? 'Or type: pizzeria, bakery, bookshop' : 'Needs signal'} disabled={!online} onChange={(e) => { setQ(e.target.value); setChip(undefined); }} />
      {busy && <div className="muted small">Looking</div>}
      {hits && !hits.length && !busy && <div className="muted small">Nothing on OpenStreetMap within a short walk. Try Google Maps.</div>}
      {hits?.map((h, i) => (
        <div key={i} className="hit" data-hit>
          <span className="stop-text"><span className="name">{h.name}</span><span className="sub">{Math.max(1, Math.round((h.m * 1.3) / 80))} min walk · {h.what}</span></span>
          <button className="secondary small" aria-label={`Add ${h.name}`} onClick={async () => {
            const p = await addPlace(near.tripId, { name: h.name, lat: h.lat, lng: h.lng, address: h.address, district: h.district, kind: chip?.kind || (/(cafe|restaurant|fast food|bakery)/.test(h.what) ? 'food' : /(bar|pub)/.test(h.what) ? 'drink' : 'other') });
            if (day) await addToDay(near.tripId, p.id, day.id, after);
            onAdded(p);
          }}>{day ? 'Add' : 'Save'}</button>
        </div>
      ))}
      {term && <a className="card-link" href={googleSearchNear(term, near)} target="_blank" rel="noreferrer" data-google>Search “{term}” near {near.name} in Google Maps</a>}
      {!term && <a className="card-link" href={googleSearchNear('restaurants', near)} target="_blank" rel="noreferrer">Restaurants near {near.name} in Google Maps</a>}
    </div>
  );
}
