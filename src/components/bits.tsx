import type { Item, State, TeamRow } from '../store';
import { ROUNDS, standings } from '../store';
import { usePhotos } from '../lib/photos';
import { initials, money } from '../lib/util';
import { cx, TeamDot } from './ui';

export function Photo({ item, className, hide }: { item?: Item; className?: string; hide?: boolean }) {
  const get = usePhotos();
  const src = item && !hide ? get(item.id) : undefined;
  const color = item ? ROUNDS[item.round].color : '#4FB3FF';
  return (
    <div className={cx('relative isolate grid place-items-center overflow-hidden rounded-2xl', className)}
      style={{ background: `radial-gradient(circle at 30% 20%, ${color}44, transparent 60%), linear-gradient(160deg, #1b2547, #0b0f1b)`, border: `2px solid ${color}88` }}>
      {hide ? (
        <span className="font-[family-name:var(--font-display)] font-black leading-none text-[clamp(60px,10vw,180px)]" style={{ color }}>?</span>
      ) : src ? (
        <img src={src} alt={item?.name} className="absolute inset-0 h-full w-full object-cover object-top" />
      ) : (
        <span className="font-[family-name:var(--font-display)] font-black leading-none text-[clamp(36px,7vw,120px)]" style={{ color }}>{item ? initials(item.name) : '—'}</span>
      )}
    </div>
  );
}

export function Thumb({ item, size = 40 }: { item: Item; size?: number }) {
  const get = usePhotos();
  const src = get(item.id);
  const color = ROUNDS[item.round].color;
  return (
    <span className="inline-grid shrink-0 place-items-center overflow-hidden rounded-lg text-xs font-black" style={{ width: size, height: size * 1.2, background: '#1b2547', color, border: `1px solid ${color}66` }}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover object-top" /> : initials(item.name)}
    </span>
  );
}

export function Podium({ state, step = 3, big }: { state: State; step?: number; big?: boolean }) {
  const rows = standings(state);
  const order: [number, string, string, string][] = [[1, '2ND', '#C9CFDF', 'h-[70%]'], [0, '1ST', '#F5B833', 'h-full'], [2, '3RD', '#E3A970', 'h-[55%]']];
  const visible = (idx: number) => (idx === 2 ? step >= 1 : idx === 1 ? step >= 2 : step >= 3);
  return (
    <div className="grid h-full grid-cols-3 items-end gap-[clamp(8px,1.5vw,28px)]">
      {order.map(([idx, label, color, h]) => {
        const r: TeamRow | undefined = rows[idx];
        const show = r && visible(idx);
        return (
          <div key={idx} className={cx('flex flex-col justify-end rounded-3xl border-2 p-[clamp(10px,1.4vw,28px)] text-center transition-all duration-700', h, show && idx === 0 && 'animate-glow')}
            style={{ borderColor: show ? color : 'var(--color-line)', background: show ? `radial-gradient(circle at 50% 0%, ${color}40, var(--color-panel) 70%)` : 'var(--color-panel)', ['--glow' as string]: color }}>
            <div className={cx('font-[family-name:var(--font-display)] font-black', big ? 'text-[clamp(28px,4vw,72px)]' : 'text-3xl')} style={{ color }}>{label}</div>
            {show ? (
              <div className="animate-zoom-in">
                <div className={cx('mt-1 break-words font-[family-name:var(--font-display)] font-black uppercase leading-[.95]', big ? 'text-[clamp(22px,3.2vw,60px)]' : 'text-xl', idx === 0 && 'gold-text')}>{r!.team.name}</div>
                <div className={cx('mt-2 font-[family-name:var(--font-display)] font-black num', big ? 'text-[clamp(30px,4.5vw,88px)]' : 'text-3xl')}>{r!.final}</div>
                <div className={cx('label', big && '!text-[clamp(10px,1vw,16px)]')}>{state.finalized ? 'final points' : 'points'} · {money(r!.remaining)} left</div>
              </div>
            ) : (
              <div className={cx('font-[family-name:var(--font-display)] font-black text-line-2', big ? 'text-[clamp(40px,6vw,110px)]' : 'text-4xl')}>?</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Standings({ state, limit, compact }: { state: State; limit?: number; compact?: boolean }) {
  const rows = standings(state).slice(0, limit ?? 999);
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <div key={r.team.id} className={cx('grid items-center gap-2 rounded-lg px-2.5', compact ? 'grid-cols-[1.6rem_minmax(0,1fr)_4.5rem_3rem] py-1 text-sm' : 'grid-cols-[2rem_minmax(0,1fr)_6rem_4rem] py-1.5', r.rank <= 3 ? 'bg-gold/10' : 'bg-panel-2/50')}>
          <span className={cx('font-[family-name:var(--font-display)] font-black num', r.rank <= 3 ? 'text-gold-2' : 'text-muted')}>{r.rank}</span>
          <span className="flex min-w-0 items-center gap-2"><TeamDot color={r.team.color} size={8} /><span className="truncate font-semibold">{r.team.name}</span></span>
          <span className="text-right text-muted num">{money(r.remaining)}</span>
          <span className="text-right font-[family-name:var(--font-display)] font-black num">{r.final}</span>
        </div>
      ))}
    </div>
  );
}
