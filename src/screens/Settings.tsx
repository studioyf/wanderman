import { useEffect, useState } from 'react';
import { go } from '../App';
import { LOOKS, applyLook, savedLook, type LookId } from '../looks';
import { supabase } from '../supabase';
import { signIn, signOut, syncNow } from '../sync';
import { usePace, setPace } from '../pace';

export function Settings() {
  const [look, setLook] = useState<LookId>(savedLook());
  const pace = usePace();
  return (
    <div className="page">
      <header className="bar"><button className="ghost" onClick={() => go('')}>Back</button><h1>Settings</h1><span /></header>
      <main className="form wide">
        <h2>Look</h2>
        <p className="muted">Three looks made to read in daylight. Try each outside.</p>
        <div className="looks">
          {LOOKS.map((l) => (
            <button key={l.id} data-look-choice={l.id} className={'look-card' + (look === l.id ? ' on' : '')} data-look={l.id} onClick={() => { applyLook(l.id); setLook(l.id); }}>
              <span className="look-sample"><span className="look-title">Neue Nationalgalerie</span><span className="look-meta">Museum · 12 min walk</span><span className="look-chip">Done</span></span>
              <strong>{l.name}</strong><span className="small">{l.about}</span>
            </button>
          ))}
        </div>
        <h2>Pace</h2>
        <p className="muted">When a day counts as too full. Your call, not the app's.</p>
        <Stepper label="Stops in a half day, at most" value={pace.stopsPerHalfDay} min={1} max={10} onChange={(v) => setPace({ ...pace, stopsPerHalfDay: v })} />
        <Stepper label="Free hours a day, at least" value={pace.freeHours} min={0} max={8} onChange={(v) => setPace({ ...pace, freeHours: v })} />
        <h2>Account</h2>
        <Account />
      </main>
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper"><span>{label}</span>
      <button className="secondary" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Less">−</button>
      <strong>{value}</strong>
      <button className="secondary" onClick={() => onChange(Math.min(max, value + 1))} aria-label="More">+</button>
    </div>
  );
}

function Account() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [create, setCreate] = useState(false);
  const [user, setUser] = useState<string>(), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user.email));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user.email));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!supabase) return <p className="muted">Sign-in is not switched on in this version yet. Everything is kept on this device.</p>;
  if (user) return <div><p>Signed in as {user}. Trips sync between your devices.</p><div className="row"><button className="secondary" onClick={() => syncNow()}>Sync now</button><button className="ghost" onClick={() => signOut()}>Sign out</button></div></div>;
  return (
    <form className="signin" onSubmit={async (e) => { e.preventDefault(); setMsg(''); setBusy(true); try { await signIn(email.trim(), password, create); } catch (err: any) { setMsg(err.message); } finally { setBusy(false); } }}>
      <p className="muted">Sign in to have your trips on the Mac, the iPad and the iPhone.</p>
      <input type="email" name="email" autoComplete="username" value={email} placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input type="password" name="password" autoComplete={create ? 'new-password' : 'current-password'} value={password} placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      <div className="row">
        <button className="primary" disabled={busy || !email.includes('@') || password.length < 8}>{create ? 'Make account' : 'Sign in'}</button>
        <button type="button" className="ghost" onClick={() => setCreate(!create)}>{create ? 'I have an account' : 'New here? Make an account'}</button>
      </div>
      {create && <p className="muted small">At least 8 characters.</p>}
      {msg && <p className="warn-text">{msg}</p>}
    </form>
  );
}
