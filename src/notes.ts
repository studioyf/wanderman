import { db, save } from './db';
import { uid, type Note, type NoteMedia, type Place } from './model';
import { metres } from './tiles';

// Quick notes: saved the moment they are made, then stamped with where you are once the phone knows.
// A note with no stop is linked to a saved place within 150 m of where it was taken.

export async function addNote(n: { tripId: string; text?: string; placeId?: string; stopId?: string; blob?: Blob; kind?: NoteMedia['kind']; secs?: number }) {
  let media: NoteMedia | undefined;
  if (n.blob && n.kind) {
    const blob = n.kind === 'photo' ? await shrink(n.blob) : n.blob;
    media = { id: uid(), kind: n.kind, mime: blob.type || n.blob.type, secs: n.secs };
    await db.blobs.put({ id: media.id, blob });
  }
  const note = await save<Note>('notes', { id: uid(), tripId: n.tripId, at: Date.now(), text: n.text?.trim() || undefined, placeId: n.placeId, stopId: n.stopId, media });
  stamp(note.id, n.tripId);
  return note;
}

function stamp(id: string, tripId: string) {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const note = await db.notes.get(id); if (!note) return;
    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    let placeId = note.placeId;
    if (!placeId) {
      const places = (await db.places.where('tripId').equals(tripId).toArray()).filter((p) => !p.deleted && p.lat != null);
      let best: [number, Place | undefined] = [150, undefined];
      for (const p of places) { const d = metres(here, p as { lat: number; lng: number }); if (d < best[0]) best = [d, p]; }
      placeId = best[1]?.id;
    }
    await save<Note>('notes', { ...note, ...here, placeId });
  }, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}

// A phone photo down to 1600 px on its long side: enough to remember by, small enough to keep many.
async function shrink(b: Blob): Promise<Blob> {
  try {
    const img = await createImageBitmap(b);
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    if (k === 1 && b.size < 900_000) return b;
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((r) => c.toBlob((x) => r(x || b), 'image/jpeg', 0.85));
  } catch { return b; }
}

export const blobUrl = async (id: string) => { const r = await db.blobs.get(id); return r ? URL.createObjectURL(r.blob) : undefined; };
