import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getSettings, updateSettings, type Settings } from '../lib/settings';
import { loadSampleData } from '../lib/sample';
import { kvGet } from '../lib/db';
import { ease } from '../lib/motion';
import { Button, Field } from './ui';
import { useLiveQuery } from 'dexie-react-hooks';

export function Welcome() {
  // undefined while loading, null on a fresh install: never flash this screen for a returning user.
  const raw = useLiveQuery(async () => (await kvGet<Partial<Settings>>('settings')) ?? null, []);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const show = raw !== undefined && !raw?.onboarded;

  const finish = async (sample: boolean) => {
    setBusy(true);
    if (sample) await loadSampleData((await getSettings()).bodyWeightKg);
    await updateSettings({ name: name.trim(), onboarded: true });
    setBusy(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[90] flex flex-col bg-[var(--ink)] px-6 pb-[calc(var(--safe-bottom)+24px)] pt-[calc(var(--safe-top)+48px)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={ease}
        >
          <div className="ambient" aria-hidden />
          <motion.div
            className="relative flex-1"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...ease, delay: 0.1 }}
          >
            <p className="font-display text-[56px] font-black leading-[0.9] tracking-[-0.06em]">
              FORM<span className="text-lime">.</span>
            </p>
            <p className="mt-5 max-w-[28ch] text-[17px] leading-snug text-white/80">
              Running, nutrition, schedule, alarms and three daily assignments. Everything stays on this phone.
            </p>
            <div className="mt-10">
              <Field label="What should we call you?">
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="given-name"
                />
              </Field>
            </div>
          </motion.div>
          <motion.div
            className="relative space-y-3"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...ease, delay: 0.2 }}
          >
            <Button variant="primary" size="lg" className="w-full" disabled={busy} onClick={() => void finish(false)}>
              Start fresh
            </Button>
            <Button size="lg" className="w-full" disabled={busy} onClick={() => void finish(true)}>
              Explore with sample data
            </Button>
            <p className="px-2 text-center text-[12px] text-faint">Sample entries carry a Sample tag. Remove them any time in Settings.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
