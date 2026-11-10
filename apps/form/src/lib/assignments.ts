import type { Assignment, Category, DayRecord } from './db';
import { addDays, atTime, daysBetween } from './date';

type Template = Omit<Assignment, 'done' | 'doneAt'>;

export const POOL: Template[] = [
  { key: 'read-20', title: 'Read for 20 minutes', description: 'A book, not a feed. Phone face down.', category: 'Learning', minutes: 20 },
  { key: 'walk-30', title: 'Take a 30-minute walk', description: 'Easy pace, outside if you can.', category: 'Physical', minutes: 30 },
  {
    key: 'room',
    title: 'Reset your room',
    description: 'Clear every surface, make the bed, put things where they live.',
    category: 'Order',
    minutes: 20,
  },
  {
    key: 'stretch-10',
    title: 'Stretch for 10 minutes',
    description: 'Hips, hamstrings, chest, shoulders. Breathe slowly.',
    category: 'Health',
    minutes: 10,
  },
  {
    key: 'learn-20',
    title: 'Learn something new',
    description: 'Twenty focused minutes on a skill or subject you chose.',
    category: 'Learning',
    minutes: 20,
  },
  { key: 'outside-30', title: 'Spend 30 minutes outside', description: 'Daylight, fresh air, no screen.', category: 'Health', minutes: 30 },
  {
    key: 'postponed',
    title: 'Finish a postponed task',
    description: 'Pick the one you have been avoiding and close it out.',
    category: 'Productivity',
    minutes: 30,
  },
  {
    key: 'water',
    title: 'Drink enough water',
    description: 'Keep a bottle with you and refill it through the day.',
    category: 'Health',
    minutes: 5,
  },
  {
    key: 'mobility',
    title: 'Short mobility session',
    description: 'Ten minutes of joint circles, deep squat holds and hip openers.',
    category: 'Physical',
    minutes: 10,
  },
  {
    key: 'no-phone-morning',
    title: 'Phone-free first hour',
    description: 'No phone for the first hour after you wake up.',
    category: 'Discipline',
    minutes: 60,
  },
  {
    key: 'plan-tomorrow',
    title: 'Plan tomorrow tonight',
    description: 'Write your top three priorities for tomorrow before bed.',
    category: 'Productivity',
    minutes: 10,
  },
  {
    key: 'journal',
    title: 'Write a short journal entry',
    description: 'What went well, what did not, what you will change.',
    category: 'Growth',
    minutes: 10,
  },
  {
    key: 'cold-finish',
    title: 'Finish your shower cold',
    description: 'The last 60 seconds cold. Skip it if it is not right for you today.',
    category: 'Discipline',
    minutes: 2,
  },
  {
    key: 'bodyweight-15',
    title: '15-minute bodyweight circuit',
    description: 'Squats, lunges, planks and rows at a pace you can hold.',
    category: 'Physical',
    minutes: 15,
  },
  {
    key: 'inbox',
    title: 'Clear your inbox',
    description: 'Reply, archive or schedule every message.',
    category: 'Productivity',
    minutes: 20,
  },
  {
    key: 'sleep-on-time',
    title: 'In bed by your target time',
    description: 'Screens off 30 minutes before.',
    category: 'Health',
    minutes: 30,
  },
  {
    key: 'declutter-5',
    title: 'Remove five things',
    description: 'Donate, recycle or bin five things you no longer use.',
    category: 'Order',
    minutes: 15,
  },
  {
    key: 'meditate-10',
    title: 'Sit still for 10 minutes',
    description: 'Breath focus. When the mind drifts, return without judgement.',
    category: 'Discipline',
    minutes: 10,
  },
  {
    key: 'reach-out',
    title: 'Reach out to someone',
    description: 'Call or message a friend or family member you have not spoken to lately.',
    category: 'Growth',
    minutes: 10,
  },
  { key: 'cook', title: 'Cook a meal from scratch', description: 'Whole ingredients, no delivery.', category: 'Health', minutes: 40 },
  { key: 'no-sugar', title: 'No added sugar today', description: 'Read labels. Fruit is fine.', category: 'Discipline', minutes: 0 },
  {
    key: 'skill-practice',
    title: 'Deliberate practice',
    description: '25 minutes on one skill, one weakness, one timer.',
    category: 'Growth',
    minutes: 25,
  },
  {
    key: 'stairs',
    title: 'Take the stairs all day',
    description: 'No lifts or escalators where stairs exist.',
    category: 'Physical',
    minutes: 5,
  },
  {
    key: 'desk',
    title: 'Organise your workspace',
    description: 'Clear the desk, sort cables, file loose papers.',
    category: 'Order',
    minutes: 15,
  },
  {
    key: 'podcast-notes',
    title: 'Learn and take notes',
    description: 'Watch or listen to one lesson and write three takeaways.',
    category: 'Learning',
    minutes: 25,
  },
  {
    key: 'screen-limit',
    title: 'Under two hours of leisure screen time',
    description: 'Check Screen Time tonight.',
    category: 'Discipline',
    minutes: 0,
  },
];

/** Deterministic 32-bit hash so a day's three assignments are stable even before they are saved. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Three assignments from three different categories, avoiding yesterday's picks where possible. */
export function generateAssignments(date: string, avoid: string[] = []): Assignment[] {
  const rand = rng(hash(date));
  const order = POOL.map((t) => ({ t, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.t);
  const picked: Template[] = [];
  const used = new Set<Category>();
  for (const pass of [true, false]) {
    for (const t of order) {
      if (picked.length === 3) break;
      if (picked.includes(t) || used.has(t.category)) continue;
      if (pass && avoid.includes(t.key)) continue;
      picked.push(t);
      used.add(t.category);
    }
  }
  return picked.map((t) => ({ ...t, done: false }));
}

export const allDone = (r: DayRecord) => r.assignments.length === 3 && r.assignments.every((a) => a.done);

/** A day closes at its deadline; a deadline after midnight is not supported, so the latest close is 23:59. */
export function isClosed(r: DayRecord, now: Date): boolean {
  return now.getTime() >= atTime(r.date, r.deadline).getTime();
}

export function verdict(r: DayRecord): 'success' | 'missed' {
  return allDone(r) ? 'success' : 'missed';
}

/** Days that should exist between the last record and today, capped so a long absence stays humane. */
export function missingDays(lastKnown: string | null, today: string, cap = 7): string[] {
  if (!lastKnown) return [];
  const gap = daysBetween(lastKnown, today);
  const out: string[] = [];
  for (let i = Math.max(1, gap - cap); i < gap; i++) out.push(addDays(lastKnown, i));
  return out;
}

/** Consecutive successful days, counting back from today (today only counts once it succeeds). */
export function streak(records: DayRecord[], today: string): number {
  const byDate = new Map(records.map((r) => [r.date, r]));
  let n = 0;
  let key = today;
  const t = byDate.get(today);
  if (!t || t.status !== 'success') key = addDays(today, -1);
  for (;;) {
    const r = byDate.get(key);
    if (!r || r.status !== 'success') break;
    n++;
    key = addDays(key, -1);
  }
  return n;
}
