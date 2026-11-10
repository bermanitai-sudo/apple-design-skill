import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Check, ImagePlus } from 'lucide-react';
import { db, type Confidence, type FoodEntry, type Meal } from '../../lib/db';
import { resizeImage } from '../../lib/image';
import { api, ApiError } from '../../lib/api';
import type { FoodAnalysis } from '../../lib/foodSchema';
import { listItem, spring } from '../../lib/motion';
import { Button, Confirm, Field, Segmented, Sheet, cx, useToast } from '../../components/ui';

export const MEALS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

export function mealForNow(d = new Date()): Meal {
  const h = d.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snack';
}

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/* ── Manual add / edit ───────────────────────────────── */

export function FoodEntrySheet({
  open,
  onClose,
  date,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  entry?: FoodEntry | null;
}) {
  const toast = useToast();
  const [meal, setMeal] = useState<Meal>(mealForNow());
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMeal(entry?.meal ?? mealForNow());
    setName(entry?.name ?? '');
    setGrams(entry ? String(entry.grams) : '');
    setKcal(entry ? String(entry.calories) : '');
    setProtein(entry ? String(entry.protein) : '');
  }, [open, entry]);

  const save = async () => {
    const row = {
      meal,
      name: name.trim(),
      grams: num(grams),
      calories: Math.round(num(kcal)),
      protein: Math.round(num(protein) * 10) / 10,
    };
    if (entry?.id) await db.foods.update(entry.id, row);
    else await db.foods.add({ ...row, date, source: 'manual', createdAt: Date.now() });
    toast(entry ? 'Entry updated' : 'Added to log');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? 'Edit food' : 'Add food'}
      footer={
        <div className={cx('grid gap-2', entry ? 'grid-cols-2' : 'grid-cols-1')}>
          {entry && (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <Button variant="primary" disabled={!name.trim()} onClick={() => void save()}>
            {entry ? 'Save' : 'Add to log'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {entry?.photo && <img src={entry.photo} alt="" className="media h-40 w-full object-cover" />}
        <Segmented value={meal} onChange={setMeal} options={MEALS} />
        <Field label="Food">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken rice bowl" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Grams">
            <input className="field" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="0" />
          </Field>
          <Field label="kcal">
            <input className="field" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Protein g">
            <input className="field" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="0" />
          </Field>
        </div>
        {entry?.source === 'ai' && (
          <p className="px-1 text-[12px] text-faint">
            Estimated from a photo{entry.confidence ? ` · ${entry.confidence} confidence` : ''}. Edit anything that looks off.
          </p>
        )}
      </div>
      <Confirm
        open={confirmDelete}
        title="Delete this entry?"
        body="Your daily totals update straight away."
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          void db.foods.delete(entry!.id!);
          onClose();
        }}
      />
    </Sheet>
  );
}

/* ── Photo scan ──────────────────────────────────────── */

interface Draft {
  name: string;
  grams: string;
  kcal: string;
  protein: string;
  confidence: Confidence;
  note: string;
  confirmed: boolean;
  include: boolean;
  perGram: { kcal: number; protein: number };
}

type Phase =
  | { kind: 'pick' }
  | { kind: 'analyzing' }
  | { kind: 'review'; analysis: FoodAnalysis }
  | { kind: 'error'; message: string; status: number };

