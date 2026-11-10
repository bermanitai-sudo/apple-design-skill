import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { MapPinOff, Pause, Play, Square } from 'lucide-react';
import { kvGet } from '../../lib/db';
import { elapsedSec, judgeFix, routeDistanceKm, runCalories } from '../../lib/run';
import { fmtDistance, fmtDuration, fmtPace, fromUnitDistance, paceSec } from '../../lib/format';
import { useSettings } from '../../lib/settings';
import { useNow } from '../../hooks/useClock';
import { addFix, discardRun, finishRun, patchActiveRun, pauseRun, resumeRun, startRun, type ActiveRun as AR } from '../../state/activeRun';
import { spring } from '../../lib/motion';
import { RouteMap } from '../../components/RouteMap';
import { Button, Confirm, Field, Sheet, useToast } from '../../components/ui';

type GpsState = 'waiting' | 'ok' | 'weak' | 'denied' | 'unsupported';

export default function ActiveRun() {
  const nav = useNavigate();
  const toast = useToast();
  const s = useSettings();
  const now = useNow(250);
  const run = useLiveQuery(() => kvGet<AR>('activeRun'), []);
  const [gps, setGps] = useState<GpsState>('waiting');
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [manualKm, setManualKm] = useState('');
  const [notes, setNotes] = useState('');
  const lock = useRef<WakeLockSentinel | null>(null);

  // Arriving here without a run starts one; returning here resumes the saved one.
  useEffect(() => {
    void startRun();
  }, []);

  const running = run?.status === 'running';

  useEffect(() => {
    if (!running) return;
    if (!('geolocation' in navigator)) {
      setGps('unsupported');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        setGps(acc > 35 ? 'weak' : 'ok');
        void addFix({ lat, lng, acc, t: pos.timestamp }, judgeFix);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGps('denied');
          void patchActiveRun((r) => ({ ...r, gpsDenied: true }));
        } else setGps('weak');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [running]);

  // Keep the screen awake during a run where the browser allows it.
  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return;
    const acquire = async () => {
      try {
        lock.current = await navigator.wakeLock.request('screen');
      } catch {
        /* denied or unsupported in this context */
      }
    };
    void acquire();
    const vis = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      void lock.current?.release();
    };
  }, [running]);

  if (!run) return <div className="h-[100dvh]" />;

  const sec = elapsedSec(run.segments, now.getTime());
  const km = routeDistanceKm(run.points);
  const pace = paceSec(sec, km, s.distanceUnit);
  const noGps = gps === 'denied' || gps === 'unsupported';

  const save = async () => {
    const typed = parseFloat(manualKm.replace(',', '.'));
    const id = await finishRun(Number.isFinite(typed) ? fromUnitDistance(typed, s.distanceUnit) : undefined, notes);
    toast('Run saved');
    nav(`/run/${id}`, { replace: true });
  };

  return (
    <div className="relative flex h-[100dvh] flex-col">
      <div className="absolute inset-0 isolate z-0">
        {run.points.length > 0 ? (
          <RouteMap points={run.points} follow={running} className="rounded-none shadow-none" />
        ) : (
          <div className="grid h-full place-items-center px-10 text-center">
            <div className="text-mute">
              {noGps ? (
                <MapPinOff className="mx-auto mb-3" size={28} />
              ) : (
                <motion.div
                  className="mx-auto mb-4 h-3 w-3 rounded-full bg-lime"
                  animate={{ scale: [1, 1.8, 1], opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                />
              )}
              <p className="text-[15px]">
                {noGps
                  ? 'Location is off, so distance cannot be measured. The timer keeps running and you can enter a known distance when you finish.'
                  : 'Finding GPS signal…'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 px-4 pt-[calc(var(--safe-top)+10px)]">
        <div className="glass mx-auto flex max-w-md items-center justify-between rounded-full px-4 py-2 text-[12px] font-semibold">
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${gps === 'ok' ? 'bg-lime' : 'bg-white/40'}`} />
            {gps === 'ok' ? 'GPS' : gps === 'weak' ? 'Weak GPS' : noGps ? 'No GPS' : 'Searching'}
          </span>
          <span className="uppercase tracking-[0.1em] text-mute">{running ? 'Running' : 'Paused'}</span>
        </div>
      </div>

      <motion.div
        className="relative z-10 mt-auto px-3 pb-[calc(var(--safe-bottom)+12px)]"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={spring}
      >
        <div className="glass mx-auto max-w-md rounded-[30px] p-5">
          <p className="num text-center text-[76px] font-bold leading-none" aria-live="off">
            {fmtDuration(sec)}
          </p>
          <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 text-center">
            <Metric label={s.distanceUnit === 'km' ? 'Kilometres' : 'Miles'} value={fmtDistance(km, s.distanceUnit)} />
            <Metric label={`Avg pace /${s.distanceUnit}`} value={fmtPace(pace)} />
            <Metric label="Est. kcal" value={String(runCalories(km, s.bodyWeightKg))} />
          </div>
          <div className="mt-6 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              className="tap h-12 rounded-full px-4 text-[14px] font-medium text-white/60"
            >
              Discard
            </button>
            <motion.button
              type="button"
              layout
              whileTap={{ scale: 0.92 }}
              onClick={() => void (running ? pauseRun() : resumeRun())}
              aria-label={running ? 'Pause' : 'Resume'}
              className="grid h-[76px] w-[76px] place-items-center rounded-full bg-lime text-[#0b1400] shadow-[0_10px_30px_-8px_rgba(183,255,53,0.7)]"
            >
              {running ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
            </motion.button>
            <button
              type="button"
              onClick={() => {
                void pauseRun();
                setFinishing(true);
              }}
              className="tap flex h-12 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-[14px] font-semibold"
            >
              <Square size={14} fill="currentColor" /> Finish
            </button>
          </div>
        </div>
      </motion.div>

      <Sheet
        open={finishing}
        onClose={() => setFinishing(false)}
        title="Finish run"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                setFinishing(false);
                void resumeRun();
              }}
            >
              Keep running
            </Button>
            <Button variant="primary" onClick={() => void save()}>
              Save run
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Time" value={fmtDuration(sec)} />
          <Metric label={s.distanceUnit} value={fmtDistance(km, s.distanceUnit)} />
          <Metric label="Pace" value={fmtPace(pace)} />
        </div>
        {km < 0.01 && (
          <div className="mt-5">
            <Field
              label={`Distance (${s.distanceUnit})`}
              hint="GPS recorded no distance. Enter it only if you know it, e.g. from a treadmill."
            >
              <input
                className="field"
                inputMode="decimal"
                value={manualKm}
                onChange={(e) => setManualKm(e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>
        )}
        <div className="mt-4">
          <Field label="Notes">
            <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel?" />
          </Field>
        </div>
      </Sheet>

      <Confirm
        open={confirmDiscard}
        title="Discard this run?"
        body="The time and route will not be saved."
        confirmLabel="Discard"
        danger
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          void discardRun();
          nav('/run', { replace: true });
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1">
      <div className="num text-[26px] font-bold leading-none">{value}</div>
      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">{label}</div>
    </div>
  );
}
