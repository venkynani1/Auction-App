// Participant side: opened on phones from the QR code. No local game state, everything comes from Firebase.
import { useEffect, useState } from 'react';
import { checkPin, roomsConfigured, submitBid, subscribe, type RoomStatus, type RoomTeam } from '../lib/rooms';
import { money, MONEY, pad2 } from '../lib/util';
import { Wordmark } from '../components/Brand';
import { Btn, cx, TeamDot } from '../components/ui';

const ROUND_COLORS = ['#FF6A3D', '#2FD58A', '#A07BFF', '#FF4FA3'];
const ROUND_SHORT = ['Actors', 'Cricketers', 'Music', 'Mystery'];
const SAVED = (code: string) => `bidwars-room:${code}`;
const MYBID = (code: string, win: string, no: number) => `bidwars-bid:${code}:${win}:${no}`;

/** This phone's team (and PIN) for a room code. Older saves held just the team number. */
interface Saved { team: number; pin: string }
function readSaved(code: string): Saved | null {
  try {
    const raw = localStorage.getItem(SAVED(code));
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (typeof v === 'number') return { team: v, pin: '' };
    const o = v as Saved;
    return o && typeof o.team === 'number' ? { team: o.team, pin: String(o.pin ?? '') } : null;
  } catch { return null; }
}
const writeSaved = (code: string, v: Saved | null) => {
  try { if (v) localStorage.setItem(SAVED(code), JSON.stringify(v)); else localStorage.removeItem(SAVED(code)); } catch { /* ignore */ }
};

export function parseRoomHash(hash: string): { code: string; team: number | null } | null {
  const m = /^#join\/([A-Z0-9]{4,12})(?:\/(\d{1,3}))?$/i.exec(hash);
  return m ? { code: m[1]!.toUpperCase(), team: m[2] ? Number(m[2]) : null } : null;
}

export function RoomApp({ code, team }: { code: string; team: number | null }) {
  const [status, setStatus] = useState<RoomStatus | null | undefined>(undefined);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!roomsConfigured) return;
    let off = () => {};
    subscribe<RoomStatus>(`events/${code}/status`, setStatus, (e) => setErr(e.message)).then((u) => (off = u)).catch((e) => setErr(String(e)));
    return () => off();
  }, [code]);

  const [saved, setSaved] = useState<Saved | null>(() => readSaved(code));
  const [pinOk, setPinOk] = useState<'checking' | 'ok' | 'wrong'>('checking');
  const needPin = !!status?.pinRequired;
  const savedPin = saved && saved.team === team ? saved.pin : '';

  // A re-scan of the plain QR code goes straight back into this phone's team room.
  useEffect(() => {
    if (team || !saved || !status || status.phase === 'closed' || saved.team > status.teamCount) return;
    if (status.pinRequired && !saved.pin) return;
    location.hash = `join/${code}/${saved.team}`;
  }, [code, team, saved, status]);

  // Re-check a remembered PIN once (the organiser may have made new PINs).
  useEffect(() => {
    if (!team || !needPin) return;
    if (!savedPin) { setPinOk('wrong'); return; }
    let alive = true;
    setPinOk('checking');
    checkPin(code, team, savedPin).then((r) => { if (alive) setPinOk(r === 'wrong' ? 'wrong' : 'ok'); });
    return () => { alive = false; };
  }, [code, team, needPin, savedPin]);

  const join = (no: number, pin: string) => { const v = { team: no, pin }; writeSaved(code, v); setSaved(v); setPinOk('ok'); location.hash = `join/${code}/${no}`; };
  const leave = () => { writeSaved(code, null); setSaved(null); location.hash = `join/${code}`; };

  let body: React.ReactNode;
  if (!roomsConfigured) body = <Notice title="Rooms are not set up" text="The organiser still needs to connect the app to Firebase." />;
  else if (err) body = <Notice title="Can't connect" text="Check your internet connection and scan the QR code again." />;
  else if (status === undefined) body = <Notice title="Connecting…" text="" spin />;
  else if (status === null) body = <Notice title="Room not found" text={`There is no auction with the code ${code}. Scan the QR code on the screen again.`} />;
  else if (status.phase === 'closed') body = <Notice title="Rooms are closed" text="The organiser hasn't opened the team rooms yet. Keep this page open; it updates by itself." />;
  else if (!team || team > status.teamCount) body = <JoinForm code={code} status={status} bad={!!team} onJoin={join} />;
  else if (needPin && pinOk === 'wrong') body = <JoinForm code={code} status={status} bad={false} onJoin={join} team={team} pinChanged={!!savedPin} />;
  else if (needPin && pinOk === 'checking') body = <Notice title="Checking your PIN…" text="" spin />;
  else body = <TeamRoom code={code} no={team} pin={savedPin} status={status} onLeave={leave} />;

  return (
    <div className="stage-bg min-h-screen">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-ink/90 px-4 py-2.5 backdrop-blur">
        <Wordmark name={status?.event || 'BID WARS'} size="sm" />
        <span className="rounded-md border border-line px-2 py-0.5 font-[family-name:var(--font-cond)] text-xs tracking-widest text-muted">ROOM {code}</span>
      </header>
      <main className="mx-auto max-w-md px-4 pb-10 pt-4">{body}</main>
    </div>
  );
}

