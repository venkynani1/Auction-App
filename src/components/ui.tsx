import React, { useEffect, useState } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'gold' | 'primary' | 'ghost' | 'danger' | 'ok' | 'subtle' | 'outline';
const VARIANTS: Record<Variant, string> = {
  gold: 'bg-gradient-to-b from-gold-2 to-gold text-gold-ink font-bold shadow-[0_8px_30px_-8px_var(--color-gold)] hover:brightness-110',
  primary: 'bg-info/90 text-ink font-bold hover:bg-info',
  ghost: 'bg-transparent text-fg hover:bg-panel-2',
  danger: 'bg-live/90 text-white font-bold hover:bg-live',
  ok: 'bg-ok/90 text-ink font-bold hover:bg-ok',
  subtle: 'bg-panel-2 text-fg hover:bg-line border border-line',
  outline: 'border border-line-2 text-fg hover:border-gold hover:text-gold-2',
};
const SIZES = {
  xs: 'h-7 px-2.5 text-xs rounded-md gap-1',
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-14 px-6 text-lg rounded-xl gap-2',
  xl: 'h-20 px-8 text-2xl rounded-2xl gap-3',
};

export function Btn({ variant = 'subtle', size = 'md', className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return (
    <button {...rest} className={cx('inline-flex items-center justify-center whitespace-nowrap select-none transition active:scale-[.97] disabled:opacity-40 disabled:active:scale-100', VARIANTS[variant], SIZES[size], className)}>
      {children}
    </button>
  );
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('label', className)}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-dim">{hint}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/80 p-4 backdrop-blur-sm animate-fade" onMouseDown={onClose}>
      <div role="dialog" aria-modal aria-label={title} className={cx('panel max-h-[90vh] w-full overflow-auto scroll-thin shadow-2xl animate-rise', wide ? 'max-w-3xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-panel px-5 py-3.5">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold uppercase tracking-wide">{title}</h2>
          <Btn variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Btn>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

type ConfirmReq = { title: string; body: string; ok: string; danger?: boolean; resolve: (v: boolean) => void };
let pushConfirm: ((r: ConfirmReq) => void) | null = null;
export function confirmDialog(title: string, body: string, ok = 'Confirm', danger = true) {
  return new Promise<boolean>((resolve) => {
    if (!pushConfirm) return resolve(false);
    pushConfirm({ title, body, ok, danger, resolve });
  });
}
export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  useEffect(() => {
    pushConfirm = setReq;
    return () => { pushConfirm = null; };
  }, []);
  const close = (v: boolean) => { req?.resolve(v); setReq(null); };
  return (
    <Modal open={!!req} onClose={() => close(false)} title={req?.title ?? ''}>
      <p className="leading-relaxed text-muted">{req?.body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Btn variant="ghost" onClick={() => close(false)}>Keep as is</Btn>
        <Btn variant={req?.danger ? 'danger' : 'gold'} onClick={() => close(true)} autoFocus>{req?.ok}</Btn>
      </div>
    </Modal>
  );
}

type ToastT = { id: number; text: string; tone: 'info' | 'warn' | 'ok' };
let pushToast: ((t: ToastT) => void) | null = null;
let tid = 0;
export function toast(text: string, tone: ToastT['tone'] = 'info') {
  pushToast?.({ id: ++tid, text, tone });
}
export function ToastHost() {
  const [items, setItems] = useState<ToastT[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      setItems((x) => [...x.slice(-3), t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3200);
    };
    return () => { pushToast = null; };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2 px-4" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={cx('animate-rise rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-xl backdrop-blur',
          t.tone === 'warn' && 'border-warn/50 bg-[#2a1d05]/95 text-warn', t.tone === 'ok' && 'border-ok/50 bg-[#062418]/95 text-ok', t.tone === 'info' && 'border-line-2 bg-panel/95 text-fg')}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function TeamDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color, boxShadow: `0 0 10px ${color}` }} aria-hidden />;
}

export function BlockBar({ pct, blocks = 10 }: { pct: number; blocks?: number }) {
  const filled = Math.round((pct / 100) * blocks);
  return (
    <span className="inline-flex gap-[3px]" aria-label={`${pct}% complete`}>
      {Array.from({ length: blocks }, (_, i) => <span key={i} className={cx('h-3 w-2.5 rounded-[2px]', i < filled ? 'bg-gold' : 'bg-line')} />)}
    </span>
  );
}
