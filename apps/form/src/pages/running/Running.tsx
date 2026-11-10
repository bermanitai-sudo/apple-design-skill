import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { Bar as RBar, BarChart, ResponsiveContainer, XAxis, Cell } from 'recharts';
import { ChevronRight, Plus } from 'lucide-react';
import { db, kvGet, type Run } from '../../lib/db';
import { addDays, atTime, dayKey, fmtDay, parseDay, startOfWeek } from '../../lib/date';
import { fmtDistance, fmtDuration, fmtPace, fromUnitDistance, paceSec, speed, toUnitDistance } from '../../lib/format';
import { runCalories } from '../../lib/run';
import { useSettings } from '../../lib/settings';
import { useToday } from '../../hooks/useClock';
import { startRun } from '../../state/activeRun';
import { listItem } from '../../lib/motion';
import {
  Button,
  Card,
  Empty,
  Field,
  IconButton,
  PageHeader,
  SampleTag,
  SectionTitle,
  Segmented,
  Sheet,
  useToast,
} from '../../components/ui';

type Period = 'week' | 'month';

export default function Running() {
  const s = useSettings();
  const nav = useNavigate();
  const today = useToday();
  const runs = useLiveQuery(() => db.runs.orderBy('startedAt').reverse().toArray(), [], []);
  const active = useLiveQuery(() => kvGet('activeRun'), []);
  const [period, setPeriod] = useState<Period>('week');
  const [manual, setManual] = useState(false);
  const u = s.distanceUnit;

  const range = useMemo(() => {
    if (period === 'week') {
      const start = startOfWeek(today);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const d = parseDay(today);
    const n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => dayKey(new Date(d.getFullYear(), d.getMonth(), i + 1)));
  }, [period, today]);

  const inRange = runs.filter((r) => {
    const k = dayKey(new Date(r.startedAt));
    return k >= range[0] && k <= range[range.length - 1];
  });
  const totalKm = inRange.reduce((n, r) => n + r.distanceKm, 0);
  const totalSec = inRange.reduce((n, r) => n + r.durationSec, 0);
  const chart = range.map((k) => ({
    k,
    label: period === 'week' ? 'MTWTFSS'[range.indexOf(k)] : String(parseDay(k).getDate()),
    v: toUnitDistance(
      inRange.filter((r) => dayKey(new Date(r.startedAt)) === k).reduce((n, r) => n + r.distanceKm, 0),
      u,
    ),
  }));

  const records = useMemo(() => personalRecords(runs), [runs]);

  const start = async () => {
    await startRun();
    nav('/run/active');
  };

  return (
    <div>
      <PageHeader
        title="Running"
        actions={
          <IconButton label="Log a run manually" onClick={() => setManual(true)}>
            <Plus size={22} />
          </IconButton>
        }
      />

      <motion.button
        type="button"
        onClick={() => void start()}
        whileTap={{ scale: 0.98 }}
        className="mt-3 flex h-[72px] w-full items-center justify-between rounded-[22px] bg-lime px-6 text-[#0b1400] shadow-[0_16px_40px_-14px_rgba(183,255,53,0.7)]"
      >
        <span className="font-display text-[22px] font-bold tracking-[-0.02em]">{active ? 'Resume run' : 'Start run'}</span>
        <ChevronRight size={26} strokeWidth={2.5} />
      </motion.button>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="eyebrow px-1">Summary</h2>
        <Segmented
          className="w-[180px]"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
      </div>

      <Card className="mt-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label={u === 'km' ? 'Kilometres' : 'Miles'} value={fmtDistance(totalKm, u, 1)} big />
          <Stat label="Runs" value={String(inRange.length)} big />
          <Stat label={`Pace /${u}`} value={fmtPace(paceSec(totalSec, totalKm, u))} big />
        </div>
        <div className="mt-4 h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={period === 'week' ? 0 : 4}
                tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
              />
              <RBar dataKey="v" radius={[4, 4, 4, 4]} minPointSize={2} isAnimationActive animationDuration={600}>
                {chart.map((c) => (
                  <Cell key={c.k} fill={c.v > 0 ? '#B7FF35' : 'rgba(255,255,255,0.08)'} />
                ))}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[12px] text-mute">Total time {fmtDuration(totalSec)}</p>
      </Card>

      <SectionTitle>Personal records</SectionTitle>
      {records ? (
        <div className="grid grid-cols-2 gap-3">
          <Record
            label="Longest run"
            value={`${fmtDistance(records.longest.distanceKm, u, 2)} ${u}`}
            sub={fmtDay(dayKey(new Date(records.longest.startedAt)), { month: 'short', day: 'numeric' })}
          />
          <Record
            label="Fastest pace"
            value={records.fastest ? `${fmtPace(paceSec(records.fastest.durationSec, records.fastest.distanceKm, u))} /${u}` : '—'}
            sub={records.fastest ? fmtDay(dayKey(new Date(records.fastest.startedAt)), { month: 'short', day: 'numeric' }) : 'Run 1 ' + u}
          />
          <Record
            label="Longest time"
            value={fmtDuration(records.longestTime.durationSec)}
            sub={fmtDay(dayKey(new Date(records.longestTime.startedAt)), { month: 'short', day: 'numeric' })}
          />
          <Record
            label="Best week"
            value={`${fmtDistance(records.bestWeekKm, u, 1)} ${u}`}
            sub={`Week of ${fmtDay(records.bestWeek, { month: 'short', day: 'numeric' })}`}
          />
        </div>
      ) : (
        <Empty title="No records yet" body="Finish your first run to set them." />
      )}

      <SectionTitle>History</SectionTitle>
      {runs.length === 0 ? (
        <Empty
          title="No runs yet"
          body="Start a GPS run or log one manually."
          action={<Button onClick={() => setManual(true)}>Log a run</Button>}
        />
      ) : (
        <div className="surface divide-y divide-white/[0.06] overflow-hidden p-0">
          <AnimatePresence initial={false}>
            {runs.map((r, i) => (
              <motion.div key={r.id} layout variants={listItem} initial="hidden" animate="show" exit="exit" custom={i}>
                <Link to={`/run/${r.id}`} className="flex min-h-[64px] items-center gap-3 px-4 py-3 active:bg-white/[0.03]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[15px] font-semibold">
                      {fmtDay(dayKey(new Date(r.startedAt)), { weekday: 'short', month: 'short', day: 'numeric' })}
                      {r.sample && <SampleTag />}
                    </div>
                    <div className="mt-0.5 text-[13px] text-mute">
                      {fmtDuration(r.durationSec)} · {fmtPace(paceSec(r.durationSec, r.distanceKm, u))} /{u} ·{' '}
                      {r.source === 'gps' ? 'GPS' : 'Manual'}
                    </div>
                  </div>
                  <div className="num text-[22px] font-bold">
                    {fmtDistance(r.distanceKm, u, 2)}
                    <span className="ml-0.5 text-[12px] font-semibold text-mute">{u}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ManualRunSheet open={manual} onClose={() => setManual(false)} />
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div className={`num font-bold leading-none ${big ? 'text-[30px]' : 'text-[20px]'}`}>{value}</div>
      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">{label}</div>
    </div>
  );
}

function Record({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <p className="num mt-2 text-[24px] font-bold leading-none">{value}</p>
      <p className="mt-1.5 text-[12px] text-faint">{sub}</p>
    </Card>
  );
}

export function personalRecords(runs: Run[]) {
  if (!runs.length) return null;
  const longest = runs.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
  const longestTime = runs.reduce((a, b) => (b.durationSec > a.durationSec ? b : a));
  const eligible = runs.filter((r) => r.distanceKm >= 1);
  const fastest = eligible.length ? eligible.reduce((a, b) => (b.durationSec / b.distanceKm < a.durationSec / a.distanceKm ? b : a)) : null;
  const weeks = new Map<string, number>();
  for (const r of runs) {
    const w = startOfWeek(dayKey(new Date(r.startedAt)));
    weeks.set(w, (weeks.get(w) ?? 0) + r.distanceKm);
  }
  const [bestWeek, bestWeekKm] = [...weeks.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
  return { longest, longestTime, fastest, bestWeek, bestWeekKm };
}

export function ManualRunSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();
  const toast = useToast();
  const [date, setDate] = useState(dayKey());
  const [time, setTime] = useState('07:00');
  const [dist, setDist] = useState('');
  const [h, setH] = useState('0');
  const [m, setM] = useState('');
  const [sec, setSec] = useState('0');
  const [notes, setNotes] = useState('');
  const km = fromUnitDistance(parseFloat(dist.replace(',', '.')) || 0, s.distanceUnit);
  const duration = (parseInt(h) || 0) * 3600 + (parseInt(m) || 0) * 60 + (parseInt(sec) || 0);
  const valid = km > 0 && duration > 0;

  const save = async () => {
    await db.runs.add({
      startedAt: atTime(date, time).getTime(),
      distanceKm: km,
      durationSec: duration,
      calories: runCalories(km, s.bodyWeightKg),
      source: 'manual',
      notes: notes.trim() || undefined,
    });
    toast('Run logged');
    setDist('');
    setM('');
    setNotes('');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Log a run"
      footer={
        <Button variant="primary" className="w-full" disabled={!valid} onClick={() => void save()}>
          Save run
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className="field" value={date} max={dayKey()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Start">
            <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label={`Distance (${s.distanceUnit})`}>
          <input className="field" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="5.00" />
        </Field>
        <Field label="Duration (h · min · s)">
          <div className="grid grid-cols-3 gap-2">
            <input className="field text-center" inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} aria-label="Hours" />
            <input
              className="field text-center"
              inputMode="numeric"
              value={m}
              onChange={(e) => setM(e.target.value)}
              placeholder="30"
              aria-label="Minutes"
            />
            <input
              className="field text-center"
              inputMode="numeric"
              value={sec}
              onChange={(e) => setSec(e.target.value)}
              aria-label="Seconds"
            />
          </div>
        </Field>
        {valid && (
          <p className="px-1 text-[13px] text-mute">
            Pace {fmtPace(paceSec(duration, km, s.distanceUnit))} /{s.distanceUnit} · {speed(duration, km, s.distanceUnit).toFixed(1)}{' '}
            {s.distanceUnit}/h · ~{runCalories(km, s.bodyWeightKg)} kcal
          </p>
        )}
        <Field label="Notes">
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
    </Sheet>
  );
}
