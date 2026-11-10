import { describe, expect, it } from 'vitest';
import { generateAssignments, missingDays, streak, POOL } from '../src/lib/assignments';
import { addDays, dayKey, monthGrid, startOfWeek } from '../src/lib/date';
import { elapsedSec, haversineKm, judgeFix, routeDistanceKm, runCalories } from '../src/lib/run';
import { fmtDuration, fmtPace, paceSec, speed, toUnitDistance } from '../src/lib/format';
import { describeDays, dueAlarms, nextAlarm, nextOccurrence } from '../src/lib/alarmMath';
import { buildIcs } from '../src/lib/ics';
import type { DayRecord } from '../src/lib/db';
import { totals } from '../src/pages/health/Health';

describe('daily assignments', () => {
  it('generates exactly three from three different categories', () => {
    for (let i = 0; i < 60; i++) {
      const a = generateAssignments(addDays('2026-01-01', i));
      expect(a).toHaveLength(3);
      expect(new Set(a.map((x) => x.category)).size).toBe(3);
      expect(a.every((x) => !x.done)).toBe(true);
    }
  });
  it('is stable for a given day and varies across days', () => {
    expect(generateAssignments('2026-11-10')).toEqual(generateAssignments('2026-11-10'));
    const keys = new Set(
      Array.from({ length: 14 }, (_, i) =>
        generateAssignments(addDays('2026-11-01', i))
          .map((a) => a.key)
          .join(),
      ),
    );
    expect(keys.size).toBeGreaterThan(10);
  });
  it('avoids yesterday’s picks when it can', () => {
    const y = generateAssignments('2026-11-09').map((a) => a.key);
    const t = generateAssignments('2026-11-10', y).map((a) => a.key);
    expect(t.some((k) => y.includes(k))).toBe(false);
  });
  it('has a pool covering every category the brief asks for', () => {
    const cats = new Set(POOL.map((p) => p.category));
    for (const c of ['Physical', 'Growth', 'Discipline', 'Productivity', 'Health', 'Learning', 'Order'])
      expect(cats.has(c as never)).toBe(true);
  });
  it('lists missing days between visits, capped at seven', () => {
    expect(missingDays('2026-11-08', '2026-11-10')).toEqual(['2026-11-09']);
    expect(missingDays('2026-11-10', '2026-11-10')).toEqual([]);
    expect(missingDays('2026-10-01', '2026-11-10')).toHaveLength(7);
    expect(missingDays(null, '2026-11-10')).toEqual([]);
  });
  it('counts the streak back from today', () => {
    const rec = (date: string, status: DayRecord['status']): DayRecord => ({ date, status, assignments: [], deadline: '23:00' });
    const days = [rec('2026-11-07', 'success'), rec('2026-11-08', 'missed'), rec('2026-11-09', 'success'), rec('2026-11-10', 'open')];
    expect(streak(days, '2026-11-10')).toBe(1);
    days[3].status = 'success';
    expect(streak(days, '2026-11-10')).toBe(2);
    days[2].status = 'missed';
    expect(streak(days, '2026-11-10')).toBe(1);
  });
});

describe('dates', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 0, 6, 0, 0))).toBe('2026-01-06');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('builds Monday-first weeks and 6-week month grids', () => {
    expect(startOfWeek('2026-11-10')).toBe('2026-11-09');
    const g = monthGrid('2026-11-15');
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-10-26');
  });
});

