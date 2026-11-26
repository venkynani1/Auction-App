import { useEffect, useMemo, useState } from 'react';
import * as E from '../engine';
import type { HostState, Lot } from '../types';
import { coKey, hostLink, joinLink, serverNow, useServerNow } from '../fb';
import { HostProvider, useHost } from './store';
import { clock, CodeBlock, Countdown, DiffChip, QR, TeamBadge } from '../ui';
import { Btn, confirmDialog, ConfirmHost, cx, Field, Label, Modal, toast, ToastHost } from '../../components/ui';
import { copyText } from '../../lib/util';
import { unlockAudio } from '../../lib/sound';
import { BankTab, LotsTab, SettingsTab, TeamsTab } from './Tabs';

type Tab = 'live' | 'teams' | 'lots' | 'bank' | 'settings';
const TABS: [Tab, string][] = [['live', 'Live control'], ['teams', 'Teams'], ['lots', 'Played'], ['bank', 'Questions'], ['settings', 'Settings & log']];

export function HostApp({ code }: { code: string }) {
  return (
    <HostProvider code={code}>
      <HostShell />
      <ConfirmHost />
      <ToastHost />
    </HostProvider>
  );
}

function HostShell() {
  const { s, link, muted, setMuted, online } = useHost();
  const [tab, setTab] = useState<Tab>('live');
  const now = useServerNow(500);
  const sch = E.scheduleStatus(s, now);
  const total = E.EVENT_MINUTES(s.cfg);
  return (
    <div className="stage-bg min-h-screen" onClick={unlockAudio}>
      <header className="z-50 border-b border-line bg-ink/90 backdrop-blur md:sticky md:top-0">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <a href="#cc" className="font-[family-name:var(--font-display)] text-xl font-bold uppercase"><span className="cyan-text">Code</span><span className="text-gold">&amp;</span><span className="cyan-text">Chaos</span></a>
          <span className="rounded-md bg-info/15 px-2 py-0.5 font-[family-name:var(--font-display)] font-bold tracking-widest text-info">{s.code}</span>
          <span className="hidden min-w-0 truncate text-sm text-muted md:inline">{s.cfg.name}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <StagePill s={s} />
            <div className={cx('rounded-lg border px-3 py-1 text-sm num', sch.overDeadline ? 'border-live text-live' : 'border-line')} title="Event timer">
              ⏱ <b className="font-[family-name:var(--font-display)] text-base">{s.clockStart ? clock(now - s.clockStart) : '00:00'}</b><span className="text-dim"> / {total}:00</span>
            </div>
            <span className="text-xs text-muted" title="Team phones online">📱 {online.size}</span>
            <a className="rounded-lg border border-line-2 px-3 py-1.5 text-sm font-semibold hover:border-info" href={`#cc/screen/${s.code}`} target="_blank" rel="noreferrer">Projector ↗</a>
            <AddDevice />
            <Btn size="sm" variant="ghost" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</Btn>
            <span className={cx('h-2.5 w-2.5 rounded-full', link === 'live' ? 'bg-ok' : 'bg-live animate-blink')} title={link === 'live' ? 'Connected' : 'Not connected'} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1700px] gap-1 overflow-x-auto px-3 pb-1.5 scroll-thin">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold', tab === k ? 'bg-panel-2 text-info' : 'text-muted hover:text-fg')}>{l}</button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1700px] px-4 py-4">
        {tab === 'live' && <Live />}
        {tab === 'teams' && <TeamsTab />}
        {tab === 'lots' && <LotsTab />}
        {tab === 'bank' && <BankTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

/** Let a second person control the event from another phone or laptop at the same time. */
function AddDevice() {
  const { s, role, makeMain } = useHost();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  if (role === 'co') {
    return (
      <>
        <span className="rounded-lg bg-violet/20 px-2.5 py-1 text-xs font-bold text-[#c3b1ff]" title="Changes you make go to the main device, which runs the timers and scoring.">2nd CONTROLLER</span>
        <button className="rounded-lg border border-line-2 px-3 py-1.5 text-sm font-semibold hover:border-info" onClick={async () => { if (await confirmDialog('Make this the main device?', 'Use this if the main device has stopped working. This device will run the timers and scoring, so keep it open with the screen on. The other device stays a controller.', 'Make main', false)) void makeMain(); }}>Make main</button>
      </>
    );
  }
  const show = async (rotate = false) => {
    setOpen(true);
    try { setKey(await coKey(s.code, rotate)); if (rotate) toast('Other devices were removed. Scan the new code to add one again.', 'ok'); }
    catch { toast('Could not reach Firebase.', 'warn'); setOpen(false); }
  };
  const link = key ? hostLink(s.code, `co-${key}`) : '';
  return (
    <>
      <button className="rounded-lg border border-line-2 px-3 py-1.5 text-sm font-semibold hover:border-info" onClick={() => show()}>📱 Add device</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Control from a second device">
        {!key ? <p className="text-muted">Preparing…</p> : (
          <div className="text-center">
            <QR text={link} className="mx-auto w-full max-w-[240px]" />
            <ol className="mt-4 space-y-1 text-left text-sm">
              <li>1. Scan with the helper's phone or laptop (not a team's phone).</li>
              <li>2. Both devices can now run the auction at the same time: start lots, confirm sales, reveal challenges, fix points.</li>
              <li>3. <b>This device is the main one</b>: it runs the timers and scoring, so keep it open and online. If it ever stops, press <b>Make main</b> on the other device.</li>
            </ol>
            <div className="mt-3 flex gap-2">
              <input readOnly id="cohost-link" className="field text-xs" value={link} onFocus={(e) => e.currentTarget.select()} />
              <Btn size="sm" variant="subtle" onClick={async () => toast((await copyText(link)) ? 'Link copied.' : 'Copy blocked: select the link and copy it.', 'ok')}>Copy</Btn>
            </div>
            <button className="mt-3 text-xs text-muted underline hover:text-live" onClick={async () => { if (await confirmDialog('Remove all other devices?', 'Every added device loses control immediately. This QR code stops working.', 'Remove')) void show(true); }}>Remove all other devices</button>
          </div>
        )}
      </Modal>
    </>
  );
}

function StagePill({ s }: { s: HostState }) {
  const map = { registration: ['Registration', 'bg-info/15 text-info'], practice: ['Practice', 'bg-panel-2 text-muted'], live: ['LIVE', 'bg-live/20 text-live'], final: ['Final results', 'bg-gold/20 text-gold'] } as const;
  const [t, c] = map[s.stage];
  return <span className={cx('rounded-lg px-2.5 py-1 text-xs font-bold tracking-widest uppercase', c)}>{t}</span>;
}

// =====================================================================================================
function Live() {
  const { s } = useHost();
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="min-w-0">
        {s.stage === 'registration' && <RegistrationPanel />}
        {(s.stage === 'practice' || s.stage === 'live') && (E.curLot(s) ? <LotControl /> : <NextLot />)}
        {s.stage === 'final' && <FinalPanel />}
      </section>
      <aside className="flex min-w-0 flex-col gap-4">
        <EventPanel />
        <BoardPanel />
        <QuickPanel />
      </aside>
    </div>
  );
}