function Notice({ title, text, spin }: { title: string; text: string; spin?: boolean }) {
  return (
    <div className="panel mt-10 p-6 text-center">
      {spin && <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-line border-t-gold" />}
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-black uppercase">{title}</h1>
      {text && <p className="mt-2 text-muted">{text}</p>}
    </div>
  );
}

function JoinForm({ code, status, bad, onJoin, team, pinChanged }: { code: string; status: RoomStatus; bad: boolean; onJoin: (no: number, pin: string) => void; team?: number; pinChanged?: boolean }) {
  const [v, setV] = useState(team ? String(team) : '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(pinChanged ? 'Your team PIN has changed. Ask the organiser for the new one.' : '');
  const n = Number(v);
  const ok = Number.isInteger(n) && n >= 1 && n <= status.teamCount;
  const needPin = status.pinRequired;
  const pinOk = !needPin || /^\d{4}$/.test(pin);
  const submit = async () => {
    if (!ok || !pinOk || busy) return;
    if (!needPin) return onJoin(n, '');
    setBusy(true); setErr('');
    const r = await checkPin(code, n, pin);
    setBusy(false);
    if (r === 'ok') onJoin(n, pin);
    else setErr(r === 'wrong' ? `That PIN is not right for team ${n}.` : 'No connection. Check your internet and try again.');
  };
  return (
    <form className="panel mt-6 p-6" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="label">Join your team room</div>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-black uppercase leading-none">{team ? `Team ${team}: enter your PIN` : "What's your team number?"}</h1>
      <p className="mt-2 text-sm text-muted">{needPin ? 'Use the team number and 4-digit PIN the organiser gave your team.' : `Use the number the organiser gave your team (1 to ${status.teamCount}).`}</p>
      <div className={cx('mt-5 grid gap-3', needPin && 'grid-cols-2')}>
        <label className="block">
          {needPin && <span className="label">Team no.</span>}
          <input id="room-no" autoFocus={!team} inputMode="numeric" pattern="[0-9]*" className="field !h-20 text-center font-[family-name:var(--font-display)] !text-5xl font-black num"
            placeholder="#" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </label>
        {needPin && (
          <label className="block">
            <span className="label">PIN</span>
            <input id="room-pin" autoFocus={!!team} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" className="field !h-20 text-center font-[family-name:var(--font-display)] !text-5xl font-black tracking-[.2em] num"
              placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </label>
        )}
      </div>
      {(bad || (v && !ok)) && <p className="mt-2 text-sm text-live">Team numbers go from 1 to {status.teamCount}.</p>}
      {err && <p className="mt-2 text-sm text-live">{err}</p>}
      <Btn variant="gold" size="lg" className="mt-4 w-full" disabled={!ok || !pinOk || busy}>{busy ? 'Checking…' : 'Enter room ▶'}</Btn>
    </form>
  );
}

function TeamRoom({ code, no, pin, status, onLeave }: { code: string; no: number; pin: string; status: RoomStatus; onLeave: () => void }) {
  const [t, setT] = useState<RoomTeam | null | undefined>(undefined);
  useEffect(() => {
    let off = () => {};
    setT(undefined);
    subscribe<RoomTeam>(`events/${code}/teams/${no}`, setT).then((u) => (off = u)).catch(() => setT(null));
    return () => off();
  }, [code, no]);

  if (t === undefined) return <Notice title="Loading your room…" text="" spin />;
  if (t === null) return <Notice title={`Team ${no} not found`} text="Check your team number with the organiser." />;

  const players = t.players ?? [];
  const bonuses = t.bonuses ?? [];
  const final = status.phase === 'final';
  const hiddenPts = !final && players.some((p) => p.pts == null && p.round === 3);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl font-[family-name:var(--font-display)] text-2xl font-black text-ink num" style={{ background: t.color }}>{no}</span>
        <div className="min-w-0 flex-1">
          <div className="label">Your team</div>
          <h1 className="truncate font-[family-name:var(--font-display)] text-3xl font-black uppercase leading-none" style={{ color: t.color }}>{t.name}</h1>
        </div>
        <button onClick={onLeave} className="text-xs text-dim underline">Not you?</button>
      </div>

      <StatusCard status={status} myNo={no} />
      {status.bidding && <BidCard code={code} no={no} pin={pin} team={t} bidding={status.bidding} />}

      <div className="grid grid-cols-2 gap-2">
        <Stat k="Purse left" v={money(t.purse)} sub={`of ${money(t.startPurse + bonuses.reduce((a, b) => a + b.cash, 0))}`} gold />
        <Stat k={final ? 'Final points' : 'Points'} v={String(final ? t.final : t.points)} sub={final ? `incl. ${t.pursePts} purse pts` : hiddenPts ? '+ secret round 3 pts' : 'purse pts added at the end'} />
        <Stat k="Spent" v={money(t.spent)} />
        <Stat k="Players" v={String(players.length)} />
      </div>

      {final && (
        <div className="panel p-4 text-center">
          {t.rank
            ? <><div className="label">Final position</div><div className="font-[family-name:var(--font-display)] text-6xl font-black gold-text num">#{t.rank}</div>{t.rank === 1 && <div className="font-[family-name:var(--font-display)] text-2xl font-black uppercase text-gold-2">Champions! 🏆</div>}</>
            : <><div className="label">Final points are in</div><div className="mt-1 text-muted">Watch the big screen for the winners…</div></>}
        </div>
      )}

      <section className="panel p-4">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-2xl font-black uppercase">Your players</h2>
        {players.length === 0 && <p className="text-sm text-muted">No players yet. Start bidding!</p>}
        <div className="flex flex-col gap-1.5">
          {players.map((p, i) => (
            <div key={i} className="rounded-lg bg-panel-2/70 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ROUND_COLORS[p.round - 1] }} />
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                <span className="text-sm text-muted num">{money(p.price)}</span>
                <span className="w-16 text-right font-bold num">{p.pts == null ? <span className="text-dim">{p.round === 4 ? 'slip' : 'secret'}</span> : `${p.pts} pts`}</span>
              </div>
              <div className="ml-[18px] text-xs text-dim">{ROUND_SHORT[p.round - 1]}{p.role ? ` · ${p.role}` : ''}</div>
              {p.note && <div className="ml-[18px] mt-0.5 text-xs text-gold-2">{p.note}</div>}
            </div>
          ))}
        </div>
      </section>

      {bonuses.length > 0 && (
        <section className="panel p-4">
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-2xl font-black uppercase">Bonuses</h2>
          {bonuses.map((b, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-line/60 py-1.5 text-sm last:border-0">
              <span className="flex-1">{b.label}</span>
              {b.pts !== 0 && <b className={cx('num', b.pts < 0 ? 'text-live' : 'text-ok')}>{b.pts > 0 ? '+' : ''}{b.pts} pts</b>}
              {b.cash !== 0 && <b className={cx('num', b.cash < 0 ? 'text-live' : 'text-ok')}>{b.cash > 0 ? '+' : '−'}{money(Math.abs(b.cash))}</b>}
            </div>
          ))}
        </section>
      )}
      <p className="text-center text-xs text-dim">This page updates live. Keep it open.</p>
    </div>
  );
}

function BidCard({ code, no, pin, team, bidding }: { code: string; no: number; pin: string; team: RoomTeam; bidding: NonNullable<RoomStatus['bidding']> }) {
  const key = MYBID(code, bidding.id, no);
  const [myAmount, setMyAmount] = useState<number | null>(() => { try { const x = localStorage.getItem(key); return x ? Number(x) : null; } catch { return null; } });
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    setEditing(false); setV(''); setErr('');
    try { const x = localStorage.getItem(key); setMyAmount(x ? Number(x) : null); } catch { setMyAmount(null); }
  }, [key]);
  // Bids are private until the organiser shows them; the host only tells us whether our team has bid.
  const teamHasBid = team.bidWin === bidding.id || myAmount != null;

  const amount = Number(v);
  const valid = v !== '' && amount > 0 && Number.isFinite(amount);
  const tooMuch = valid && amount > team.purse + 1e-9;
  const send = async () => {
    if (!valid || tooMuch || sending) return;
    setSending(true); setErr('');
    const amt = Math.round(amount * 100) / 100;
    try {
      await submitBid(code, bidding.id, no, amt, team.name, pin);
      try { localStorage.setItem(key, String(amt)); } catch { /* ignore */ }
      setMyAmount(amt); setEditing(false);
    } catch { setErr('Bid not accepted. Bidding may have closed, someone in your team may have bid already, or the PIN has changed.'); }
    finally { setSending(false); }
  };

  const shell = (children: React.ReactNode) => (
    <div className="panel overflow-hidden border-2" style={{ borderColor: 'var(--color-gold)' }}>
      <div className="flex items-center justify-between bg-gold/15 px-4 py-2">
        <span className="font-[family-name:var(--font-cond)] text-sm font-bold tracking-widest text-gold-2">TEAM BIDDING</span>
        <span className={cx('text-xs font-semibold', bidding.open ? 'text-ok' : 'text-muted')}>{bidding.open ? '● OPEN' : 'CLOSED'}</span>
      </div>
      <div className="p-4">{bidding.lot && <div className="mb-2 text-sm text-muted">For <b className="text-fg">{bidding.lot}</b>{bidding.base ? ` · base ${money(bidding.base)}` : ''}</div>}{children}</div>
    </div>
  );

  if (teamHasBid) {
    return shell(
      <div className="text-center">
        <div className="label">Your team's bid is in ✓</div>
        {myAmount != null ? <div className="font-[family-name:var(--font-display)] text-5xl font-black gold-text num">{MONEY(myAmount)}</div> : <div className="text-sm text-muted">Placed from a teammate's phone.</div>}
        <div className="mt-1 text-xs text-dim">One bid per team. Watch the big screen for the result.</div>
      </div>,
    );
  }
  if (!bidding.open) return shell(<p className="text-center text-muted">Bidding has closed. Your team did not bid.</p>);
  if (!editing) {
    return shell(
      <Btn variant="gold" size="xl" className="w-full animate-glow" style={{ ['--glow' as string]: 'var(--color-gold)' }} onClick={() => setEditing(true)}>BID 🔨</Btn>,
    );
  }
  return shell(
    <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <label className="label" htmlFor="bid-amt">Your bid in crores (50 L = 0.5)</label>
      <div className="mt-1 flex items-center gap-2">
        <span className="font-[family-name:var(--font-display)] text-4xl font-black text-gold-2">₹</span>
        <input id="bid-amt" autoFocus inputMode="decimal" className="field !h-16 flex-1 font-[family-name:var(--font-display)] !text-4xl font-black num"
          placeholder="0.0" value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7))} />
        <span className="font-[family-name:var(--font-display)] text-2xl font-black text-muted">Cr</span>
      </div>
      <div className="mt-1 min-h-5 text-sm">{tooMuch ? <span className="text-live">You only have {money(team.purse)} left.</span> : valid ? <span className="text-muted">= {money(amount)} · you have {money(team.purse)}</span> : <span className="text-dim">You have {money(team.purse)} left.</span>}</div>
      {err && <p className="text-sm text-live">{err}</p>}
      <div className="mt-2 grid grid-cols-[1fr_2fr] gap-2">
        <Btn type="button" variant="ghost" size="lg" onClick={() => { setEditing(false); setV(''); }}>Cancel</Btn>
        <Btn variant="gold" size="lg" disabled={!valid || tooMuch || sending}>{sending ? 'Sending…' : 'Confirm bid'}</Btn>
      </div>
      <p className="mt-2 text-xs text-dim">You can bid only once. It can't be changed after you confirm.</p>
    </form>,
  );
}

