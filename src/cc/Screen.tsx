// Projector view: read-only, driven entirely by the public game state the host publishes.
import { useEffect, useRef, useState } from 'react';
import type { Pub, PubLot, PubRow } from './types';
import { normPub } from './types';
import { ccConfigured, joinLink, listen, P, signIn, startServerClock, useConnected, useServerNow } from './fb';
import * as E from './engine';
import { clock, CodeBlock, Countdown, Partic, QR, RoundChip, TeamBadge } from './ui';
import { cx } from '../components/ui';
import { confetti, ConfettiLayer } from '../components/Confetti';
import { play, unlockAudio, type Sfx } from '../lib/sound';

export function Screen({ code }: { code: string }) {
  const [pub, setPub] = useState<Pub | null | undefined>(undefined);
  const [soundOn, setSoundOn] = useState(false);
  const connected = useConnected();
  useEffect(() => {
    if (!ccConfigured) return;
    let off: (() => void) | undefined;
    void (async () => { await signIn().catch(() => {}); void startServerClock(); off = await listen<Pub>(P(code, 'pub'), (v) => setPub(normPub(v))); })();
    return () => off?.();
  }, [code]);

  const sfx = (x: Sfx) => { if (soundOn && pub?.cfg.sound) play(x); };
  useCues(pub ?? null, sfx);

  if (!ccConfigured) return <Center>Firebase isn't set up for this site yet.</Center>;
  if (pub === undefined) return <Center>Connecting…</Center>;
  if (pub === null) return <Center>No event with code <b className="text-info">{code}</b>.</Center>;

  return (
    <div className="theme-cc stage-bg relative flex min-h-screen flex-col overflow-hidden" onClick={() => { unlockAudio(); setSoundOn(true); }}>
      <div className="circuit pointer-events-none absolute inset-0 opacity-60" />
      <ConfettiLayer />
      <TopBar pub={pub} code={code} connected={connected} />
      <main className="relative flex min-h-0 flex-1 flex-col px-[3vw] pb-[2.5vh]">
        <Body pub={pub} code={code} />
      </main>
      <div className="pointer-events-none fixed bottom-2 right-3 z-50 flex gap-2">
        {!soundOn && pub.cfg.sound && <span className="pointer-events-auto rounded-lg bg-panel/80 px-3 py-1.5 text-xs text-muted">Click anywhere to turn on sound</span>}
        <button className="pointer-events-auto rounded-lg bg-panel/70 px-3 py-1.5 text-xs text-muted opacity-40 hover:opacity-100" onClick={(e) => { e.stopPropagation(); try { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); } catch { /* not allowed */ } }}>⛶ Full screen</button>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="theme-cc stage-bg grid min-h-screen place-items-center p-6 text-center text-2xl text-muted">{children}</div>;
}

/** Sounds + confetti when the public state moves to a new step. */
function useCues(pub: Pub | null, sfx: (x: Sfx) => void) {
  const prev = useRef<string>('');
  const prevHigh = useRef<number>(0);
  useEffect(() => {
    if (!pub) return;
    const l = pub.lot;
    const key = `${pub.stage}|${l?.id ?? ''}|${l?.status ?? ''}|${pub.q?.win ?? ''}|${pub.final?.step ?? ''}`;
    if (key !== prev.current) {
      const had = prev.current !== '';
      prev.current = key;
      if (had) {
        if (pub.stage === 'final' && pub.final) {
          if (pub.final.step === 3) { sfx('win'); confetti(['#22e3ff', '#ffc83d', '#8b5cff', '#ffffff'], 320, 'sides'); } else if (pub.final.step > 0) sfx('round');
        } else if (l) {
          if (l.status === 'auction') sfx('bell');
          else if (l.status === 'settlement') sfx('closed');
          else if (l.status === 'sold') { sfx('hammer'); setTimeout(() => sfx('sold'), 350); confetti(['#ffc83d', '#22e3ff', '#ffffff'], 140, 'top'); }
          else if (l.status === 'unsold') sfx('unsold');
          else if (l.status === 'answer' || l.status === 'steal') sfx('event');
          else if (l.status === 'vault') { sfx('card'); confetti(['#ff4fd8', '#8b5cff', '#ffffff'], 160, 'center'); }
          else if (l.status === 'results') sfx('round');
        }
      }
    }
    const h = l?.high?.amount ?? 0;
    if (h && h !== prevHigh.current) sfx('bid');
    prevHigh.current = h;
  }, [pub, sfx]);
}

