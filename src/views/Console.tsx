import { useCallback, useEffect, useMemo, useState } from 'react';
import { queue, ROUNDS, SLIPS, teamRows, useStore, type Item, type RoundNo, type SlipId, type State } from '../store';
import { money, MONEY, pad2, round2, timeOfDay } from '../lib/util';
import { play, unlockAudio } from '../lib/sound';
import { Photo, Standings, Thumb } from '../components/bits';
import { BlockBar, Btn, confirmDialog, cx, Label, TeamDot, toast } from '../components/ui';

const STEPS = [0.1, 0.25, 0.5, 1, 2, 5];

export function Console({ muted }: { muted: boolean }) {
  const { state, dispatch, undo, canUndo } = useStore();
  const live = state.live;
  const item = live ? state.items.find((i) => i.id === live.itemId) : undefined;
  const sfx = useCallback((s: Parameters<typeof play>[0]) => { if (!muted) play(s); }, [muted]);

  const next = useCallback(() => {
    if (live?.phase === 'bidding') return toast('Finish this lot first: SOLD, UNSOLD or Cancel.', 'warn');
    const q = queue(state);
    if (!q.length) return toast('No lots left in this round. Pick the next round above.', 'warn');
    dispatch({ type: 'OPEN_LOT', itemId: q[0]!.id });
    sfx('bell');
  }, [live, state, dispatch, sfx]);

  const sold = useCallback(() => {
    if (!live || live.phase !== 'bidding') return;
    if (!live.teamId) return toast('Pick the winning team first.', 'warn');
    const row = teamRows(state).find((r) => r.team.id === live.teamId)!;
    if (live.bid > row.remaining + 1e-9) return toast(`${row.team.name} only has ${money(row.remaining)} left.`, 'warn');
    dispatch({ type: 'SOLD' });
    sfx('sold');
  }, [live, state, dispatch, sfx]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') || document.querySelector('[role=dialog]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'n') next();
      else if (key === 's') sold();
      else if (key === 'u' && live?.phase === 'bidding') { dispatch({ type: 'UNSOLD' }); sfx('unsold'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [next, sold, undo, live, dispatch, sfx]);

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-4" onClick={unlockAudio}>
      <RoundBar state={state} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="panel min-w-0 p-4 sm:p-6">
          {!live || !item ? <NoLot state={state} onNext={next} /> : live.phase === 'bidding' ? <Bidding state={state} item={item} onSold={sold} sfx={sfx} /> : <Done state={state} item={item} onNext={next} />}
        </section>
        <aside className="flex min-w-0 flex-col gap-4">
          <ScreenControl state={state} />
          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase">Standings</h3>
              <span className="label">{state.finalized ? 'final pts' : 'points'}</span>
            </div>
            <Standings state={state} limit={10} compact />
            {state.teams.length > 10 && <a href="#teams" className="mt-2 block text-xs text-muted hover:text-gold-2">All {state.teams.length} teams →</a>}
          </div>
          <UpNext state={state} />
          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase">Activity</h3>
              <Btn size="xs" variant="ghost" disabled={!canUndo} onClick={() => { undo(); toast('Last action undone.', 'ok'); }}>↶ Undo</Btn>
            </div>
            <div className="flex max-h-56 flex-col gap-1 overflow-auto scroll-thin text-sm">
              {state.log.length === 0 && <p className="text-dim">Sales and adjustments appear here.</p>}
              {state.log.slice(0, 40).map((l, i) => (
                <div key={i} className="flex gap-2"><span className="shrink-0 pt-0.5 text-xs text-dim num">{timeOfDay(l.at)}</span><span className={cx(l.text.startsWith('SOLD') && 'font-semibold text-gold-2')}>{l.text}</span></div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      <p className="text-center text-xs text-dim">Shortcuts: <b>N</b> next lot · <b>S</b> sold · <b>U</b> unsold · <b>Ctrl+Z</b> undo</p>
    </div>
  );
}

function RoundBar({ state }: { state: State }) {
  const { dispatch } = useStore();
  const busy = state.live?.phase === 'bidding';
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {([1, 2, 3, 4] as RoundNo[]).map((r) => {
        const R = ROUNDS[r];
        const all = state.items.filter((i) => i.round === r);
        const done = all.filter((i) => i.status !== 'available').length;
        const active = state.round === r;
        return (
          <button key={r} disabled={busy && !active} onClick={() => !active && dispatch({ type: 'SET_ROUND', round: r })}
            className={cx('rounded-2xl border p-3 text-left transition disabled:opacity-40', active ? 'bg-panel-2' : 'border-line bg-panel hover:border-line-2')}
            style={active ? { borderColor: R.color, boxShadow: `0 0 26px -12px ${R.color}` } : undefined}>
            <div className="label" style={{ color: R.color }}>Round {r}</div>
            <div className="truncate font-[family-name:var(--font-display)] text-xl font-black uppercase">{R.short}</div>
            <div className="mt-1 flex items-center gap-2"><BlockBar pct={all.length ? (done / all.length) * 100 : 0} /><span className="text-xs text-muted num">{done}/{all.length}</span></div>
          </button>
        );
      })}
    </div>
  );
}

function LotHead({ item }: { item: Item }) {
  const R = ROUNDS[item.round];
  return (
    <div className="flex gap-4 sm:gap-6">
      <Photo item={item} className="h-36 w-28 shrink-0 sm:h-48 sm:w-40" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md px-2.5 py-0.5 font-[family-name:var(--font-display)] text-xl font-black text-ink num" style={{ background: R.color }}>LOT {pad2(item.lot)}</span>
          <span className="label" style={{ color: R.color }}>{R.name}</span>
        </div>
        <h1 className="mt-1.5 break-words font-[family-name:var(--font-display)] text-[clamp(36px,4.6vw,68px)] font-black uppercase leading-[.9]">{item.name}</h1>
        {item.role && <div className="text-muted">{item.role}</div>}
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <span>Base <b className="num">{item.base ? money(item.base) : 'open'}</b></span>
          {item.round !== 4 && (
            <span>Points <b className="num">{item.points ?? 'not set'}</b>
              <span className="ml-1.5 text-xs text-muted">{item.round === 1 ? '(shown on screen)' : item.round === 2 ? '(hidden until sold)' : '(secret, never shown)'}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function NoLot({ state, onNext }: { state: State; onNext: () => void }) {
  const q = queue(state);
  const R = ROUNDS[state.round];
  if (!q.length) {
    const nextRound = state.round < 4 ? ((state.round + 1) as RoundNo) : null;
    return <RoundDone state={state} nextRound={nextRound} />;
  }
  return (
    <div className="grid min-h-[420px] place-items-center text-center">
      <div className="flex flex-col items-center">
        <Label className="!text-[13px]">Round {state.round} · {R.name} · up next</Label>
        <Photo item={q[0]} hide={state.round === 4} className="mt-3 h-44 w-36" />
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-5xl font-black uppercase">{q[0]!.name}</h2>
        <p className="text-muted">{q[0]!.base ? `Base ${money(q[0]!.base)}` : 'Open bidding'} · {q.length} left in this round</p>
        <Btn variant="gold" size="xl" className="mt-6 min-w-[300px]" onClick={onNext}>NEXT LOT ▶</Btn>
        <p className="mt-3 max-w-md text-xs text-dim">Puts the lot on the projector. You can also pick any lot from "Next up" on the right.</p>
      </div>
    </div>
  );
}

function RoundDone({ state, nextRound }: { state: State; nextRound: RoundNo | null }) {
  const { dispatch } = useStore();
  const unsold = state.items.filter((i) => i.round === state.round && i.status === 'unsold');
  return (
    <div className="grid min-h-[420px] place-items-center text-center">
      <div>
        <div className="text-6xl">🏁</div>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-black uppercase">Round {state.round} complete</h2>
        {unsold.length > 0 && (
          <div className="mt-3">
            <p className="text-muted">{unsold.length} unsold. Put any of them back up for auction:</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {unsold.map((i) => <Btn key={i.id} size="sm" variant="outline" onClick={() => dispatch({ type: 'REQUEUE', itemId: i.id })}>↺ {i.name}</Btn>)}
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {nextRound
            ? <Btn variant="gold" size="xl" onClick={() => dispatch({ type: 'SET_ROUND', round: nextRound })}>Start round {nextRound}: {ROUNDS[nextRound].short} ▶</Btn>
            : state.finalized
              ? <Btn variant="gold" size="xl" onClick={() => dispatch({ type: 'FINALE_STEP', step: 0 })}>🏆 Go to final results</Btn>
              : <CalcFinalBtn size="xl" />}
          <Btn variant="subtle" size="xl" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'board' })}>Show leaderboard</Btn>
        </div>
      </div>
    </div>
  );
}

function Bidding({ state, item, onSold, sfx }: { state: State; item: Item; onSold: () => void; sfx: (s: 'bid' | 'unsold') => void }) {
  const { dispatch } = useStore();
  const live = state.live!;
  const rows = useMemo(() => teamRows(state), [state]);
  const [filter, setFilter] = useState('');
  const [typed, setTyped] = useState('');
  const leader = rows.find((r) => r.team.id === live.teamId);
  const setBid = (v: number) => { dispatch({ type: 'SET_BID', bid: v }); };
  const shown = rows.filter((r) => r.team.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex flex-col gap-5">
      <LotHead item={item} />

      <div className="rounded-2xl border border-line bg-ink/50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <Label>Current bid (shown on the projector)</Label>
            <div key={live.bid} className="font-[family-name:var(--font-display)] text-[clamp(52px,6.5vw,100px)] font-black leading-[.9] num gold-text animate-bid-pop">{MONEY(live.bid)}</div>
            <div className="mt-1 text-lg">Leading: {leader ? <b className="font-[family-name:var(--font-display)] text-2xl uppercase" style={{ color: leader.team.color }}>{leader.team.name}</b> : <span className="text-muted">no team yet</span>}</div>
          </div>
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); const v = Number(typed); if (v >= 0 && typed !== '') { setBid(v); setTyped(''); } }}>
            <input id="type-bid" className="field !h-12 !w-32 text-lg num" type="number" step="0.05" min="0" placeholder="₹ Cr" value={typed} onChange={(e) => setTyped(e.target.value)} />
            <Btn size="lg" variant="outline" className="!h-12">Set</Btn>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STEPS.map((s) => <Btn key={s} variant="primary" className="min-w-[78px] font-[family-name:var(--font-display)] !text-lg !font-black" onClick={() => { setBid(round2(live.bid + s)); sfx('bid'); }}>+{s < 1 ? `${Math.round(s * 100)} L` : `${s} Cr`}</Btn>)}
          <Btn variant="subtle" onClick={() => setBid(round2(Math.max(0, live.bid - 0.25)))}>−25 L</Btn>
          <Btn variant="ghost" onClick={() => setBid(item.base)}>Reset to base</Btn>
        </div>
        <p className="mt-2 text-xs text-dim">Prices are in crores: 50 L = 0.5. Type any amount, or use the buttons.</p>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Label>Who has the highest bid? Tap the team</Label>
          <input id="team-filter" className="field !w-56 !py-1.5" placeholder="Find team" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {shown.map((r) => {
            const sel = live.teamId === r.team.id;
            const short = r.remaining + 1e-9 < live.bid;
            return (
              <button key={r.team.id} disabled={short} title={short ? `Only ${money(r.remaining)} left` : undefined}
                onClick={() => { dispatch({ type: 'SET_LEADER', teamId: sel ? null : r.team.id }); if (!sel) sfx('bid'); }}
                className={cx('flex min-w-0 items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition disabled:opacity-35', sel ? 'scale-[1.02]' : 'hover:border-line-2')}
                style={{ borderColor: sel ? r.team.color : 'var(--color-line)', background: sel ? `${r.team.color}30` : 'var(--color-panel-2)' }}>
                <TeamDot color={r.team.color} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold leading-tight">{r.team.name}</span>
                  <span className="text-xs text-muted num">{money(r.remaining)} left · {r.final} pts</span>
                </span>
                {sel && <span className="ml-auto">👑</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_auto]">
        <Btn variant="gold" size="xl" className="col-span-2 sm:col-span-1" disabled={!live.teamId} onClick={onSold}>
          SOLD 🔨{leader ? <span className="ml-2 text-base font-semibold">{leader.team.name} · {money(live.bid)}</span> : null}
        </Btn>
        <Btn variant="subtle" size="xl" onClick={() => { dispatch({ type: 'UNSOLD' }); sfx('unsold'); }}>UNSOLD</Btn>
        <Btn variant="ghost" size="xl" onClick={async () => { if (await confirmDialog('Cancel this lot?', 'The lot goes back to the list as if it never came up.', 'Cancel lot')) dispatch({ type: 'CLOSE_LOT' }); }}>Cancel</Btn>
      </div>
    </div>
  );
}

function Done({ state, item, onNext }: { state: State; item: Item; onNext: () => void }) {
  const { dispatch } = useStore();
  const t = state.teams.find((x) => x.id === item.teamId);
  const more = queue(state).length > 0;
  const needsSlip = item.round === 4 && item.status === 'sold' && !item.slip;
  return (
    <div className="flex flex-col gap-5">
      <LotHead item={item} />
      <div className={cx('rounded-2xl border-2 p-5', item.status === 'sold' ? 'border-gold bg-gold/10' : 'border-line bg-panel-2')}>
        {item.status === 'sold' && t ? (
          <>
            <div className="font-[family-name:var(--font-display)] text-5xl font-black gold-text">SOLD! 🔨</div>
            <div className="mt-1 font-[family-name:var(--font-display)] text-3xl font-black uppercase" style={{ color: t.color }}>to {t.name} · {MONEY(item.price ?? 0)}</div>
            {item.round !== 4 && <div className="mt-1 text-muted">+{item.points ?? 0} points to {t.name}{item.round === 2 ? ' (now revealed on screen)' : item.round === 3 ? ' (kept secret)' : ''}.</div>}
            {item.slip && <div className="mt-2 font-semibold text-fg">Slip: {SLIPS[item.slip].title}. {item.slipNote}</div>}
          </>
        ) : <div className="font-[family-name:var(--font-display)] text-5xl font-black text-muted">UNSOLD</div>}
      </div>
      {needsSlip && <SlipPicker state={state} item={item} />}
      <div className="flex flex-wrap gap-3">
        {more
          ? <Btn variant="gold" size="xl" className="flex-1" disabled={needsSlip} onClick={onNext}>NEXT LOT ▶</Btn>
          : <Btn variant="gold" size="xl" className="flex-1" disabled={needsSlip} onClick={() => dispatch({ type: 'CLOSE_LOT' })}>Finish round ▶</Btn>}
        <Btn variant="ghost" size="xl" onClick={async () => { if (await confirmDialog(`Undo the result for ${item.name}?`, 'The lot goes back to the list and any money is refunded.', 'Put it back')) dispatch({ type: 'REQUEUE', itemId: item.id }); }}>Put back</Btn>
      </div>
    </div>
  );
}

function SlipPicker({ state, item }: { state: State; item: Item }) {
  const { dispatch } = useStore();
  const used = new Set(state.items.filter((i) => i.slip).map((i) => i.slip));
  const [pick, setPick] = useState<SlipId | null>(null);
  const [battery, setBattery] = useState('');
  const [mine, setMine] = useState('');
  const [theirs, setTheirs] = useState('');
  const t = state.teams.find((x) => x.id === item.teamId)!;
  const myItems = state.items.filter((i) => i.status === 'sold' && i.teamId === t.id && i.round !== 4);
  const others = state.items.filter((i) => i.status === 'sold' && i.teamId && i.teamId !== t.id && i.round !== 4);
  const apply = () => {
    if (!pick) return;
    if (pick === 'battery' && !(Number(battery) >= 0 && battery !== '')) return toast('Type the battery %.', 'warn');
    if (pick === 'swap' && (!mine || !theirs)) return toast('Pick both players to swap.', 'warn');
    dispatch({ type: 'APPLY_SLIP', itemId: item.id, slip: pick, value: Number(battery), swap: { mine, theirs } });
  };
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: ROUNDS[4].color }}>
      <Label className="!text-[13px]" >Open the slip. Which one did {t.name} get?</Label>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(SLIPS) as SlipId[]).map((s) => (
          <button key={s} onClick={() => setPick(s)} disabled={used.has(s)}
            className={cx('rounded-xl border p-3 text-left disabled:opacity-35', pick === s ? 'bg-panel-2' : 'border-line bg-panel')}
            style={pick === s ? { borderColor: ROUNDS[4].color } : undefined}>
            <div className="font-semibold">{SLIPS[s].title}{used.has(s) ? ' (used)' : ''}</div>
            <div className="text-xs text-muted">{SLIPS[s].text}</div>
          </button>
        ))}
      </div>
      {pick === 'battery' && (
        <label className="mt-3 flex items-center gap-2"><span className="label">Battery %</span><input id="battery" className="field !w-28 num" type="number" min="0" max="100" value={battery} onChange={(e) => setBattery(e.target.value)} /></label>
      )}
      {pick === 'swap' && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select id="swap-mine" className="field" value={mine} onChange={(e) => setMine(e.target.value)}>
            <option value="">{t.name} gives…</option>
            {myItems.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.points ?? 0} pts)</option>)}
          </select>
          <select id="swap-theirs" className="field" value={theirs} onChange={(e) => setTheirs(e.target.value)}>
            <option value="">…and takes</option>
            {others.map((i) => <option key={i.id} value={i.id}>{i.name} ({state.teams.find((x) => x.id === i.teamId)?.name}, {i.points ?? 0} pts)</option>)}
          </select>
          {!myItems.length && <p className="text-sm text-warn sm:col-span-2">{t.name} has no players to swap. Pick a different outcome or skip with “Put back”.</p>}
        </div>
      )}
      <Btn variant="gold" size="lg" className="mt-3" disabled={!pick} onClick={apply}>Reveal on screen and apply</Btn>
    </div>
  );
}

