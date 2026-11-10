import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvGet, kvSet } from './db';
import type { DistanceUnit, WeightUnit } from './format';

export interface Settings {
  name: string;
  distanceUnit: DistanceUnit;
  weightUnit: WeightUnit;
  bodyWeightKg: number;
  calorieTarget: number | null;
  proteinTarget: number | null;
  alarmTimerMinutes: number;
  assignmentDeadline: string;
  pushupReps: number;
  notify: { alarms: boolean; events: boolean; assignments: boolean; pushups: boolean };
  theme: 'dark' | 'oled';
  solid: boolean;
  reduceMotion: boolean;
  accessCode: string;
  onboarded: boolean;
  startedOn: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  distanceUnit: 'km',
  weightUnit: 'kg',
  bodyWeightKg: 70,
  calorieTarget: null,
  proteinTarget: null,
  alarmTimerMinutes: 15,
  assignmentDeadline: '23:00',
  pushupReps: 50,
  notify: { alarms: true, events: true, assignments: true, pushups: true },
  theme: 'dark',
  solid: false,
  reduceMotion: false,
  accessCode: '',
  onboarded: false,
  startedOn: null,
};

const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Partial<Settings>>(KEY);
  return { ...DEFAULT_SETTINGS, ...s, notify: { ...DEFAULT_SETTINGS.notify, ...s?.notify } };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.kv, async () => {
    const next = { ...(await getSettings()), ...patch };
    await kvSet(KEY, next);
    return next;
  });
}

export function useSettings(): Settings {
  return useLiveQuery(getSettings, [], DEFAULT_SETTINGS);
}
