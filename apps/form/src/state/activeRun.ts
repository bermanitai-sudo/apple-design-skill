import { db, kvGet, kvSet, type RoutePoint, type Run } from '../lib/db';
import { elapsedSec, routeDistanceKm, runCalories, type Segment } from '../lib/run';
import { getSettings } from '../lib/settings';

export interface ActiveRun {
  startedAt: number;
  segments: Segment[];
  points: RoutePoint[];
  status: 'running' | 'paused';
  gpsDenied?: boolean;
  /** The next accepted fix starts a new line segment (set on resume). */
  resumeGap?: boolean;
}

const KEY = 'activeRun';

export const getActiveRun = () => kvGet<ActiveRun>(KEY);

export async function startRun(): Promise<ActiveRun> {
  const existing = await getActiveRun();
  if (existing) return existing;
  const now = Date.now();
  const run: ActiveRun = { startedAt: now, segments: [{ startedAt: now, endedAt: null }], points: [], status: 'running' };
  await kvSet(KEY, run);
  return run;
}

export async function patchActiveRun(fn: (r: ActiveRun) => ActiveRun): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const r = await getActiveRun();
    if (r) await kvSet(KEY, fn(r));
  });
}

export const pauseRun = () =>
  patchActiveRun((r) => ({
    ...r,
    status: 'paused',
    segments: r.segments.map((s, i, a) => (i === a.length - 1 && s.endedAt == null ? { ...s, endedAt: Date.now() } : s)),
  }));

export const resumeRun = () =>
  patchActiveRun((r) => ({
    ...r,
    status: 'running',
    segments: [...r.segments, { startedAt: Date.now(), endedAt: null }],
    resumeGap: true,
  }));

export async function addFix(p: RoutePoint, judge: (prev: RoutePoint | undefined, next: RoutePoint) => string): Promise<boolean> {
  let added = false;
  await patchActiveRun((r) => {
    if (r.status !== 'running') return r;
    const point = r.resumeGap && r.points.length ? { ...p, gap: true } : p;
    if (judge(point.gap ? undefined : r.points.at(-1), point) !== 'accept') return r;
    added = true;
    return { ...r, points: [...r.points, point], resumeGap: false };
  });
  return added;
}

export async function discardRun(): Promise<void> {
  await db.kv.delete(KEY);
}

/** Saves the run. `manualKm` is only used when GPS recorded nothing and you typed a known distance. */
export async function finishRun(manualKm?: number, notes?: string): Promise<number> {
  const r = await getActiveRun();
  if (!r) throw new Error('No active run');
  const s = await getSettings();
  const durationSec = Math.round(elapsedSec(r.segments));
  const gpsKm = routeDistanceKm(r.points);
  const usedManual = manualKm != null && manualKm > 0 && gpsKm < 0.01;
  const distanceKm = usedManual ? manualKm : gpsKm;
  const run: Run = {
    startedAt: r.startedAt,
    durationSec,
    distanceKm,
    calories: runCalories(distanceKm, s.bodyWeightKg),
    source: usedManual ? 'manual' : 'gps',
    route: r.points.length ? r.points : undefined,
    notes: notes?.trim() || undefined,
  };
  const id = await db.transaction('rw', db.runs, db.kv, async () => {
    const id = await db.runs.add(run);
    await db.kv.delete(KEY);
    return id;
  });
  return id;
}
