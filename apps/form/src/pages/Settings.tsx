import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../lib/db';
import { updateSettings, useSettings, type Settings } from '../lib/settings';
import { fromUnitWeight, round, toUnitWeight } from '../lib/format';
import { applyDeadline } from '../state/discipline';
import { downloadBlob, downloadJson, eraseEverything, exportBackup, parseBackup, restoreBackup } from '../lib/backup';
import { buildIcs } from '../lib/ics';
import { clearSampleData, hasSampleData, loadSampleData } from '../lib/sample';
import { dayKey } from '../lib/date';
import { Button, Card, Confirm, PageHeader, SectionTitle, Segmented, Toggle, useToast } from '../components/ui';

/** Number input that commits on blur so typing never fights the live query. */
function NumberSetting({
  value,
  onCommit,
  placeholder,
  suffix,
  allowEmpty,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  placeholder?: string;
  suffix: string;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => setText(value == null ? '' : String(value)), [value]);
  return (
    <span className="flex items-center gap-1.5">
      <input
        className="num w-20 rounded-[10px] bg-white/[0.06] px-2.5 py-1.5 text-right text-[16px] font-semibold outline-none focus:bg-white/[0.1]"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = parseFloat(text.replace(',', '.'));
          if (text.trim() === '' && allowEmpty) onCommit(null);
          else if (Number.isFinite(n) && n >= 0) onCommit(n);
          else setText(value == null ? '' : String(value));
        }}
      />
      <span className="w-9 text-[13px] text-mute">{suffix}</span>
    </span>
  );
}

