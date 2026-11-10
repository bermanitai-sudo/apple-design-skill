import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { db, type CalEvent } from '../../lib/db';
import { addDays, dayKey, fmtDay, fmtTime, monthGrid, parseDay, relDay, startOfWeek } from '../../lib/date';
import { useToday } from '../../hooks/useClock';
import { listItem } from '../../lib/motion';
import {
  Button,
  Confirm,
  Empty,
  Field,
  IconButton,
  PageHeader,
  SampleTag,
  SectionTitle,
  Segmented,
  Sheet,
  cx,
  useToast,
} from '../../components/ui';
import { Alarms } from './Alarms';

type View = 'day' | 'week' | 'month';
const REMINDERS: { v: number | null; label: string }[] = [
  { v: null, label: 'None' },
  { v: 0, label: 'At time' },
  { v: 10, label: '10 min' },
  { v: 30, label: '30 min' },
  { v: 60, label: '1 hour' },
  { v: 1440, label: '1 day' },
];

const byTime = (a: CalEvent, b: CalEvent) => (a.date + a.start).localeCompare(b.date + b.start);

export default function Schedule() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'alarms' ? 'alarms' : 'calendar';
  const today = useToday();
  const [view, setView] = useState<View>('day');
  const [cursor, setCursor] = useState(today);
  const [edit, setEdit] = useState<CalEvent | null | undefined>(undefined);
  const [addingAlarm, setAddingAlarm] = useState(false);
  const doneAdding = useCallback(() => setAddingAlarm(false), []);

  const range =
    view === 'day'
      ? [cursor, cursor]
      : view === 'week'
        ? [startOfWeek(cursor), addDays(startOfWeek(cursor), 6)]
        : [monthGrid(cursor)[0], monthGrid(cursor)[41]];
  const events = useLiveQuery(() => db.events.where('date').between(range[0], range[1], true, true).toArray(), [range[0], range[1]], []);
  const upcoming = useLiveQuery(
    () => db.events.where('date').between(addDays(today, 1), addDays(today, 14), true, true).toArray(),
    [today],
    [],
  );

  const step = (n: number) => {
    if (view === 'day') setCursor(addDays(cursor, n));
    else if (view === 'week') setCursor(addDays(cursor, 7 * n));
    else {
      const d = parseDay(cursor);
      setCursor(dayKey(new Date(d.getFullYear(), d.getMonth() + n, 1)));
    }
  };

  const title =
    view === 'day'
      ? relDay(cursor, today)
      : view === 'week'
        ? `${fmtDay(range[0], { month: 'short', day: 'numeric' })} – ${fmtDay(range[1], { month: 'short', day: 'numeric' })}`
        : parseDay(cursor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader
        title="Schedule"
        actions={
          <IconButton
            label={tab === 'alarms' ? 'New alarm' : 'New event'}
            onClick={() => (tab === 'alarms' ? setAddingAlarm(true) : setEdit(null))}
          >
            <Plus size={22} />
          </IconButton>
        }
      />
      <Segmented
        className="mt-2"
        value={tab}
        onChange={(v) => setParams(v === 'alarms' ? { tab: 'alarms' } : {}, { replace: true })}
        options={[
          { value: 'calendar', label: 'Calendar' },
          { value: 'alarms', label: 'Alarms' },
        ]}
      />

      <AnimatePresence mode="wait" initial={false}>
        {tab === 'alarms' ? (
          <motion.div
            key="alarms"
            className="mt-4"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.22 }}
          >
            <Alarms adding={addingAlarm} onAdded={doneAdding} />
          </motion.div>
        ) : (
          <motion.div
            key="cal"
            className="mt-4"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            <div className="flex items-center gap-2">
              <Segmented
                className="flex-1"
                value={view}
                onChange={setView}
                options={[
                  { value: 'day', label: 'Day' },
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' },
                ]}
              />
              {cursor !== today && (
                <Button size="sm" onClick={() => setCursor(today)}>
                  Today
                </Button>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <IconButton label="Previous" onClick={() => step(-1)}>
                <ChevronLeft size={20} />
              </IconButton>
              <span className="text-[16px] font-semibold">{title}</span>
              <IconButton label="Next" onClick={() => step(1)}>
                <ChevronRight size={20} />
              </IconButton>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view + range[0]}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {view === 'day' && (
                  <DayList events={events.filter((e) => e.date === cursor).sort(byTime)} onOpen={setEdit} onAdd={() => setEdit(null)} />
                )}
                {view === 'week' && (
                  <div className="space-y-2">
                    {Array.from({ length: 7 }, (_, i) => addDays(range[0], i)).map((k) => {
                      const list = events.filter((e) => e.date === k).sort(byTime);
                      return (
                        <div key={k} className={cx('surface-flat px-4 py-3', k === today && 'border-lime/40')}>
                          <button
                            type="button"
                            className="flex w-full items-baseline justify-between"
                            onClick={() => {
                              setCursor(k);
                              setView('day');
                            }}
                          >
                            <span className={cx('text-[14px] font-semibold', k === today && 'text-lime')}>
                              {fmtDay(k, { weekday: 'long', day: 'numeric' })}
                            </span>
                            <span className="text-[12px] text-faint">
                              {list.length ? `${list.length} event${list.length > 1 ? 's' : ''}` : 'Free'}
                            </span>
                          </button>
                          {list.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => setEdit(e)}
                              className="mt-2 flex w-full items-center gap-3 text-left"
                            >
                              <span className="num w-16 text-[13px] text-mute">{fmtTime(e.start)}</span>
                              <span className="flex-1 truncate text-[15px]">{e.title}</span>
                              {e.sample && <SampleTag />}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
                {view === 'month' && (
                  <div className="surface p-3">
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <span key={i} className="pb-1 text-[11px] font-semibold text-faint">
                          {d}
                        </span>
                      ))}
                      {monthGrid(cursor).map((k) => {
                        const n = events.filter((e) => e.date === k).length;
                        const inMonth = parseDay(k).getMonth() === parseDay(cursor).getMonth();
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => {
                              setCursor(k);
                              setView('day');
                            }}
                            className={cx(
                              'flex h-12 flex-col items-center justify-center rounded-[12px] text-[15px]',
                              k === today ? 'bg-lime font-semibold text-[#0b1400]' : 'active:bg-white/[0.06]',
                              !inMonth && k !== today && 'text-white/30',
                            )}
                          >
                            {parseDay(k).getDate()}
                            <span className="mt-0.5 flex h-1 gap-0.5">
                              {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                                <span key={i} className={cx('h-1 w-1 rounded-full', k === today ? 'bg-[#0b1400]' : 'bg-lime')} />
                              ))}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {view === 'day' && cursor === today && (
              <>
                <SectionTitle>Upcoming · 14 days</SectionTitle>
                {upcoming.length === 0 ? (
                  <p className="px-1 text-[14px] text-mute">Nothing planned.</p>
                ) : (
                  <div className="surface divide-y divide-white/[0.06] p-0">
                    {upcoming.sort(byTime).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setEdit(e)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className="w-20 shrink-0">
                          <div className="text-[13px] font-semibold">{relDay(e.date, today)}</div>
                          <div className="num text-[12px] text-mute">{fmtTime(e.start)}</div>
                        </div>
                        <span className="flex-1 truncate text-[15px]">{e.title}</span>
                        {e.sample && <SampleTag />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <EventSheet open={edit !== undefined} event={edit} defaultDate={cursor} onClose={() => setEdit(undefined)} />
    </div>
  );
}

function DayList({ events, onOpen, onAdd }: { events: CalEvent[]; onOpen: (e: CalEvent) => void; onAdd: () => void }) {
  if (!events.length)
    return (
      <Empty
        title="Nothing scheduled"
        body="A clear day. Add an event if you need one."
        action={<Button onClick={onAdd}>Add event</Button>}
      />
    );
  return (
    <div className="relative space-y-2 pl-4">
      <span className="absolute bottom-2 left-[5px] top-2 w-px bg-white/10" />
      {events.map((e, i) => (
        <motion.button
          key={e.id}
          type="button"
          variants={listItem}
          initial="hidden"
          animate="show"
          custom={i}
          onClick={() => onOpen(e)}
          className="surface tap relative block w-full p-4 text-left"
        >
          <span className="absolute -left-[15px] top-5 h-2.5 w-2.5 rounded-full bg-lime shadow-[0_0_8px_#B7FF35]" />
          <div className="num text-[13px] font-semibold text-mute">
            {fmtTime(e.start)}
            {e.end ? ` – ${fmtTime(e.end)}` : ''}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[17px] font-semibold">
            {e.title} {e.sample && <SampleTag />}
          </div>
          {e.description && <p className="mt-1 text-[14px] text-mute">{e.description}</p>}
          {e.reminderMinutes != null && (
            <p className="mt-2 text-[12px] text-faint">
              Reminder {REMINDERS.find((r) => r.v === e.reminderMinutes)?.label.toLowerCase() ?? `${e.reminderMinutes} min`}
              {e.reminderMinutes ? ' before' : ''}
            </p>
          )}
        </motion.button>
      ))}
    </div>
  );
}

function EventSheet({
  open,
  event,
  defaultDate,
  onClose,
}: {
  open: boolean;
  event?: CalEvent | null;
  defaultDate: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('');
  const [reminder, setReminder] = useState<number | null>(10);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? '');
    setDescription(event?.description ?? '');
    setDate(event?.date ?? defaultDate);
    setStart(event?.start ?? '09:00');
    setEnd(event?.end ?? '');
    setReminder(event ? event.reminderMinutes : 10);
  }, [open, event, defaultDate]);

  const invalidEnd = !!end && end <= start;
  const save = async () => {
    const row = { title: title.trim(), description: description.trim(), date, start, end: end || undefined, reminderMinutes: reminder };
    if (event?.id) await db.events.update(event.id, { ...row, sample: false });
    else await db.events.add(row);
    toast(event ? 'Event updated' : 'Event added');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={event ? 'Edit event' : 'New event'}
      footer={
        <div className={cx('grid gap-2', event ? 'grid-cols-2' : 'grid-cols-1')}>
          {event && (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Delete
            </Button>
          )}
          <Button variant="primary" disabled={!title.trim() || invalidEnd} onClick={() => void save()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gym, meeting, long run…" />
        </Field>
        <Field label="Description">
          <textarea
            className="field min-h-[80px] resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label="Date">
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <input type="time" className="field" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Ends" hint={invalidEnd ? 'Must be after the start.' : undefined}>
            <input type="time" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block px-1 text-[13px] font-medium text-mute">Reminder</span>
          <div className="grid grid-cols-3 gap-1.5">
            {REMINDERS.map((r) => (
              <button
                key={String(r.v)}
                type="button"
                aria-pressed={reminder === r.v}
                onClick={() => setReminder(r.v)}
                className={cx(
                  'h-10 rounded-[12px] text-[13px] font-semibold transition-colors',
                  reminder === r.v ? 'bg-white text-[#080808]' : 'bg-white/[0.06] text-white/70',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Confirm
        open={confirm}
        title="Delete event?"
        body={event?.title ?? ''}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          void db.events.delete(event!.id!);
          onClose();
        }}
      />
    </Sheet>
  );
}
