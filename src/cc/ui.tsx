import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useServerNow } from './fb';
import { ROUND_META } from './engine';
import { cx } from '../components/ui';

/** Seconds left until a server-time deadline, as a ring (big) or a pill. */
export function Countdown({ deadline, total, size = 120, label }: { deadline: number | null | undefined; total: number; size?: number; label?: string }) {
  const now = useServerNow(100);
  if (!deadline) return null;
  const ms = Math.max(0, deadline - now);
  const secs = Math.ceil(ms / 1000);
  const frac = Math.min(1, ms / (total * 1000));
  const r = 44, Cc = 2 * Math.PI * r;
  const danger = secs <= 3;
  const color = secs === 0 ? 'var(--color-live)' : danger ? 'var(--color-live)' : secs <= 10 ? 'var(--color-gold)' : 'var(--color-info)';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="timer" aria-label={`${secs} seconds left`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={Cc} strokeDashoffset={Cc * (1 - frac)} style={{ transition: 'stroke-dashoffset .1s linear', filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div key={danger ? secs : 'n'} className={cx('font-[family-name:var(--font-display)] font-bold leading-none num', danger && 'animate-count')} style={{ fontSize: size * 0.38, color: secs === 0 ? 'var(--color-live)' : undefined }}>{secs}</div>
          {label && <div className="label mt-0.5" style={{ fontSize: Math.max(9, size * 0.075) }}>{secs === 0 ? 'TIME UP' : label}</div>}
        </div>
      </div>
    </div>
  );
}

export function useLeft(deadline: number | null | undefined) {
  const now = useServerNow(200);
  return deadline ? Math.max(0, deadline - now) : 0;
}

export function QR({ text, className }: { text: string; className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: 720, errorCorrectionLevel: 'M', color: { dark: '#050A18', light: '#FFFFFF' } })
      .then((u) => alive && setSrc(u)).catch(() => alive && setSrc(''));
    return () => { alive = false; };
  }, [text]);
  return (
    <div className={cx('aspect-square overflow-hidden rounded-2xl bg-white p-2', className)}>
      {src ? <img src={src} alt="QR code to join the game" className="h-full w-full" style={{ imageRendering: 'pixelated' }} /> : null}
    </div>
  );
}

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  if (!code) return null;
  return <pre className={cx('code-block overflow-x-auto rounded-xl border border-line bg-ink/80 px-4 py-3 text-left', className)}><code>{code}</code></pre>;
}

export function TeamBadge({ no, size = 'md', className }: { no: number | null | undefined; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  if (no === null || no === undefined) return null;
  const s = { sm: 'h-6 min-w-6 text-xs px-1.5', md: 'h-8 min-w-8 text-sm px-2', lg: 'h-12 min-w-12 text-2xl px-3', xl: 'h-[clamp(56px,8vw,120px)] min-w-[clamp(56px,8vw,120px)] text-[clamp(28px,4.5vw,64px)] px-4' }[size];
  return <span className={cx('inline-grid shrink-0 place-items-center rounded-xl border border-info/50 bg-info/10 font-[family-name:var(--font-display)] font-bold text-info num', s, className)}>T{no}</span>;
}

export function RoundChip({ round, className }: { round: number; className?: string }) {
  const m = ROUND_META[round] ?? ROUND_META[1]!;
  return <span className={cx('label inline-flex items-center gap-1.5', className)} style={{ color: m.color }}><span className="inline-block h-2 w-2 rounded-full" style={{ background: m.color, boxShadow: `0 0 10px ${m.color}` }} />{round === 0 ? 'PRACTICE' : `ROUND ${round}`} · {m.name}</span>;
}

export function Partic({ p }: { p: string }) {
  const map: Record<string, [string, string]> = {
    open: ['OPEN', 'Everyone answers. Owner gets full points, others a share.'],
    exclusive: ['EXCLUSIVE', 'Only the winning team answers.'],
    steal: ['STEAL', 'Owner answers first. If they miss, others can steal.'],
    all: ['FREE FOR ALL', 'Every team answers. No bidding.'],
  };
  const [t, d] = map[p] ?? ['', ''];
  return <span title={d} className="rounded-md border border-violet/50 bg-violet/15 px-2 py-0.5 font-[family-name:var(--font-cond)] text-xs font-bold tracking-widest text-[#c3b1ff]">{t}</span>;
}

export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Medium / Hard badge for a question. */
export function DiffChip({ d, className = '' }: { d: string; className?: string }) {
  const hard = d === 'Hard';
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-widest ${hard ? 'bg-live/20 text-live' : 'bg-gold/15 text-gold'} ${className}`}>{d === 'Hard' ? '🔥 Hard' : d}</span>;
}
