import { useEffect, useState } from 'react';
import { onSync, syncState } from '../sync';

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => { const u = () => setOn(true), d = () => setOn(false); addEventListener('online', u); addEventListener('offline', d); return () => { removeEventListener('online', u); removeEventListener('offline', d); }; }, []);
  return on;
}

export function SyncBadge() {
  const [s, setS] = useState(syncState());
  useEffect(() => { onSync(setS); }, []);
  const online = useOnline();
  const label = !online ? 'No signal' : s.status === 'syncing' ? 'Syncing' : s.status === 'error' ? 'Sync failed' : s.status === 'idle' ? 'Synced' : null;
  return label ? <span className={'badge ' + (s.status === 'error' ? 'warn' : '')} title={s.error}>{label}</span> : <span className="badge-space" />;
}
