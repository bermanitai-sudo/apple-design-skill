import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import { pageVariants } from './lib/motion';
import { TabBar, tabIndex } from './components/TabBar';
import { Engines } from './components/Engines';
import { Welcome } from './components/Welcome';
import Home from './pages/Home';
import Daily from './pages/Daily';

const Running = lazy(() => import('./pages/running/Running'));
const ActiveRun = lazy(() => import('./pages/running/ActiveRun'));
const RunDetail = lazy(() => import('./pages/running/RunDetail'));
const Health = lazy(() => import('./pages/health/Health'));
const Schedule = lazy(() => import('./pages/schedule/Schedule'));
const Stats = lazy(() => import('./pages/Stats'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function depth(path: string) {
  return path.split('/').filter(Boolean).length;
}

export default function App() {
  const location = useLocation();
  const prev = useRef(location.pathname);
  const [dir, setDir] = useState(1);
  const pending = useLiveQuery(() => db.pushups.where('status').equals('pending').count(), [], 0);
  const immersive = location.pathname === '/run/active';

  useEffect(() => {
    const a = prev.current;
    const b = location.pathname;
    const d = tabIndex(b) - tabIndex(a) || depth(b) - depth(a) || 1;
    setDir(Math.sign(d));
    prev.current = b;
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const section = location.pathname.split('/').slice(0, 3).join('/') || '/';

  return (
    <>
      <div className="ambient" aria-hidden />
      <div className="relative z-10 mx-auto min-h-[100dvh] max-w-md">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.main
            key={section}
            custom={dir}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className={immersive ? '' : 'px-4 pb-[calc(var(--safe-bottom)+110px)]'}
          >
            <Suspense fallback={<div className="min-h-[100dvh]" />}>
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/run" element={<Running />} />
                <Route path="/run/active" element={<ActiveRun />} />
                <Route path="/run/:id" element={<RunDetail />} />
                <Route path="/health" element={<Health />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/daily" element={<Daily />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </Suspense>
          </motion.main>
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {!immersive && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <TabBar badge={pending} />
          </motion.div>
        )}
      </AnimatePresence>
      <Engines />
      <Welcome />
    </>
  );
}