function RegistrationPanel() {
  const { s, act, online } = useHost();
  const regs = E.registeredTeams(s);
  const link = joinLink(s.code);
  const allowed = s.cfg.teamNos.filter((n) => s.teams[n]?.eligible);
  return (
    <div className="panel p-5 sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div>
          <QR text={link} className="mx-auto w-full max-w-[160px] sm:max-w-[300px] lg:mx-0" />
          <div className="mt-3 flex gap-2">
            <input readOnly id="join-link" className="field text-xs" value={link} onFocus={(e) => e.currentTarget.select()} />
            <Btn size="sm" variant="subtle" onClick={async () => toast((await copyText(link)) ? 'Link copied.' : 'Copy blocked: select the link and copy it.', 'ok')}>Copy</Btn>
          </div>
        </div>
        <div>
          <Label>Team registration · one phone per team</Label>
          <div className="mt-1 font-[family-name:var(--font-display)] text-6xl font-bold num"><span className="text-info">{regs.length}</span><span className="text-dim"> / {allowed.length}</span></div>
          <p className="text-muted">teams registered · {online.size} phones online · registration is <b className={s.regOpen ? 'text-ok' : 'text-live'}>{s.regOpen ? 'open' : 'closed'}</b>{s.cfg.regCode ? ` · code ${s.cfg.regCode}` : ''}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {allowed.map((no) => {
              const t = s.teams[no]!;
              return <span key={no} title={t.members?.join(', ') ?? 'Not registered'} className={cx('grid h-10 w-12 place-items-center rounded-lg border font-[family-name:var(--font-display)] font-bold num', t.members ? online.has(no) ? 'border-ok bg-ok/15 text-ok' : 'border-info bg-info/10 text-info' : 'border-line text-dim')}>{no}</span>;
            })}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {!s.clockStart && <Btn variant="outline" onClick={() => act((x) => E.startClock(x, serverNow()), 'Event timer started.')}>⏱ Start event timer</Btn>}
            <Btn variant="subtle" onClick={() => act((x) => E.setRegOpen(x, !x.regOpen))}>{s.regOpen ? 'Close registration' : 'Reopen registration'}</Btn>
            <Btn variant="outline" onClick={() => act((x) => E.startPractice(x, serverNow()), 'Practice started.')}>Start practice auction</Btn>
            <Btn variant="primary" size="lg" onClick={async () => { if (await confirmDialog('Start the actual event?', `Every registered team (${regs.length}) gets ${E.money(s.cfg.purse)} and 0 points. Registration closes. This can't be undone.`, 'Start event', false)) act((x) => E.startLive(x, serverNow()), 'The event is live!'); }}>▶ Start actual event</Btn>
          </div>
          <p className="mt-3 text-xs text-dim">Show the projector (button at the top) so teams can scan the QR code. Teams type their team number, four names and a PIN.</p>
        </div>
      </div>
    </div>
  );
}

