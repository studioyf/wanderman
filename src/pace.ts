import { useEffect, useState } from 'react';

// Pace is each person's own setting (Yvan, 22 Nov 2026: "that's up to other people it should be a setting").
export type Pace = { stopsPerHalfDay: number; freeHours: number };
export const DEFAULT_PACE: Pace = { stopsPerHalfDay: 4, freeHours: 2 };
const listeners = new Set<(p: Pace) => void>();
export function getPace(): Pace { try { return { ...DEFAULT_PACE, ...JSON.parse(localStorage.getItem('wm-pace') || '{}') }; } catch { return DEFAULT_PACE; } }
export function setPace(p: Pace) { try { localStorage.setItem('wm-pace', JSON.stringify(p)); } catch {} listeners.forEach((f) => f(p)); }
export function usePace() { const [p, setP] = useState(getPace()); useEffect(() => { listeners.add(setP); return () => { listeners.delete(setP); }; }, []); return p; }
