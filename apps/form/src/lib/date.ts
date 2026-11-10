const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day key, YYYY-MM-DD. Never UTC: midnight is the phone's midnight. */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

export function atTime(key: string, hhmm: string): Date {
  const d = parseDay(key);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function startOfWeek(key: string, weekStartsOn = 1): string {
  const d = parseDay(key);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return dayKey(d);
}

export function monthGrid(key: string, weekStartsOn = 1): string[] {
  const d = parseDay(key);
  const first = dayKey(new Date(d.getFullYear(), d.getMonth(), 1));
  const start = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function fmtDay(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) {
  return parseDay(key).toLocaleDateString(undefined, opts);
}

export function fmtTime(hhmm: string): string {
  return atTime('2000-01-01', hhmm).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function relDay(key: string, today = dayKey()): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return fmtDay(key, { weekday: 'short', month: 'short', day: 'numeric' });
}