export function CalcFinalBtn({ size = 'md' }: { size?: 'md' | 'xl' }) {
  const { state, dispatch } = useStore();
  const go = async () => {
    if (state.live?.phase === 'bidding') return toast('Finish the current lot first.', 'warn');
    const left = state.items.filter((i) => i.status === 'available').length;
    const body = `Every team gets ${state.settings.ptsPerCr} point for each full ₹1 Cr left in its purse, and the winners are ranked.${left ? ` ${left} lots have not been auctioned yet.` : ''}`;
    if (!(await confirmDialog('Calculate final points?', body, 'Calculate', false))) return;
    dispatch({ type: 'FINALIZE', on: true });
    toast('Final points calculated. Reveal the winners from “Final results”.', 'ok');
  };
  return <Btn variant="gold" size={size} className="w-full" onClick={go}>🧮 Calculate final points</Btn>;
}

function ScreenControl({ state }: { state: State }) {
  const { dispatch } = useStore();
  const opts: [typeof state.screen, string][] = [['lot', 'Current lot'], ['board', 'Leaderboard'], ['finale', 'Final results'], ['join', 'Room QR']];
  return (
    <div className="panel p-4">
      <h3 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase">Projector shows</h3>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {opts.map(([k, l]) => <Btn key={k} size="sm" variant={state.screen === k ? 'gold' : 'subtle'} disabled={k === 'finale' && !state.finalized} title={k === 'finale' && !state.finalized ? 'Calculate final points first' : undefined} onClick={() => dispatch({ type: 'SET_SCREEN', screen: k })}>{l}</Btn>)}
      </div>
      <div className="mt-3">
        {state.finalized
          ? <div className="flex items-center justify-between gap-2 rounded-xl bg-ok/10 px-3 py-2 text-sm"><span className="text-ok">✓ Final points calculated (purse points added)</span><Btn size="xs" variant="ghost" onClick={() => dispatch({ type: 'FINALIZE', on: false })}>Undo</Btn></div>
          : <CalcFinalBtn />}
      </div>
      {state.screen === 'finale' && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['Reset', 'Reveal 3rd', 'Reveal 2nd', 'Reveal champion'].map((l, i) => (
            <Btn key={i} size="sm" variant={state.finaleStep === i ? 'outline' : 'ghost'} onClick={() => dispatch({ type: 'FINALE_STEP', step: i })}>{l}</Btn>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-dim">Open this app in a second window on the projector and choose “Projector”. It follows what you do here.</p>
    </div>
  );
}

function UpNext({ state }: { state: State }) {
  const { dispatch } = useStore();
  const q = queue(state);
  const busy = state.live?.phase === 'bidding';
  return (
    <div className="panel p-4">
      <h3 className="mb-2 font-[family-name:var(--font-display)] text-2xl font-black uppercase">Next up <span className="text-base text-muted">({q.length})</span></h3>
      {q.length === 0 && <p className="text-sm text-muted">Nothing left in this round.</p>}
      <div className="flex max-h-64 flex-col gap-1 overflow-auto scroll-thin">
        {q.map((i) => (
          <button key={i.id} disabled={busy} onClick={() => dispatch({ type: 'OPEN_LOT', itemId: i.id })} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-2 disabled:hover:bg-transparent">
            <Thumb item={i} size={26} />
            <span className="w-6 text-dim num">{pad2(i.lot)}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{i.name}</span>
            <span className="text-muted num">{i.base ? money(i.base) : 'open'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

