import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { db, type DayRecord } from '../lib/db';
import { atTime, fmtDay, fmtTime, relDay } from '../lib/date';
import { fmtDuration } from '../lib/format';
import { streak } from '../lib/assignments';
import { useNow, useToday } from '../hooks/useClock';
import { resolvePushups, toggleAssignment } from '../state/discipline';
import { listItem, spring } from '../lib/motion';
import { Bar, Button, Card, PageHeader, SampleTag, SectionTitle, cx, useToast } from '../components/ui';

export function PushupBanner() {
  const pending = useLiveQuery(() => db.pushups.where('status').equals('pending').sortBy('forDate'), [], []);
  const today = useToday();
  const toast = useToast();
  return (
    <AnimatePresence initial={false}>
      {pending.map((p) => (
        <motion.div
          key={p.id}
          layout
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
          transition={spring}
          className="surface overflow-hidden border-lime/40 p-4 shadow-[0_0_0_1px_rgba(183,255,53,0.25),0_18px_40px_-12px_rgba(0,0,0,0.85)]"
        >
          <p className="eyebrow text-lime">Accountability</p>
          <p className="mt-1.5 font-display text-[22px] font-bold tracking-[-0.02em]">
            <span className="num">{p.reps}</span> push-ups pending
          </p>
          <p className="mt-1 text-[13px] text-mute">
            You missed your assignments{' '}
            {relDay(p.forDate, today).toLowerCase() === 'yesterday'
              ? 'yesterday'
              : `on ${fmtDay(p.forDate, { weekday: 'long', month: 'short', day: 'numeric' })}`}
            . Split them into sets. Skip if you are sore, unwell or injured; never push through pain.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              onClick={() => {
                void resolvePushups(p.id!, 'done');
                toast('Push-ups logged. Accountability kept.');
              }}
            >
              Mark done
            </Button>
            <Button onClick={() => void resolvePushups(p.id!, 'skipped')}>Skip</Button>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export default function Daily() {
  const now = useNow(1000);
  const today = useToday();
  const day = useLiveQuery(() => db.days.get(today), [today]);
  const all = useLiveQuery(() => db.days.orderBy('date').reverse().toArray(), [], []);
  const pushups = useLiveQuery(() => db.pushups.orderBy('forDate').reverse().toArray(), [], []);
  const [open, setOpen] = useState<string | null>(null);

  const done = day?.assignments.filter((a) => a.done).length ?? 0;
  const past = all.filter((d) => d.date < today || d.evaluatedAt);
  const closed = all.filter((d) => d.evaluatedAt);
  const success = closed.filter((d) => d.status === 'success').length;
  const missed = closed.filter((d) => d.status === 'missed').length;
  const rate = closed.length ? Math.round((success / closed.length) * 100) : 0;
  const left = day ? (atTime(day.date, day.deadline).getTime() - now.getTime()) / 1000 : 0;

  return (
    <div>
      <PageHeader eyebrow={fmtDay(today)} title="Daily" />
      <div className="mt-3 space-y-3">
        <PushupBanner />

        <Card className="py-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-mute">
              {day?.evaluatedAt ? 'Day closed' : `Deadline ${day ? fmtTime(day.deadline) : '—'}`}
            </span>
            <span className="num text-[15px] font-semibold">
              {day?.evaluatedAt ? (day.status === 'success' ? 'Complete' : 'Missed') : left > 0 ? fmtDuration(left) : '—'}
            </span>
          </div>
          <Bar className="mt-2.5" value={done / 3} label="Assignments complete" />
        </Card>

        {day?.assignments.map((a, i) => (
          <motion.button
            key={a.key}
            type="button"
            variants={listItem}
            initial="hidden"
            animate="show"
            custom={i}
            disabled={!!day.evaluatedAt}
            onClick={() => void toggleAssignment(day.date, a.key)}
            aria-pressed={a.done}
            className={cx(
              'surface tap flex w-full items-start gap-4 p-4 text-left transition-shadow duration-300',
              a.done && 'shadow-[0_0_0_1px_rgba(183,255,53,0.35),0_18px_40px_-12px_rgba(0,0,0,0.85)]',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="eyebrow">{a.category}</span>
                <span className="text-[11px] text-faint">· {a.minutes ? `${a.minutes} min` : 'All day'}</span>
              </div>
              <p className={cx('mt-1.5 text-[18px] font-semibold tracking-[-0.01em] transition-colors', a.done && 'text-white/50')}>
                {a.title}
              </p>
              <p className="mt-1 text-[14px] leading-snug text-mute">{a.description}</p>
            </div>
            <span
              className={cx(
                'mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-200',
                a.done ? 'border-lime bg-lime' : 'border-white/25',
              )}
            >
              <AnimatePresence>
                {a.done && (
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={spring}
                  >
                    <Check size={20} strokeWidth={3} className="text-[#0b1400]" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </motion.button>
        ))}

        <div className="grid grid-cols-4 gap-2 pt-2">
          {[
            ['Streak', streak(all, today)],
            ['Success', success],
            ['Missed', missed],
            ['Rate', `${rate}%`],
          ].map(([k, v]) => (
            <div key={k} className="surface-flat px-2 py-3 text-center">
              <div className="num text-[22px] font-bold">{v}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">{k}</div>
            </div>
          ))}
        </div>

        <SectionTitle>History</SectionTitle>
        {past.length === 0 && <p className="px-1 text-[14px] text-mute">Closed days appear here after each deadline.</p>}
        <div className="surface divide-y divide-white/[0.06] overflow-hidden p-0">
          {past.map((d) => (
            <HistoryRow key={d.date} d={d} open={open === d.date} onToggle={() => setOpen(open === d.date ? null : d.date)} today={today} />
          ))}
        </div>

        {pushups.length > 0 && (
          <>
            <SectionTitle>Push-up log</SectionTitle>
            <div className="surface divide-y divide-white/[0.06] p-0">
              {pushups.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-2 text-[15px]">
                    {fmtDay(p.forDate, { month: 'short', day: 'numeric', weekday: 'short' })} {p.sample && <SampleTag />}
                  </span>
                  <span className={cx('text-[13px] font-semibold', p.status === 'done' ? 'text-lime' : 'text-mute')}>
                    {p.status === 'pending' ? `${p.reps} pending` : p.status === 'done' ? `${p.reps} done` : 'Skipped'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ d, open, onToggle, today }: { d: DayRecord; open: boolean; onToggle: () => void; today: string }) {
  const n = d.assignments.filter((a) => a.done).length;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cx('h-2.5 w-2.5 rounded-full', d.status === 'success' ? 'bg-lime shadow-[0_0_8px_#B7FF35]' : 'border border-white/40')}
        />
        <span className="flex flex-1 items-center gap-2 text-[15px]">
          {relDay(d.date, today)} {d.sample && <SampleTag />}
        </span>
        <span className="num text-[13px] text-mute">{n}/3</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring}>
          <ChevronDown size={16} className="text-white/40" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden px-4"
          >
            {d.assignments.map((a) => (
              <li key={a.key} className="flex items-center gap-2.5 pb-3 text-[14px]">
                <span className={cx('h-1.5 w-1.5 rounded-full', a.done ? 'bg-lime' : 'bg-white/25')} />
                <span className={a.done ? '' : 'text-mute'}>{a.title}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
