import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RoutePoint } from '../lib/db';
import { cx } from './ui';

/** Splits the route at pauses so the line never draws a path you did not run. */
function segments(points: RoutePoint[]): L.LatLngExpression[][] {
  const out: L.LatLngExpression[][] = [];
  for (const p of points) {
    if (p.gap || out.length === 0) out.push([]);
    out[out.length - 1].push([p.lat, p.lng]);
  }
  return out;
}

export function RouteMap({ points, follow = false, className }: { points: RoutePoint[]; follow?: boolean; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const line = useRef<L.LayerGroup | null>(null);
  const dot = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(m);
    m.setView([0, 0], 2);
    line.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !line.current) return;
    line.current.clearLayers();
    const segs = segments(points);
    for (const s of segs) {
      L.polyline(s, { color: '#B7FF35', weight: 9, opacity: 0.18, lineCap: 'round' }).addTo(line.current);
      L.polyline(s, { color: '#B7FF35', weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(line.current);
    }
    const last = points.at(-1);
    if (last) {
      if (!dot.current)
        dot.current = L.circleMarker([last.lat, last.lng], {
          radius: 7,
          color: '#080808',
          weight: 3,
          fillColor: '#ffffff',
          fillOpacity: 1,
        }).addTo(m);
      dot.current.setLatLng([last.lat, last.lng]);
      if (follow) m.setView([last.lat, last.lng], Math.max(m.getZoom(), 16), { animate: true });
      else if (points.length > 1) m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [24, 24] });
      else m.setView([last.lat, last.lng], 16);
    }
  }, [points, follow]);

  return <div ref={el} className={cx('media relative isolate z-0 h-full w-full', className)} role="img" aria-label="Route map" />;
}
