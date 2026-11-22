import { useEffect, useRef, useState, type ReactNode } from 'react';

// The phone's sheet over the map: pulled up or pushed down by its top edge, it rests at three heights:
// a peek, half the screen, or nearly all of it.
export type Snap = 'peek' | 'half' | 'full';
export function Sheet({ snap, onSnap, children, head }: { snap: Snap; onSnap: (s: Snap) => void; children: ReactNode; head?: ReactNode }) {
  const [h, setH] = useState(() => innerHeight);
  useEffect(() => { const f = () => setH(innerHeight); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  const tabbar = 64, top = 96;
  const heights: Record<Snap, number> = { peek: 132, half: Math.round((h - tabbar) * 0.5), full: h - tabbar - top };
  const [drag, setDrag] = useState<number | null>(null);
  const g = useRef<{ y: number; start: number; moved: boolean } | null>(null);
  const height = drag ?? heights[snap];
  const down = (e: React.PointerEvent) => { g.current = { y: e.clientY, start: heights[snap], moved: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => { const s = g.current; if (!s) return; const d = s.y - e.clientY; if (Math.abs(d) > 4) s.moved = true; if (s.moved) setDrag(Math.max(90, Math.min(heights.full, s.start + d))); };
  const up = () => {
    const s = g.current; g.current = null;
    if (!s) return;
    if (!s.moved) { onSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half'); return; }
    const cur = drag ?? heights[snap];
    const best = (Object.keys(heights) as Snap[]).reduce((a, b) => (Math.abs(heights[b] - cur) < Math.abs(heights[a] - cur) ? b : a));
    setDrag(null); onSnap(best);
  };
  return (
    <div className="sheet" data-snap={snap} style={{ height, transition: drag == null ? 'height .25s ease' : 'none' }}>
      <div className="sheet-grip" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Pull up or down"><span /></div>
      {head}
      <div className="sheet-body">{children}</div>
    </div>
  );
}
export const sheetHeight = (snap: Snap) => (snap === 'peek' ? 132 : snap === 'half' ? Math.round((innerHeight - 64) * 0.5) : innerHeight - 160);
