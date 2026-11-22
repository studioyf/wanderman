// WanderMan's data, as kept on the device. Every row carries the same three bookkeeping fields so that
// sync can work the same way for all of them: when it last changed, whether it was removed, and whether
// it still has to be sent to the server.
export type Row = { id: string; updatedAt: number; deleted: 0 | 1; dirty: 0 | 1 };

export type OfflineMap = { template: string; bbox: Bbox; savedAt: number; tiles: number; bytes: number };
export type Bbox = [west: number, south: number, east: number, north: number];

export type Trip = Row & {
  name: string; city: string; country?: string;
  start: string; end: string; // dates, yyyy-mm-dd, in the trip's own time zone
  tz: string; baseId?: string; // the place where you sleep
  offline?: OfflineMap;
};
export type Area = Row & { tripId: string; name: string; color: string };
export type PlaceKind = 'sight' | 'museum' | 'food' | 'drink' | 'stay' | 'transport' | 'walk' | 'market' | 'other';
export type Place = Row & {
  tripId: string; areaId?: string; name: string; kind: PlaceKind;
  lat?: number; lng?: number; // a link with no location sits in the Inbox until it gets one
  address?: string; url?: string; note?: string; hours?: string;
};
export type Day = Row & { tripId: string; date: string; title: string; note?: string };
export type StopState = 'planned' | 'done' | 'later' | 'dropped';
export type Stop = Row & { tripId: string; dayId: string; placeId: string; order: number; state: StopState; time?: string; note?: string };
export type AnchorKind = 'flight' | 'train' | 'stay' | 'booking';
export type Anchor = Row & { tripId: string; kind: AnchorKind; title: string; start: string; end?: string; placeId?: string; detail?: string };
export type Note = Row & { tripId: string; at: number; text?: string; lat?: number; lng?: number; placeId?: string; stopId?: string };
export type CityGuide = Row & { tripId: string; city: string; sections: { title: string; lines: string[] }[] };

export const TABLES = ['trips', 'areas', 'places', 'days', 'stops', 'anchors', 'notes', 'guides'] as const;
export type TableName = (typeof TABLES)[number];

export const uid = () => crypto.randomUUID();
