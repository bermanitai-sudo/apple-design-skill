import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Check, ChevronRight, Settings as Cog } from 'lucide-react';
import { db } from '../lib/db';
import { atTime, dayKey, fmtDay, fmtTime, startOfWeek, relDay } from '../lib/date';
import { fmtDistance, fmtLeft } from '../lib/format';
import { nextAlarm } from '../lib/alarmMath';
import { streak } from '../lib/assignments';
import { useSettings } from '../lib/settings';
import { useNow } from '../hooks/useClock';
import { toggleAssignment } from '../state/discipline';
import { listItem, spring } from '../lib/motion';
import { Bar, Card, PageHeader, Ring, SampleTag, SectionTitle, cx } from '../components/ui';
import { PushupBanner } from './Daily';

function greeting(h: number) {
  if (h < 5) return 'Late night';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

export default function Home() {
  const s = useSettings();
  const now = useNow(30_000);
  const today = dayKey(now);
  const day = useLiveQuery(() => db.days.get(today), [today]);
  const days = useLiveQuery(() => db.days.toArray(), [], []);
  const foods = useLiveQuery(() => db.foods.where('date').equals(today).toArray(), [today], []);
  const weekStart = startOfWeek(today);
  const runs = useLiveQuery(() => db.runs.orderBy('startedAt').reverse().toArray(), [], []);
  const alarms = useLiveQuery(() => db.alarms.toArray(), [], []);
  const events = useLiveQuery(() => db.events.where('date').aboveOrEqual(today).sortBy('date'), [today], []);
  const hasSample = useLiveQuery(async () => (await db.runs.filter((r) => !!r.sample).count()) > 0, [], false);

  const done = day?.assignments.filter((a) => a.done).length ?? 0;
  const kcal = foods.reduce((n, f) => n + f.calories, 0);
  const protein = foods.reduce((n, f) => n + f.protein, 0);
  const weekRuns = runs.filter((r) => dayKey(new Date(r.startedAt)) >= weekStart);
  const weekKm = weekRuns.reduce((n, r) => n + r.distanceKm, 0);
  const lastRun = runs[0];
  const next = nextAlarm(alarms, now);
  const upcoming = events
    .filter((e) => atTime(e.date, e.start) >= now)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
  const closes = day ? atTime(day.date, day.deadline).getTime() - now.getTime() : 0;
  const currentStreak = streak(days, today);

  return (
    <div>
      <PageHeader
        eyebrow={fmtDay(today)}
        title={s.name ? `${greeting(now.getHours())}, ${s.name}` : greeting(now.getHours())}
        actions={
          <>
            <Link to="/stats" aria-label="Statistics" className="tap grid h-11 w-11 place-items-center rounded-full text-white/85">
              <BarChart3 size={20} />
            </Link>
            <Link to="/settings" aria-label="Settings" className="tap grid h-11 w-11 place-items-center rounded-full text-white/85">
              <Cog size={20} />
            </Link>
          </>
        }
      />

      <div className="mt-3 space-y-3">
        <PushupBanner />
        {hasSample && (
          <Card className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2">
              <SampleTag />
              <span className="text-[13px] text-mute">Preview data is showing.</span>
            </div>
            <Link to="/settings" className="text-[13px] font-semibold text-lime">
              Manage
            </Link>
          </Card>
        )}

        {/* Discipline hero */}
        <Card i={0} className="p-5">
          <div className="flex items-center gap-5">
            <Ring value={done / 3} size={112} stroke={9}>
              <div>
                <div className="num text-[34px] font-bold leading-none">
                  {done}
                  <span className="text-white/40">/3</span>
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Done</div>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Daily discipline</p>
              <p className="mt-1.5 font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">
                {day?.status === 'success' ? 'Day complete' : day?.status === 'missed' ? 'Day closed' : `${3 - done} to go`}
              </p>
              <p className="mt-1 text-[13px] text-mute">
                {day?.status === 'open' && closes > 0
                  ? `Closes ${fmtTime(day.deadline)} · ${fmtLeft(closes / 1000)} left`
                  : `Streak ${currentStreak} day${currentStreak === 1 ? '' : 's'}`}
              </p>
              {day?.status === 'open' && (
                <p className="mt-0.5 text-[13px] text-mute">
                  Streak <span className="font-semibold text-white">{currentStreak}</span>
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 space-y-1">
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
                className="tap flex w-full items-center gap-3 rounded-xl py-2 text-left"
              >
                <span
                  className={cx(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors',
                    a.done ? 'border-lime bg-lime' : 'border-white/25',
                  )}
                >
                  <AnimatePresence>
                    {a.done && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring}>
                        <Check size={14} strokeWidth={3} className="text-[#0b1400]" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className={cx('flex-1 text-[15px] transition-colors', a.done && 'text-white/45 line-through decoration-white/30')}>
                  {a.title}
                </span>
                <span className="text-[12px] text-faint">{a.category}</span>
              </motion.button>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/run">
            <Card i={1} className="h-full">
              <p className="eyebrow">Running · week</p>
              <p className="num mt-2 text-[34px] font-bold leading-none">
                {fmtDistance(weekKm, s.distanceUnit, 1)}
                <span className="ml-1 text-[15px] font-semibold text-mute">{s.distanceUnit}</span>
              </p>
              <p className="mt-2 text-[12px] text-mute">
                {weekRuns.length} run{weekRuns.length === 1 ? '' : 's'}
                {lastRun ? ` · last ${relDay(dayKey(new Date(lastRun.startedAt)), today)}` : ''}
              </p>
            </Card>
          </Link>
          <Link to="/health">
            <Card i={2} className="h-full">
              <p className="eyebrow">Nutrition · today</p>
              <p className="num mt-2 text-[34px] font-bold leading-none">
                {kcal.toLocaleString()}
                <span className="ml-1 text-[15px] font-semibold text-mute">kcal</span>
              </p>
              <Bar className="mt-3" value={s.calorieTarget ? kcal / s.calorieTarget : 0} label="Calories" />
              <p className="mt-2 text-[12px] text-mute">
                {Math.round(protein)} g protein{s.proteinTarget ? ` of ${s.proteinTarget}` : ''}
              </p>
            </Card>
          </Link>
        </div>

        <Link to="/schedule?tab=alarms" className="block">
          <Card i={3} className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Next alarm</p>
              {next ? (
                <>
                  <p className="num mt-1.5 text-[28px] font-bold leading-none">{fmtTime(next.alarm.time)}</p>
                  <p className="mt-1.5 text-[13px] text-mute">
                    {next.alarm.label || 'Alarm'} · {relDay(dayKey(next.at), today)} · in{' '}
                    {fmtLeft((next.at.getTime() - now.getTime()) / 1000)}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[15px] text-mute">No alarms set</p>
              )}
            </div>
            <ChevronRight size={20} className="text-white/30" />
          </Card>
        </Link>

        {upcoming && (
          <Link to="/schedule" className="block">
            <Card i={4} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="eyebrow flex items-center gap-2">Up next {upcoming.sample && <SampleTag />}</p>
                <p className="mt-1.5 truncate text-[17px] font-semibold">{upcoming.title}</p>
                <p className="mt-0.5 text-[13px] text-mute">
                  {relDay(upcoming.date, today)} · {fmtTime(upcoming.start)}
                </p>
              </div>
              <ChevronRight size={20} className="text-white/30" />
            </Card>
          </Link>
        )}

        <SectionTitle>More</SectionTitle>
        <Link to="/stats" className="block">
          <Card i={5} className="flex items-center justify-between">
            <span className="text-[15px] font-medium">Statistics</span>
            <ChevronRight size={20} className="text-white/30" />
          </Card>
        </Link>
      </div>
    </div>
  );
}
