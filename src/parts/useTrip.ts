import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Place } from '../model';

// Everything about one trip, kept up to date as it changes.
export function useTrip(id: string) {
  const trip = useLiveQuery(() => db.trips.get(id), [id]);
  const live = <T,>(f: () => Promise<T[]>) => useLiveQuery(f, [id]) || ([] as T[]);
  const places = live(() => db.places.where('tripId').equals(id).filter((p) => !p.deleted).toArray());
  const areas = live(() => db.areas.where('tripId').equals(id).filter((a) => !a.deleted).toArray());
  const days = live(() => db.days.where('tripId').equals(id).filter((d) => !d.deleted).sortBy('date'));
  const stops = live(() => db.stops.where('tripId').equals(id).filter((s) => !s.deleted).toArray());
  const anchors = live(() => db.anchors.where('tripId').equals(id).filter((a) => !a.deleted).toArray());
  const guide = useLiveQuery(() => db.guides.where('tripId').equals(id).filter((g) => !g.deleted).first(), [id]);
  const byId = useMemo(() => new Map<string, Place>(places.map((p) => [p.id, p])), [places]);
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  return { trip, places, areas, days, stops, anchors, guide, byId, areaById };
}
export type TripData = ReturnType<typeof useTrip>;
