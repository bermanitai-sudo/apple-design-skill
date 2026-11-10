import Dexie, { type Table } from 'dexie';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Confidence = 'high' | 'medium' | 'low';

export interface RoutePoint {
  lat: number;
  lng: number;
  t: number;
  acc: number;
  /** True when this fix follows a GPS gap or a pause; the map breaks the line here. */
  gap?: boolean;
}

export interface Run {
  id?: number;
  startedAt: number;
  durationSec: number;
  distanceKm: number;
  calories: number;
  source: 'gps' | 'manual';
  route?: RoutePoint[];
  notes?: string;
  sample?: boolean;
}

export interface FoodEntry {
  id?: number;
  date: string;
  meal: Meal;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  source: 'ai' | 'manual';
  confidence?: Confidence;
  photo?: string;
  createdAt: number;
  sample?: boolean;
}

export interface Alarm {
  id?: number;
  label: string;
  time: string;
  days: number[];
  enabled: boolean;
  sound: SoundId;
  timerMinutes?: number | null;
  createdAt: number;
}

export type SoundId = 'pulse' | 'rise' | 'bell' | 'digital';

export interface CalEvent {
  id?: number;
  title: string;
  description?: string;
  date: string;
  start: string;
  end?: string;
  reminderMinutes: number | null;
  sample?: boolean;
}

export type Category = 'Physical' | 'Growth' | 'Discipline' | 'Productivity' | 'Health' | 'Learning' | 'Order';

export interface Assignment {
  key: string;
  title: string;
  description: string;
  category: Category;
  minutes: number;
  done: boolean;
  doneAt?: number;
}

export interface DayRecord {
  date: string;
  assignments: Assignment[];
  status: 'open' | 'success' | 'missed';
  evaluatedAt?: number;
  deadline: string;
  sample?: boolean;
}

export interface PushupChallenge {
  id?: number;
  forDate: string;
  reps: number;
  status: 'pending' | 'done' | 'skipped';
  createdAt: number;
  resolvedAt?: number;
  sample?: boolean;
}

export interface KV {
  key: string;
  value: unknown;
}

export class FormDB extends Dexie {
  runs!: Table<Run, number>;
  foods!: Table<FoodEntry, number>;
  alarms!: Table<Alarm, number>;
  events!: Table<CalEvent, number>;
  days!: Table<DayRecord, string>;
  pushups!: Table<PushupChallenge, number>;
  kv!: Table<KV, string>;

  constructor(name = 'form') {
    super(name);
    this.version(1).stores({
      runs: '++id, startedAt',
      foods: '++id, date, createdAt',
      alarms: '++id',
      events: '++id, date',
      days: 'date, status',
      pushups: '++id, forDate, status',
      kv: 'key',
    });
  }
}

export const db = new FormDB();

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = await db.kv.get(key);
  return row?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}
