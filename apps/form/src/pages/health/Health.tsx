import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react';
import { db, type FoodEntry } from '../../lib/db';
import { addDays, dayKey, fmtDay, monthGrid, parseDay, relDay } from '../../lib/date';
import { useSettings } from '../../lib/settings';
import { useToday } from '../../hooks/useClock';
import { listItem } from '../../lib/motion';
import { Bar, Card, IconButton, PageHeader, Ring, SampleTag, SectionTitle, Sheet, cx } from '../../components/ui';
import { FoodEntrySheet, FoodScanSheet, MEALS } from './FoodSheets';

export function totals(foods: FoodEntry[]) {
  return {
    kcal: foods.reduce((n, f) => n + f.calories, 0),
    protein: Math.round(foods.reduce((n, f) => n + f.protein, 0) * 10) / 10,
    meals: new Set(foods.map((f) => f.meal)).size,
    items: foods.length,
  };
}

export default function Health() {
  const s = useSettings();
  const today = useToday();
  const [date, setDate] = useState<string | null>(null);
  const day = date ?? today;
  const foods = useLiveQuery(() => db.foods.where('date').equals(day).sortBy('createdAt'), [day], []);
  const [scan, setScan] = useState(false);
  const [edit, setEdit] = useState<FoodEntry | null | undefined>(undefined);
  const [calendar, setCalendar] = useState(false);
  const t = totals(foods);

  return (
    <div>
      <PageHeader
        title="Health"
        eyebrow={relDay(day, today) === 'Today' ? fmtDay(day) : `Viewing ${fmtDay(day)}`}
        actions={
          <>
            <IconButton label="History calendar" onClick={() => setCalendar(true)}>
              <CalendarDays size={20} />
            </IconButton>
            <IconButton label="Add food manually" onClick={() => setEdit(null)}>
              <Plus size={22} />
            </IconButton>
          </>
        }
      />

      <div className="mt-2 flex items-center justify-between">
        <IconButton label="Previous day" onClick={() => setDate(addDays(day, -1))}>
          <ChevronLeft size={20} />
        </IconButton>
        <button type="button" onClick={() => setCalendar(true)} className="text-[15px] font-semibold">
          {relDay(day, today)}
        </button>
        <IconButton label="Next day" onClick={() => setDate(addDays(day, 1))} disabled={day >= today} className="disabled:opacity-25">
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={day}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="mt-2 p-5">
            <div className="flex items-center gap-5">
              <Ring value={s.calorieTarget ? t.kcal / s.calorieTarget : 0} size={118} stroke={9}>
                <div>
                  <div className="num text-[28px] font-bold leading-none">{t.kcal.toLocaleString()}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">kcal</div>
                </div>
              </Ring>
              <div className="flex-1 space-y-3.5">
                <Metric label="Calories" value={`${t.kcal.toLocaleString()}`} target={s.calorieTarget} unit="kcal" />
                <Metric
                  label="Protein"
                  value={`${t.protein}`}
                  target={s.proteinTarget}
                  unit="g"
                  ratio={s.proteinTarget ? t.protein / s.proteinTarget : 0}
                />
                <p className="text-[12px] text-mute">
                  {t.items} item{t.items === 1 ? '' : 's'} · {t.meals} meal{t.meals === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            {(!s.calorieTarget || !s.proteinTarget) && (
              <Link to="/settings" className="mt-4 block text-[13px] text-mute">
                No tracking targets set. <span className="font-semibold text-lime">Set your own</span>
              </Link>
            )}
          </Card>

          <motion.button
            type="button"
            onClick={() => setScan(true)}
            whileTap={{ scale: 0.98 }}
            className="mt-3 flex h-16 w-full items-center justify-center gap-3 rounded-[20px] bg-lime text-[17px] font-semibold text-[#0b1400] shadow-[0_16px_40px_-14px_rgba(183,255,53,0.7)]"
          >
            <Camera size={22} /> Scan food
          </motion.button>

          {MEALS.map((m) => {
            const rows = foods.filter((f) => f.meal === m.value);
            const kcal = rows.reduce((n, f) => n + f.calories, 0);
            return (
              <section key={m.value}>
                <SectionTitle action={<span className="num text-[13px] text-mute">{kcal} kcal</span>}>
                  {m.label}
                  {m.value === 'snack' ? 's' : ''}
                </SectionTitle>
                {rows.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setEdit(null)}
                    className="surface-flat tap w-full px-4 py-3.5 text-left text-[14px] text-faint"
                  >
                    Nothing logged
                  </button>
                ) : (
                  <div className="surface divide-y divide-white/[0.06] overflow-hidden p-0">
                    <AnimatePresence initial={false}>
                      {rows.map((f, i) => (
                        <motion.button
                          key={f.id}
                          layout
                          variants={listItem}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          custom={i}
                          type="button"
                          onClick={() => setEdit(f)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/[0.03]"
                        >
                          {f.photo ? (
                            <img src={f.photo} alt="" className="media h-11 w-11 shrink-0 rounded-[10px] object-cover" />
                          ) : (
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-white/[0.06] text-[15px] font-semibold text-white/60">
                              {f.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[15px] font-medium">{f.name}</span>
                              {f.sample && <SampleTag />}
                            </div>
                            <div className="mt-0.5 text-[12px] text-mute">
                              {f.grams ? `${f.grams} g · ` : ''}
                              {f.protein} g protein{f.source === 'ai' ? ' · photo estimate' : ''}
                            </div>
                          </div>
                          <span className="num text-[17px] font-semibold">{f.calories}</span>
                        </motion.button>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <FoodScanSheet
        open={scan}
        onClose={() => setScan(false)}
        date={day}
        onManual={() => {
          setScan(false);
          setEdit(null);
        }}
      />
      <FoodEntrySheet open={edit !== undefined} onClose={() => setEdit(undefined)} date={day} entry={edit} />
      <HistoryCalendar
        open={calendar}
        onClose={() => setCalendar(false)}
        selected={day}
        onPick={(k) => {
          setDate(k === today ? null : k);
          setCalendar(false);
        }}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  target,
  unit,
  ratio,
}: {
  label: string;
  value: string;
  target: number | null;
  unit: string;
  ratio?: number;
}) {
  const r = ratio ?? (target ? parseFloat(value.replace(/,/g, '')) / target : 0);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-mute">{label}</span>
        <span className="num font-semibold">
          {value}
          <span className="text-mute">
            {target ? ` / ${target.toLocaleString()}` : ''} {unit}
          </span>
        </span>
      </div>
      <Bar className="mt-1.5" value={target ? r : 0} label={label} />
    </div>
  );
}

function HistoryCalendar({
  open,
  onClose,
  selected,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  selected: string;
  onPick: (k: string) => void;
}) {
  const today = useToday();
  const [month, setMonth] = useState(selected);
  const grid = monthGrid(month);
  const m = parseDay(month);
  const sums = useLiveQuery(
    async () => {
      const rows = await db.foods.where('date').between(grid[0], grid[41], true, true).toArray();
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.date, (map.get(r.date) ?? 0) + r.calories);
      return map;
    },
    [grid[0]],
    new Map<string, number>(),
  );
  return (
    <Sheet open={open} onClose={onClose} title="Food history">
      <div className="flex items-center justify-between pb-3">
        <IconButton label="Previous month" onClick={() => setMonth(dayKey(new Date(m.getFullYear(), m.getMonth() - 1, 1)))}>
          <ChevronLeft size={20} />
        </IconButton>
        <span className="text-[16px] font-semibold">{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
        <IconButton label="Next month" onClick={() => setMonth(dayKey(new Date(m.getFullYear(), m.getMonth() + 1, 1)))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1 pb-4 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="pb-1 text-[11px] font-semibold text-faint">
            {d}
          </span>
        ))}
        {grid.map((k) => {
          const inMonth = parseDay(k).getMonth() === m.getMonth();
          const kcal = sums.get(k);
          const future = k > today;
          return (
            <button
              key={k}
              type="button"
              disabled={future}
              onClick={() => onPick(k)}
              className={cx(
                'flex h-12 flex-col items-center justify-center rounded-[12px] text-[15px] transition-colors disabled:opacity-25',
                k === selected ? 'bg-lime font-semibold text-[#0b1400]' : 'hover:bg-white/[0.05]',
                !inMonth && k !== selected && 'text-white/30',
              )}
            >
              {parseDay(k).getDate()}
              <span
                className={cx('mt-0.5 h-1 w-1 rounded-full', kcal ? (k === selected ? 'bg-[#0b1400]' : 'bg-lime') : 'bg-transparent')}
              />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
