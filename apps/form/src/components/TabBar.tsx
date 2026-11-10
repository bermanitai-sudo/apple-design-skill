import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, CircleCheck, Footprints, House, Salad } from 'lucide-react';
import { spring } from '../lib/motion';
import { cx } from './ui';

export const TABS = [
  { to: '/', label: 'Home', Icon: House },
  { to: '/run', label: 'Run', Icon: Footprints },
  { to: '/health', label: 'Health', Icon: Salad },
  { to: '/schedule', label: 'Schedule', Icon: CalendarDays },
  { to: '/daily', label: 'Daily', Icon: CircleCheck },
] as const;

export function tabIndex(path: string): number {
  if (path === '/' || path.startsWith('/stats') || path.startsWith('/settings')) return 0;
  const i = TABS.findIndex((t) => t.to !== '/' && path.startsWith(t.to));
  return i < 0 ? 0 : i;
}

export function TabBar({ badge }: { badge?: number }) {
  const { pathname } = useLocation();
  const active = tabIndex(pathname);
  return (
    <nav aria-label="Sections" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(var(--safe-bottom)+10px)]">
      <div className="glass pointer-events-auto mx-auto flex h-[62px] max-w-[420px] items-stretch rounded-full p-1.5">
        {TABS.map(({ to, label, Icon }, i) => {
          const on = i === active;
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={on ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-[3px] rounded-full"
            >
              {on && (
                <motion.span
                  layoutId="tab-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-full bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                />
              )}
              <span className="relative">
                <Icon size={21} strokeWidth={on ? 2.3 : 1.8} className={cx('transition-colors', on ? 'text-lime' : 'text-white/70')} />
                {i === 4 && !!badge && (
                  <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-lime px-1 text-[10px] font-bold text-[#0b1400]">
                    {badge}
                  </span>
                )}
              </span>
              <span className={cx('relative text-[10px] font-semibold tracking-[0.01em]', on ? 'text-white' : 'text-white/60')}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
