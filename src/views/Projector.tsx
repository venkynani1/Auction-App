import { useEffect, useRef, useState } from 'react';
import { pointsShown, queue, ROUNDS, SLIPS, standings, useStore, type Item, type State } from '../store';
import { MONEY, pad2 } from '../lib/util';
import { Wordmark } from '../components/Brand';
import { Photo, Podium } from '../components/bits';
import { BlockBar, cx, TeamDot } from '../components/ui';
import { confetti } from '../components/Confetti';
import { JoinQR } from '../components/JoinQR';
import { joinUrl } from '../lib/rooms';

const FLASH_MS = { sold: 4200, unsold: 2400, slip: 5500, round: 3200 } as const;

function useTick(ms = 250) {
  const [n, set] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => set(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return n;
}

function Header({ state }: { state: State }) {
  const R = ROUNDS[state.round];
  const inRound = state.items.filter((i) => i.round === state.round);
  const done = inRound.filter((i) => i.status !== 'available').length;
  const pct = inRound.length ? Math.round((done / inRound.length) * 100) : 0;
  const lot = state.live ? state.items.find((i) => i.id === state.live!.itemId)?.lot : undefined;
  return (
    <header className="relative z-10 grid grid-cols-1 items-center gap-3 border-b border-line/80 bg-ink/70 px-[clamp(12px,2vw,32px)] py-[clamp(8px,1.4vh,18px)] backdrop-blur lg:grid-cols-[1fr_auto_1fr]">
      <Wordmark name={state.settings.eventName} subtitle="THE ULTIMATE OFFICE AUCTION" size="lg" />
      <div className="text-center">
        <div className="label !text-[clamp(10px,.9vw,15px)]" style={{ color: R.color }}>ROUND {state.round}</div>
        <div className="font-[family-name:var(--font-display)] text-[clamp(24px,3vw,54px)] font-black uppercase leading-none">{R.name}</div>
        <div className="mt-1.5 flex items-center justify-center gap-2"><BlockBar pct={pct} /><span className="label num">{done}/{inRound.length}</span></div>
      </div>
      <div className="flex justify-center gap-2 lg:justify-end">
        <Chip k="Lot" v={lot ? `#${pad2(lot)}` : '—'} />
        <Chip k="Left in round" v={String(inRound.length - done)} />
        <Chip k="Teams" v={String(state.teams.length)} />
      </div>
    </header>
  );
}

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel/70 px-[clamp(8px,1vw,18px)] py-[clamp(4px,.6vh,10px)] text-center">
      <div className="label !text-[clamp(9px,.75vw,13px)]">{k}</div>
      <div className="font-[family-name:var(--font-display)] text-[clamp(16px,1.7vw,30px)] font-extrabold leading-none num">{v}</div>
    </div>
  );
}

function PointsBox({ item, state }: { item: Item; state: State }) {
  const mode = pointsShown(item, state.live);
  const R = ROUNDS[item.round];
  if (item.round === 4) {
    return <Box label="INSIDE THE SLIP" value={item.slip ? SLIPS[item.slip].title : '?'} sub={item.slip ? item.slipNote : 'opened after the sale'} color={item.slip ? R.color : undefined} small={!!item.slip} />;
  }
  if (mode === 'show') return <Box label={item.status === 'sold' && item.round === 2 ? 'POINTS EARNED' : 'POINTS'} value={item.points == null ? '—' : String(item.points)} color={item.status === 'sold' && item.round === 2 ? '#F5B833' : undefined} pop={item.round === 2} />;
  if (mode === 'secret') return <Box label="POINTS" value={item.status === 'sold' ? '✓' : '?'} sub={item.status === 'sold' ? 'added to the team' : 'secret'} />;
  return <Box label="POINTS" value="?" sub="revealed after the sale" />;
}

function Box({ label, value, sub, color, small, pop }: { label: string; value: string; sub?: string; color?: string; small?: boolean; pop?: boolean }) {
  return (
    <div key={value} className={cx('min-w-0 rounded-2xl border p-[clamp(12px,1.4vw,24px)]', pop && color && 'animate-bid-pop')} style={{ borderColor: color ?? 'var(--color-line)', background: color ? `${color}22` : 'var(--color-panel-2)' }}>
      <div className="label !text-[clamp(11px,1vw,18px)]">{label}</div>
      <div className={cx('font-[family-name:var(--font-display)] font-black leading-none num', small ? 'text-[clamp(26px,3vw,56px)]' : 'text-[clamp(48px,6vw,110px)]')} style={{ color: color ?? 'var(--color-fg)' }}>{value}</div>
      {sub && <div className="mt-1 text-[clamp(12px,1.1vw,20px)] text-muted">{sub}</div>}
    </div>
  );
}

