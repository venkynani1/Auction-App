// Team phone: register / sign in, then bid (Round 3) and answer challenges. One phone per team.
import { useEffect, useMemo, useState } from 'react';
import type { Priv, Pub, PubLot } from './types';
import { normPriv, normPub } from './types';
import { ccConfigured, listen, P, placeBid, register, rejoin, setOnline, signIn, startServerClock, submitAnswer, useConnected } from './fb';
import * as E from './engine';
import { CodeBlock, Countdown, DiffChip, useLeft } from './ui';
import { Btn, cx } from '../components/ui';

interface Me { team: number; pin: string }
const KEY = (code: string) => `cc:play:${code}`;
const loadMe = (code: string): Me | null => { try { return JSON.parse(localStorage.getItem(KEY(code)) || 'null') as Me | null; } catch { return null; } };
const saveMe = (code: string, me: Me | null) => { try { if (me) localStorage.setItem(KEY(code), JSON.stringify(me)); else localStorage.removeItem(KEY(code)); } catch { /* private mode */ } };
const ANS = (code: string, win: string) => `cc:ans:${code}:${win}`;

export function Play({ code }: { code: string }) {
  const [pub, setPub] = useState<Pub | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(() => loadMe(code));
  const [sess, setSess] = useState<'checking' | 'ok' | 'lost'>('checking');
  const [priv, setPriv] = useState<Priv | null>(null);
  const connected = useConnected();

  useEffect(() => {
    if (!ccConfigured) return;
    let off: (() => void) | undefined;
    void (async () => {
      await signIn().catch(() => {});
      void startServerClock();
      off = await listen<Pub>(P(code, 'pub'), (v) => setPub(normPub(v)), () => setPub(null));
    })();
    return () => off?.();
  }, [code]);

  // Our session: readable only while this phone holds it. Losing read access = another phone took over.
  useEffect(() => {
    if (!me) return;
    setSess('checking');
    let offS: (() => void) | undefined, offP: (() => void) | undefined;
    void (async () => {
      const uid = await signIn().catch(() => null);
      offS = await listen<{ uid: string }>(P(code, `sess/${me.team}`), (v) => setSess(v && v.uid === uid ? 'ok' : 'lost'), () => setSess('lost'));
      offP = await listen<Priv>(P(code, `priv/${me.team}`), (v) => setPriv(normPriv(v)), () => setPriv(null));
    })();
    return () => { offS?.(); offP?.(); };
  }, [code, me]);
  useEffect(() => { if (me && sess === 'ok' && connected) void setOnline(code, me.team); }, [code, me, sess, connected]);

  if (!ccConfigured) return <Shell><Msg>This site isn't connected to Firebase yet. Ask the host.</Msg></Shell>;
  if (pub === undefined) return <Shell><Msg>Connecting…</Msg></Shell>;
  if (pub === null) return <Shell><Msg>No event with code <b className="text-info">{code}</b>. Check the code on the big screen.</Msg></Shell>;

  if (!me) return <Shell pub={pub}><Join code={code} pub={pub} onIn={(m) => { saveMe(code, m); setMe(m); }} /></Shell>;

  if (sess === 'lost') {
    return (
      <Shell pub={pub}>
        <div className="panel p-5 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase">Team {me.team} is on another phone</h2>
          <p className="mt-2 text-muted">Only one phone per team can play. Take over if this is now your team's phone. The other phone will be signed out.</p>
          <TakeOver code={code} me={me} onDone={() => setSess('checking')} onForget={() => { saveMe(code, null); setMe(null); }} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell pub={pub} me={me} priv={priv} connected={connected}>
      <Arena code={code} pub={pub} me={me} priv={priv} />
    </Shell>
  );
}

function Shell({ children, pub, me, priv, connected = true }: { children: React.ReactNode; pub?: Pub; me?: Me; priv?: Priv | null; connected?: boolean }) {
  return (
    <div className="theme-cc stage-bg min-h-[100dvh] pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2">
          {me ? (
            <>
              <span className="grid h-11 min-w-11 place-items-center rounded-xl border border-info/60 bg-info/10 px-2 font-[family-name:var(--font-display)] text-xl font-bold text-info num">T{me.team}</span>
              <div className="min-w-0 leading-tight">
                <div className="font-[family-name:var(--font-display)] text-lg font-bold num">{priv ? E.money(priv.purse) : '—'}<span className="ml-2 text-sm text-muted">{priv ? `${priv.points} pts` : ''}</span></div>
                <div className="truncate text-xs text-muted">{pub ? (pub.stage === 'registration' ? 'Waiting to start' : pub.stage === 'final' ? 'Final results' : pub.practice ? 'Practice · dummy money' : 'Live auction') : ''}</div>
              </div>
            </>
          ) : (
            <div className="font-[family-name:var(--font-display)] text-lg font-bold uppercase"><span className="cyan-text">Code</span> <span className="text-gold">&amp;</span> <span className="cyan-text">Chaos</span></div>
          )}
          <span className={cx('ml-auto flex items-center gap-1.5 text-xs', connected ? 'text-ok' : 'text-live')}><span className={cx('h-2.5 w-2.5 rounded-full', connected ? 'bg-ok' : 'bg-live animate-blink')} />{connected ? 'Live' : 'Offline'}</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-4">{children}</main>
    </div>
  );
}
const Msg = ({ children }: { children: React.ReactNode }) => <div className="panel p-6 text-center text-lg text-muted">{children}</div>;

// ------------------------------------------------------------------------------------------- join
function Join({ code, pub, onIn }: { code: string; pub: Pub; onIn: (m: Me) => void }) {
  const [mode, setMode] = useState<'new' | 'back'>(pub.regOpen ? 'new' : 'back');
  const [team, setTeam] = useState('');
  const [names, setNames] = useState(['', '', '', '']);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [reg, setReg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const no = Number(team);
  const taken = pub.registered.includes(no);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!pub.allowed.includes(no)) return setErr(`Team ${team || '?'} isn't in this event. Teams are ${pub.allowed[0]}–${pub.allowed[pub.allowed.length - 1]}.`);
    if (!/^\d{4,6}$/.test(pin)) return setErr('PIN must be 4 to 6 digits.');
    setBusy(true);
    try {
      if (mode === 'new') {
        if (taken) return setErr(`Team ${no} is already registered. Use "We already registered" and your PIN.`);
        const m = names.map((x) => x.trim());
        if (m.some((x) => !x)) return setErr('Type all four team members\' names.');
        if (m.some((x) => x.length > 40)) return setErr('Names can be at most 40 characters.');
        if (pin !== pin2) return setErr('The two PINs don\'t match.');
        if (pub.needCode && !reg.trim()) return setErr('Enter the registration code shown by the host.');
        const r = await register(code, no, m, pin, reg.trim());
        if (r === 'ok') onIn({ team: no, pin });
        else setErr(r === 'offline' ? 'No connection. Check your internet and try again.' : !pub.regOpen ? 'Registration is closed. Ask the host.' : pub.needCode ? 'Registration code is wrong, or this team was just registered.' : `Team ${no} was just registered by another phone.`);
      } else {
        const r = await rejoin(code, no, pin);
        if (r === 'ok') onIn({ team: no, pin });
        else setErr(r === 'offline' ? 'No connection. Try again.' : 'Wrong team number or PIN. Ask the host if you forgot the PIN.');
      }
    } finally { setBusy(false); }
  };

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase leading-none">{mode === 'new' ? 'Register your team' : 'Sign in'}</h1>
      <p className="mt-1 text-sm text-muted">{pub.name} · event {code}</p>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-panel p-1">
        <button className={cx('rounded-lg py-2 text-sm font-semibold', mode === 'new' ? 'bg-panel-2 text-info' : 'text-muted')} onClick={() => setMode('new')}>New team</button>
        <button className={cx('rounded-lg py-2 text-sm font-semibold', mode === 'back' ? 'bg-panel-2 text-info' : 'text-muted')} onClick={() => setMode('back')}>We already registered</button>
      </div>
      {mode === 'new' && !pub.regOpen && <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">Registration is closed. Ask the host to reopen it.</p>}
      <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
        <label className="block"><span className="label">Team number</span>
          <input id="p-team" className="field mt-1 !h-16 text-center font-[family-name:var(--font-display)] text-4xl font-bold num" inputMode="numeric" autoComplete="off" value={team} onChange={(e) => setTeam(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          {mode === 'new' && team && taken && <span className="mt-1 block text-xs text-warn">Team {team} is already registered.</span>}
        </label>
        {mode === 'new' && (
          <div className="grid gap-2">
            <span className="label">Team members (all four)</span>
            {names.map((n, i) => <input key={i} id={`p-name-${i}`} className="field" maxLength={40} autoCapitalize="words" placeholder={`Member ${i + 1}`} value={n} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />)}
          </div>
        )}
        <div className={cx('grid gap-2', mode === 'new' && 'grid-cols-2')}>
          <label className="block"><span className="label">{mode === 'new' ? 'Choose a PIN' : 'Team PIN'}</span>
            <input id="p-pin" className="field mt-1 text-center font-[family-name:var(--font-display)] text-2xl tracking-[.3em] num" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </label>
          {mode === 'new' && (
            <label className="block"><span className="label">PIN again</span>
              <input id="p-pin2" className="field mt-1 text-center font-[family-name:var(--font-display)] text-2xl tracking-[.3em] num" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
            </label>
          )}
        </div>
        {mode === 'new' && pub.needCode && (
          <label className="block"><span className="label">Registration code (from the host)</span><input id="p-reg" className="field mt-1" autoCapitalize="characters" value={reg} onChange={(e) => setReg(e.target.value)} /></label>
        )}
        {mode === 'new' && <p className="text-xs text-dim">4–6 digits. Your team needs it to sign in again on another phone, so remember it.</p>}
        {err && <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">{err}</p>}
        <Btn variant="primary" size="xl" disabled={busy || (mode === 'new' && !pub.regOpen)}>{busy ? 'Please wait…' : mode === 'new' ? 'REGISTER TEAM' : 'SIGN IN'}</Btn>
      </form>
    </div>
  );
}

function TakeOver({ code, me, onDone, onForget }: { code: string; me: Me; onDone: () => void; onForget: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="mt-4 flex flex-col gap-2">
      <Btn variant="primary" size="lg" disabled={busy} onClick={async () => { setBusy(true); setErr(''); const r = await rejoin(code, me.team, me.pin); setBusy(false); if (r === 'ok') onDone(); else setErr(r === 'offline' ? 'No connection.' : 'The PIN has changed. Sign in again with the new PIN.'); }}>Use this phone for Team {me.team}</Btn>
      <Btn variant="ghost" onClick={onForget}>Sign in as a different team</Btn>
      {err && <p className="text-sm text-live">{err}</p>}
    </div>
  );
}

// ------------------------------------------------------------------------------------------- arena
function Arena({ code, pub, me, priv }: { code: string; pub: Pub; me: Me; priv: Priv | null }) {
  const l = pub.lot;
  if (pub.stage === 'registration') {
    return (
      <div className="panel p-6 text-center">
        <div className="text-5xl">✅</div>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold uppercase">You're in!</h2>
        {priv && <p className="mt-2 text-muted">{priv.members.join(' · ')}</p>}
        <p className="mt-4 text-lg">Keep this page open. The game starts soon.</p>
        <p className="mt-1 text-sm text-dim">{pub.registered.length} teams registered</p>
      </div>
    );
  }
  if (pub.stage === 'final' && pub.final) return <FinalPhone pub={pub} me={me} />;
  return (
    <div className="flex flex-col gap-4">
      {l && !['done', 'skipped'].includes(l.status) ? <LotPhone code={code} pub={pub} l={l} me={me} priv={priv} /> : (
        <div className="panel p-6 text-center">
          <span className="label">{pub.practice ? 'Practice' : 'Live auction'}</span>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold uppercase">Next lot coming up</h2>
          <p className="mt-1 text-muted">Watch the big screen.</p>
        </div>
      )}
      <MyTeam pub={pub} priv={priv} />
    </div>
  );
}

function LotPhone({ code, pub, l, me, priv }: { code: string; pub: Pub; l: PubLot; me: Me; priv: Priv | null }) {
  const mine = l.owner === me.team;
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line p-4">
        <div className="flex items-center gap-2">{l.difficulty && <DiffChip d={l.difficulty} />}{l.practice && <span className="text-xs font-bold text-muted">PRACTICE · dummy money</span>}</div>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold uppercase leading-tight">{l.label} · {l.kind === 'vault' ? `Mystery vault ${l.seq}` : l.title}</h2>
        <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
          {l.kind !== 'jackpot' && l.kind !== 'crowd' && <span>Base <b className="text-gold">{E.money(l.base)}</b></span>}
          <span>Reward <b className="text-fg">{l.reward === null ? 'hidden' : `${l.reward} pts`}</b></span>
        </div>
      </div>
      <div className="p-4">
        {l.status === 'auction' && (l.mode === 'mobile' ? <BidPad code={code} pub={pub} l={l} me={me} priv={priv} /> : (
          <div className="flex items-center gap-4">
            <Countdown deadline={l.deadline} total={pub.cfg.auctionSec} size={96} />
            <div><p className="text-xl font-bold text-info">✋ Bid out loud</p><p className="text-sm text-muted">Raise your paddle. The host records the winner. You have {priv ? E.money(priv.purse) : '—'}.</p></div>
          </div>
        ))}
        {l.status === 'settlement' && <p className="text-center text-lg font-semibold">⏰ Time's up. The host is confirming the sale…</p>}
        {l.status === 'sold' && (
          <div className="text-center">
            <div className={cx('font-[family-name:var(--font-display)] text-4xl font-bold', mine ? 'gold-text animate-stamp' : 'text-fg')}>{mine ? 'YOU WON IT! 🔨' : `SOLD to Team ${l.owner}`}</div>
            <p className="mt-1 text-muted">for {E.money(l.price ?? 0)}</p>
            {mine && l.kind !== 'vault' && <p className="mt-2 text-sm">Get ready: the question is coming, and only your team can answer it first. You'll have 10 seconds.</p>}
            {!mine && <p className="mt-2 text-sm text-muted">If Team {l.owner} gets it wrong, the question opens to everyone. Stay ready!</p>}
          </div>
        )}
        {l.status === 'unsold' && <p className="text-center font-[family-name:var(--font-display)] text-3xl font-bold text-muted">UNSOLD</p>}
        {l.status === 'vault' && l.vault && (
          <div className="text-center">
            <p className="label">Team {l.owner} opened</p>
            <div className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase animate-zoom-in" style={{ color: '#ff4fd8' }}>{l.vault.title}</div>
            <p className="mt-1">{l.vault.text}</p>
          </div>
        )}
        {(l.status === 'answer' || l.status === 'steal') && pub.q && <AnswerPad key={pub.q.win} code={code} pub={pub} me={me} />}
        {l.status === 'results' && pub.res && <ResultPhone pub={pub} l={l} me={me} priv={priv} />}
      </div>
    </div>
  );
}

function BidPad({ code, pub, l, me, priv }: { code: string; pub: Pub; l: PubLot; me: Me; priv: Priv | null }) {
  const [pick, setPick] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ t: string; ok: boolean } | null>(null);
  const left = useLeft(l.deadline);
  const inc = pub.cfg.inc;
  const min = l.minBid ?? l.base;
  const purse = priv?.purse ?? 0;
  const leading = l.high?.team === me.team;
  const quick = useMemo(() => [min, min + inc, min + 2 * inc, min + 5 * inc], [min, inc]);
  useEffect(() => { if (pick !== null && pick < min) setPick(null); }, [min, pick]);
  const valid = (a: number) => a >= min && a <= purse && (a === l.base || a % inc === 0);
  const customLakh = Math.round(Number(custom) * 100);
  const send = async () => {
    if (pick === null) return;
    setBusy(true);
    const r = await placeBid(code, l.id, me.team, pick);
    setBusy(false);
    setPick(null); setCustom('');
    setNote(r === 'ok' ? { t: `Bid sent: ${E.money(pick)}`, ok: true } : r === 'offline' ? { t: 'No connection. Bid not sent.', ok: false } : { t: 'Bid rejected: someone bid higher or time ran out.', ok: false });
  };
  return (
    <div>
      <div className="flex items-center gap-4">
        <Countdown deadline={l.deadline} total={pub.cfg.auctionSec} size={96} />
        <div className="min-w-0">
          <div className="label">Highest bid</div>
          {l.high ? <div key={l.high.amount} className={cx('font-[family-name:var(--font-display)] text-3xl font-bold num animate-bid-pop', leading ? 'text-ok' : 'gold-text')}>{E.money(l.high.amount)} <span className="text-base">{leading ? '· YOU' : `· T${l.high.team}`}</span></div> : <div className="text-xl text-muted">No bids yet</div>}
          <div className="text-xs text-muted">Your purse {E.money(purse)}</div>
        </div>
      </div>
      {left > 0 && !leading && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {quick.map((a, i) => (
              <button key={i} disabled={!valid(a)} onClick={() => setPick(a)} className={cx('rounded-xl border px-3 py-3 font-[family-name:var(--font-display)] text-xl font-bold num transition disabled:opacity-30', pick === a ? 'border-gold bg-gold/20 text-gold' : 'border-line-2 bg-panel-2')}>
                {i === 0 ? (l.high ? 'Min' : 'Opening') : `+${E.money(a - min)}`}<span className="block text-sm font-normal text-muted">{E.money(a)}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input id="p-custom" className="field num" inputMode="decimal" placeholder="Custom amount in ₹ Cr, e.g. 2.4" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ''))} />
            <Btn variant="subtle" disabled={!custom || !valid(customLakh)} onClick={() => setPick(customLakh)}>Set</Btn>
          </div>
          {custom && !valid(customLakh) && <p className="mt-1 text-xs text-warn">{customLakh > purse ? 'More than your purse.' : customLakh < min ? `At least ${E.money(min)}.` : `Use steps of ${E.money(inc)}.`}</p>}
          <Btn variant="gold" size="xl" className="mt-3 w-full" disabled={pick === null || busy || !valid(pick)} onClick={send}>{pick === null ? 'Choose an amount' : `CONFIRM BID ${E.money(pick)}`}</Btn>
        </>
      )}
      {leading && left > 0 && <p className="mt-4 rounded-xl bg-ok/10 px-3 py-3 text-center font-semibold text-ok">You're the highest bidder. Wait for others…</p>}
      {left === 0 && <p className="mt-4 text-center font-semibold text-muted">Bidding closed.</p>}
      {note && <p className={cx('mt-2 text-center text-sm', note.ok ? 'text-ok' : 'text-live')}>{note.t}</p>}
    </div>
  );
}

function AnswerPad({ code, pub, me }: { code: string; pub: Pub; me: Me }) {
  const q = pub.q!;
  const eligible = q.elig === 'all' || (q.elig === 'owner' ? q.owner === me.team : q.owner !== me.team);
  const [locked, setLocked] = useState<string | null>(() => { try { return localStorage.getItem(ANS(code, q.win)); } catch { return null; } });
  const [pick, setPick] = useState<number | null>(null);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const left = useLeft(q.deadline);
  const submit = async () => {
    const c = q.type === 'oneword' ? word.trim() : pick;
    if (c === null || c === '') return;
    setBusy(true); setErr('');
    const r = await submitAnswer(code, q.win, me.team, c);
    setBusy(false);
    const shown = typeof c === 'number' ? `${String.fromCharCode(65 + c)}. ${q.options[c]}` : c;
    if (r === 'ok') { setLocked(shown); try { localStorage.setItem(ANS(code, q.win), shown); } catch { /* */ } }
    else if (r === 'rejected') { setErr(left > 0 ? 'Already answered for this team.' : 'Too late, time ran out.'); if (left > 0) setLocked('(already submitted)'); }
    else setErr('No connection. Try again quickly!');
  };
  return (
    <div>
      <div className="flex items-start gap-3">
        <Countdown deadline={q.deadline} total={pub.cfg.answerSec} size={84} />
        <div className="min-w-0">
          {q.n === 2 && <div className="mb-1 inline-block rounded bg-live/20 px-2 py-0.5 text-xs font-bold text-live">OPEN TO EVERYONE · {q.reward} pts</div>}
          <p className="text-lg font-semibold leading-snug">{q.prompt}</p>
        </div>
      </div>
      <CodeBlock code={q.code} className="mt-3 text-sm" />
      {q.image && <img src={q.image} alt="" className="mt-3 max-h-48 rounded-xl" />}
      {!eligible ? (
        <p className="mt-4 rounded-xl bg-panel-2 px-3 py-3 text-center text-muted">{q.elig === 'owner' ? `Team ${q.owner} is answering. If they get it wrong, it opens to everyone, so get ready!` : 'You missed it. The other teams are answering now.'}</p>
      ) : locked ? (
        <div className="mt-4 rounded-xl border border-ok/50 bg-ok/10 p-4 text-center">
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-ok">ANSWER LOCKED 🔒</div>
          <p className="mt-1">{locked}</p>
        </div>
      ) : left === 0 ? (
        <p className="mt-4 text-center font-semibold text-live">Time's up. No answer sent.</p>
      ) : (
        <>
          {q.type === 'oneword' ? (
            <input id="p-word" className="field mt-4 !h-14 text-center text-xl" autoCapitalize="off" autoComplete="off" autoCorrect="off" maxLength={40} placeholder="One word" value={word} onChange={(e) => setWord(e.target.value)} />
          ) : (
            <div className="mt-4 grid gap-2">
              {q.options.map((o, i) => (
                <button key={i} onClick={() => setPick(i)} className={cx('flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-base font-semibold transition', pick === i ? 'border-info bg-info/15' : 'border-line-2 bg-panel-2')}>
                  <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg font-[family-name:var(--font-display)]', pick === i ? 'bg-info text-ink' : 'bg-ink/60 text-info')}>{String.fromCharCode(65 + i)}</span>{o}
                </button>
              ))}
            </div>
          )}
          <Btn variant="primary" size="xl" className="mt-3 w-full" disabled={busy || (q.type === 'oneword' ? !word.trim() : pick === null)} onClick={submit}>{busy ? 'Sending…' : 'SUBMIT ANSWER'}</Btn>
          <p className="mt-1 text-center text-xs text-dim">You can't change it after submitting.</p>
        </>
      )}
      {err && <p className="mt-2 text-center text-sm text-live">{err}</p>}
    </div>
  );
}

function ResultPhone({ pub, l, me, priv }: { pub: Pub; l: PubLot; me: Me; priv: Priv | null }) {
  const r = pub.res!;
  const mine = r.scores.filter((x) => x.team === me.team).reduce((a, x) => a + x.pts, 0);
  return (
    <div className="text-center">
      <div className="label">Correct answer</div>
      <div className="font-[family-name:var(--font-display)] text-3xl font-bold text-ok">{r.answer}</div>
      {r.explain && <p className="mt-1 text-sm text-muted">{r.explain}</p>}
      <div className={cx('mt-4 rounded-xl p-4', mine > 0 ? 'bg-ok/15' : 'bg-panel-2')}>
        {mine > 0 ? <div className="font-[family-name:var(--font-display)] text-4xl font-bold text-ok animate-stamp">+{mine} pts</div> : <div className="text-lg text-muted">{l.kind === 'vault' && l.owner !== me.team ? 'Not your vault this time.' : 'No points this time.'}</div>}
        {priv && <p className="mt-1 text-sm text-muted">Total: {priv.points} pts · {E.money(priv.purse)}</p>}
      </div>
    </div>
  );
}

function MyTeam({ pub, priv }: { pub: Pub; priv: Priv | null }) {
  const rank = pub.board?.find((r) => r.team === priv?.no)?.rank;
  if (!priv) return null;
  return (
    <div className="panel p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold uppercase">Your team{priv.practice ? ' (practice)' : ''}</h3>
        {rank && <span className="text-sm text-muted">Rank <b className="text-fg">#{rank}</b> of {pub.board!.length}</span>}
      </div>
      <p className="text-sm text-muted">{priv.members.join(' · ')}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-ink/50 p-3"><div className="label">Purse</div><div className="font-[family-name:var(--font-display)] text-2xl font-bold text-gold num">{E.money(priv.purse)}</div></div>
        <div className="rounded-xl bg-ink/50 p-3"><div className="label">Points</div><div className="font-[family-name:var(--font-display)] text-2xl font-bold num">{priv.points}</div></div>
      </div>
      {priv.buys.length > 0 && (
        <div className="mt-3 flex flex-col gap-1 text-sm">
          {priv.buys.map((b, i) => <div key={i} className="flex justify-between gap-2"><span className="truncate"><b>{b.label}</b> {b.title}</span><span className="shrink-0 text-muted num">{E.money(b.price)} · {b.pts >= 0 ? '+' : ''}{b.pts}</span></div>)}
        </div>
      )}
    </div>
  );
}

function FinalPhone({ pub, me }: { pub: Pub; me: Me }) {
  const f = pub.final!;
  const r = f.rows.find((x) => x.team === me.team);
  return (
    <div className="panel p-6 text-center">
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase cyan-text">Final results</h2>
      {!r ? <p className="mt-4 text-lg">Watch the big screen… 👀</p> : (
        <>
          <div className="mt-4 font-[family-name:var(--font-display)] text-6xl font-bold num">{r.rank === 1 ? '🏆' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}</div>
          <p className="mt-1 text-lg">{r.rank <= 3 ? ['Champions!', 'Runner-up!', 'Third place!'][r.rank - 1] : `You finished #${r.rank} of ${f.rows.length}`}</p>
          <div className="mt-4 font-[family-name:var(--font-display)] text-4xl font-bold text-gold num">{r.final} pts</div>
          <p className="text-sm text-muted">{r.points} points + {r.cashPts} from {E.money(r.purse)} left</p>
        </>
      )}
    </div>
  );
}
