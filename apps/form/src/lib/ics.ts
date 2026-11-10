import type { Alarm, CalEvent } from './db';
import { addDays, dayKey } from './date';
import { describeDays } from './alarmMath';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const esc = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/[,;]/g, (m) => `\\${m}`)
    .replace(/\n/g, '\\n');
const stamp = (key: string, hhmm: string) => `${key.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;

function firstDate(days: number[], from = dayKey()): string {
  if (!days.length) return from;
  for (let i = 0; i < 7; i++) {
    const k = addDays(from, i);
    const [y, m, d] = k.split('-').map(Number);
    if (days.includes(new Date(y, m - 1, d).getDay())) return k;
  }
  return from;
}

/**
 * A calendar file that iOS Calendar imports with alerts attached. Calendar alerts fire with the app
 * closed, so this is the dependable backup for wake-up alarms on iPhone.
 */
export function buildIcs(alarms: Alarm[], events: CalEvent[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FORM//Discipline Tracker//EN', 'CALSCALE:GREGORIAN'];
  for (const a of alarms.filter((x) => x.enabled)) {
    const start = firstDate(a.days);
    lines.push(
      'BEGIN:VEVENT',
      `UID:form-alarm-${a.id}@form.local`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(start, a.time)}`,
      'DURATION:PT5M',
      `SUMMARY:${esc(a.label || 'Alarm')}`,
      `DESCRIPTION:${esc(`FORM alarm · ${describeDays(a.days)}`)}`,
    );
    if (a.days.length)
      lines.push(
        `RRULE:FREQ=WEEKLY;BYDAY=${[...a.days]
          .sort()
          .map((d) => BYDAY[d])
          .join(',')}`,
      );
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(a.label || 'Alarm')}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  }
  for (const e of events.filter((x) => !x.sample)) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:form-event-${e.id}@form.local`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.date, e.start)}`,
      e.end ? `DTEND:${stamp(e.date, e.end)}` : 'DURATION:PT30M',
      `SUMMARY:${esc(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.reminderMinutes != null)
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${e.reminderMinutes}M`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
