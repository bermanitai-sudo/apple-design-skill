import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { syncDiscipline, toggleAssignment, resolvePushups, applyDeadline } from '../src/state/discipline';
import { updateSettings } from '../src/lib/settings';
import { exportBackup, parseBackup, restoreBackup } from '../src/lib/backup';
import { clearSampleData, hasSampleData, loadSampleData } from '../src/lib/sample';
import { finishRun, pauseRun, resumeRun, startRun, addFix } from '../src/state/activeRun';
import { judgeFix } from '../src/lib/run';

const at = (d: string, t: string) => new Date(`${d}T${t}:00`);

beforeEach(async () => {
  await db.delete();
  await db.open();
  await updateSettings({ assignmentDeadline: '22:00', onboarded: true });
});

describe('discipline sync', () => {
  it('creates today’s assignments once and keeps them through refreshes', async () => {
    await syncDiscipline(at('2026-11-10', '08:00'));
    const first = await db.days.get('2026-11-10');
    await syncDiscipline(at('2026-11-10', '12:00'));
    await syncDiscipline(at('2026-11-10', '18:00'));
    expect(await db.days.count()).toBe(1);
    expect((await db.days.get('2026-11-10'))?.assignments).toEqual(first?.assignments);
  });

  it('marks a day complete when all three are done, without a push-up challenge', async () => {
    await syncDiscipline(at('2026-11-10', '08:00'));
    const day = (await db.days.get('2026-11-10'))!;
    for (const a of day.assignments) await toggleAssignment('2026-11-10', a.key);
    expect((await db.days.get('2026-11-10'))?.status).toBe('success');
    await syncDiscipline(at('2026-11-10', '22:30'));
    expect((await db.days.get('2026-11-10'))?.evaluatedAt).toBeTruthy();
    expect(await db.pushups.count()).toBe(0);
  });

  it('closes a missed day at the deadline and files exactly one 50 push-up challenge', async () => {
    await syncDiscipline(at('2026-11-10', '08:00'));
    const day = (await db.days.get('2026-11-10'))!;
    await toggleAssignment('2026-11-10', day.assignments[0].key);
    const { newlyMissed } = await syncDiscipline(at('2026-11-10', '22:01'));
    expect(newlyMissed).toEqual(['2026-11-10']);
    await syncDiscipline(at('2026-11-10', '23:00'));
    const p = await db.pushups.toArray();
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ forDate: '2026-11-10', reps: 50, status: 'pending' });
    // A closed day is locked.
    await toggleAssignment('2026-11-10', day.assignments[1].key);
    expect((await db.days.get('2026-11-10'))?.assignments[1].done).toBe(false);
    await resolvePushups(p[0].id!, 'done');
    expect((await db.pushups.get(p[0].id!))?.status).toBe('done');
  });

  it('resets at local midnight and keeps history', async () => {
    await syncDiscipline(at('2026-11-10', '21:00'));
    await syncDiscipline(at('2026-11-11', '00:00'));
    expect((await db.days.get('2026-11-10'))?.status).toBe('missed');
    expect(await db.days.get('2026-11-11')).toBeTruthy();
    expect(await db.days.count()).toBe(2);
    expect(await db.pushups.where('forDate').equals('2026-11-10').count()).toBe(1);
  });

  it('counts days the app was never opened, capped at a week', async () => {
    await syncDiscipline(at('2026-11-01', '08:00'));
    await syncDiscipline(at('2026-11-04', '08:00'));
    expect((await db.days.toArray()).map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
    expect(await db.pushups.count()).toBe(3);
  });

  it('gives a first open after the deadline until 23:59 instead of an instant penalty', async () => {
    await syncDiscipline(at('2026-11-10', '22:30'));
    expect((await db.days.get('2026-11-10'))?.deadline).toBe('23:59');
    await syncDiscipline(at('2026-11-10', '22:45'));
    expect(await db.pushups.count()).toBe(0);
  });

  it('applies a new deadline to today', async () => {
    await syncDiscipline(at('2026-11-10', '08:00'));
    await applyDeadline('20:00');
    const { newlyMissed } = await syncDiscipline(at('2026-11-10', '20:01'));
    expect(newlyMissed).toEqual(['2026-11-10']);
  });
});

describe('data', () => {
  it('round-trips a backup', async () => {
    await db.runs.add({ startedAt: 1, durationSec: 60, distanceKm: 1, calories: 70, source: 'manual' });
    await db.foods.add({
      date: '2026-11-10',
      meal: 'lunch',
      name: 'Rice',
      grams: 200,
      calories: 260,
      protein: 5,
      source: 'manual',
      createdAt: 1,
    });
    const b = parseBackup(JSON.stringify(await exportBackup()));
    await db.runs.clear();
    await db.foods.clear();
    await restoreBackup(b);
    expect(await db.runs.count()).toBe(1);
    expect((await db.foods.toArray())[0].name).toBe('Rice');
    expect(() => parseBackup('{"app":"other"}')).toThrow();
  });

  it('labels and removes sample data without touching real data', async () => {
    await db.runs.add({ startedAt: 1, durationSec: 60, distanceKm: 1, calories: 70, source: 'manual' });
    await loadSampleData();
    expect(await hasSampleData()).toBe(true);
    await clearSampleData();
    expect(await hasSampleData()).toBe(false);
    expect(await db.runs.count()).toBe(1);
    expect(await db.events.count()).toBe(0);
  });
});

describe('active run', () => {
  it('records real fixes, breaks the line on pause, and saves', async () => {
    await startRun();
    await addFix({ lat: 0, lng: 0, t: 0, acc: 5 }, judgeFix);
    await addFix({ lat: 0, lng: 0.001, t: 30_000, acc: 5 }, judgeFix);
    await addFix({ lat: 0, lng: 0.5, t: 31_000, acc: 5 }, judgeFix); // GPS jump: rejected
    await pauseRun();
    await addFix({ lat: 0, lng: 0.002, t: 40_000, acc: 5 }, judgeFix); // paused: ignored
    await resumeRun();
    await addFix({ lat: 0, lng: 0.01, t: 90_000, acc: 5 }, judgeFix); // after pause: new segment
    await addFix({ lat: 0, lng: 0.011, t: 120_000, acc: 5 }, judgeFix);
    const id = await finishRun();
    const run = await db.runs.get(id);
    expect(run?.source).toBe('gps');
    expect(run?.route).toHaveLength(4);
    expect(run?.route?.[2].gap).toBe(true);
    expect(run?.distanceKm).toBeCloseTo(0.2224, 3);
    expect(await db.kv.get('activeRun')).toBeUndefined();
  });

  it('accepts a typed distance only when GPS recorded none', async () => {
    await startRun();
    const id = await finishRun(5);
    expect((await db.runs.get(id))?.source).toBe('manual');
    expect((await db.runs.get(id))?.distanceKm).toBe(5);
  });
});
