/** Pure scheduling math shared by the app and the push scheduler. No DOM, no storage. */

export interface AlarmLike {
  id?: number;
  label: string;
  time: string;
  days: number[];
  enabled: boolean;
}

export function nextOccurrence(a: AlarmLike, from: Date): Date | null {
  if (!a.enabled) return null;
  const [h, m] = a.time.split(':').map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= from.getTime()) continue;
    if (a.days.length === 0 || a.days.includes(d.getDay())) return d;
  }
  return null;
}

export function nextAlarm<T extends AlarmLike>(alarms: T[], from = new Date()): { alarm: T; at: Date } | null {
  let best: { alarm: T; at: Date } | null = null;
  for (const alarm of alarms) {
    const at = nextOccurrence(alarm, from);
    if (at && (!best || at < best.at)) best = { alarm, at };
  }
  return best;
}

/** Local wall-clock parts in an IANA time zone. */
export function zonedParts(now: Date, timeZone: string): { date: string; time: string; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday };
}

/**
 * Alarms that should fire in the minute window ending at `now`, looking back `lookbackMin` minutes so a
 * scheduler that runs late still fires once. Each result carries a stable key for de-duplication.
 */
export function dueAlarms<T extends AlarmLike>(alarms: T[], timeZone: string, now: Date, lookbackMin = 4) {
  const out: { alarm: T; key: string }[] = [];
  for (let back = 0; back <= lookbackMin; back++) {
    const at = new Date(now.getTime() - back * 60_000);
    const p = zonedParts(at, timeZone);
    for (const alarm of alarms) {
      if (!alarm.enabled || alarm.time !== p.time) continue;
      if (alarm.days.length && !alarm.days.includes(p.weekday)) continue;
      out.push({ alarm, key: `alarm:${alarm.id}:${p.date}T${p.time}` });
    }
  }
  return out;
}

export function describeDays(days: number[]): string {
  const s = [...days].sort();
  if (s.length === 0) return 'Once';
  if (s.length === 7) return 'Every day';
  if (s.join() === '1,2,3,4,5') return 'Weekdays';
  if (s.join() === '0,6') return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return s.map((d) => names[d]).join(' ');
}
