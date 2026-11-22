import type { ReactNode } from 'react';

// A small menu over everything, for a choice of a few options (later when, which day).
export function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-box" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="overlay-title">{title}</div>
        {children}
        <button className="ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
