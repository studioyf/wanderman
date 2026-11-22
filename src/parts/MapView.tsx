import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap, type GeoJSONSource } from 'maplibre-gl';
import type { Area, Place } from '../model';
import { baseStyle, tinted } from '../mapstyle';
import { savedLook } from '../looks';
import { bboxOf } from '../tiles';

export type MapStop = { placeId: string; n: number; done: boolean };
type Pad = { top: number; bottom: number; left: number; right: number };
type Props = {
  places: Place[]; areas: Area[]; baseId?: string; template?: string; stops: MapStop[]; frameKey: string; pad: Pad;
  selected?: string; onSelect: (id?: string) => void; onLongPress: (lat: number, lng: number) => void;
};

// The trip on a map: the day's stops numbered in their order with the walk between them, every other
// saved place as a small dot in its area's colour, the base as an ink square.
export function MapView({ places, areas, baseId, template, stops, frameKey, pad, selected, onSelect, onLongPress }: Props) {
  const el = useRef<HTMLDivElement>(null), map = useRef<MLMap>(undefined);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState('');
  const framed = useRef('');
  const handlers = useRef({ onSelect, onLongPress }); handlers.current = { onSelect, onLongPress };

  useEffect(() => {
    let m: MLMap | undefined, gone = false;
    setReady(false); framed.current = '';
    baseStyle().then((b) => {
      if (gone || !el.current) return;
      m = new maplibregl.Map({ container: el.current, style: tinted(b, savedLook(), template), attributionControl: { compact: true }, center: [10, 50], zoom: 3 });
      map.current = m; (window as any).__wmMap = m;
      m.on('load', () => {
        const empty = { type: 'FeatureCollection', features: [] } as any;
        for (const s of ['others', 'walk', 'stops']) m!.addSource(s, { type: 'geojson', data: empty });
        m!.addLayer({ id: 'others', type: 'circle', source: 'others', paint: {
          'circle-radius': ['case', ['get', 'sel'], 8, ['get', 'base'], 7, 5], 'circle-color': ['get', 'color'],
          'circle-opacity': ['case', ['get', 'sel'], 1, ['get', 'base'], 1, 0.55], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': ['case', ['get', 'sel'], 3, 1] } });
        m!.addLayer({ id: 'others-label', type: 'symbol', source: 'others', minzoom: 14.5, layout: {
          'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true },
          paint: { 'text-color': '#55514a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 } });
        m!.addLayer({ id: 'walk', type: 'line', source: 'walk', paint: { 'line-color': '#1b1a17', 'line-width': 2.2, 'line-dasharray': [1, 2], 'line-opacity': 0.6 } });
        m!.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: {
          'circle-radius': ['case', ['get', 'sel'], 15, 12], 'circle-color': ['get', 'color'], 'circle-stroke-color': ['case', ['get', 'sel'], '#1b1a17', '#ffffff'], 'circle-stroke-width': ['case', ['get', 'sel'], 3, 2] } });
        m!.addLayer({ id: 'stops-num', type: 'symbol', source: 'stops', layout: {
          'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true },
          paint: { 'text-color': '#ffffff' } });
        m!.addLayer({ id: 'stops-label', type: 'symbol', source: 'stops', minzoom: 13.5, layout: {
          'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-optional': true },
          paint: { 'text-color': '#1b1a17', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 } });
        for (const id of ['stops', 'others']) {
          m!.on('click', id, (e) => { e.preventDefault(); handlers.current.onSelect(e.features?.[0]?.properties?.id); });
          m!.on('mouseenter', id, () => (m!.getCanvas().style.cursor = 'pointer'));
          m!.on('mouseleave', id, () => (m!.getCanvas().style.cursor = ''));
        }
        setReady(true);
      });
      // A long press on the map adds a place there (a right-click on the Mac).
      let timer: any, start: { x: number; y: number } | undefined;
      const cancel = () => { clearTimeout(timer); start = undefined; };
      m.on('touchstart', (e) => { if (e.originalEvent.touches.length !== 1) return cancel(); start = e.point; const ll = e.lngLat; timer = setTimeout(() => handlers.current.onLongPress(ll.lat, ll.lng), 600); });
      m.on('touchmove', (e) => { if (start && Math.hypot(e.point.x - start.x, e.point.y - start.y) > 8) cancel(); });
      m.on('touchend', cancel); m.on('dragstart', cancel);
      m.on('contextmenu', (e) => handlers.current.onLongPress(e.lngLat.lat, e.lngLat.lng));
    }).catch((e) => setFailed(String(e?.message || e)));
    return () => { gone = true; m?.remove(); map.current = undefined; };
  }, [template]);

  useEffect(() => {
    const m = map.current; if (!ready || !m) return;
    const color = new Map(areas.map((a) => [a.id, a.color]));
    const onDay = new Map(stops.map((s) => [s.placeId, s]));
    const located = places.filter((p) => p.lat != null && !p.deleted);
    const feat = (p: Place, props: object) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng!, p.lat!] }, properties: { id: p.id, name: p.name, sel: p.id === selected, ...props } });
    (m.getSource('others') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: located.filter((p) => !onDay.has(p.id)).map((p) =>
      feat(p, { base: p.id === baseId, color: p.id === baseId ? '#1b1a17' : color.get(p.areaId!) || '#6b6b6b' })) } as any);
    const dayPlaces = stops.map((s) => located.find((p) => p.id === s.placeId)).filter(Boolean) as Place[];
    (m.getSource('stops') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: dayPlaces.map((p) => { const s = onDay.get(p.id)!;
      return feat(p, { label: s.done ? '✓' : String(s.n), color: s.done ? '#8b867c' : color.get(p.areaId!) || '#6b6b6b' }); }) } as any);
    (m.getSource('walk') as GeoJSONSource)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: dayPlaces.map((p) => [p.lng!, p.lat!]) } } as any);
    // Frame the day once each time it changes: its stops, else the trip's places you go to, not the airport.
    if (framed.current !== frameKey) {
      const walked = located.filter((p) => p.kind !== 'transport');
      const pts = dayPlaces.length ? dayPlaces : walked.length ? walked : located;
      const box = bboxOf(pts as { lat: number; lng: number }[], 0.25);
      if (box) { m.fitBounds(box as any, { padding: pad, animate: framed.current !== '', maxZoom: 15.5 }); framed.current = frameKey; }
    }
  }, [ready, places, areas, baseId, selected, stops, frameKey]);

  useEffect(() => {
    const p = places.find((x) => x.id === selected);
    if (ready && p?.lat != null) map.current?.easeTo({ center: [p.lng!, p.lat], zoom: Math.max(map.current.getZoom(), 14.5), padding: pad });
  }, [selected, ready]);

  return <div className="map" ref={el} data-ready={ready ? '1' : '0'}>{failed && <div className="map-failed">The map could not load: {failed}</div>}</div>;
}
