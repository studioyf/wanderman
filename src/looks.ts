// Three looks of WanderMan's own, each made to read on a phone in daylight: dark text on a light
// ground, large type, one accent. The map is tinted to match each one.
export type LookId = 'paper' | 'signal' | 'atlas';
export const LOOKS: { id: LookId; name: string; about: string; map: Record<string, string>; theme: string }[] = [
  { id: 'paper', name: 'Paper', about: 'Warm off-white, black ink, a vermilion accent. A serif for names, a plain sans for the rest. A notebook.', theme: '#f4f1ea',
    map: { background: '#efeae0', park: '#e2e2d2', water: '#c9d3d6', building: '#e7e1d5', residential: '#ebe6db', wood: '#dcdccb' } },
  { id: 'signal', name: 'Signal', about: 'Pure white, heavy black type, a safety orange. The most contrast, for full sun.', theme: '#ffffff',
    map: { background: '#f6f6f4', park: '#e4ebe0', water: '#cbd9e2', building: '#ececea', residential: '#f1f1ee', wood: '#dbe5d6' } },
  { id: 'atlas', name: 'Atlas', about: 'Pale sage like an old survey map, deep green ink, a cobalt accent. Calm, a guidebook.', theme: '#eef0e6',
    map: { background: '#e9ecdf', park: '#d8e2c8', water: '#bfd2d8', building: '#e1e3d6', residential: '#e5e8db', wood: '#cfdbbe' } },
];
export const lookOf = (id: string | undefined) => LOOKS.find((l) => l.id === id) || LOOKS[0];

export function applyLook(id: LookId) {
  document.documentElement.dataset.look = id;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', lookOf(id).theme);
  try { localStorage.setItem('wm-look', id); } catch {}
}
export const savedLook = (): LookId => { try { return (localStorage.getItem('wm-look') as LookId) || 'paper'; } catch { return 'paper'; } };
