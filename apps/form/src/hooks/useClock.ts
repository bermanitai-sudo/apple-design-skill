import { useEffect, useState } from 'react';
import { dayKey } from '../lib/date';

/** Re-renders on an interval; `ms` of 1000 for live timers, 30000 for clocks. */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const iv = window.setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms]);
  return now;
}

/** Today's local day key; flips at local midnight. */
export function useToday(): string {
  return dayKey(useNow(15_000));
}
