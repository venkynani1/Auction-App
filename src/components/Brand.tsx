import { cx } from './ui';

/** BID WARS wordmark: a brass paddle numeral + tall condensed type. Original mark. */
export function Wordmark({ name = 'BID WARS', subtitle, size = 'md', compact }: { name?: string; subtitle?: string; size?: 'sm' | 'md' | 'lg'; compact?: boolean }) {
  const [a, ...rest] = name.split(' ');
  const t = size === 'lg' ? 'text-[clamp(28px,3.4vw,58px)]' : size === 'sm' ? 'text-xl' : 'text-[26px]';
  const icon = size === 'lg' ? 'h-[clamp(34px,3.8vw,64px)]' : size === 'sm' ? 'h-7' : 'h-9';
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Paddle className={cx(icon, 'w-auto shrink-0')} />
      <div className={cx('min-w-0 leading-none', compact && 'hidden sm:block')}>
        <div className={cx('font-[family-name:var(--font-display)] font-black tracking-[.02em] leading-[.85] whitespace-nowrap', t)}>
          <span className="gold-text">{a}</span>{rest.length ? <span className="text-fg"> {rest.join(' ')}</span> : null}
        </div>
        {subtitle && (
          <div className={cx('label mt-1 truncate !text-fg/60', size === 'lg' ? '!text-[clamp(10px,1vw,16px)]' : '!text-[10px]')}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

export function Paddle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 52" className={className} aria-hidden>
      <defs>
        <linearGradient id="pd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset=".55" stopColor="#f5b833" />
          <stop offset="1" stopColor="#b97a0d" />
        </linearGradient>
      </defs>
      <rect x="17" y="30" width="6" height="21" rx="3" fill="#8b5524" />
      <rect x="2" y="1" width="36" height="34" rx="9" fill="url(#pd)" />
      <rect x="6" y="5" width="28" height="26" rx="6" fill="#0b0f1b" opacity=".92" />
      <text x="20" y="25.5" textAnchor="middle" fontFamily="Big Shoulders Display, Impact, sans-serif" fontWeight="900" fontSize="20" fill="#f5b833">₹</text>
    </svg>
  );
}