const played = (s: HostState) => s.lots.filter((l) => !l.practice && l.status !== 'skipped').length;

function NextLot() {
  const { s, act } = useHost();
  const [diff, setDiff] = useState<'any' | 'Medium' | 'Hard'>('any');
  const [qid, setQid] = useState('');
  const mode = s.cfg.bidMode ?? 'physical';
  const left = E.unusedQuestions(s, diff);
  const practice = s.stage === 'practice';
  const n = s.lots.filter((l) => l.practice === practice).reduce((m, l) => Math.max(m, l.seq), 0) + 1;
  const go = () => { if (act((x) => E.nextQuestion(x, serverNow(), { qid: qid || undefined, difficulty: diff }))) setQid(''); };
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line p-5 sm:p-7" style={{ background: 'linear-gradient(120deg, #22e3ff22, transparent 60%)' }}>
        <Label>{practice ? 'Practice (dummy money)' : `${played(s)} questions played`}</Label>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-[clamp(30px,4vw,54px)] font-bold uppercase leading-none">{practice ? `Practice ${n}` : `Lot ${String(n).padStart(2, '0')}`}: next question</h2>
        <p className="mt-2 text-sm text-muted">A random unused question goes up for auction. The winning team answers alone; if they get it wrong, it opens to every other team.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Difficulty">
            <select id="next-diff" className="field" value={diff} onChange={(e) => { setDiff(e.target.value as typeof diff); setQid(''); }}>
              <option value="any">Any (mix)</option><option value="Medium">Medium</option><option value="Hard">Hard</option>
            </select>
          </Field>
          <Field label="Question">
            <select id="next-q" className="field" value={qid} onChange={(e) => setQid(e.target.value)}>
              <option value="">Random ({left.length} left)</option>
              {left.map((q) => <option key={q.id} value={q.id}>{q.title} · {q.category} ({q.difficulty})</option>)}
            </select>
          </Field>
          <Field label="Bidding">
            <select id="next-mode" className="field" value={mode} onChange={(e) => act((x) => E.configure(x, { bidMode: e.target.value as 'physical' | 'mobile' }))}>
              <option value="physical">✋ Out loud (you enter the winner)</option><option value="mobile">📱 On team phones</option>
            </select>
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Btn variant="primary" size="xl" disabled={!left.length && !qid} onClick={go}>▶ NEXT QUESTION</Btn>
          {practice
            ? <Btn variant="gold" size="xl" onClick={async () => { if (await confirmDialog('Start the actual event?', `Every registered team gets ${E.money(s.cfg.purse)} and 0 points.`, 'Start event', false)) act((x) => E.startLive(x, serverNow()), 'The event is live!'); }}>▶ Start actual event</Btn>
            : <FinishBtn />}
        </div>
        {!left.length && <p className="mt-3 text-sm text-warn">No unused {diff === 'any' ? '' : `${diff} `}questions left. Add or import more under Questions.</p>}
      </div>
    </div>
  );
}

