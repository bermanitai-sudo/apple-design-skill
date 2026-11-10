import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useMotionValueEvent, useScroll, type HTMLMotionProps } from 'framer-motion';
import { X } from 'lucide-react';
import { ease, listItem, spring } from '../lib/motion';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ── Surfaces ─────────────────────────────────────────── */

export function Card({ className, children, i = 0, ...rest }: HTMLMotionProps<'div'> & { i?: number }) {
  return (
    <motion.div variants={listItem} initial="hidden" animate="show" custom={i} className={cx('surface p-4', className)} {...rest}>
      {children}
    </motion.div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-end justify-between px-1">
      <h2 className="eyebrow">{children}</h2>
      {action}
    </div>
  );
}

export function SampleTag() {
  return (
    <span className="rounded-[5px] border border-white/20 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">
      Sample
    </span>
  );
}

/* ── Buttons ──────────────────────────────────────────── */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const btn: Record<BtnVariant, string> = {
  primary: 'bg-lime text-[#0b1400] font-semibold shadow-[0_8px_24px_-8px_rgba(183,255,53,0.55)]',
  secondary: 'bg-white/[0.08] text-white font-medium border border-white/10',
  ghost: 'text-white/80 font-medium',
  danger: 'bg-white/[0.06] text-[#ff6b5e] font-medium border border-white/10',
};

export function Button({
  variant = 'secondary',
  className,
  size = 'md',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      className={cx(
        'tap inline-flex select-none items-center justify-center gap-2 rounded-full disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' && 'h-9 px-4 text-[13px]',
        size === 'md' && 'h-11 px-5 text-[15px]',
        size === 'lg' && 'h-14 px-6 text-[17px]',
        btn[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('tap grid h-11 w-11 place-items-center rounded-full text-white/85', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── Progress ─────────────────────────────────────────── */

export function Ring({
  value,
  size = 120,
  stroke = 10,
  children,
  track = 'rgba(255,255,255,0.08)',
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  track?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#B7FF35"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: v > 0 ? 'drop-shadow(0 0 6px rgba(183,255,53,0.45))' : undefined }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cx('h-1.5 overflow-hidden rounded-full bg-white/[0.08]', className)}
    >
      <motion.div
        className="h-full rounded-full bg-lime"
        initial={{ width: 0 }}
        animate={{ width: `${v * 100}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/* ── Controls ─────────────────────────────────────────── */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-lime' : 'bg-white/[0.16]',
      )}
    >
      <motion.span
        layout
        transition={spring}
        className={cx(
          'absolute top-[2px] h-[27px] w-[27px] rounded-full shadow-[0_3px_8px_rgba(0,0,0,0.35)]',
          checked ? 'right-[2px] bg-[#0b1400]' : 'left-[2px] bg-white',
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" className={cx('flex rounded-full bg-white/[0.06] p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'relative h-8 flex-1 rounded-full text-[13px] font-medium transition-colors',
            value === o.value ? 'text-[#0b1400]' : 'text-white/70',
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 rounded-full bg-lime" />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block px-1 text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="surface-flat flex flex-col items-center px-6 py-8 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-[30ch] text-[13px] text-mute">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Page header with scroll-edge compact bar ─────────── */

export function PageHeader({ title, eyebrow, actions }: { title: string; eyebrow?: ReactNode; actions?: ReactNode }) {
  const { scrollY } = useScroll();
  const [compact, setCompact] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setCompact(y > 56));
  return (
    <>
      <AnimatePresence>
        {compact && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={ease}
            className="fixed inset-x-0 top-0 z-30 px-3 pt-[calc(var(--safe-top)+6px)]"
          >
            <div className="glass mx-auto flex h-11 max-w-md items-center justify-between rounded-full pl-5 pr-1.5">
              <span className="text-[15px] font-semibold">{title}</span>
              <div className="flex items-center">{actions}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="flex items-end justify-between gap-3 pb-2 pt-[calc(var(--safe-top)+18px)]">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
          <h1 className="truncate font-display text-[34px] font-bold leading-[1.05] tracking-[-0.035em]">{title}</h1>
        </div>
        {actions && <div className="-mr-2 flex shrink-0 items-center">{actions}</div>}
      </header>
    </>
  );
}

/* ── Sheet (functional layer: Liquid Glass) ───────────── */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const controls = useDragControls();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="glass absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] max-w-md flex-col rounded-t-[30px] border-b-0"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            dragControls={controls}
            onDragEnd={(_, i) => (i.offset.y > 110 || i.velocity.y > 600) && onClose()}
          >
            <div className="cursor-grab touch-none" onPointerDown={(e) => controls.start(e)}>
              <div className="flex justify-center pb-1 pt-2.5">
                <span className="h-[5px] w-9 rounded-full bg-white/25" />
              </div>
              <div className="flex items-center justify-between px-5 pb-2 pt-1">
                <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{title}</h2>
                <IconButton label="Close" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="-mr-2 bg-white/[0.08]">
                  <X size={18} />
                </IconButton>
              </div>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            {footer && <div className="border-t border-white/[0.06] px-5 pb-[calc(var(--safe-bottom)+14px)] pt-3">{footer}</div>}
            {!footer && <div className="pb-[var(--safe-bottom)]" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── Toasts ───────────────────────────────────────────── */

type Toast = { id: number; text: string };
const ToastCtx = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+10px)] z-[70] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={spring}
              className="glass max-w-sm rounded-full px-4 py-2.5 text-[14px] font-medium"
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center px-8" role="alertdialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="glass relative w-full max-w-[300px] rounded-[26px] p-5 text-center"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring}
          >
            <h3 className="text-[17px] font-semibold">{title}</h3>
            <p className="mt-1.5 text-[13px] text-mute">{body}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant={danger ? 'danger' : 'primary'}
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
