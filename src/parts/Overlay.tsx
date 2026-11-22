import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

// A small menu over everything, for a choice of a few options (later when, which day). Drawn at the top of the
// page, so a menu opened from inside the sheet still sits above the tab bar.
export function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="overlay-box" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="overlay-title">{title}</div>
        {children}
        <button className="ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>,
    document.body,
  );
}
