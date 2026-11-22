import { db, getMeta, setMeta } from './db';
import { TABLES, type TableName } from './model';
import { supabase } from './supabase';

// Sync, local first: the device's copy is the one that counts, the server is where devices meet.
// Every row goes up as one record (what kind it is, which trip, its contents), and comes down to
// any other device signed in to the same account. The last change wins.
export type SyncState = { status: 'off' | 'signed-out' | 'idle' | 'syncing' | 'error' | 'offline'; at?: number; error?: string };
let state: SyncState = { status: supabase ? 'signed-out' : 'off' };
const listeners = new Set<(s: SyncState) => void>();
const set = (s: SyncState) => { state = s; listeners.forEach((f) => f(s)); };
export const syncState = () => state;
export const onSync = (f: (s: SyncState) => void) => { listeners.add(f); return () => listeners.delete(f); };

const strip = ({ dirty, ...rest }: any) => rest;

export async function syncNow() {
  if (!supabase) return set({ status: 'off' });
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return set({ status: 'signed-out' });
  if (!navigator.onLine) return set({ ...state, status: 'offline' });
  set({ ...state, status: 'syncing' });
  try {
    // Up: everything changed here since the last sync.
    for (const t of TABLES) {
      const rows = await (db[t] as any).where('dirty').equals(1).toArray();
      if (!rows.length) continue;
      const records = rows.map((r: any) => ({ id: r.id, owner: user.id, kind: t, trip_id: t === 'trips' ? r.id : r.tripId, data: strip(r), updated_at: r.updatedAt, deleted: !!r.deleted }));
      const { error } = await supabase.from('records').upsert(records, { onConflict: 'owner,id' });
      if (error) throw error;
      // Only clear the mark on rows not changed again while they were being sent.
      await db.transaction('rw', db[t], async () => {
        for (const r of rows) { const now: any = await db[t].get(r.id); if (now && now.updatedAt === r.updatedAt) await (db[t] as any).update(r.id, { dirty: 0 }); }
      });
    }
    // Down: everything the server has received since this device last asked.
    const since = (await getMeta<string>('pulledAt')) || '1970-01-01T00:00:00Z';
    let latest = since;
    for (let page = 0; ; page++) {
      const { data: recs, error } = await supabase.from('records').select('*').gte('server_at', since).order('server_at').range(page * 1000, page * 1000 + 999);
      if (error) throw error;
      for (const rec of recs || []) {
        const t = rec.kind as TableName;
        if (!TABLES.includes(t)) continue;
        const mine: any = await db[t].get(rec.id);
        if (!mine || (!mine.dirty && mine.updatedAt <= rec.updated_at) || mine.updatedAt < rec.updated_at)
          await (db[t] as any).put({ ...rec.data, id: rec.id, updatedAt: rec.updated_at, deleted: rec.deleted ? 1 : 0, dirty: 0 });
        if (rec.server_at > latest) latest = rec.server_at;
      }
      if (!recs || recs.length < 1000) break;
    }
    await setMeta('pulledAt', latest);
    set({ status: 'idle', at: Date.now() });
  } catch (e: any) {
    set({ status: 'error', at: Date.now(), error: e?.message || String(e) });
  }
}

let timer: any;
export const syncSoon = () => { clearTimeout(timer); timer = setTimeout(syncNow, 2000); };

export function startSync() {
  if (!supabase) return;
  supabase.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') syncSoon(); if (ev === 'SIGNED_OUT') set({ status: 'signed-out' }); });
  addEventListener('online', syncSoon);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncSoon(); });
}

// Sign-in by email and password (ANSWERS 5): no email to open, so it works inside the app on the home
// screen, and the password manager fills it on each device. A new email makes a new account.
export async function signIn(email: string, password: string, create: boolean) {
  if (!supabase) throw new Error('Sign-in is not set up yet');
  const { data, error } = create ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (create && !data.session) throw new Error('Account made, but Supabase still asks for the email to be confirmed. Turn off Confirm email in Supabase, then sign in.');
}
export async function signOut() { await supabase?.auth.signOut(); }
