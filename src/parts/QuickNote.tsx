import { useEffect, useRef, useState } from 'react';
import { addNote } from '../notes';
import { Overlay } from './Overlay';

// One tap opens it, typing starts at once. Photo opens the camera and saves as soon as the picture is taken;
// Voice records until tapped again and saves. Every note is stamped with the time, the place and the stop.
export function QuickNote({ tripId, placeId, stopId, about, onClose }: { tripId: string; placeId?: string; stopId?: string; about?: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [rec, setRec] = useState<{ r: MediaRecorder; started: number }>(), [secs, setSecs] = useState(0), [err, setErr] = useState('');
  const chunks = useRef<Blob[]>([]);
  const base = { tripId, placeId, stopId };

  useEffect(() => { if (!rec) return; const i = setInterval(() => setSecs(Math.round((Date.now() - rec.started) / 1000)), 500); return () => clearInterval(i); }, [rec]);
  useEffect(() => () => rec?.r.stream.getTracks().forEach((x) => x.stop()), [rec]);

  const done = async (extra?: Parameters<typeof addNote>[0]) => { await addNote(extra || { ...base, text }); onClose(); };
  const voice = async () => {
    if (rec) { rec.r.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      const started = Date.now();
      r.onstop = () => {
        stream.getTracks().forEach((x) => x.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/mp4' });
        done({ ...base, text, blob, kind: 'voice', secs: Math.round((Date.now() - started) / 1000) });
      };
      r.start(); setRec({ r, started });
    } catch { setErr('The microphone is not available here.'); }
  };

  return (
    <Overlay title={about ? `Note at ${about}` : 'Note'} onClose={() => { rec?.r.stop(); onClose(); }}>
      <textarea className="note-text" data-note-text autoFocus rows={3} value={text} placeholder="What you see, what to remember" onChange={(e) => setText(e.target.value)} />
      <div className="note-buttons">
        <label className="secondary note-photo">
          Photo
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) done({ ...base, text, blob: f, kind: 'photo' }); }} />
        </label>
        <button className={rec ? 'primary rec' : 'secondary'} onClick={voice}>{rec ? `Stop ${secs}s` : 'Voice'}</button>
        <button className="primary" data-note-save disabled={!text.trim() || !!rec} onClick={() => done()}>Save</button>
      </div>
      {err && <p className="muted small">{err}</p>}
    </Overlay>
  );
}
