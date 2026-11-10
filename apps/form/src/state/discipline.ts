import { db, type DayRecord } from '../lib/db';
import { dayKey } from '../lib/date';
import { allDone, generateAssignments, isClosed, missingDays, verdict } from '../lib/assignments';
import { getSettings, updateSettings } from '../lib/settings';

/**
 * Bring the discipline log up to date: close past or overdue days, file a push-up challenge for each
 * missed one, and create today's three assignments exactly once. Safe to call as often as you like.
 */
export async function syncDiscipline(now = new Date()): Promise<{ newlyMissed: string[] }> {
  const settings = await getSettings();
  const today = dayKey(now);
  return db.transaction('rw', db.days, db.pushups, db.kv, async () => {
    const newlyMissed: string[] = [];
    const real = (await db.days.orderBy('date').toArray()).filter((d) => !d.sample);
    const last = real.at(-1)?.date ?? null;

    // Days the app was never opened still count, capped at a week.
    for (const date of missingDays(last && last < today ? last : null, today)) {
      if (await db.days.get(date)) continue;
      await db.days.put({ date, assignments: generateAssignments(date), status: 'open', deadline: settings.assignmentDeadline });
    }

    const open = await db.days
      .where('status')
      .anyOf('open', 'success')
      .filter((d) => !d.evaluatedAt)
      .toArray();
    for (const r of open) {
      const past = r.date < today;
      if (!past && !(r.date === today && isClosed(r, now))) continue;
      const v = verdict(r);
      await db.days.update(r.date, { status: v, evaluatedAt: now.getTime() });
      if (v === 'missed' && !r.sample) {
        const exists = await db.pushups.where('forDate').equals(r.date).count();
        if (!exists) {
          await db.pushups.add({ forDate: r.date, reps: settings.pushupReps, status: 'pending', createdAt: now.getTime() });
          newlyMissed.push(r.date);
        }
      }
    }

    if (!(await db.days.get(today))) {
      const prev = real.at(-1);
      const avoid = prev && prev.date < today ? prev.assignments.map((a) => a.key) : [];
      const draft: DayRecord = {
        date: today,
        assignments: generateAssignments(today, avoid),
        status: 'open',
        deadline: settings.assignmentDeadline,
      };
      // Opened after the deadline: give the day until 23:59 rather than penalise a day you never saw.
      if (isClosed(draft, now)) draft.deadline = '23:59';
      await db.days.put(draft);
    }
    if (!settings.startedOn) await updateSettings({ startedOn: today });
    return { newlyMissed };
  });
}

export async function toggleAssignment(date: string, key: string, now = new Date()): Promise<DayRecord | undefined> {
  return db.transaction('rw', db.days, async () => {
    const r = await db.days.get(date);
    if (!r || r.evaluatedAt) return r;
    const assignments = r.assignments.map((a) => (a.key === key ? { ...a, done: !a.done, doneAt: a.done ? undefined : now.getTime() } : a));
    const next: DayRecord = { ...r, assignments };
    next.status = allDone(next) ? 'success' : 'open';
    await db.days.put(next);
    return next;
  });
}

/** Changing the deadline applies to today if today is still open, and to every future day. */
export async function applyDeadline(deadline: string): Promise<void> {
  await updateSettings({ assignmentDeadline: deadline });
  const today = await db.days.get(dayKey());
  if (today && !today.evaluatedAt) await db.days.update(today.date, { deadline });
}

export async function resolvePushups(id: number, status: 'done' | 'skipped'): Promise<void> {
  await db.pushups.update(id, { status, resolvedAt: Date.now() });
}
