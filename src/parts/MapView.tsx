import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap, type GeoJSONSource } from 'maplibre-gl';
import type { Area, Place } from '../model';
import { baseStyle, tinted } from '../mapstyle';
import { savedLook } from '../looks';
import { bboxOf } from '../tiles';

type Props = {
  places: Place[]; areas: Area[]; baseId?: string; template?: string;
  selected?: string; onSelect: (id?: string) => void; onLongPress: (lat: number, lng: number) => void;
};

// The trip on a map: each place a dot in its area's colour, the base a larger ink dot.
export function MapView({ places, areas, baseId, template, selected, onSelect, onLongPress }: Props) {
  const el = useRef<HTMLDivElement>(null), map = useRef<MLMap>(undefined);
  const framed = useRef(false);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState('');
  const handlers = useRef({ onSelect, onLongPress }); handlers.current = { onSelect, onLongPress };

  useEffect(() => {
    // The map is rebuilt when the trip's saved tiles change; until the new one has loaded it takes no data.
    let m: MLMap | undefined, gone = false;
    setReady(false); framed.current = false;
    baseStyle().then((b) => {
      if (gone || !el.current) return;
      m = new maplibregl.Map({ container: el.current, style: tinted(b, savedLook(), template), attributionControl: { compact: true }, center: [10, 50], zoom: 3 });
      map.current = m; (window as any).__wmMap = m;
      m.on('load', () => {
        m!.addSource('places', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m!.addLayer({ id: 'places-dot', type: 'circle', source: 'places', paint: {
          'circle-radius': ['case', ['get', 'base'], 9, ['get', 'sel'], 10, 7],
          'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': ['case', ['get', 'sel'], 3, 2] } });
        m!.addLayer({ id: 'places-label', type: 'symbol', source: 'places', minzoom: 13.5, layout: {
          'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true },
          paint: { 'text-color': '#1b1a17', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
        m!.on('click', 'places-dot', (e) => handlers.current.onSelect(e.features?.[0]?.properties?.id));
        m!.on('mouseenter', 'places-dot', () => (m!.getCanvas().style.cursor = 'pointer'));
        m!.on('mouseleave', 'places-dot', () => (m!.getCanvas().style.cursor = ''));
        setReady(true);
      });
      // A long press on the map adds a place there.
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
    const src = ready ? (map.current?.getSource('places') as GeoJSONSource | undefined) : undefined;
    if (!src) return;
    const color = new Map(areas.map((a) => [a.id, a.color]));
    src.setData({ type: 'FeatureCollection', features: places.filter((p) => p.lat != null).map((p) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng!, p.lat!] },
      properties: { id: p.id, name: p.name, base: p.id === baseId, sel: p.id === selected, color: p.id === baseId ? '#1b1a17' : color.get(p.areaId!) || '#6b6b6b' },
    })) });
    // Frame the city once, not the airport: places you go to, not the ones you arrive by.
    if (!framed.current && places.length) {
      const walked = places.filter((p) => p.kind !== 'transport');
      const box = bboxOf((walked.length ? walked : places) as { lat: number; lng: number }[], 0.3);
      if (box) { map.current!.fitBounds(box as any, { padding: 30, animate: false }); framed.current = true; }
    }
  }, [ready, places, areas, baseId, selected]);

  useEffect(() => {
    const p = places.find((x) => x.id === selected);
    if (ready && p?.lat != null) map.current?.easeTo({ center: [p.lng!, p.lat], zoom: Math.max(map.current.getZoom(), 14.5) });
  }, [selected, ready]);

  return <div className="map" ref={el} data-ready={ready ? '1' : '0'}>{failed && <div className="map-failed">The map could not load: {failed}</div>}</div>;
}
