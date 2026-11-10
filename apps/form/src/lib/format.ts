export type DistanceUnit = 'km' | 'mi';
export type WeightUnit = 'kg' | 'lb';

const KM_PER_MI = 1.609344;
const KG_PER_LB = 0.45359237;

export const toUnitDistance = (km: number, u: DistanceUnit) => (u === 'km' ? km : km / KM_PER_MI);
export const fromUnitDistance = (v: number, u: DistanceUnit) => (u === 'km' ? v : v * KM_PER_MI);
export const toUnitWeight = (kg: number, u: WeightUnit) => (u === 'kg' ? kg : kg / KG_PER_LB);
export const fromUnitWeight = (v: number, u: WeightUnit) => (u === 'kg' ? v : v * KG_PER_LB);

export function fmtDistance(km: number, u: DistanceUnit, digits = 2): string {
  return toUnitDistance(km, u).toFixed(digits);
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(r).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Seconds per unit distance. */
export function paceSec(durationSec: number, km: number, u: DistanceUnit): number | null {
  const d = toUnitDistance(km, u);
  if (d < 0.01 || durationSec <= 0) return null;
  return durationSec / d;
}

export function fmtPace(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec > 3600) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

export function speed(durationSec: number, km: number, u: DistanceUnit): number {
  if (durationSec <= 0) return 0;
  return toUnitDistance(km, u) / (durationSec / 3600);
}

export const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

/** "45 min", "3 h 05 min": for countdowns measured in hours rather than seconds. */
export function fmtLeft(sec: number): string {
  const m = Math.max(0, Math.round(sec / 60));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