function LotStage({ state }: { state: State }) {
  const live = state.live!;
  const item = state.items.find((i) => i.id === live.itemId);
  if (!item) return null;
  const R = ROUNDS[item.round];
  const leader = state.teams.find((t) => t.id === (item.status === 'sold' ? item.teamId : live.teamId));
  const sold = live.phase === 'sold';
  const isSlip = item.round === 4;
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-[clamp(14px,2.4vw,44px)] md:grid-cols-[minmax(0,.75fr)_minmax(0,1.6fr)]">
      <div className="relative">
        <Photo item={item} hide={isSlip} className="mx-auto aspect-[4/5] w-full max-w-[260px] md:max-h-[64vh] md:max-w-none" />
        {sold && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-gold bg-ink/75 px-6 py-2 font-[family-name:var(--font-display)] text-[clamp(40px,6vw,110px)] font-black text-gold animate-stamp">SOLD</div>}
        {live.phase === 'unsold' && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-muted bg-ink/75 px-6 py-2 font-[family-name:var(--font-display)] text-[clamp(32px,5vw,90px)] font-black text-muted animate-stamp">UNSOLD</div>}
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-[clamp(10px,2vh,28px)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg px-3 py-1 font-[family-name:var(--font-display)] text-[clamp(16px,1.8vw,32px)] font-black text-ink num" style={{ background: R.color }}>LOT {pad2(item.lot)}</span>
            <span className="label !text-[clamp(11px,1vw,18px)]" style={{ color: R.color }}>{R.name}</span>
          </div>
          <h1 className="mt-2 break-words font-[family-name:var(--font-display)] font-black uppercase leading-[.86] text-[clamp(44px,7vw,150px)]">{item.name}</h1>
          {item.role && <div className="mt-2 text-[clamp(16px,1.8vw,32px)] text-muted">{item.role}</div>}
        </div>
        <div className="grid grid-cols-2 gap-[clamp(10px,1.4vw,24px)]">
          <Box label="BASE PRICE" value={item.base ? MONEY(item.base) : 'OPEN'} color="#F5B833" />
          <PointsBox item={item} state={state} />
        </div>
        <div className="rounded-2xl border border-line bg-ink/40 p-[clamp(12px,1.4vw,24px)]">
          <div className="label !text-[clamp(11px,1vw,18px)]">{sold ? 'SOLD FOR' : live.phase === 'unsold' ? 'NO SALE' : leader ? 'CURRENT BID' : 'OPENING BID'}</div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div key={`${live.bid}-${live.teamId}`} className="whitespace-nowrap font-[family-name:var(--font-display)] font-black leading-[.9] num gold-text animate-bid-pop text-[clamp(52px,7.5vw,150px)]">{MONEY(sold ? item.price ?? live.bid : live.bid)}</div>
            {leader && live.phase !== 'unsold' && (
              <div key={leader.id} className="flex min-w-0 items-center gap-3 animate-rise pb-2">
                <TeamDot color={leader.color} size={22} />
                <span className="truncate font-[family-name:var(--font-display)] font-black uppercase leading-none text-[clamp(26px,3.4vw,64px)]" style={{ color: leader.color }}>{leader.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IdleStage({ state }: { state: State }) {
  const R = ROUNDS[state.round];
  const left = queue(state).length;
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <div className="label !text-[clamp(14px,1.4vw,24px)]" style={{ color: R.color }}>ROUND {state.round}{left ? ' · UP NEXT' : ' · COMPLETE'}</div>
        <h1 className="font-[family-name:var(--font-display)] font-black uppercase leading-[.9] text-[clamp(52px,8vw,160px)]">{R.name}</h1>
        <p className="mx-auto mt-4 max-w-[36ch] text-[clamp(18px,2vw,34px)] text-fg/75">{R.rule}</p>
        {left > 0 && <div className="mt-6 font-[family-name:var(--font-cond)] text-[clamp(16px,1.6vw,28px)] tracking-[.2em] text-fg/60 animate-blink">PADDLES READY</div>}
      </div>
    </div>
  );
}

function BoardStage({ state }: { state: State }) {
  const rows = standings(state);
  const half = Math.ceil(rows.length / 2);
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-[clamp(14px,2vw,36px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex min-h-[340px] flex-col">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-[clamp(26px,3vw,56px)] font-black uppercase">Top 3</h2>
        <div className="min-h-0 flex-1"><Podium state={state} big /></div>
      </div>
      <div className="min-w-0">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-[clamp(26px,3vw,56px)] font-black uppercase">Standings</h2>
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-2">
          {[rows.slice(0, half), rows.slice(half)].map((col, c) => (
            <div key={c} className="flex flex-col gap-1">
              {col.map((r) => (
                <div key={r.team.id} className={cx('grid grid-cols-[2.2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-3 py-[clamp(4px,.7vh,10px)] text-[clamp(14px,1.25vw,24px)] transition-all', r.rank <= 3 ? 'bg-gold/15' : 'bg-panel/80')}>
                  <span className={cx('font-[family-name:var(--font-display)] font-black num', r.rank <= 3 ? 'text-gold-2' : 'text-muted')}>{r.rank}</span>
                  <span className="flex min-w-0 items-center gap-2"><TeamDot color={r.team.color} /><span className="truncate font-semibold">{r.team.name}</span></span>
                  <span className="font-[family-name:var(--font-display)] font-black num">{r.final}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[clamp(12px,1vw,18px)] text-muted">{state.finalized ? 'Final points = player points + bonuses + 1 point for every full ₹1 Cr left.' : 'Points = player points + bonuses. Leftover purse points are added at the final calculation.'}</p>
      </div>
    </div>
  );
}

function JoinStage({ state }: { state: State }) {
  const url = joinUrl(state.rooms.code).replace(/^https?:\/\//, '');
  return (
    <div className="grid h-full grid-cols-1 items-center gap-[clamp(16px,3vw,60px)] md:grid-cols-[auto_minmax(0,1fr)]">
      <JoinQR code={state.rooms.code} className="mx-auto w-[min(70vw,58vh)] shadow-[0_0_80px_-20px_var(--color-gold)]" />
      <div className="min-w-0 text-center md:text-left">
        <div className="label !text-[clamp(14px,1.4vw,24px)] text-gold-2">{state.rooms.open ? 'TEAM ROOMS ARE OPEN' : 'TEAM ROOMS OPEN SOON'}</div>
        <h1 className="font-[family-name:var(--font-display)] font-black uppercase leading-[.88] text-[clamp(48px,7vw,140px)]">Scan to join<br />your team</h1>
        <ol className="mt-4 flex flex-col gap-1 text-[clamp(18px,1.9vw,34px)] text-fg/85">
          <li>1 · Scan the QR code with your phone camera</li>
          <li>2 · Type your team number (1 – {state.teams.length})</li>
          <li>3 · Watch your purse, points and players live</li>
        </ol>
        <div className="mt-4 break-all font-[family-name:var(--font-cond)] text-[clamp(14px,1.3vw,24px)] tracking-wide text-muted">{url}</div>
      </div>
    </div>
  );
}

function FinaleStage({ state }: { state: State }) {
  const step = state.finaleStep;
  const champ = standings(state)[0];
  useEffect(() => {
    if (step !== 3) return;
    const c = [champ?.team.color ?? '#F5B833', '#F5B833', '#FFD977', '#FFFFFF'];
    confetti(c, 220, 'center');
    const t1 = setTimeout(() => confetti(c, 160, 'sides'), 700);
    const t2 = setTimeout(() => confetti(c, 200, 'top'), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-[clamp(10px,2vh,28px)] text-center font-[family-name:var(--font-display)] font-black uppercase leading-none text-[clamp(40px,6vw,120px)]">
        {step === 3 ? <span className="gold-text">Champions!</span> : step === 0 ? 'And the winners are…' : step === 1 ? 'Third place' : 'Runner-up'}
      </h1>
      <div className="min-h-[320px] flex-1"><Podium state={state} step={step} big /></div>
    </div>
  );
}

function Flash({ state }: { state: State }) {
  const now = useTick(200);
  const f = state.flash;
  const shown = useRef<string | null>(null);
  const item = state.live ? state.items.find((i) => i.id === state.live!.itemId) : undefined;
  const team = item?.teamId ? state.teams.find((t) => t.id === item.teamId) : undefined;
  useEffect(() => {
    if (!f || shown.current === f.id || Date.now() - f.at > 1500) return;
    shown.current = f.id;
    if (f.kind === 'sold') setTimeout(() => confetti([team?.color ?? '#F5B833', '#F5B833', '#FFD977', '#FFFFFF'], 170), 700);
    if (f.kind === 'slip') confetti([ROUNDS[4].color, '#FFFFFF'], 120, 'top');
    if (f.kind === 'round') confetti([ROUNDS[state.round].color, '#F5B833', '#FFFFFF'], 120, 'sides');
  }, [f, team, state.round]);
  if (!f || now - f.at > FLASH_MS[f.kind]) return null;
  const color = f.kind === 'sold' ? team?.color ?? '#F5B833' : f.kind === 'unsold' ? '#5D6789' : f.kind === 'slip' ? ROUNDS[4].color : ROUNDS[state.round].color;
  return (
    <div key={f.id} className="fixed inset-0 z-[60] grid place-items-center overflow-hidden px-6 text-center" style={{ backgroundColor: '#070A12', backgroundImage: `radial-gradient(circle at 50% 45%, ${color}40, transparent 62%)` }}>
      <div>
        {f.kind === 'sold' && item && team && (
          <>
            <div className="font-[family-name:var(--font-display)] font-black leading-[.85] gold-text animate-stamp text-[clamp(80px,15vw,260px)]">SOLD!</div>
            <div className="mt-4 font-[family-name:var(--font-cond)] text-[clamp(18px,2.4vw,42px)] font-semibold tracking-[.2em] text-fg/80 animate-rise" style={{ animationDelay: '.4s' }}>{item.name.toUpperCase()}</div>
            <div className="mt-2 font-[family-name:var(--font-display)] font-black uppercase leading-none animate-rise text-[clamp(30px,5vw,96px)]" style={{ color: team.color, animationDelay: '.6s' }}>TO {team.name}</div>
            <div className="mt-3 font-[family-name:var(--font-display)] font-black num gold-text animate-zoom-in text-[clamp(52px,8vw,150px)]" style={{ animationDelay: '.9s' }}>{MONEY(item.price ?? 0)}</div>
            {item.round === 2 && <div className="mt-3 font-[family-name:var(--font-display)] font-black text-[clamp(26px,3.6vw,68px)] animate-zoom-in" style={{ animationDelay: '1.4s' }}>+{item.points ?? '?'} POINTS</div>}
          </>
        )}
        {f.kind === 'unsold' && <div className="font-[family-name:var(--font-display)] font-black text-muted animate-stamp text-[clamp(70px,12vw,220px)]">UNSOLD</div>}
        {f.kind === 'slip' && item?.slip && (
          <>
            <div className="label !text-[clamp(14px,1.6vw,28px)]" style={{ color }}>THE SLIP SAYS</div>
            <div className="font-[family-name:var(--font-display)] font-black uppercase leading-[.9] animate-zoom-in text-[clamp(56px,9vw,170px)]" style={{ color, textShadow: `0 0 60px ${color}88` }}>{SLIPS[item.slip].title}</div>
            <div className="mx-auto mt-4 max-w-[34ch] text-[clamp(18px,2.4vw,42px)] font-semibold animate-rise">{item.slipNote}</div>
          </>
        )}
        {f.kind === 'round' && (
          <>
            <div className="label !text-[clamp(16px,2vw,32px)]" style={{ color }}>ROUND {state.round}</div>
            <div className="font-[family-name:var(--font-display)] font-black uppercase leading-[.9] gold-text animate-zoom-in text-[clamp(60px,10vw,190px)]">{ROUNDS[state.round].name}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function Projector({ fullscreen }: { fullscreen: boolean }) {
  const { state } = useStore();
  const showLot = state.screen === 'lot';
  return (
    <div className={cx('stage-bg relative flex flex-col overflow-hidden', fullscreen ? 'h-screen' : 'min-h-[calc(100vh-56px)]')}>
      <div className="pointer-events-none absolute inset-0 spotlight-grid opacity-40" />
      {state.screen !== 'finale' && state.screen !== 'join' && <Header state={state} />}
      <main className="relative z-10 min-h-0 flex-1 p-[clamp(14px,2vw,36px)]">
        {state.screen === 'join' ? <JoinStage state={state} />
          : state.screen === 'finale' ? <FinaleStage state={state} />
          : state.screen === 'board' ? <BoardStage state={state} />
            : showLot && state.live ? <LotStage state={state} /> : <IdleStage state={state} />}
      </main>
      {state.screen === 'lot' && <Ticker state={state} />}
      <Flash state={state} />
    </div>
  );
}

function Ticker({ state }: { state: State }) {
  const top = standings(state).slice(0, 3);
  const text = [
    ...top.map((r) => `#${r.rank} ${r.team.name.toUpperCase()} · ${r.final} PTS`),
    ...state.log.slice(0, 6).map((l) => l.text.toUpperCase()),
  ];
  return (
    <div className="relative z-10 flex items-center overflow-hidden border-t border-line bg-ink/80">
      <span className="z-10 shrink-0 bg-live px-4 py-2 font-[family-name:var(--font-display)] text-[clamp(14px,1.2vw,22px)] font-black">TOP 3</span>
      <div className="flex min-w-0 overflow-hidden">
        <div className="flex shrink-0 animate-ticker gap-12 whitespace-nowrap py-2 pl-6 font-[family-name:var(--font-cond)] text-[clamp(14px,1.2vw,22px)] font-semibold tracking-wide text-fg/80">
          {[...text, ...text].map((t, i) => <span key={i}>{t} <span className="text-gold">◆</span></span>)}
        </div>
      </div>
    </div>
  );
}