export function FoodScanSheet({
  open,
  onClose,
  date,
  onManual,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  onManual: () => void;
}) {
  const toast = useToast();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });
  const [preview, setPreview] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [meal, setMeal] = useState<Meal>(mealForNow());

  useEffect(() => {
    if (open) {
      setPhase({ kind: 'pick' });
      setPreview(null);
      setDrafts([]);
      setMeal(mealForNow());
    }
  }, [open]);

  const analyze = async (file: File) => {
    setPhase({ kind: 'analyzing' });
    try {
      const [big, small] = await Promise.all([resizeImage(file, 1024, 0.8), resizeImage(file, 320, 0.7)]);
      setPreview(big);
      setThumb(small);
      const analysis = await api<FoodAnalysis>('/api/analyze-food', { image: big });
      setDrafts(
        analysis.items.map((it) => ({
          name: it.name,
          grams: String(Math.round(it.grams)),
          kcal: String(Math.round(it.calories)),
          protein: String(Math.round(it.protein * 10) / 10),
          confidence: it.confidence,
          note: it.note,
          confirmed: it.confidence === 'high',
          include: true,
          perGram: { kcal: it.grams > 0 ? it.calories / it.grams : 0, protein: it.grams > 0 ? it.protein / it.grams : 0 },
        })),
      );
      setPhase({ kind: 'review', analysis });
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;
      setPhase({ kind: 'error', status, message: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void analyze(f);
  };

  const update = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setGrams = (i: number, g: string) => {
    const d = drafts[i];
    const n = num(g);
    update(i, {
      grams: g,
      ...(d.perGram.kcal > 0 && {
        kcal: String(Math.round(n * d.perGram.kcal)),
        protein: String(Math.round(n * d.perGram.protein * 10) / 10),
      }),
    });
  };

  const chosen = drafts.filter((d) => d.include);
  const needsConfirm = chosen.some((d) => !d.confirmed);

  const add = async () => {
    const now = Date.now();
    await db.foods.bulkAdd(
      chosen.map((d, i) => ({
        date,
        meal,
        name: d.name.trim() || 'Food',
        grams: num(d.grams),
        calories: Math.round(num(d.kcal)),
        protein: Math.round(num(d.protein) * 10) / 10,
        source: 'ai' as const,
        confidence: d.confidence,
        photo: i === 0 ? (thumb ?? undefined) : undefined,
        createdAt: now + i,
      })),
    );
    toast(`${chosen.length} item${chosen.length === 1 ? '' : 's'} added`);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Scan food"
      footer={
        phase.kind === 'review' && drafts.length > 0 ? (
          <div className="space-y-3">
            <Segmented value={meal} onChange={setMeal} options={MEALS} />
            <Button variant="primary" className="w-full" disabled={!chosen.length || needsConfirm} onClick={() => void add()}>
              {needsConfirm
                ? 'Confirm the flagged items'
                : `Add ${chosen.length} to ${MEALS.find((m) => m.value === meal)!.label.toLowerCase()}`}
            </Button>
          </div>
        ) : undefined
      }
    >
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={library} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <AnimatePresence mode="wait" initial={false}>
        {phase.kind === 'pick' && (
          <motion.div
            key="pick"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3 pb-2"
          >
            <p className="text-[14px] text-mute">
              Photograph the whole plate from above, in good light. You review every estimate before it is logged.
            </p>
            <button
              type="button"
              onClick={() => camera.current?.click()}
              className="surface tap flex w-full items-center gap-4 p-4 text-left"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-lime text-[#0b1400]">
                <Camera size={22} />
              </span>
              <span>
                <span className="block text-[16px] font-semibold">Take a photo</span>
                <span className="block text-[13px] text-mute">Opens the camera</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => library.current?.click()}
              className="surface tap flex w-full items-center gap-4 p-4 text-left"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.08]">
                <ImagePlus size={22} />
              </span>
              <span>
                <span className="block text-[16px] font-semibold">Choose from library</span>
                <span className="block text-[13px] text-mute">Any photo of food</span>
              </span>
            </button>
            <Button variant="ghost" className="w-full" onClick={onManual}>
              Enter manually instead
            </Button>
          </motion.div>
        )}

        {phase.kind === 'analyzing' && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-4">
            <div className="media relative h-64 bg-white/[0.04]">
              {preview && <img src={preview} alt="Your food" className="h-full w-full object-cover" />}
              <motion.div
                className="absolute inset-x-0 h-16 bg-[linear-gradient(to_bottom,transparent,rgba(183,255,53,0.35),transparent)]"
                animate={{ top: ['-15%', '100%'] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
              />
            </div>
            <p className="mt-4 text-center text-[15px] text-mute">Identifying food and estimating portions…</p>
          </motion.div>
        )}

        {phase.kind === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3 pb-2"
          >
            <div className="surface-flat p-4">
              <p className="text-[15px] font-semibold">Could not analyse the photo</p>
              <p className="mt-1 text-[14px] text-mute">{phase.message}</p>
              {phase.status === 401 && <p className="mt-2 text-[13px] text-mute">Enter your access code in Settings → Private access.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setPhase({ kind: 'pick' })}>Try again</Button>
              <Button onClick={onManual}>Enter manually</Button>
            </div>
          </motion.div>
        )}

        {phase.kind === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3 pb-2"
          >
            {preview && <img src={preview} alt="Your food" className="media h-40 w-full object-cover" />}
            {!phase.analysis.is_food || drafts.length === 0 ? (
              <div className="surface-flat p-4">
                <p className="text-[15px] font-semibold">No food recognised</p>
                <p className="mt-1 text-[14px] text-mute">Try a clearer photo, or enter it manually.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button onClick={() => setPhase({ kind: 'pick' })}>New photo</Button>
                  <Button onClick={onManual}>Enter manually</Button>
                </div>
              </div>
            ) : (
              <>
                {phase.analysis.question && (
                  <div className="rounded-[14px] border border-lime/40 bg-lime/[0.06] p-3.5 text-[14px]">
                    <span className="font-semibold text-lime">Check · </span>
                    {phase.analysis.question}
                  </div>
                )}
                {drafts.map((d, i) => (
                  <motion.div
                    key={i}
                    variants={listItem}
                    initial="hidden"
                    animate="show"
                    custom={i}
                    className={cx('surface p-3.5', !d.include && 'opacity-45')}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none"
                        value={d.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                        aria-label="Food name"
                      />
                      <ConfidenceChip c={d.confidence} />
                    </div>
                    {d.note && <p className="mt-1 text-[12px] text-mute">{d.note}</p>}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <MiniField label="g" value={d.grams} onChange={(v) => setGrams(i, v)} />
                      <MiniField label="kcal" value={d.kcal} onChange={(v) => update(i, { kcal: v })} />
                      <MiniField label="protein" value={d.protein} onChange={(v) => update(i, { protein: v })} />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        className="text-[13px] font-medium text-mute"
                        onClick={() => update(i, { include: !d.include })}
                      >
                        {d.include ? 'Remove' : 'Include'}
                      </button>
                      {d.include && !d.confirmed && (
                        <motion.button
                          type="button"
                          layout
                          transition={spring}
                          onClick={() => update(i, { confirmed: true })}
                          className="flex h-8 items-center gap-1.5 rounded-full border border-lime/50 px-3 text-[13px] font-semibold text-lime"
                        >
                          <Check size={14} /> Looks right
                        </motion.button>
                      )}
                      {d.include && d.confirmed && d.confidence !== 'high' && <span className="text-[12px] text-lime">Confirmed</span>}
                    </div>
                  </motion.div>
                ))}
                <p className="px-1 text-[12px] text-faint">
                  Estimates from a photo. Change the grams and calories and protein scale with it.
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

function ConfidenceChip({ c }: { c: Confidence }) {
  return (
    <span
      className={cx(
        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]',
        c === 'high' ? 'bg-lime/15 text-lime' : c === 'medium' ? 'bg-white/10 text-white/80' : 'border border-white/30 text-white/80',
      )}
    >
      {c === 'high' ? 'High confidence' : c === 'medium' ? 'Medium · confirm' : 'Low · confirm'}
    </span>
  );
}

function MiniField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block rounded-[10px] bg-white/[0.05] px-2.5 py-1.5">
      <input
        className="num w-full bg-transparent text-[17px] font-semibold outline-none"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">{label}</span>
    </label>
  );
}
