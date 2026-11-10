import { db, kvGet, kvSet } from './db';
import { api } from './api';
import { atTime, dayKey } from './date';
import { getSettings } from './settings';
import { notificationState } from './notify';

export interface Reminder {
  key: string;
  at: number;
  title: string;
  body: string;
  url: string;
}

export interface PushConfig {
  enabled: boolean;
  publicKey?: string;
}

async function deviceId(): Promise<string> {
  let id = await kvGet<string>('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    await kvSet('deviceId', id);
  }
  return id;
}

function b64ToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function pushConfig(): Promise<PushConfig> {
  try {
    return await api<PushConfig>('/api/push/config');
  } catch {
    return { enabled: false };
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enableBackgroundAlarms(): Promise<void> {
  const cfg = await pushConfig();
  if (!cfg.enabled || !cfg.publicKey) throw new Error('Background alarms are not configured on the server yet. See the setup guide.');
  if (notificationState() !== 'granted') throw new Error('Allow notifications first.');
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.publicKey) as BufferSource }));
  await kvSet('pushEnabled', true);
  await syncSchedule(sub);
}

export async function disableBackgroundAlarms(): Promise<void> {
  const sub = await currentSubscription();
  await kvSet('pushEnabled', false);
  await api('/api/push/subscribe', { deviceId: await deviceId(), remove: true }).catch(() => undefined);
  await sub?.unsubscribe();
}

/** Upcoming one-off reminders: event reminders, the post-alarm timer, and discipline nudges. */
export async function buildReminders(now = new Date()): Promise<Reminder[]> {
  const s = await getSettings();
  const out: Reminder[] = [];
  const today = dayKey(now);
  if (s.notify.events) {
    const events = await db.events.where('date').aboveOrEqual(today).toArray();
    for (const e of events) {
      if (e.reminderMinutes == null || e.sample) continue;
      const at = atTime(e.date, e.start).getTime() - e.reminderMinutes * 60_000;
      if (at > now.getTime() && at < now.getTime() + 35 * 86_400_000)
        out.push({
          key: `event:${e.id}:${at}`,
          at,
          title: e.title,
          body: e.reminderMinutes ? `Starts in ${e.reminderMinutes} min` : 'Starting now',
          url: '/schedule',
        });
    }
  }
  const timer = await kvGet<{ endsAt: number; label: string }>('timer');
  if (timer && timer.endsAt > now.getTime())
    out.push({ key: `timer:${timer.endsAt}`, at: timer.endsAt, title: 'Timer finished', body: timer.label, url: '/' });
  if (s.notify.assignments) {
    const day = await db.days.get(today);
    if (day && day.status === 'open') {
      const at = atTime(today, day.deadline).getTime() - 60 * 60_000;
      const left = day.assignments.filter((a) => !a.done).length;
      if (at > now.getTime())
        out.push({
          key: `deadline:${today}`,
          at,
          title: 'One hour left',
          body: `${left} assignment${left === 1 ? '' : 's'} still open today.`,
          url: '/daily',
        });
    }
  }
  return out;
}

let timer: number | undefined;

/** Debounced: sends the alarm schedule and reminders so the server can wake the phone when the app is closed. */
export function scheduleSync(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncSchedule().catch(() => undefined), 1200);
}

export async function syncSchedule(sub?: PushSubscription | null): Promise<void> {
  if (!(await kvGet<boolean>('pushEnabled'))) return;
  sub ??= await currentSubscription();
  if (!sub) return;
  const s = await getSettings();
  const alarms = s.notify.alarms ? (await db.alarms.toArray()).filter((a) => a.enabled) : [];
  await api('/api/push/subscribe', {
    deviceId: await deviceId(),
    subscription: sub.toJSON(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms: alarms.map(({ id, label, time, days, enabled }) => ({ id, label, time, days, enabled })),
    reminders: await buildReminders(),
  });
}
