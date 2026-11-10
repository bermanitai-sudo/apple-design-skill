import { db, type FoodEntry, type Run } from './db';
import { addDays, atTime, dayKey } from './date';
import { generateAssignments } from './assignments';
import { runCalories } from './run';

/** Realistic preview data. Every row carries `sample: true`, shows a Sample tag, and can be removed in one tap. */
export async function loadSampleData(bodyWeightKg = 70): Promise<void> {
  const today = dayKey();
  const runs: Run[] = [
    [-20, '07:10', 5.02, 1712],
    [-17, '18:30', 7.4, 2580],
    [-13, '06:50', 5.5, 1840],
    [-9, '07:05', 10.1, 3540],
    [-5, '18:45', 6.2, 2105],
    [-2, '07:20', 8.0, 2712],
  ].map(([off, t, km, sec]) => ({
    startedAt: atTime(addDays(today, off as number), t as string).getTime(),
    distanceKm: km as number,
    durationSec: sec as number,
    calories: runCalories(km as number, bodyWeightKg),
    source: 'manual' as const,
    notes: 'Sample run',
    sample: true,
  }));

  const menu: Omit<FoodEntry, 'date' | 'createdAt'>[] = [
    { meal: 'breakfast', name: 'Greek yogurt with berries', grams: 250, calories: 210, protein: 20, source: 'manual' },
    { meal: 'breakfast', name: 'Oats with banana', grams: 300, calories: 380, protein: 11, source: 'manual' },
    { meal: 'lunch', name: 'Chicken rice bowl', grams: 420, calories: 640, protein: 46, source: 'manual' },
    { meal: 'lunch', name: 'Tuna salad wrap', grams: 280, calories: 470, protein: 32, source: 'manual' },
    { meal: 'dinner', name: 'Salmon, potatoes, greens', grams: 450, calories: 690, protein: 41, source: 'manual' },
    { meal: 'dinner', name: 'Beef stir-fry with noodles', grams: 400, calories: 720, protein: 38, source: 'manual' },
    { meal: 'snack', name: 'Apple and peanut butter', grams: 200, calories: 260, protein: 7, source: 'manual' },
    { meal: 'snack', name: 'Protein shake', grams: 330, calories: 160, protein: 30, source: 'manual' },
  ];
  const foods: FoodEntry[] = [];
  for (let off = -6; off <= -1; off++) {
    const date = addDays(today, off);
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach((meal, i) => {
      const opts = menu.filter((m) => m.meal === meal);
      const pick = opts[(off + i + 10) % opts.length];
      foods.push({ ...pick, date, createdAt: atTime(date, ['08:00', '13:00', '19:30', '16:00'][i]).getTime(), sample: true });
    });
  }

  const days = [-6, -5, -4, -3, -2, -1].map((off) => {
    const date = addDays(today, off);
    const missed = off === -4;
    const assignments = generateAssignments(date).map((a, i) => ({ ...a, done: !(missed && i === 2) }));
    return {
      date,
      assignments,
      status: missed ? ('missed' as const) : ('success' as const),
      evaluatedAt: Date.now(),
      deadline: '23:00',
      sample: true,
    };
  });

  const events = [
    {
      title: 'Long run',
      description: 'Easy pace, 12 km',
      date: addDays(today, 2),
      start: '07:00',
      end: '08:15',
      reminderMinutes: 30,
      sample: true,
    },
    { title: 'Dentist', description: '', date: addDays(today, 4), start: '15:30', end: '16:00', reminderMinutes: 60, sample: true },
  ];

  await db.transaction('rw', [db.runs, db.foods, db.days, db.events, db.pushups], async () => {
    await db.runs.bulkAdd(runs);
    await db.foods.bulkAdd(foods);
    for (const d of days) if (!(await db.days.get(d.date))) await db.days.put(d);
    await db.events.bulkAdd(events);
    await db.pushups.add({
      forDate: addDays(today, -4),
      reps: 50,
      status: 'done',
      createdAt: Date.now(),
      resolvedAt: Date.now(),
      sample: true,
    });
  });
}

export async function clearSampleData(): Promise<void> {
  await db.transaction('rw', [db.runs, db.foods, db.days, db.events, db.pushups], async () => {
    await db.runs.filter((r) => !!r.sample).delete();
    await db.foods.filter((r) => !!r.sample).delete();
    await db.days.filter((r) => !!r.sample).delete();
    await db.events.filter((r) => !!r.sample).delete();
    await db.pushups.filter((r) => !!r.sample).delete();
  });
}

export async function hasSampleData(): Promise<boolean> {
  return (await db.runs.filter((r) => !!r.sample).count()) + (await db.foods.filter((r) => !!r.sample).count()) > 0;
}