function TopBar({ pub, code, connected }: { pub: Pub; code: string; connected: boolean }) {
  const now = useServerNow(500);
  const total = pub.schedule.reduce((a, b) => a + b, 0);
  return (
    <header className="relative z-10 flex items-center gap-[2vw] px-[3vw] py-[1.6vh]">
      <div className="leading-none">
        <div className="font-[family-name:var(--font-display)] text-[clamp(20px,2.4vw,44px)] font-bold uppercase tracking-wide"><span className="cyan-text">BID WARS 2.0</span></div>
        <div className="label mt-1 text-[clamp(10px,.9vw,15px)]">Code &amp; Chaos{pub.name ? ` · ${pub.name}` : ''}</div>
      </div>
      {pub.stage !== 'registration' && pub.stage !== 'final' && <RoundChip round={pub.practice ? 0 : pub.round} className="text-[clamp(12px,1.2vw,20px)]" />}
      <div className="ml-auto flex items-center gap-[1.5vw]">
        {pub.stage !== 'registration' && <span className="label text-[clamp(10px,.9vw,15px)]">Join code <b className="text-info">{code}</b></span>}
        {pub.clockStart && <span className="rounded-xl border border-line bg-panel/60 px-3 py-1 font-[family-name:var(--font-display)] text-[clamp(16px,1.6vw,30px)] font-bold num">{clock(now - pub.clockStart)}<span className="text-dim text-[.6em]"> / {total}:00</span></span>}
        {!connected && <span className="rounded-lg bg-live/20 px-2 py-1 text-sm font-bold text-live animate-blink">RECONNECTING</span>}
      </div>
    </header>
  );
}

function Body({ pub, code }: { pub: Pub; code: string }) {
  if (pub.stage === 'registration') return <Lobby pub={pub} code={code} />;
  if (pub.stage === 'final' && pub.final) return <Final pub={pub} />;
  const l = pub.lot;
  if (!l || l.status === 'done' || l.status === 'skipped') return <Between pub={pub} />;
  return <LotStage pub={pub} l={l} />;
}