function FinishBtn({ size = 'xl' }: { size?: 'xl' | 'sm' }) {
  const { s, act } = useHost();
  return (
    <Btn variant="ghost" size={size} className="border border-gold/50 text-gold" onClick={async () => {
      if (await confirmDialog('Finish the auction?', `${played(s)} questions were played. Next you reveal the leaderboard: 3rd place, runner-up, then champions. You can come back with "Back to the auction" if needed.`, 'Finish auction', false)) act((x) => E.finalize(x, serverNow()), 'Auction finished. Reveal the results when ready.');
    }}>🏁 Finish auction</Btn>
  );
}

// =====================================================================================================
function LotHeader({ l }: { l: Lot }) {
  const { s } = useHost();
  const [show, setShow] = useState(false);
  const q = E.question(s, l.questionId);
  return (
    <div className="border-b border-line p-5" style={{ background: 'linear-gradient(120deg, #22e3ff22, transparent 60%)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <DiffChip d={l.difficulty} />
        {l.mode === 'mobile' && <span className="rounded bg-info/15 px-2 py-0.5 text-xs font-bold text-info">📱 PHONE BIDDING</span>}
        {l.practice && <span className="rounded bg-panel-2 px-2 py-0.5 text-xs font-bold">PRACTICE: dummy money</span>}
      </div>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(28px,3.6vw,50px)] font-bold uppercase leading-none">{E.lotLabel(l)} · {l.title}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {l.category && <span>{l.category}</span>}
        {l.kind !== 'crowd' && <span>Base <b className="text-gold">{E.money(l.base)}</b></span>}
        <span>Reward <b className="text-fg">{l.reward} pts</b></span>
        {l.kind !== 'crowd' && <span>If they miss: <b className="text-fg">{Math.floor(l.reward * s.cfg.stealShare)} pts</b> for every other team that's right</span>}
      </div>
      {q && (
        <div className="mt-3">
          <button className="text-xs font-semibold text-info hover:underline" onClick={() => setShow((x) => !x)}>{show ? 'Hide' : 'Show'} question &amp; answer (only on this screen)</button>
          {show && (
            <div className="mt-2 rounded-xl border border-line bg-ink/60 p-3 text-sm">
              <p className="font-semibold">{q.prompt}</p>
              <CodeBlock code={q.code} className="mt-2 text-xs" />
              <p className="mt-2">Answer: <b className="text-ok">{E.answerText(q)}</b></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LotControl() {
  const { s } = useHost();
  const l = E.curLot(s)!;
  return (
    <div className="panel overflow-hidden">
      <LotHeader l={l} />
      <div className="p-5">
        {l.status === 'auction' && <AuctionCtl l={l} />}
        {l.status === 'settlement' && <SettleCtl l={l} />}
        {l.status === 'sold' && <SoldCtl l={l} />}
        {l.status === 'unsold' && <UnsoldCtl l={l} />}
        {(l.status === 'answer' || l.status === 'steal') && <AnswerCtl l={l} />}
        {l.status === 'results' && <ResultsCtl l={l} />}
      </div>
    </div>
  );
}

function AuctionCtl({ l }: { l: Lot }) {
  const { s, act, bidCount } = useHost();
  const c = s.cur!;
  const [vt, setVt] = useState('');
  const [va, setVa] = useState('');
  return (
    <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
      <Countdown deadline={c.deadline} total={s.cfg.auctionSec} size={170} label="BIDDING" />
      <div>
        {l.mode === 'mobile' ? (
          <div>
            <Label>Highest phone bid</Label>
            {c.high ? (
              <div className="flex items-center gap-3">
                <TeamBadge no={c.high.team} size="lg" />
                <span key={c.high.amount} className="font-[family-name:var(--font-display)] text-6xl font-bold num gold-text animate-bid-pop">{E.money(c.high.amount)}</span>
              </div>
            ) : <p className="text-2xl text-muted">No bids yet (opening {E.money(l.base)})</p>}
            <p className="mt-1 text-sm text-dim">{bidCount} bids received · teams bid on their phones</p>
          </div>
        ) : (
          <div>
            <p className="text-lg">Teams bid <b>out loud</b>. Run the auction; when time's up, enter the winner and final price.</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-info">Optional: show the current verbal bid on screen</summary>
              <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); act((x) => E.setVerbal(x, vt ? Number(vt) : null, va ? Number(va) : null)); }}>
                <Field label="Team"><input id="verbal-team" className="field !w-24 num" inputMode="numeric" value={vt} onChange={(e) => setVt(e.target.value)} /></Field>
                <Field label="Bid (lakh)"><input id="verbal-amt" className="field !w-28 num" inputMode="numeric" value={va} onChange={(e) => setVa(e.target.value)} /></Field>
                <Btn size="md" variant="subtle">Show</Btn>
              </form>
            </details>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Btn variant="subtle" onClick={() => act((x) => E.extendAuction(x, 10))}>+10 s</Btn>
          <Btn variant="primary" onClick={() => act((x) => E.endAuction(x, serverNow()))}>End bidding now</Btn>
          <Btn variant="ghost" onClick={() => act((x) => E.markUnsold(x, serverNow()))}>Mark unsold</Btn>
        </div>
      </div>
    </div>
  );
}

function SettleCtl({ l }: { l: Lot }) {
  const { s, act } = useHost();
  const high = s.cur!.high;
  const [team, setTeam] = useState(high ? String(high.team) : s.cur?.verbal?.team ? String(s.cur.verbal.team) : '');
  const [price, setPrice] = useState(high ? String(high.amount) : s.cur?.verbal?.amount ? String(s.cur.verbal.amount) : String(l.base));
  const [reason, setReason] = useState('');
  const tNo = Number(team), p = Math.round(Number(price));
  const t = s.teams[tNo];
  const purse = t?.members ? E.purseOf(s, tNo, l.practice) : null;
  const differs = l.mode === 'mobile' && (!high || high.team !== tNo || high.amount !== p);
  let problem = '';
  if (!team) problem = 'Enter the winning team number.';
  else if (!t?.members) problem = `Team ${team} is not registered.`;
  else if (!t.eligible) problem = `Team ${team} is not playing.`;
  else if (!(p >= l.base)) problem = `At least the base price, ${E.money(l.base)}.`;
  else if (p !== l.base && p % s.cfg.inc !== 0) problem = `Use steps of ${E.money(s.cfg.inc)}.`;
  else if (purse !== null && p > purse) problem = `Team ${team} only has ${E.money(purse)}.`;
  else if (differs && !reason.trim()) problem = high ? 'This differs from the phone auction result. Give a reason.' : 'No phone bids arrived. Give a reason to sell anyway.';
  const confirm = () => act((x) => E.settle(x, { team: tNo, price: p, override: differs ? reason : undefined }, serverNow()));
  return (
    <div>
      <div className="mb-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 font-semibold text-gold">⏰ Time's up. {l.mode === 'mobile' ? (high ? `Highest phone bid: Team ${high.team}, ${E.money(high.amount)}.` : 'No phone bids.') : 'Enter the winning team and the final price.'}</div>
      <form className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr]" onSubmit={(e) => { e.preventDefault(); if (!problem) confirm(); }}>
        <Field label="Winning team number"><input id="settle-team" autoFocus className="field !h-16 text-center font-[family-name:var(--font-display)] text-4xl font-bold num" inputMode="numeric" value={team} onChange={(e) => setTeam(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="Final price (lakh)" hint={`${E.money(p || 0)} · step ${E.money(s.cfg.inc)}`}>
          <input id="settle-price" className="field !h-16 text-center font-[family-name:var(--font-display)] text-4xl font-bold num" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <div className="rounded-xl border border-line bg-ink/50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted">Team purse</span><b className="num">{purse === null ? '—' : E.money(purse)}</b></div>
          <div className="flex justify-between"><span className="text-muted">Deduct</span><b className="num text-live">{p ? `−${E.money(p)}` : '—'}</b></div>
          <div className="mt-1 flex justify-between border-t border-line pt-1"><span className="text-muted">Left after sale</span><b className={cx('num', purse !== null && p > purse && 'text-live')}>{purse === null || !p ? '—' : E.money(purse - p)}</b></div>
        </div>
        <div className="flex flex-wrap gap-1.5 md:col-span-3">
          {[0, 1, 2, 5, 10].map((k) => { const v = l.base + k * s.cfg.inc; return <Btn key={k} type="button" size="sm" variant="subtle" onClick={() => setPrice(String(v))}>{E.money(v)}</Btn>; })}
        </div>
        {l.mode === 'mobile' && differs && (
          <div className="md:col-span-3"><Field label="Override reason (saved in the audit log)"><input id="settle-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Team 4's phone died mid-auction" /></Field></div>
        )}
        {problem && <p className="text-sm text-warn md:col-span-3">{problem}</p>}
        <div className="flex flex-wrap gap-2 md:col-span-3">
          <Btn variant="gold" size="xl" className="min-w-[260px] flex-1" disabled={!!problem}>CONFIRM SALE 🔨</Btn>
          <Btn type="button" variant="subtle" size="xl" onClick={() => act((x) => E.markUnsold(x, serverNow()))}>MARK UNSOLD</Btn>
        </div>
      </form>
    </div>
  );
}

function SoldCtl({ l }: { l: Lot }) {
  const { s, act } = useHost();
  return (
    <div className="text-center">
      <div className="font-[family-name:var(--font-display)] text-5xl font-bold gold-text">SOLD! 🔨</div>
      <div className="mt-2 flex items-center justify-center gap-3 text-2xl"><TeamBadge no={l.owner} size="lg" /> for <b className="num">{E.money(l.price ?? 0)}</b></div>
      <p className="mt-1 text-sm text-muted">Team {l.owner} now has {E.money(E.purseOf(s, l.owner!, l.practice))} left.</p>
      <Btn variant="primary" size="xl" className="mt-6" onClick={() => act((x) => E.revealChallenge(x, serverNow()))}>REVEAL QUESTION · {Math.min(10, s.cfg.answerSec)} s</Btn>
      {s.cfg.auto && <p className="mt-2 text-xs text-dim">Auto-reveal is on: the challenge starts by itself in a few seconds.</p>}
    </div>
  );
}

function UnsoldCtl({ l }: { l: Lot }) {
  const { s, act } = useHost();
  return (
    <div className="text-center">
      <div className="font-[family-name:var(--font-display)] text-5xl font-bold text-muted">UNSOLD</div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {l.questionId && <Btn variant="primary" size="xl" onClick={() => act((x) => E.unsoldToCrowd(x, serverNow()))}>Ask everyone ({Math.max(10, Math.floor(l.reward * s.cfg.stealShare))} pts each)</Btn>}
        <Btn variant="subtle" size="xl" onClick={() => act((x) => E.nextQuestion(E.finishLot(x), serverNow()))}>Skip → next question</Btn>
      </div>
    </div>
  );
}

function AnswerCtl({ l }: { l: Lot }) {
  const { s, act, answers } = useHost();
  const w = s.cur!.win!;
  const q = E.question(s, l.questionId)!;
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const eligible = w.elig === 'all' ? E.registeredTeams(s).length : w.elig === 'owner' ? 1 : E.registeredTeams(s).length - 1;
  const n = Object.keys(answers).length;
  return (
    <div>
      <div className="grid gap-5 md:grid-cols-[auto_1fr]">
        <Countdown deadline={w.deadline} total={Math.min(10, s.cfg.answerSec)} size={170} label={w.n === 2 ? 'EVERYONE' : 'ANSWER'} />
        <div className="min-w-0">
          <div className={cx('inline-block rounded-lg px-3 py-1 text-sm font-bold', w.n === 2 ? 'bg-live/20 text-live' : 'bg-info/15 text-info')}>
            {w.n === 2 ? `Team ${w.owner} missed it. OPEN TO EVERYONE · ${w.reward} pts for each correct team` : w.elig === 'owner' ? `Only Team ${w.owner} answers · ${w.reward} pts` : `All teams answer · ${w.reward} pts each`}
          </div>
          <p className="mt-3 text-xl font-semibold">{q.prompt}</p>
          <CodeBlock code={q.code} className="mt-2" />
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {q.type === 'oneword' ? <p>Accepted: <b className="text-ok">{q.accept.join(', ')}</b></p> : q.options.map((o, i) => (
              <div key={i} className={cx('rounded-lg border px-3 py-1.5 text-sm', i === q.answer ? 'border-ok bg-ok/10 text-ok' : 'border-line')}>{String.fromCharCode(65 + i)}. {o}{i === q.answer ? ' ✓' : ''}</div>
            ))}
          </div>
          <p className="mt-3 text-sm"><b className="num text-info">{n}</b> / {eligible} answers locked in. Scored automatically when the timer ends.</p>
        </div>
      </div>
      <div className="mt-4">
        <Btn size="sm" variant="ghost" className="hover:!text-live" onClick={() => setVoidOpen(true)}>Technical problem? Void &amp; replay</Btn>
      </div>
      <VoidModal open={voidOpen} onClose={() => setVoidOpen(false)} reason={reason} setReason={setReason} onGo={() => { if (act((x) => E.voidAndReplay(x, reason, serverNow()), 'Question replayed with a fresh 10 s window.')) { setVoidOpen(false); setReason(''); } }} />
    </div>
  );
}

function VoidModal({ open, onClose, reason, setReason, onGo }: { open: boolean; onClose: () => void; reason: string; setReason: (v: string) => void; onGo: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Void and replay">
      <p className="text-sm text-muted">Throws away every answer (and any points given) for this question, then opens a fresh 10-second window. Recorded in the audit log.</p>
      <Field label="Reason"><input id="void-reason" className="field mt-2" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
      <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="danger" disabled={!reason.trim()} onClick={onGo}>Void &amp; replay</Btn></div>
    </Modal>
  );
}

function ResultsCtl({ l }: { l: Lot }) {
  const { s, act } = useHost();
  const r = l.result!;
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const total = r.scores.reduce((a, x) => a + x.pts, 0);
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Correct answer</Label>
          <div className="font-[family-name:var(--font-display)] text-4xl font-bold text-ok">{r.answer}</div>
          {r.explain && <p className="mt-1 text-muted">{r.explain}</p>}
          {r.ownerCorrect !== null && <p className="mt-2">Team {l.owner}: <b className={r.ownerCorrect ? 'text-ok' : 'text-live'}>{r.ownerCorrect ? 'correct' : 'wrong or no answer'}</b>{r.stealTried ? ' · then opened to everyone' : ''}</p>}
          <p className="mt-1 text-sm text-dim">{r.submitted} answers · {r.correct} correct</p>
        </div>
        <div>
          <Label>Points awarded ({total})</Label>
          <div className="mt-1 flex max-h-56 flex-wrap gap-1.5 overflow-auto">
            {r.scores.length === 0 && <span className="text-muted">Nobody scored.</span>}
            {r.scores.map((x) => <span key={x.team + x.role} className="rounded-lg border border-ok/40 bg-ok/10 px-2 py-1 text-sm"><b>T{x.team}</b> +{x.pts}{x.role === 'owner' ? ' (winner)' : ''}</span>)}
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Btn variant="primary" size="xl" className="flex-1" onClick={() => act((x) => E.nextQuestion(E.finishLot(x), serverNow()))}>NEXT QUESTION ▶</Btn>
        <Btn variant="subtle" size="xl" onClick={() => act((x) => E.finishLot(x))}>Show leaderboard</Btn>
        <Btn variant="ghost" onClick={() => setVoidOpen(true)}>Void &amp; replay</Btn>
      </div>
      <VoidModal open={voidOpen} onClose={() => setVoidOpen(false)} reason={reason} setReason={setReason} onGo={() => { if (act((x) => E.voidAndReplay(x, reason, serverNow()), 'Question replayed.')) { setVoidOpen(false); setReason(''); } }} />
      <span className="hidden">{s.rev}</span>
    </div>
  );
}

// =====================================================================================================
function FinalPanel() {
  const { s, act } = useHost();
  const rows = E.finalRows(s);
  const steps = ['Leaderboard hidden', 'Reveal 3rd place', 'Reveal runner-up', 'Reveal champions'];
  return (
    <div className="panel p-6">
      <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold uppercase">Final results</h2>
      <p className="text-muted">Final points = points + {s.cfg.conv} per full ₹1 Cr left in the purse.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((t, i) => <Btn key={i} variant={s.finalStep === i ? 'gold' : i === s.finalStep + 1 ? 'primary' : 'subtle'} onClick={() => act((x) => E.setFinalStep(x, i))}>{t}</Btn>)}
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="label border-b border-line text-left"><th className="p-2">#</th><th className="p-2">Team</th><th className="p-2 text-right">Points</th><th className="p-2 text-right">Purse left</th><th className="p-2 text-right">Cash pts</th><th className="p-2 text-right">Final</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.team} className={cx('border-b border-line/50', r.rank <= 3 && 'bg-gold/5')}>
              <td className="p-2 font-bold num">{r.rank}</td><td className="p-2"><b>Team {r.team}</b> <span className="text-dim">{r.members.join(', ')}</span></td>
              <td className="p-2 text-right num">{r.points}</td><td className="p-2 text-right num">{E.money(r.purse)}</td><td className="p-2 text-right num">{r.cashPts}</td><td className="p-2 text-right font-bold text-gold num">{r.final}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-4 flex gap-2"><Btn variant="ghost" onClick={() => act((x) => E.reopen(x))}>Back to the auction</Btn></div>
    </div>
  );
}

function EventPanel() {
  const { s } = useHost();
  const now = useServerNow(1000);
  const total = E.EVENT_MINUTES(s.cfg);
  const mins = s.clockStart ? (now - s.clockStart) / 60000 : 0;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase">Event</h3>
        <span className={cx('text-sm num', mins > total && 'text-live')}>⏱ {s.clockStart ? clock(now - s.clockStart) : '—'} / {total}:00</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-ink/50 p-2"><div className="label">Played</div><b className="text-xl num">{played(s)}</b></div>
        <div className="rounded-lg bg-ink/50 p-2"><div className="label">Questions left</div><b className="text-xl num">{E.unusedQuestions(s).length}</b></div>
      </div>
      {s.stage === 'live' && !E.curLot(s) && <div className="mt-3"><FinishBtn size="sm" /></div>}
      {s.stage === 'live' && mins > total && <p className="mt-2 text-xs text-live">Planned time is up. Press Finish auction when you're ready.</p>}
    </div>
  );
}

function BoardPanel() {
  const { s, online } = useHost();
  const rows = useMemo(() => E.standings(s), [s]);
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase">{s.stage === 'practice' ? 'Practice standings' : 'Standings'}</h3>
        <span className="label">pts · purse</span>
      </div>
      <div className="mt-2 flex max-h-[340px] flex-col gap-1 overflow-auto scroll-thin">
        {rows.length === 0 && <p className="text-sm text-muted">No teams yet.</p>}
        {rows.map((r) => (
          <div key={r.team} className={cx('grid grid-cols-[1.8rem_auto_1fr_auto_auto] items-center gap-2 rounded-lg px-2 py-1 text-sm', r.rank <= 3 ? 'bg-gold/10' : 'bg-panel-2/50')}>
            <span className="font-bold text-muted num">{r.rank}</span>
            <span className={cx('h-2 w-2 rounded-full', online.has(r.team) ? 'bg-ok' : 'bg-line-2')} />
            <span className="font-semibold">Team {r.team}</span>
            <span className="text-right font-bold num">{r.points}</span>
            <span className="w-20 text-right text-muted num">{E.money(r.purse)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickPanel() {
  const { s, act } = useHost();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState('');
  const [pts, setPts] = useState('');
  const [cash, setCash] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => { if (!open) { setTeam(''); setPts(''); setCash(''); setReason(''); } }, [open]);
  return (
    <div className="panel p-4">
      <h3 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase">Quick actions</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <Btn size="sm" variant="outline" disabled={s.stage === 'registration'} onClick={() => setOpen(true)}>± Points / cash</Btn>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Manual adjustment">
        <div className="grid gap-3">
          <Field label="Team number"><input id="adj-team" className="field num" inputMode="numeric" value={team} onChange={(e) => setTeam(e.target.value.replace(/\D/g, ''))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Points (+/−)"><input id="adj-pts" className="field num" value={pts} onChange={(e) => setPts(e.target.value)} /></Field>
            <Field label="Cash in lakh (+/−)"><input id="adj-cash" className="field num" value={cash} onChange={(e) => setCash(e.target.value)} /></Field>
          </div>
          <Field label="Reason (audit log)"><input id="adj-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Btn variant="primary" onClick={() => { if (act((x) => E.adjust(x, Number(team), Number(pts || 0), Number(cash || 0), reason), 'Adjusted.')) setOpen(false); }}>Apply</Btn>
        </div>
      </Modal>
    </div>
  );
}
