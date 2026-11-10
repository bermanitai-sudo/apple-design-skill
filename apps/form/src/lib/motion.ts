import type { Transition, Variants } from 'framer-motion';

export const spring: Transition = { type: 'spring', stiffness: 440, damping: 38, mass: 0.9 };
export const softSpring: Transition = { type: 'spring', stiffness: 260, damping: 32 };
export const ease: Transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };

/** Page moves follow the tab direction: forward slides in from the right, back from the left. */
export const pageVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28, scale: 0.995 }),
  center: { opacity: 1, x: 0, scale: 1, transition: { ...ease, opacity: { duration: 0.22 } } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -20, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }),
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { ...ease, delay: Math.min(i, 8) * 0.035 } }),
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
};