// ------------------------------------------------------------------------------------------- lobby
function Lobby({ pub, code }: { pub: Pub; code: string }) {
  const reg = new Set(pub.registered);
  return (
    <div className="grid flex-1 items-center gap-[4vw] lg:grid-cols-[minmax(0,40vh)_1fr]">
      <div className="mx-auto w-full max-w-[44vh] text-center">
        <QR text={joinLink(code)} className="w-full shadow-[0_0_60px_rgba(34,227,255,.25)]" />
        <div className="mt-3 label text-[clamp(11px,1vw,16px)]">Scan with one phone per team</div>
        <div className="mt-1 font-[family-name:var(--font-display)] text-[clamp(26px,3vw,54px)] font-bold tracking-[.25em] text-info">{code}</div>
      </div>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(40px,6vw,120px)] font-bold uppercase leading-[.9]"><span className="cyan-text">Code</span> <span className="text-gold">&amp;</span> <span className="cyan-text">Chaos</span></h1>
        <p className="mt-2 text-[clamp(16px,1.6vw,28px)] text-muted">Bid smart · Think fast · Rule the arena</p>
        <div className="mt-[3vh] flex items-baseline gap-3">
          <span className="font-[family-name:var(--font-display)] text-[clamp(48px,6vw,110px)] font-bold text-info num">{pub.registered.length}</span>
          <span className="text-[clamp(18px,2vw,36px)] text-dim">/ {pub.allowed.length} teams ready</span>
        </div>
        <div className="mt-[2vh] flex flex-wrap gap-[.6vw]">
          {pub.allowed.map((no) => (
            <span key={no} className={cx('grid h-[clamp(34px,4vw,64px)] w-[clamp(44px,5vw,80px)] place-items-center rounded-xl border font-[family-name:var(--font-display)] text-[clamp(14px,1.6vw,28px)] font-bold num transition', reg.has(no) ? 'border-info bg-info/15 text-info shadow-[0_0_18px_rgba(34,227,255,.35)] animate-zoom-in' : 'border-line text-dim')}>{no}</span>
          ))}
        </div>
        <ol className="mt-[3vh] grid gap-1 text-[clamp(13px,1.2vw,22px)] text-muted sm:grid-cols-2">
          <li>1 · Scan the QR code</li><li>2 · Enter your team number</li><li>3 · Type all four names</li><li>4 · Pick a PIN only your team knows</li>
        </ol>
        {!pub.regOpen && <p className="mt-3 font-bold text-warn">Registration is closed.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------- lot
function LotStage({ pub, l }: { pub: Pub; l: PubLot }) {
  const color = E.ROUND_META[l.round]?.color ?? '#22e3ff';
  return (
    <div className="grid min-h-0 flex-1 gap-[2vw] xl:grid-cols-[minmax(0,1fr)_minmax(260px,24vw)]">
      <section className="panel relative flex min-h-0 flex-col overflow-hidden p-[2.5vw]" style={{ boxShadow: `0 0 0 1px ${color}55, 0 0 80px ${color}22` }}>
        <div className="scan pointer-events-none absolute inset-x-0 top-0 h-1/3" />
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-[family-name:var(--font-display)] text-[clamp(18px,1.8vw,34px)] font-bold" style={{ color }}>{l.label}</span>
          {l.practice && <span className="rounded bg-panel-2 px-2 py-0.5 text-sm font-bold">PRACTICE · dummy money</span>}
          {l.category && <span className="label text-[clamp(10px,1vw,16px)]">{l.category}</span>}
          {(l.kind === 'question' || l.kind === 'practice' || l.kind === 'crowd' || l.kind === 'jackpot') && <Partic p={l.participation} />}
        </div>
        <h2 key={l.id} className="mt-[1vh] font-[family-name:var(--font-display)] text-[clamp(34px,5vw,96px)] font-bold uppercase leading-[.95] animate-rise">{l.kind === 'vault' ? `Mystery vault ${l.seq}` : l.title}</h2>
        <div className="flex min-h-0 flex-1 flex-col justify-center py-[2vh]">
          <Phase pub={pub} l={l} />
        </div>
      </section>
      <aside className="hidden min-h-0 flex-col gap-[1.5vw] xl:flex">
        <MiniBoard rows={pub.board} />
      </aside>
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink/50 px-[1.4vw] py-[1.2vh]">
      <div className="label text-[clamp(10px,.9vw,15px)]">{k}</div>
      <div className="font-[family-name:var(--font-display)] text-[clamp(22px,2.6vw,48px)] font-bold num" style={{ color: accent }}>{v}</div>
    </div>
  );
}

function Phase({ pub, l }: { pub: Pub; l: PubLot }) {
  const vaultSealed = l.kind === 'vault' && !l.vault;
  if (l.status === 'auction') {
    return (
      <div className="grid items-center gap-[3vw] lg:grid-cols-[auto_1fr]">
        <Countdown deadline={l.deadline} total={pub.cfg.auctionSec} size={Math.min(320, Math.max(150, window.innerHeight * 0.3))} label="BIDDING" />
        <div className="flex flex-col gap-[1.6vh]">
          <div className="grid grid-cols-2 gap-[1vw]">
            {l.kind !== 'jackpot' && <Stat k="Base price" v={E.money(l.base)} accent="var(--color-gold)" />}
            <Stat k="Reward" v={vaultSealed ? '???' : l.reward === null ? 'HIDDEN' : `${l.reward} pts`} accent={l.reward === null ? '#c3b1ff' : undefined} />
          </div>
          {l.mode === 'mobile' ? (
            l.high ? (
              <div className="flex items-center gap-[1.5vw]">
                <TeamBadge no={l.high.team} size="xl" />
                <span key={l.high.amount} className="font-[family-name:var(--font-display)] text-[clamp(56px,8vw,160px)] font-bold leading-none gold-text animate-bid-pop num">{E.money(l.high.amount)}</span>
              </div>
            ) : <p className="text-[clamp(22px,2.6vw,48px)] font-semibold text-info">Bid on your phones now!</p>
          ) : (
            <div>
              <p className="text-[clamp(22px,2.8vw,52px)] font-bold uppercase text-info">✋ Bid out loud</p>
              {l.verbal?.amount ? <div className="mt-1 flex items-center gap-[1.2vw]">{l.verbal.team ? <TeamBadge no={l.verbal.team} size="xl" /> : null}<span key={l.verbal.amount} className="font-[family-name:var(--font-display)] text-[clamp(48px,7vw,140px)] font-bold gold-text animate-bid-pop num">{E.money(l.verbal.amount)}</span></div> : <p className="text-[clamp(16px,1.6vw,28px)] text-muted">Raise your paddle and shout your bid. Steps of {E.money(pub.cfg.inc)}.</p>}
            </div>
          )}
          {vaultSealed && <VaultDoor />}
        </div>
      </div>
    );
  }
  if (l.status === 'settlement') {
    return (
      <div className="text-center">
        <div className="font-[family-name:var(--font-display)] text-[clamp(48px,7vw,140px)] font-bold uppercase text-live animate-stamp">Time's up</div>
        <p className="text-[clamp(18px,2vw,36px)] text-muted">{l.high ? <>Highest bid: <b className="text-fg">Team {l.high.team}</b>, {E.money(l.high.amount)}. Host is confirming…</> : 'Host is confirming the winning bid…'}</p>
      </div>
    );
  }
  if (l.status === 'sold') {
    return (
      <div className="text-center">
        <div className="font-[family-name:var(--font-display)] text-[clamp(70px,12vw,240px)] font-bold leading-none gold-text animate-stamp">SOLD! 🔨</div>
        <div className="mt-[2vh] flex items-center justify-center gap-[1.5vw] text-[clamp(24px,3vw,56px)] font-bold">
          <span className="text-muted">to</span><TeamBadge no={l.owner} size="xl" /><span className="num">{E.money(l.price ?? 0)}</span>
        </div>
        {l.reward !== null && l.kind !== 'vault' && <p className="mt-2 text-[clamp(16px,1.6vw,30px)] text-muted">Worth <b className="text-fg">{l.reward} pts</b> if they get it right</p>}
        {l.kind === 'vault' && <div className="mx-auto mt-[2vh] max-w-[40vh]"><VaultDoor /></div>}
      </div>
    );
  }
  if (l.status === 'unsold') {
    return <div className="text-center font-[family-name:var(--font-display)] text-[clamp(64px,10vw,200px)] font-bold text-muted animate-stamp">UNSOLD</div>;
  }
  if (l.status === 'vault' && l.vault) {
    return (
      <div className="grid items-center gap-[3vw] lg:grid-cols-[minmax(0,34vh)_1fr]">
        <VaultDoor open />
        <div>
          <div className="label text-[clamp(12px,1.1vw,20px)]">Team {l.owner} opened…</div>
          <div className="font-[family-name:var(--font-display)] text-[clamp(48px,7vw,140px)] font-bold uppercase leading-none animate-zoom-in" style={{ color: '#ff4fd8', textShadow: '0 0 40px #ff4fd888' }}>{l.vault.title}</div>
          <p className="mt-2 text-[clamp(20px,2.2vw,40px)]">{l.vault.text}</p>
        </div>
      </div>
    );
  }
  if ((l.status === 'answer' || l.status === 'steal') && pub.q) return <QuestionView pub={pub} />;
  if (l.status === 'results' && pub.res) return <ResultView pub={pub} l={l} />;
  return null;
}

function VaultDoor({ open }: { open?: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34vh]">
      <div className="absolute inset-0 grid place-items-center rounded-3xl border-2 border-[#ff4fd8]/50 bg-[radial-gradient(circle,#ff4fd833,transparent_70%)] text-[clamp(50px,8vh,110px)]">🎁</div>
      <div className={cx('vault-door absolute inset-0 grid place-items-center rounded-3xl border-4 border-[#8b5cff]', open && 'animate-vault-open')}>
        <div className="grid aspect-square w-1/2 place-items-center rounded-full border-[6px] border-[#c3b1ff]/70 animate-spin-slow"><div className="h-1/2 w-2 rounded bg-[#c3b1ff]/70" /></div>
      </div>
    </div>
  );
}

function QuestionView({ pub }: { pub: Pub }) {
  const q = pub.q!;
  const who = q.elig === 'all' ? (q.owner ? `All teams answer · Team ${q.owner} gets ${q.reward} pts, others ${Math.floor(q.reward * pub.cfg.share)}` : `All teams answer · ${q.reward} pts each`) : q.elig === 'owner' ? `Only Team ${q.owner} answers · ${q.reward} pts` : `STEAL! Everyone except Team ${q.owner} · first correct gets ${q.reward} pts`;
  return (
    <div className="grid items-start gap-[3vw] lg:grid-cols-[auto_1fr]">
      <Countdown deadline={q.deadline} total={pub.cfg.answerSec} size={Math.min(280, Math.max(140, window.innerHeight * 0.26))} label={q.n === 2 ? 'STEAL' : 'ANSWER'} />
      <div className="min-w-0">
        <div className={cx('inline-block rounded-xl px-[1vw] py-[.6vh] text-[clamp(14px,1.4vw,26px)] font-bold', q.n === 2 ? 'bg-live/20 text-live animate-blink' : 'bg-info/15 text-info')}>{who}</div>
        <p key={q.win} className="mt-[1.5vh] text-[clamp(24px,3vw,58px)] font-semibold leading-tight animate-rise">{q.prompt}</p>
        <CodeBlock code={q.code} className="mt-[1.5vh] text-[clamp(14px,1.6vw,30px)]" />
        {q.image && <img src={q.image} alt="" className="mt-[1.5vh] max-h-[28vh] rounded-2xl" />}
        {q.type !== 'oneword' ? (
          <div className="mt-[2vh] grid gap-[1vw] sm:grid-cols-2">
            {q.options.map((o, i) => (
              <div key={i} className="flex items-center gap-[1vw] rounded-2xl border border-line-2 bg-ink/60 px-[1.2vw] py-[1.4vh] text-[clamp(18px,2vw,38px)] font-semibold">
                <span className="grid h-[1.6em] w-[1.6em] shrink-0 place-items-center rounded-lg bg-info/15 font-[family-name:var(--font-display)] text-info">{String.fromCharCode(65 + i)}</span>{o}
              </div>
            ))}
          </div>
        ) : <p className="mt-[2vh] text-[clamp(18px,2vw,36px)] text-muted">Type a one-word answer on your phone.</p>}
        <p className="mt-[2vh] text-[clamp(14px,1.3vw,24px)] text-dim">Answer on your phone and press <b className="text-fg">SUBMIT</b>. No changes after submitting.</p>
      </div>
    </div>
  );
}

function ResultView({ pub, l }: { pub: Pub; l: PubLot }) {
  const r = pub.res!;
  return (
    <div className="grid gap-[3vw] lg:grid-cols-2">
      <div>
        <div className="label text-[clamp(12px,1.1vw,20px)]">Correct answer</div>
        <div className="font-[family-name:var(--font-display)] text-[clamp(40px,5.5vw,110px)] font-bold leading-none text-ok animate-zoom-in">{r.answer}</div>
        {r.explain && <p className="mt-2 text-[clamp(16px,1.6vw,30px)] text-muted">{r.explain}</p>}
        {r.ownerCorrect !== null && l.owner && (
          <p className={cx('mt-[2vh] text-[clamp(20px,2.2vw,42px)] font-bold', r.ownerCorrect ? 'text-ok' : 'text-live')}>Team {l.owner} {r.ownerCorrect ? 'got it! ✅' : 'missed it ❌'}</p>
        )}
      </div>
      <div>
        <div className="label text-[clamp(12px,1.1vw,20px)]">{r.correct} of {r.submitted} answers correct</div>
        <div className="mt-[1vh] flex flex-wrap gap-[.6vw]">
          {r.scores.length === 0 && <p className="text-[clamp(18px,2vw,36px)] text-muted">Nobody scored this time.</p>}
          {r.scores.slice(0, 40).map((x, i) => (
            <span key={x.team + x.role} className="rounded-xl border border-ok/40 bg-ok/10 px-[.8vw] py-[.6vh] text-[clamp(16px,1.6vw,30px)] font-bold animate-rise" style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}>T{x.team} <span className="text-ok">+{x.pts}</span>{x.role === 'steal' && <span className="text-live"> STEAL</span>}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------- between lots
function MiniBoard({ rows, big }: { rows: PubRow[] | null; big?: boolean }) {
  const ranks = useRef<Map<number, number>>(new Map());
  const moved = new Map<number, number>();
  if (rows) for (const r of rows) { const p = ranks.current.get(r.team); if (p && p !== r.rank) moved.set(r.team, p - r.rank); }
  useEffect(() => { if (rows) ranks.current = new Map(rows.map((r) => [r.team, r.rank])); }, [rows]);
  if (!rows) return <div className="panel grid flex-1 place-items-center p-6 text-center text-muted">Leaderboard is hidden right now.</div>;
  const show = rows.slice(0, big ? 12 : 10);
  return (
    <div className="panel flex min-h-0 flex-1 flex-col p-[1.4vw]">
      <div className="label mb-[1vh] text-[clamp(11px,1vw,17px)]">Leaderboard · points</div>
      <div className="flex min-h-0 flex-col gap-[.6vh]">
        {show.map((r) => {
          const d = moved.get(r.team) ?? 0;
          return (
            <div key={r.team} className={cx('grid grid-cols-[2.2em_1fr_auto] items-center gap-[.8vw] rounded-xl px-[.8vw] py-[.7vh] text-[clamp(14px,1.35vw,26px)]', r.rank === 1 ? 'bg-gold/15' : r.rank <= 3 ? 'bg-info/10' : 'bg-panel-2/60', d > 0 && 'animate-rise')}>
              <span className={cx('font-[family-name:var(--font-display)] font-bold num', r.rank === 1 ? 'text-gold' : 'text-muted')}>#{r.rank}</span>
              <span className="truncate font-semibold">Team {r.team}{d > 0 && <span className="ml-2 text-ok text-[.8em]">▲{d} 🚀</span>}</span>
              <span className="text-right"><b className="font-[family-name:var(--font-display)] num">{r.points}</b>{big && <span className="ml-3 text-[.8em] text-muted num">{E.money(r.purse)}</span>}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Between({ pub }: { pub: Pub }) {
  const m = E.ROUND_META[pub.practice ? 0 : pub.round];
  return (
    <div className="grid min-h-0 flex-1 gap-[2vw] xl:grid-cols-[minmax(0,1fr)_minmax(320px,32vw)]">
      <section className="panel flex flex-col justify-center p-[3vw]" style={{ boxShadow: m ? `0 0 0 1px ${m.color}44, 0 0 80px ${m.color}18` : undefined }}>
        <div className="label text-[clamp(12px,1.2vw,22px)]" style={{ color: m?.color }}>{pub.practice ? 'Practice auction' : pub.round ? `Round ${pub.round}` : 'Get ready'}</div>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-[clamp(44px,7vw,140px)] font-bold uppercase leading-[.9]" style={{ color: m?.color }}>{pub.practice ? 'Warm-up' : m?.name ?? 'Code & Chaos'}</h2>
        {m && !pub.practice && <p className="mt-2 text-[clamp(18px,2vw,36px)] text-muted">{m.tag}</p>}
        {pub.history.length > 0 && (
          <div className="mt-[4vh]">
            <div className="label mb-[1vh] text-[clamp(11px,1vw,17px)]">Recent lots</div>
            <div className="flex flex-col gap-[.6vh]">
              {pub.history.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-center gap-[1vw] text-[clamp(14px,1.4vw,26px)]">
                  <span className="w-[6em] font-[family-name:var(--font-display)] font-bold text-muted">{h.label}</span>
                  <span className="min-w-0 flex-1 truncate">{h.title}</span>
                  {h.team ? <><TeamBadge no={h.team} size="sm" /><span className="num">{E.money(h.price ?? 0)}</span></> : <span className="text-dim">{h.status === 'skipped' ? 'skipped' : 'unsold'}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <MiniBoard rows={pub.board} big />
    </div>
  );
}

// ------------------------------------------------------------------------------------------- final
function Final({ pub }: { pub: Pub }) {
  const f = pub.final!;
  const rows = f.rows;
  const at = (rank: number) => rows.find((r) => r.rank === rank);
  if (f.step === 0) {
    return (
      <div className="grid flex-1 place-items-center text-center">
        <div>
          <div className="font-[family-name:var(--font-display)] text-[clamp(50px,8vw,160px)] font-bold uppercase leading-none cyan-text animate-glow">Final results</div>
          <p className="mt-3 text-[clamp(18px,2vw,36px)] text-muted">Points + {pub.cfg.conv} per ₹1 Cr left in the purse</p>
        </div>
      </div>
    );
  }
  const place = (rank: number, label: string, emoji: string, h: string, show: boolean) => {
    const r = at(rank);
    return (
      <div className={cx('flex flex-col items-center justify-end', !show && 'opacity-0')}>
        {show && r && (
          <div className="mb-[1.5vh] text-center animate-zoom-in">
            <div className="text-[clamp(30px,4vw,80px)]">{emoji}</div>
            <div className="label text-[clamp(11px,1vw,18px)]">{label}</div>
            <div className="font-[family-name:var(--font-display)] text-[clamp(30px,4vw,84px)] font-bold leading-none" style={{ color: rank === 1 ? 'var(--color-gold)' : undefined }}>Team {r.team}</div>
            {r.members.length > 0 && <div className="mt-1 text-[clamp(12px,1.1vw,20px)] text-muted">{r.members.join(' · ')}</div>}
            <div className="mt-1 font-[family-name:var(--font-display)] text-[clamp(22px,2.6vw,50px)] font-bold num">{r.final} <span className="text-[.6em] text-muted">pts</span></div>
            <div className="text-[clamp(11px,1vw,18px)] text-dim num">{r.points} pts + {r.cashPts} from {E.money(r.purse)} left</div>
          </div>
        )}
        <div className={cx('w-full rounded-t-2xl border border-b-0', rank === 1 ? 'border-gold/60 bg-gold/20' : 'border-info/40 bg-info/10')} style={{ height: h }} />
      </div>
    );
  };
  return (
    <div className="flex flex-1 flex-col">
      <div className="grid flex-1 grid-cols-3 items-end gap-[2vw] px-[4vw]">
        {place(2, 'Runner-up', '🥈', '22vh', f.step >= 2)}
        {place(1, 'Champions', '🏆', '32vh', f.step >= 3)}
        {place(3, 'Third place', '🥉', '14vh', f.step >= 1)}
      </div>
      {f.step >= 3 && rows.length > 3 && (
        <div className="mt-[2vh] flex flex-wrap justify-center gap-[.6vw]">
          {rows.slice(3, 15).map((r) => <span key={r.team} className="rounded-lg bg-panel-2/70 px-[.8vw] py-[.4vh] text-[clamp(12px,1.1vw,20px)]">#{r.rank} Team {r.team} · <b className="num">{r.final}</b></span>)}
        </div>
      )}
    </div>
  );
}
