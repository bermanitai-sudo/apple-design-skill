import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { db, type Alarm, type SoundId } from '../../lib/db';
import { describeDays, nextAlarm } from '../../lib/alarmMath';
import { WEEKDAYS, WEEKDAYS_LONG, dayKey, fmtTime, relDay } from '../../lib/date';
import { fmtLeft } from '../../lib/format';
import { SOUNDS, previewSound } from '../../lib/sound';
import { useSettings } from '../../lib/settings';
import { useNow } from '../../hooks/useClock';
import { listItem } from '../../lib/motion';
import { Button, Card, Confirm, Empty, Field, SectionTitle, Sheet, Toggle, cx, useToast } from '../../components/ui';
import { AlarmReliability } from './AlarmReliability';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function Alarms({ adding, onAdded }: { adding: boolean; onAdded: () => void }) {
  const now = useNow(30_000);
  const alarms = useLiveQuery(() => db.alarms.toArray(), [], []);
  const [edit, setEdit] = useState<Alarm | null | undefined>(undefined);
  const [plan, setPlan] = useState(false);
  const next = nextAlarm(alarms, now);
  const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time));

  useEffect(() => {
    if (adding) {
      setEdit(null);
      onAdded();
    }
  }, [adding, onAdded]);

  return (
    <div className="space-y-3">
      <Card className="p-5">
        <p className="eyebrow">Next alarm</p>
        {next ? (
          <>
            <p className="num mt-2 text-[56px] font-bold leading-none">{fmtTime(next.alarm.time)}</p>
            <p className="mt-2 text-[14px] text-mute">
              {next.alarm.label || 'Alarm'} · {relDay(dayKey(next.at), dayKey(now))} · in{' '}
              {fmtLeft((next.at.getTime() - now.getTime()) / 1000)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-[15px] text-mute">No alarm scheduled.</p>
        )}
      </Card>

      <SectionTitle
        action={
          <button type="button" className="text-[13px] font-semibold text-lime" onClick={() => setPlan(true)}>
            Weekly plan
          </button>
        }
      >
        Alarms
      </SectionTitle>
      {sorted.length === 0 ? (
        <Empty
          title="No alarms"
          body="Add one, or set a different wake-up time for each day of the week."
          action={<Button onClick={() => setPlan(true)}>Set up a weekly plan</Button>}
        />
      ) : (
        <div className="surface divide-y divide-white/[0.06] overflow-hidden p-0">
          <AnimatePresence initial={false}>
            {sorted.map((a, i) => (
              <motion.div
                key={a.id}
                layout
                variants={listItem}
                initial="hidden"
                animate="show"
                exit="exit"
                custom={i}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEdit(a)}>
                  <div className={cx('num text-[34px] font-bold leading-none transition-colors', !a.enabled && 'text-white/35')}>
                    {fmtTime(a.time)}
                  </div>
                  <div className="mt-1.5 truncate text-[13px] text-mute">
                    {a.label || 'Alarm'} · {describeDays(a.days)}
                  </div>
                </button>
                <Toggle
                  checked={a.enabled}
                  onChange={(v) => void db.alarms.update(a.id!, { enabled: v })}
                  label={`${a.label || 'Alarm'} ${fmtTime(a.time)}`}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <SectionTitle>On iPhone</SectionTitle>
      <AlarmReliability />

      <AlarmSheet open={edit !== undefined} alarm={edit} onClose={() => setEdit(undefined)} />
      <WeeklyPlanSheet open={plan} onClose={() => setPlan(false)} />
    </div>
  );
}

function AlarmSheet({ open, alarm, onClose }: { open: boolean; alarm?: Alarm | null; onClose: () => void }) {
  const s = useSettings();
  const toast = useToast();
  const [time, setTime] = useState('07:00');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [sound, setSound] = useState<SoundId>('pulse');
  const [timer, setTimer] = useState('');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTime(alarm?.time ?? '07:00');
    setLabel(alarm?.label ?? '');
    setDays(alarm?.days ?? [1, 2, 3, 4, 5]);
    setSound(alarm?.sound ?? 'pulse');
    setTimer(alarm?.timerMinutes != null ? String(alarm.timerMinutes) : '');
  }, [open, alarm]);

  const save = async () => {
    const timerMinutes = timer.trim() === '' ? null : Math.max(0, Math.min(240, parseInt(timer) || 0));
    const row = { time, label: label.trim(), days, sound, timerMinutes, enabled: true };
    if (alarm?.id) await db.alarms.update(alarm.id, row);
    else await db.alarms.add({ ...row, createdAt: Date.now() });
    toast(alarm ? 'Alarm updated' : `Alarm set for ${fmtTime(time)}`);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={alarm ? 'Edit alarm' : 'New alarm'}
      footer={
        <div className={cx('grid gap-2', alarm ? 'grid-cols-2' : 'grid-cols-1')}>
          {alarm && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Delete
            </Button>
          )}
          <Button variant="primary" onClick={() => void save()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="num w-full bg-transparent text-center text-[64px] font-bold outline-none"
          aria-label="Alarm time"
        />
        <Field label="Name">
          <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Wake up" />
        </Field>
        <div>
          <span className="mb-1.5 block px-1 text-[13px] font-medium text-mute">Repeat · {describeDays(days)}</span>
          <div className="grid grid-cols-7 gap-1.5">
            {ORDER.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAYS_LONG[d]}
                  onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                  className={cx(
                    'h-11 rounded-[12px] text-[13px] font-semibold transition-colors',
                    on ? 'bg-lime text-[#0b1400]' : 'bg-white/[0.06] text-white/70',
                  )}
                >
                  {WEEKDAYS[d].slice(0, 2)}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 px-1 text-[12px] text-faint">No days selected rings once.</p>
        </div>
        <div>
          <span className="mb-1.5 block px-1 text-[13px] font-medium text-mute">Sound · tap to preview</span>
          <div className="grid grid-cols-4 gap-1.5">
            {SOUNDS.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={sound === x.id}
                onClick={() => {
                  setSound(x.id);
                  previewSound(x.id);
                }}
                className={cx(
                  'h-11 rounded-[12px] text-[13px] font-semibold transition-colors',
                  sound === x.id ? 'bg-white text-[#080808]' : 'bg-white/[0.06] text-white/70',
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 px-1 text-[12px] text-faint">
            Plays while FORM is open. Closed-app alerts use the iPhone notification sound.
          </p>
        </div>
        <Field
          label="Timer after dismiss (minutes)"
          hint={`Leave empty to use your default of ${s.alarmTimerMinutes} min. 0 turns it off.`}
        >
          <input
            className="field"
            inputMode="numeric"
            value={timer}
            onChange={(e) => setTimer(e.target.value)}
            placeholder={String(s.alarmTimerMinutes)}
          />
        </Field>
      </div>
      <Confirm
        open={confirm}
        title="Delete alarm?"
        body={`${alarm?.label || 'Alarm'} at ${alarm ? fmtTime(alarm.time) : ''}`}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          void db.alarms.delete(alarm!.id!);
          onClose();
        }}
      />
    </Sheet>
  );
}

/** One alarm per weekday, each with its own time: the quickest way to set a whole week. */
function WeeklyPlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const alarms = useLiveQuery(() => db.alarms.toArray(), [], []);
  const [rows, setRows] = useState<{ day: number; on: boolean; time: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setRows(
      ORDER.map((day) => {
        const a = alarms.find((x) => x.label === 'Wake up' && x.days.length === 1 && x.days[0] === day);
        return { day, on: a?.enabled ?? false, time: a?.time ?? (day === 0 || day === 6 ? '09:00' : '07:00') };
      }),
    );
  }, [open, alarms]);

  const save = async () => {
    await db.transaction('rw', db.alarms, async () => {
      for (const r of rows) {
        const existing = (await db.alarms.toArray()).find((x) => x.label === 'Wake up' && x.days.length === 1 && x.days[0] === r.day);
        if (existing) await db.alarms.update(existing.id!, { time: r.time, enabled: r.on });
        else if (r.on)
          await db.alarms.add({
            label: 'Wake up',
            time: r.time,
            days: [r.day],
            enabled: true,
            sound: 'rise',
            timerMinutes: null,
            createdAt: Date.now(),
          });
      }
    });
    toast('Weekly plan saved');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Weekly wake-up plan"
      footer={
        <Button variant="primary" className="w-full" onClick={() => void save()}>
          Save plan
        </Button>
      }
    >
      <p className="pb-3 text-[13px] text-mute">A separate “Wake up” alarm for each day. Edit any of them later from the list.</p>
      <div className="surface divide-y divide-white/[0.06] p-0">
        {rows.map((r, i) => (
          <div key={r.day} className="flex items-center gap-3 px-4 py-2.5">
            <span className={cx('w-24 text-[15px] font-medium', !r.on && 'text-white/40')}>{WEEKDAYS_LONG[r.day]}</span>
            <input
              type="time"
              value={r.time}
              disabled={!r.on}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))}
              className="num min-h-0 flex-1 bg-transparent text-right text-[20px] font-semibold outline-none disabled:opacity-30"
              aria-label={`${WEEKDAYS_LONG[r.day]} time`}
            />
            <Toggle
              checked={r.on}
              onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, on: v } : x)))}
              label={WEEKDAYS_LONG[r.day]}
            />
          </div>
        ))}
      </div>
    </Sheet>
  );
}