describe('running math', () => {
  const p = (lat: number, lng: number, t: number, acc = 5) => ({ lat, lng, t, acc });
  it('measures distance with haversine', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.19, 1);
  });
  it('rejects inaccurate fixes, jitter and impossible jumps', () => {
    expect(judgeFix(undefined, p(0, 0, 0, 80))).toBe('inaccurate');
    expect(judgeFix(p(0, 0, 0), p(0, 0.00001, 1000))).toBe('jitter');
    expect(judgeFix(p(0, 0, 0), p(0, 0.01, 1000))).toBe('jump');
    expect(judgeFix(p(0, 0, 0), p(0, 0.0001, 3000))).toBe('accept');
  });
  it('does not count distance across a pause', () => {
    const pts = [p(0, 0, 0), p(0, 0.001, 30_000), { ...p(0, 0.05, 90_000), gap: true }, p(0, 0.051, 120_000)];
    expect(routeDistanceKm(pts)).toBeCloseTo(0.2224, 3);
  });
  it('times runs from wall-clock segments', () => {
    expect(
      elapsedSec(
        [
          { startedAt: 0, endedAt: 60_000 },
          { startedAt: 120_000, endedAt: null },
        ],
        150_000,
      ),
    ).toBe(90);
  });
  it('formats pace, speed and duration', () => {
    expect(fmtPace(paceSec(1500, 5, 'km'))).toBe('5:00');
    expect(speed(1800, 6, 'km')).toBe(12);
    expect(fmtDuration(3725)).toBe('1:02:05');
    expect(fmtDuration(65)).toBe('1:05');
    expect(toUnitDistance(1.609344, 'mi')).toBeCloseTo(1);
    expect(fmtPace(paceSec(10, 0, 'km'))).toBe('—');
    expect(runCalories(10, 70)).toBe(700);
  });
});

describe('alarms', () => {
  const a = { id: 1, label: 'Wake', time: '07:00', days: [1, 2, 3, 4, 5], enabled: true };
  it('finds the next weekday occurrence', () => {
    const fri = new Date(2026, 10, 13, 8, 0);
    expect(nextOccurrence(a, fri)?.getDay()).toBe(1);
    expect(nextOccurrence({ ...a, enabled: false }, fri)).toBeNull();
    expect(nextOccurrence({ ...a, days: [] }, new Date(2026, 10, 13, 6, 0))?.getHours()).toBe(7);
  });
  it('picks the soonest alarm', () => {
    const sat = { ...a, id: 2, time: '09:00', days: [6] };
    expect(nextAlarm([a, sat], new Date(2026, 10, 13, 8, 0))?.alarm.id).toBe(2);
  });
  it('fires once per minute in the device time zone, with a late-run lookback', () => {
    const now = new Date('2026-11-10T07:02:30Z');
    const due = dueAlarms([a], 'UTC', now, 4);
    expect(due).toHaveLength(1);
    expect(due[0].key).toBe('alarm:1:2026-11-10T07:00');
    expect(dueAlarms([a], 'UTC', new Date('2026-11-10T07:06:00Z'), 4)).toHaveLength(0);
    expect(dueAlarms([a], 'Asia/Jerusalem', new Date('2026-11-10T05:00:10Z'), 0)).toHaveLength(1);
  });
  it('describes repeat days', () => {
    expect(describeDays([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeDays([0, 6])).toBe('Weekends');
    expect(describeDays([])).toBe('Once');
  });
  it('exports a calendar with weekly repeats and alerts', () => {
    const ics = buildIcs(
      [{ ...a, sound: 'pulse', createdAt: 0 }],
      [{ id: 3, title: 'Gym', date: '2026-11-12', start: '18:00', reminderMinutes: 30 }],
    );
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
  });
});

describe('nutrition', () => {
  it('totals calories, protein and meals', () => {
    const f = (meal: 'breakfast' | 'lunch', calories: number, protein: number) => ({
      date: 'x',
      meal,
      name: 'a',
      grams: 1,
      calories,
      protein,
      source: 'manual' as const,
      createdAt: 0,
    });
    expect(totals([f('breakfast', 300, 20.5), f('breakfast', 100, 4), f('lunch', 600, 40)])).toEqual({
      kcal: 1000,
      protein: 64.5,
      meals: 2,
      items: 3,
    });
    expect(totals([])).toEqual({ kcal: 0, protein: 0, meals: 0, items: 0 });
  });
});