function Stat({ k, v, sub, gold }: { k: string; v: string; sub?: string; gold?: boolean }) {
  return (
    <div className="panel p-3">
      <div className="label">{k}</div>
      <div key={v} className={cx('font-[family-name:var(--font-display)] text-3xl font-black leading-tight num animate-bid-pop', gold && 'gold-text')}>{v}</div>
      {sub && <div className="text-xs text-dim">{sub}</div>}
    </div>
  );
}

function StatusCard({ status, myNo }: { status: RoomStatus; myNo: number }) {
  const color = status.roundColor;
  if (status.phase === 'waiting') {
    return (
      <div className="panel p-5 text-center">
        <div className="label text-ok">You're in ✓</div>
        <div className="mt-1 font-[family-name:var(--font-display)] text-3xl font-black uppercase">The auction starts soon</div>
        <div className="mt-2 font-[family-name:var(--font-cond)] tracking-[.2em] text-fg/60 animate-blink">PADDLES READY</div>
      </div>
    );
  }
  if (status.phase === 'done') return <div className="panel p-5 text-center"><div className="label">All 4 rounds done</div><div className="mt-1 font-[family-name:var(--font-display)] text-3xl font-black uppercase">Waiting for the final points…</div></div>;
  if (status.phase === 'final') return <div className="panel p-4 text-center"><div className="label text-gold-2">Auction over</div><div className="font-[family-name:var(--font-display)] text-3xl font-black uppercase">Final results</div></div>;

  const L = status.live;
  const mine = L?.leader === myNo;
  return (
    <div className="panel overflow-hidden" style={{ borderColor: color }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: `${color}22` }}>
        <span className="flex items-center gap-2 font-[family-name:var(--font-cond)] text-sm font-bold tracking-widest"><span className="h-2 w-2 rounded-full bg-live animate-blink" />AUCTION LIVE</span>
        <span className="font-[family-name:var(--font-cond)] text-sm font-bold tracking-widest" style={{ color }}>ROUND {status.round} OF 4</span>
      </div>
      <div className="p-4">
        <div className="font-[family-name:var(--font-display)] text-2xl font-black uppercase leading-none" style={{ color }}>{status.roundName}</div>
        {!L ? <p className="mt-2 text-muted">Next lot coming up…</p> : (
          <div className="mt-3 rounded-xl border border-line bg-ink/40 p-3">
            <div className="flex items-center gap-2 text-xs text-muted"><span className="rounded px-1.5 font-bold text-ink num" style={{ background: color }}>LOT {pad2(L.lot)}</span>{L.state === 'sold' ? 'SOLD' : L.state === 'unsold' ? 'UNSOLD' : `Base ${L.base ? money(L.base) : 'open'}`}</div>
            <div className="mt-1 break-words font-[family-name:var(--font-display)] text-3xl font-black uppercase leading-none">{L.name}</div>
            {L.role && <div className="text-sm text-muted">{L.role}</div>}
            {L.state !== 'unsold' && (
              <div className="mt-2 flex items-end justify-between gap-2">
                <div key={L.bid} className="font-[family-name:var(--font-display)] text-4xl font-black gold-text num animate-bid-pop">{MONEY(L.bid)}</div>
                <div className={cx('min-w-0 truncate pb-1 text-right text-sm font-semibold', mine && 'text-ok')}>
                  {L.leaderName ? (mine ? (L.state === 'sold' ? 'Yours! 🎉' : 'You lead 👑') : <><TeamDot color="#8e98b8" size={8} /> {L.leaderName}</>) : 'No bids yet'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