function Line({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <div className="text-[15px]">{label}</div>
        {sub && <div className="mt-0.5 text-[12px] text-mute">{sub}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <Card className="divide-y divide-white/[0.06] p-0">{children}</Card>;
}

export default function SettingsPage() {
  const s = useSettings();
  const nav = useNavigate();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const sample = useLiveQuery(hasSampleData, [], false);
  const [confirm, setConfirm] = useState<null | 'erase' | 'restore'>(null);
  const [pending, setPending] = useState<ReturnType<typeof parseBackup> | null>(null);
  const set = (p: Partial<Settings>) => void updateSettings(p);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setPending(parseBackup(await f.text()));
      setConfirm('restore');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not read that file');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={
          <button type="button" onClick={() => nav('/')} className="-ml-1 flex items-center gap-0.5 text-lime">
            <ChevronLeft size={16} /> Home
          </button>
        }
        title="Settings"
      />

      <SectionTitle>Profile</SectionTitle>
      <Group>
        <Line label="Name">
          <input
            className="w-40 rounded-[10px] bg-white/[0.06] px-2.5 py-1.5 text-right text-[16px] outline-none focus:bg-white/[0.1]"
            defaultValue={s.name}
            key={s.name}
            onBlur={(e) => set({ name: e.target.value.trim() })}
            placeholder="Your name"
          />
        </Line>
        <Line label="Distance">
          <Segmented
            className="w-32"
            value={s.distanceUnit}
            onChange={(v) => set({ distanceUnit: v })}
            options={[
              { value: 'km', label: 'km' },
              { value: 'mi', label: 'mi' },
            ]}
          />
        </Line>
        <Line label="Weight">
          <Segmented
            className="w-32"
            value={s.weightUnit}
            onChange={(v) => set({ weightUnit: v })}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />
        </Line>
        <Line label="Body weight" sub="Used only for calorie estimates on runs">
          <NumberSetting
            value={round(toUnitWeight(s.bodyWeightKg, s.weightUnit), 1)}
            suffix={s.weightUnit}
            onCommit={(v) => v && set({ bodyWeightKg: fromUnitWeight(v, s.weightUnit) })}
          />
        </Line>
      </Group>

      <SectionTitle>Tracking goals</SectionTitle>
      <Group>
        <Line label="Daily calories" sub="Your own number. Leave empty for no target.">
          <NumberSetting
            value={s.calorieTarget}
            allowEmpty
            placeholder="—"
            suffix="kcal"
            onCommit={(v) => set({ calorieTarget: v ? Math.round(v) : null })}
          />
        </Line>
        <Line label="Daily protein">
          <NumberSetting
            value={s.proteinTarget}
            allowEmpty
            placeholder="—"
            suffix="g"
            onCommit={(v) => set({ proteinTarget: v ? Math.round(v) : null })}
          />
        </Line>
      </Group>

      <SectionTitle>Alarms & discipline</SectionTitle>
      <Group>
        <Link to="/schedule?tab=alarms" className="flex min-h-[56px] items-center justify-between px-4">
          <span className="text-[15px]">Alarm schedule</span>
          <ChevronRight size={18} className="text-white/30" />
        </Link>
        <Line label="Timer after alarm" sub="Starts when you dismiss an alarm">
          <NumberSetting
            value={s.alarmTimerMinutes}
            suffix="min"
            onCommit={(v) => v != null && set({ alarmTimerMinutes: Math.min(240, Math.round(v)) })}
          />
        </Line>
        <Line label="Assignment deadline" sub="Unfinished assignments count as missed after this">
          <input
            type="time"
            className="num rounded-[10px] bg-white/[0.06] px-2.5 py-1.5 text-[16px] font-semibold outline-none"
            value={s.assignmentDeadline}
            onChange={(e) => e.target.value && void applyDeadline(e.target.value)}
            aria-label="Assignment deadline"
          />
        </Line>
        <Line label="Accountability push-ups" sub="Pending after a missed day">
          <NumberSetting value={s.pushupReps} suffix="reps" onCommit={(v) => v && set({ pushupReps: Math.round(v) })} />
        </Line>
      </Group>

      <SectionTitle>Notifications</SectionTitle>
      <Group>
        {(
          [
            ['alarms', 'Alarms'],
            ['events', 'Event reminders'],
            ['assignments', 'Deadline reminder', 'One hour before, if assignments are open'],
            ['pushups', 'Push-up challenges'],
          ] as const
        ).map(([k, label, sub]) => (
          <Line key={k} label={label} sub={sub}>
            <Toggle checked={s.notify[k]} onChange={(v) => set({ notify: { ...s.notify, [k]: v } })} label={label} />
          </Line>
        ))}
      </Group>

      <SectionTitle>Appearance</SectionTitle>
      <Group>
        <Line label="Background">
          <Segmented
            className="w-40"
            value={s.theme}
            onChange={(v) => set({ theme: v })}
            options={[
              { value: 'dark', label: 'Black' },
              { value: 'oled', label: 'True black' },
            ]}
          />
        </Line>
        <Line label="Solid surfaces" sub="Turns off glass blur">
          <Toggle checked={s.solid} onChange={(v) => set({ solid: v })} label="Solid surfaces" />
        </Line>
        <Line label="Reduce motion">
          <Toggle checked={s.reduceMotion} onChange={(v) => set({ reduceMotion: v })} label="Reduce motion" />
        </Line>
      </Group>

      <SectionTitle>Private access</SectionTitle>
      <Group>
        <Line label="Access code" sub="Must match APP_ACCESS_CODE on your server">
          <input
            type="password"
            autoComplete="off"
            className="w-36 rounded-[10px] bg-white/[0.06] px-2.5 py-1.5 text-right text-[16px] outline-none focus:bg-white/[0.1]"
            defaultValue={s.accessCode}
            key={s.accessCode}
            onBlur={(e) => set({ accessCode: e.target.value.trim() })}
            placeholder="Not set"
          />
        </Line>
      </Group>

      <SectionTitle>Data</SectionTitle>
      <Card className="space-y-2">
        <p className="pb-1 text-[13px] text-mute">
          Everything is stored on this device only. Export a backup regularly; deleting the Home Screen app deletes its data.
        </p>
        <Button className="w-full" onClick={() => void exportBackup().then((b) => downloadJson(b, `form-backup-${dayKey()}.json`))}>
          Export backup
        </Button>
        <Button className="w-full" onClick={() => file.current?.click()}>
          Import backup
        </Button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onImport(e)} />
        <Button
          className="w-full"
          onClick={() =>
            void Promise.all([db.alarms.toArray(), db.events.toArray()]).then(([a, e]) =>
              downloadBlob(new Blob([buildIcs(a, e)], { type: 'text/calendar' }), 'form-alarms.ics'),
            )
          }
        >
          Export alarms & events to Calendar
        </Button>
        {sample ? (
          <Button className="w-full" onClick={() => void clearSampleData().then(() => toast('Sample data removed'))}>
            Remove sample data
          </Button>
        ) : (
          <Button className="w-full" onClick={() => void loadSampleData(s.bodyWeightKg).then(() => toast('Sample data added'))}>
            Add sample data
          </Button>
        )}
        <Button variant="danger" className="w-full" onClick={() => setConfirm('erase')}>
          Erase all data
        </Button>
      </Card>

      <p className="mt-6 px-1 text-center text-[12px] text-faint">FORM · personal use · no account, no tracking</p>

      <Confirm
        open={confirm === 'restore'}
        title="Replace all data?"
        body={`Restores the backup from ${pending ? new Date(pending.exportedAt).toLocaleString() : ''}. Current data on this phone is replaced.`}
        confirmLabel="Restore"
        onClose={() => setConfirm(null)}
        onConfirm={() => void restoreBackup(pending!).then(() => toast('Backup restored'))}
      />
      <Confirm
        open={confirm === 'erase'}
        title="Erase everything?"
        body="Runs, food, alarms, events and history are deleted from this phone. Export a backup first."
        confirmLabel="Erase"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => void eraseEverything().then(() => window.location.assign('/'))}
      />
    </div>
  );
}
