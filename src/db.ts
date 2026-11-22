import Dexie, { type EntityTable } from 'dexie';
import type { Trip, Area, Place, Day, Stop, Anchor, Note, CityGuide, TableName, Row } from './model';

// Everything lives on the device first (IndexedDB, the browser's own database), so the app works with no signal.
export const db = new Dexie('wanderman') as Dexie & {
  trips: EntityTable<Trip, 'id'>; areas: EntityTable<Area, 'id'>; places: EntityTable<Place, 'id'>;
  days: EntityTable<Day, 'id'>; stops: EntityTable<Stop, 'id'>; anchors: EntityTable<Anchor, 'id'>;
  notes: EntityTable<Note, 'id'>; guides: EntityTable<CityGuide, 'id'>;
  meta: EntityTable<{ key: string; value: any }, 'key'>;
};
db.version(1).stores({
  trips: 'id, dirty, updatedAt',
  areas: 'id, tripId, dirty',
  places: 'id, tripId, areaId, dirty',
  days: 'id, tripId, date, dirty',
  stops: 'id, tripId, dayId, placeId, dirty',
  anchors: 'id, tripId, dirty',
  notes: 'id, tripId, dirty',
  guides: 'id, tripId, dirty',
  meta: 'key',
});

let onChange: (() => void) | undefined;
export const whenChanged = (f: () => void) => { onChange = f; };

// Every edit goes through here: it stamps the row and marks it for sync.
export async function save<T extends Row>(table: TableName, row: Omit<T, 'updatedAt' | 'dirty' | 'deleted'> & Partial<Row>) {
  const full = { deleted: 0, ...row, updatedAt: Date.now(), dirty: 1 } as T;
  await (db[table] as any).put(full);
  onChange?.();
  return full;
}
export async function remove(table: TableName, id: string) {
  await (db[table] as any).update(id, { deleted: 1, updatedAt: Date.now(), dirty: 1 });
  onChange?.();
}
export const getMeta = async <T,>(key: string): Promise<T | undefined> => (await db.meta.get(key))?.value;
export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value });
