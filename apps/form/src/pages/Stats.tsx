import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Bar as RBar, BarChart, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft } from 'lucide-react';
import { db } from '../lib/db';
import { addDays, dayKey, fmtDay, parseDay, startOfWeek } from '../lib/date';
import { fmtDistance, fmtPace, paceSec, toUnitDistance } from '../lib/format';
import { streak } from '../lib/assignments';
import { useSettings } from '../lib/settings';
import { useToday } from '../hooks/useClock';
import { Card, PageHeader, SectionTitle } from '../components/ui';

const axis = { fill: 'rgba(255,255,255,0.45)', fontSize: 11 };
const tooltip = {
  contentStyle: { background: 'rgba(26,26,26,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: 'rgba(255,255,255,0.6)' },
  itemStyle: { color: '#fff' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

export default function Stats() {
  const s = useSettings();
  const nav = useNavigate();
  const today = useToday();
  const u = s.distanceUnit;
  const runs = useLiveQuery(() => db.runs.toArray(), [], []);
  const days = useLiveQuery(() => db.days.toArray(), [], []);
  const from = addDays(today, -13);
  const foods = useLiveQuery(() => db.foods.where('date').between(from, today, true, true).toArray(), [from, today], []);

  const totalKm = runs.reduce((n, r) => n + r.distanceKm, 0);
  const totalSec = runs.reduce((n, r) => n + r.durationSec, 0);

  const thisWeek = startOfWeek(today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, (i - 7) * 7));
  const weekly = weeks.map((w) => ({
    label: fmtDay(w, { month: 'numeric', day: 'numeric' }),
    v:
      Math.round(
        toUnitDistance(
          runs.filter((r) => startOfWeek(dayKey(new Date(r.startedAt))) === w).reduce((n, r) => n + r.distanceKm, 0),
          u,
        ) * 10,
      ) / 10,
  }));

  const daily = Array.from({ length: 14 }, (_, i) => addDays(from, i)).map((k) => {
    const f = foods.filter((x) => x.date === k);
    return {
      label: String(parseDay(k).getDate()),
      kcal: f.reduce((n, x) => n + x.calories, 0),
      protein: Math.round(f.reduce((n, x) => n + x.protein, 0)),
    };
  });

  const closed = days.filter((d) => d.evaluatedAt);
  const completed = days.reduce((n, d) => n + d.assignments.filter((a) => a.done).length, 0);
  const possible = closed.length * 3;
  const closedDone = closed.reduce((n, d) => n + d.assignments.filter((a) => a.done).length, 0);
  const missed = closed.filter((d) => d.status === 'missed').length;

  return (
    <div>
      <PageHeader
        eyebrow={
          <button type="button" onClick={() => nav('/')} className="-ml-1 flex items-center gap-0.5 text-lime">
            <ChevronLeft size={16} /> Home
          </button>
        }
        title="Statistics"
      />

      <SectionTitle>Running</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Tile label={`Total ${u}`} value={fmtDistance(totalKm, u, 1)} />
        <Tile label="Runs" value={String(runs.length)} />
        <Tile label={`Avg pace /${u}`} value={fmtPace(paceSec(totalSec, totalKm, u))} />
      </div>
      <Card className="mt-3">
        <p className="eyebrow">Weekly distance · {u}</p>
        <div className="mt-3 h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} />
              <YAxis tickLine={false} axisLine={false} tick={axis} width={40} allowDecimals={false} />
              <Tooltip {...tooltip} formatter={(v: number) => [`${v} ${u}`, 'Distance']} />
              <RBar dataKey="v" radius={[5, 5, 2, 2]} minPointSize={2}>
                {weekly.map((_, i) => (
                  <Cell key={i} fill={i === weekly.length - 1 ? '#B7FF35' : 'rgba(255,255,255,0.28)'} />
                ))}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <SectionTitle>Nutrition · 14 days</SectionTitle>
      <Card>
        <p className="eyebrow">Calories</p>
        <div className="mt-3 h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 8, right: 0, left: -4, bottom: 0 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} interval={1} />
              <YAxis tickLine={false} axisLine={false} tick={axis} width={46} />
              <Tooltip {...tooltip} formatter={(v: number) => [`${v} kcal`, 'Calories']} />
              {s.calorieTarget && <ReferenceLine y={s.calorieTarget} stroke="rgba(255,255,255,0.5)" strokeDasharray="4 4" />}
              <RBar dataKey="kcal" radius={[5, 5, 2, 2]} fill="#B7FF35" minPointSize={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="mt-3">
        <p className="eyebrow">Protein · g</p>
        <div className="mt-3 h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} interval={1} />
              <YAxis tickLine={false} axisLine={false} tick={axis} width={40} />
              <Tooltip {...tooltip} formatter={(v: number) => [`${v} g`, 'Protein']} />
              {s.proteinTarget && <ReferenceLine y={s.proteinTarget} stroke="rgba(255,255,255,0.5)" strokeDasharray="4 4" />}
              <Line type="monotone" dataKey="protein" stroke="#ffffff" strokeWidth={2} dot={{ r: 2.5, fill: '#B7FF35', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <SectionTitle>Discipline</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Completion" value={possible ? `${Math.round((closedDone / possible) * 100)}%` : '—'} accent />
        <Tile label="Current streak" value={`${streak(days, today)}`} />
        <Tile label="Assignments done" value={String(completed)} />
        <Tile label="Missed days" value={String(missed)} />
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="px-3.5 py-3.5">
      <p className={`num text-[26px] font-bold leading-none ${accent ? 'text-lime' : ''}`}>{value}</p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">{label}</p>
    </Card>
  );
}
