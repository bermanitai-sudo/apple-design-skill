import type { RoutePoint } from './db';

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const MAX_ACCURACY_M = 35;
const MAX_SPEED_MS = 11; // faster than any human runner: a GPS jump, not a stride
const MIN_STEP_KM = 0.003; // ignore jitter below 3 m

export type FixVerdict = 'accept' | 'inaccurate' | 'jitter' | 'jump';

/** Decide whether a new GPS fix extends the route. Real fixes only; nothing is interpolated. */
export function judgeFix(prev: RoutePoint | undefined, next: RoutePoint): FixVerdict {
  if (next.acc > MAX_ACCURACY_M) return 'inaccurate';
  if (!prev) return 'accept';
  const km = haversineKm(prev, next);
  const dt = (next.t - prev.t) / 1000;
  if (km < MIN_STEP_KM) return 'jitter';
  if (dt > 0 && (km * 1000) / dt > MAX_SPEED_MS) return 'jump';
  return 'accept';
}

export function routeDistanceKm(points: RoutePoint[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    if (!points[i].gap) km += haversineKm(points[i - 1], points[i]);
  }
  return km;
}

/** Running energy estimate: ~1 kcal per kg of body weight per km. An estimate, labelled as one. */
export function runCalories(distanceKm: number, bodyWeightKg: number): number {
  return Math.round(distanceKm * bodyWeightKg * 1.0);
}

export interface Segment {
  startedAt: number;
  endedAt: number | null;
}

/** Elapsed moving time from wall-clock segments, so a suspended page never loses time. */
export function elapsedSec(segments: Segment[], now = Date.now()): number {
  return segments.reduce((s, seg) => s + ((seg.endedAt ?? now) - seg.startedAt) / 1000, 0);
}
