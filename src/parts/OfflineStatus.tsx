import { useEffect, useState } from 'react';
import type { Place, Trip } from '../model';
import { needsSaving, saveOffline } from '../offline';
import { fillDetails } from '../details';
import { baseStyle } from '../mapstyle';
import { mb } from './format';
import { useOnline } from './SyncBadge';

// Offline is the default: a trip's map saves itself whenever there is signal and the trip's places
// have grown past what was saved. The button is only there to retry.
export function OfflineStatus({ trip, places }: { trip: Trip; places: Place[] }) {
  const online = useOnline();
  const [progress, setProgress] = useState<[number, number]>(), [error, setError] = useState('');
  const run = () => { setError(''); saveOffline(trip.id, (d, t) => setProgress([d, t])).catch((e) => setError(String(e?.message || e))).finally(() => setProgress(undefined)); };
  // With the map, each place's photo, hours and two lines from Wikipedia, so the cards read offline too.
  useEffect(() => { if (online) fillDetails(trip.id).catch(() => {}); }, [online, trip.id, places.length]);
  useEffect(() => {
    if (!online || progress) return;
    baseStyle().then((b) => { if (needsSaving(trip, places, b.template)) run(); }).catch(() => {});
  }, [online, trip.id, places.length, trip.offline?.savedAt]);
  if (progress) return <span className="offline-status busy" data-offline="saving">Saving map {Math.round((progress[0] / progress[1]) * 100)}%</span>;
  if (error) return <button className="offline-status warn" onClick={run} title={error}>Map not saved. Retry</button>;
  if (trip.offline) return <span className="offline-status yes" data-offline="saved" title={`${trip.offline.tiles} pieces, ${mb(trip.offline.bytes)}`}>Works offline</span>;
  return <span className="offline-status" data-offline="none">{online ? 'Map not saved' : 'No signal, map not saved'}</span>;
}
