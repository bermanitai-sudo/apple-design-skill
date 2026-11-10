import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { db } from '../../lib/db';
import { dayKey, fmtDay } from '../../lib/date';
import { fmtDistance, fmtDuration, fmtPace, paceSec, speed } from '../../lib/format';
import { useSettings } from '../../lib/settings';
import { RouteMap } from '../../components/RouteMap';
import { Card, Confirm, Empty, IconButton, PageHeader, SampleTag } from '../../components/ui';

export default function RunDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const s = useSettings();
  const run = useLiveQuery(() => db.runs.get(Number(id)), [id], null);
  const [confirm, setConfirm] = useState(false);
  const u = s.distanceUnit;
  if (run === null) return null;
  if (!run) return <Empty title="Run not found" />;
  const d = new Date(run.startedAt);

  return (
    <div>
      <PageHeader
        eyebrow={
          <button type="button" onClick={() => nav('/run')} className="-ml-1 flex items-center gap-0.5 text-lime">
            <ChevronLeft size={16} /> Running
          </button>
        }
        title={fmtDay(dayKey(d), { weekday: 'long', month: 'short', day: 'numeric' })}
        actions={
          <IconButton label="Delete run" onClick={() => setConfirm(true)}>
            <Trash2 size={19} />
          </IconButton>
        }
      />
      <p className="flex items-center gap-2 px-1 text-[13px] text-mute">
        {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {run.source === 'gps' ? 'GPS tracked' : 'Manual entry'}{' '}
        {run.sample && <SampleTag />}
      </p>
      {run.route && run.route.length > 1 && (
        <div className="mt-4 h-[260px]">
          <RouteMap points={run.route} />
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          [u === 'km' ? 'Distance (km)' : 'Distance (mi)', fmtDistance(run.distanceKm, u)],
          ['Time', fmtDuration(run.durationSec)],
          [`Avg pace /${u}`, fmtPace(paceSec(run.durationSec, run.distanceKm, u))],
          [`Avg speed ${u}/h`, speed(run.durationSec, run.distanceKm, u).toFixed(1)],
          ['Calories (est.)', String(run.calories)],
          ['GPS points', run.route ? String(run.route.length) : '—'],
        ].map(([k, v], i) => (
          <Card key={k} i={i}>
            <p className="eyebrow">{k}</p>
            <p className="num mt-2 text-[28px] font-bold leading-none">{v}</p>
          </Card>
        ))}
      </div>
      {run.notes && (
        <Card className="mt-3">
          <p className="eyebrow">Notes</p>
          <p className="mt-1.5 text-[15px]">{run.notes}</p>
        </Card>
      )}
      <p className="mt-4 px-1 text-[12px] text-faint">Calories use about 1 kcal per kg of body weight per km, an estimate.</p>
      <Confirm
        open={confirm}
        title="Delete this run?"
        body="This cannot be undone."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          void db.runs.delete(run.id!);
          nav('/run', { replace: true });
        }}
      />
    </div>
  );
}
