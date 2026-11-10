import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { liveQuery } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvGet, kvSet, type Alarm } from '../lib/db';
import { dueAlarms } from '../lib/alarmMath';
import { atTime, dayKey, fmtTime } from '../lib/date';
import { fmtDuration } from '../lib/format';
import { chime, loopSound } from '../lib/sound';
import { localNotify } from '../lib/notify';
import { scheduleSync } from '../lib/push';
import { getSettings, useSettings } from '../lib/settings';
import { syncDiscipline } from '../state/discipline';
import { spring } from '../lib/motion';
import { Button, Ring, useToast } from './ui';

export interface TimerState {
  startedAt: number;
  endsAt: number;
  total: number;
  label: string;
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

async function markFired(listKey: string, key: string): Promise<boolean> {
  const list = (await kvGet<string[]>(listKey)) ?? [];
  if (list.includes(key)) return false;
  await kvSet(listKey, [...list.slice(-80), key]);
  return true;
}

export async function startTimer(minutes: number, label: string): Promise<void> {
  const now = Date.now();
  await kvSet('timer', { startedAt: now, endsAt: now + minutes * 60_000, total: minutes * 60, label } satisfies TimerState);
}

export async function stopTimer(): Promise<void> {
  await db.kv.delete('timer');
}

async function timerMinutesFor(alarm: Alarm | undefined): Promise<number> {
  const s = await getSettings();
  return alarm?.timerMinutes ?? s.alarmTimerMinutes;
}

/** Keeps discipline days, foreground alarms, reminders and the background schedule in step. */
export function Engines() {
  const toast = useToast();
  const [ringing, setRinging] = useState<Alarm | null>(null);

  // Discipline: close days, file push-up challenges, create today's assignments.
  useEffect(() => {
    const run = async () => {
      const { newlyMissed } = await syncDiscipline();
      if (newlyMissed.length) {
        const s = await getSettings();
        const msg = `Missed assignments · ${s.pushupReps} push-ups pending`;
        toast(msg);
        if (s.notify.pushups) void localNotify('Accountability check', msg, { url: '/daily', tag: 'pushups' });
      }
    };
    void run();
    const iv = window.setInterval(run, 30_000);
    const vis = () => document.visibilityState === 'visible' && void run();
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [toast]);

  // Foreground alarms and event reminders: exact while the app is open.
  useEffect(() => {
    const check = async () => {
      const now = new Date();
      const s = await getSettings();
      if (s.notify.alarms) {
        const alarms = await db.alarms.toArray();
        for (const { alarm, key } of dueAlarms(alarms, tz(), now, 5)) {
          if (await markFired('firedAlarms', key)) {
            if (!alarm.days.length) await db.alarms.update(alarm.id!, { enabled: false });
            setRinging(alarm);
            break;
          }
        }
      }
      if (s.notify.events) {
        const today = dayKey(now);
        for (const e of await db.events.where('date').equals(today).toArray()) {
          if (e.reminderMinutes == null) continue;
          const at = atTime(e.date, e.start).getTime() - e.reminderMinutes * 60_000;
          if (now.getTime() >= at && now.getTime() - at < 5 * 60_000 && (await markFired('firedReminders', `event:${e.id}:${at}`))) {
            chime();
            toast(`${e.title} · ${e.reminderMinutes ? `in ${e.reminderMinutes} min` : 'now'}`);
          }
        }
      }
    };
    const iv = window.setInterval(() => void check(), 1000);
    return () => window.clearInterval(iv);
  }, [toast]);

  // A tapped alarm notification counts as dismissing it: start the countdown.
  useEffect(() => {
    const handle = async (url: URL) => {
      const key = url.searchParams.get('alarmKey');
      const id = Number(url.searchParams.get('alarm'));
      const at = Number(url.searchParams.get('at'));
      if (!key || !id) return;
      window.history.replaceState(null, '', url.pathname);
      const fresh = Date.now() - at < 30 * 60_000;
      if (!(await markFired('firedAlarms', key)) || !fresh) return;
      const alarm = await db.alarms.get(id);
      const mins = await timerMinutesFor(alarm);
      if (mins > 0) {
        await startTimer(mins, alarm?.label || 'After alarm');
        toast(`Alarm dismissed · ${mins}-minute timer started`);
      }
    };
    void handle(new URL(window.location.href));
    const onMsg = (e: MessageEvent) => e.data?.type === 'open-url' && void handle(new URL(e.data.url, window.location.origin));
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [toast]);

  // Mirror every schedule change to the push server (no-op until background alarms are enabled).
  useEffect(() => {
    const sub = liveQuery(async () => [
      await db.alarms.toArray(),
      await db.events.toArray(),
      await db.days.get(dayKey()),
      await kvGet('timer'),
      await kvGet('settings'),
    ]).subscribe({ next: () => scheduleSync() });
    return () => sub.unsubscribe();
  }, []);

  return (
    <>
      <TimerPill />
      <AnimatePresence>{ringing && <Ringing alarm={ringing} onDone={() => setRinging(null)} />}</AnimatePresence>
    </>
  );
}

function Ringing({ alarm, onDone }: { alarm: Alarm; onDone: () => void }) {
  const toast = useToast();
  const settings = useSettings();
  const mins = alarm.timerMinutes ?? settings.alarmTimerMinutes;
  useEffect(() => {
    const stop = loopSound(alarm.sound);
    void localNotify(alarm.label || 'Alarm', fmtTime(alarm.time), { tag: `alarm-${alarm.id}` });
    navigator.vibrate?.([400, 200, 400]);
    return stop;
  }, [alarm]);

  const dismiss = async (withTimer: boolean) => {
    onDone();
    if (withTimer && mins > 0) {
      await startTimer(mins, alarm.label || 'After alarm');
      toast(`${mins}-minute timer started`);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-black/70 px-6 pb-[calc(var(--safe-bottom)+28px)] pt-[calc(var(--safe-top)+64px)] backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="alertdialog"
      aria-label={`Alarm: ${alarm.label}`}
    >
      <motion.div className="text-center" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
        <p className="eyebrow text-lime">{alarm.label || 'Alarm'}</p>
        <p className="num mt-3 text-[88px] font-bold leading-none">{fmtTime(alarm.time)}</p>
        <p className="mt-4 text-[15px] text-mute">{mins > 0 ? `Dismiss to start your ${mins}-minute timer` : 'Good morning'}</p>
      </motion.div>
      <motion.div
        className="w-full max-w-sm space-y-3"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.08 }}
      >
        <div className="relative">
          <motion.span
            aria-hidden
            className="absolute -inset-1 rounded-full bg-lime/40 blur-md"
            animate={{ opacity: [0.2, 0.7, 0.2] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
          />
          <Button variant="primary" size="lg" className="relative w-full" onClick={() => void dismiss(true)}>
            Dismiss
          </Button>
        </div>
        {mins > 0 && (
          <Button variant="ghost" className="w-full" onClick={() => void dismiss(false)}>
            Dismiss without timer
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}

function TimerPill() {
  const timer = useLiveQuery(() => kvGet<TimerState>('timer'), []);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const finished = useRef<number | null>(null);

  useEffect(() => {
    if (!timer) return;
    const iv = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(iv);
  }, [timer]);

  useEffect(() => {
    if (!timer || now < timer.endsAt || finished.current === timer.endsAt) return;
    finished.current = timer.endsAt;
    chime();
    navigator.vibrate?.(300);
    toast(`Timer finished · ${timer.label}`);
    if (document.visibilityState !== 'visible') void localNotify('Timer finished', timer.label, { tag: 'timer' });
    void stopTimer();
    setOpen(false);
  }, [now, timer, toast]);

  const left = timer ? Math.max(0, (timer.endsAt - now) / 1000) : 0;

  return (
    <AnimatePresence>
      {timer && (
        <motion.div
          key="timer"
          transition={spring}
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+8px)] z-[45] flex justify-center"
        >
          <motion.div layout className="glass pointer-events-auto overflow-hidden rounded-[28px]" transition={spring}>
            {!open ? (
              <motion.button
                layout="position"
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-10 items-center gap-2.5 pl-3 pr-4"
                aria-label="Open timer"
              >
                <span className="relative h-2 w-2 rounded-full bg-lime shadow-[0_0_10px_#B7FF35]" />
                <span className="num text-[15px] font-semibold">{fmtDuration(left)}</span>
              </motion.button>
            ) : (
              <motion.div layout="position" className="flex w-[300px] flex-col items-center px-5 pb-5 pt-4">
                <p className="eyebrow">{timer.label}</p>
                <div className="mt-3">
                  <Ring value={left / timer.total} size={150} stroke={8}>
                    <span className="num text-[34px] font-bold">{fmtDuration(left)}</span>
                  </Ring>
                </div>
                <div className="mt-4 grid w-full grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    onClick={() => void kvSet('timer', { ...timer, endsAt: timer.endsAt + 60_000, total: timer.total + 60 })}
                  >
                    +1 min
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void stopTimer()}>
                    Stop
                  </Button>
                  <Button size="sm" onClick={() => setOpen(false)}>
                    Hide
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
