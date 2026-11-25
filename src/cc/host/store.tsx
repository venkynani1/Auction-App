// Host side: holds the game, saves it (this browser + Firebase backup), publishes the public view,
// and listens for registrations, presence, phone bids and answers. One host laptop runs the game.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as E from '../engine';
import type { HostState, RawAnswer, RawBid } from '../types';
import { claim, forgetWrites, hostWrite, listen, P, readOnce, serverNow, signIn, startServerClock, takeOver } from '../fb';
import { toast } from '../../components/ui';
import { play } from '../../lib/sound';

const KEY = (code: string) => `cc:host:${code}`;
const LIST = 'cc:events';
export interface EventRef { code: string; name: string; at: number }
export const myEvents = (): EventRef[] => { try { return JSON.parse(localStorage.getItem(LIST) || '[]') as EventRef[]; } catch { return []; } };
export const rememberEvent = (e: EventRef) => {
  try { localStorage.setItem(LIST, JSON.stringify([e, ...myEvents().filter((x) => x.code !== e.code)].slice(0, 20))); } catch { /* ignore */ }
};
export const forgetEvent = (code: string) => {
  try { localStorage.setItem(LIST, JSON.stringify(myEvents().filter((x) => x.code !== code))); localStorage.removeItem(KEY(code)); } catch { /* ignore */ }
};
export function saveLocal(s: HostState) { try { localStorage.setItem(KEY(s.code), JSON.stringify(s)); return true; } catch { return false; } }
function loadLocal(code: string): HostState | null { try { const v = JSON.parse(localStorage.getItem(KEY(code)) || 'null'); return v?.v === 1 ? v : null; } catch { return null; } }

export type Link = 'connecting' | 'live' | 'taken' | 'moved' | 'error' | 'missing';

interface Ctx {
  s: HostState;
  /** Run an engine step. Returns false (and shows the reason) if the game refused it. */
  act: (f: (s: HostState) => HostState, ok?: string) => boolean;
  link: Link;
  online: Set<number>;
  answers: Record<string, RawAnswer>;   // current window, host-only
  bidCount: number;
  muted: boolean;
  setMuted: (m: boolean) => void;
}
const C = createContext<Ctx | null>(null);
export const useHost = () => useContext(C)!;

export function HostProvider({ code, children }: { code: string; children: React.ReactNode }) {
  const [s, setS] = useState<HostState | null>(() => loadLocal(code));
  const ref = useRef<HostState | null>(s);
  const [link, setLink] = useState<Link>('connecting');
  const [online, setOnline] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<Record<string, RawAnswer>>({});
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [bidCount, setBidCount] = useState(0);
  const [muted, setMuted] = useState(true);
  const sfx = useCallback((x: Parameters<typeof play>[0]) => { if (!muted) play(x); }, [muted]);

  const commit = useCallback((next: HostState) => {
    ref.current = next;
    setS(next);
    if (!saveLocal(next)) toast('This browser could not save the game. The Firebase backup still has it.', 'warn');
  }, []);

  const act = useCallback((f: (s: HostState) => HostState, ok?: string) => {
    const cur = ref.current;
    if (!cur) return false;
    try {
      const next = f(cur);
      if (next !== cur) commit(next);
      if (ok) toast(ok, 'ok');
      return true;
    } catch (e) {
      if (e instanceof E.GameError) { toast(e.message, 'warn'); return false; }
      console.error(e);
      toast('Something went wrong. The game was not changed.', 'warn');
      return false;
    }
  }, [commit]);

  // ---- connect: claim ownership, restore from the Firebase backup if this browser has nothing newer
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await signIn();
        void startServerClock();
        // A handover link (#cc/host/CODE/KEY) moves control of the event to this device.
        const key = location.hash.split('/')[3];
        let mine = await claim(code);
        if (!mine && key) mine = await takeOver(code, key);
        if (key) history.replaceState(null, '', `#cc/host/${code}`);
        if (!mine) { if (alive) setLink(key ? 'error' : 'taken'); if (key) toast('That control link has expired. Make a new one on the device running the event.', 'warn'); return; }
        const raw = await readOnce<string | HostState>(P(code, 'host'));
        // Backup is stored as a JSON string: Firebase would otherwise drop nulls and empty lists.
        const remote = typeof raw === 'string' ? (JSON.parse(raw) as HostState) : null;
        const local = loadLocal(code);
        const best = remote && (!local || remote.rev > local.rev) ? remote : local;
        if (!alive) return;
        if (!best) { setLink('missing'); return; }
        forgetWrites();
        commit(best);
        rememberEvent({ code, name: best.cfg.name, at: Date.now() });
        setLink('live');
      } catch (e) {
        console.error(e);
        if (alive) setLink('error');
      }
    })();
    return () => { alive = false; };
  }, [code, commit]);

  // ---- if another device takes control, stop running the game here
  useEffect(() => {
    if (link !== 'live') return;
    let off: (() => void) | undefined, alive = true;
    void (async () => {
      const uid = await signIn();
      const o = await listen<string>(P(code, 'owner'), (v) => { if (alive && v && v !== uid) setLink('moved'); });
      if (alive) off = o; else o();
    })();
    return () => { alive = false; off?.(); };
  }, [link, code]);

  // ---- keep the screen on (a sleeping phone would stop the timers and scoring)
  useEffect(() => {
    if (link !== 'live' || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const get = () => { if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => {}); };
    get();
    document.addEventListener('visibilitychange', get);
    return () => { document.removeEventListener('visibilitychange', get); void lock?.release().catch(() => {}); };
  }, [link]);

  // ---- publish public + private views, and back up the full state
  const pubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answeredCount = Object.keys(answers).length;
  useEffect(() => {
    if (!s || link !== 'live') return;
    if (pubTimer.current) clearTimeout(pubTimer.current);
    pubTimer.current = setTimeout(() => {
      const cur = ref.current!;
      const parts: Record<string, unknown> = { pub: E.buildPub(cur, answeredCount), regcode: cur.cfg.regCode.trim() || null };
      parts.allowed = Object.fromEntries(cur.cfg.teamNos.filter((no) => cur.teams[no]?.eligible).map((no) => [no, true]));
      for (const t of Object.values(cur.teams)) if (t.members) parts[`priv/${t.no}`] = E.buildPriv(cur, t.no);
      hostWrite(code, parts).catch((e) => { console.error(e); toast('Could not reach Firebase. Check the internet connection.', 'warn'); });
    }, 60);
    if (backupTimer.current) clearTimeout(backupTimer.current);
    backupTimer.current = setTimeout(() => {
      hostWrite(code, { host: ref.current ? JSON.stringify(ref.current) : null }).catch(() => { /* retried on next change */ });
    }, 800);
  }, [s, link, code, answeredCount]);

  // ---- registrations
  useEffect(() => {
    if (link !== 'live') return;
    let off = () => {};
    listen<Record<string, { m: string[]; at: number }>>(P(code, 'reg'), (regs) => {
      let cur = ref.current!;
      for (const [no, r] of Object.entries(regs ?? {})) {
        const t = cur.teams[no];
        if (t && !t.members && r?.m) {
          cur = E.applyRegistration(cur, Number(no), r.m, r.at);
          if (cur.teams[no]?.members) { toast(`Team ${no} registered.`, 'ok'); sfx('bid'); }
        }
      }
      if (cur !== ref.current) commit(cur);
    }).then((u) => (off = u));
    return () => off();
  }, [link, code, commit, sfx]);

  // ---- presence
  useEffect(() => {
    if (link !== 'live') return;
    let off = () => {};
    listen<Record<string, boolean>>(P(code, 'online'), (v) => setOnline(new Set(Object.keys(v ?? {}).map(Number)))).then((u) => (off = u));
    return () => off();
  }, [link, code]);

  // ---- phone bids for the current mobile lot
  const lot = s ? E.curLot(s) : undefined;
  const bidLot = lot && lot.mode === 'mobile' && ['auction', 'settlement'].includes(lot.status) ? lot.id : null;
  useEffect(() => {
    setBidCount(0);
    if (link !== 'live' || !bidLot) return;
    let off = () => {};
    listen<Record<string, Record<string, RawBid>>>(P(code, `bids/${bidLot}`), (raw) => {
      setBidCount(Object.values(raw ?? {}).reduce((a, b) => a + Object.keys(b ?? {}).length, 0));
      const cur = ref.current!;
      const next = E.applyBids(cur, raw);
      if (next !== cur) { commit(next); sfx('bid'); }
    }).then((u) => (off = u));
    return () => off();
  }, [link, code, bidLot, commit, sfx]);

  // ---- answers for the open window
  const winId = s?.cur?.win && lot && ['answer', 'steal'].includes(lot.status) ? s.cur.win.id : null;
  useEffect(() => {
    setAnswers({});
    if (link !== 'live' || !winId) return;
    let off = () => {};
    listen<Record<string, RawAnswer>>(P(code, `ans/${winId}`), (v) => setAnswers(v ?? {})).then((u) => (off = u));
    return () => off();
  }, [link, code, winId]);

  // ---- timers: end auctions, close answer windows (server clock), auto-reveal
  const lastTick = useRef(-1);
  useEffect(() => {
    if (link !== 'live') return;
    const id = setInterval(() => {
      const cur = ref.current!;
      const l = E.curLot(cur);
      const now = serverNow();
      if (!l || !cur.cur) return;
      if (l.status === 'auction' && cur.cur.deadline && now >= cur.cur.deadline) {
        commit(E.endAuction(cur, now));
        sfx('closed');
        return;
      }
      if ((l.status === 'answer' || l.status === 'steal') && cur.cur.win) {
        const left = Math.ceil((cur.cur.win.deadline - now) / 1000);
        if (left <= 3 && left > 0 && left !== lastTick.current) { lastTick.current = left; sfx('tick'); }
        // Wait a moment after the deadline for answers that were already accepted by the server to arrive.
        if (now >= cur.cur.win.deadline + 1200) {
          const next = E.closeWindow(cur, cur.cur.win.id, answersRef.current, now);
          if (next !== cur) { commit(next); sfx(E.curLot(next)!.status === 'steal' ? 'event' : 'win'); }
        }
        return;
      }
      if (cur.cfg.auto && l.status === 'sold' && l.kind !== 'vault' && l.questionId && now - cur.cur.shownAt > 4000) {
        try { commit(E.revealChallenge(cur, now)); } catch { /* the host will reveal by hand */ }
      }
    }, 200);
    return () => clearInterval(id);
  }, [link, commit, sfx]);

  const value = useMemo(() => (s ? { s, act, link, online, answers, bidCount, muted, setMuted } : null), [s, act, link, online, answers, bidCount, muted]);
  if (!value || link === 'taken' || link === 'moved' || link === 'missing') {
    return (
      <div className="stage-bg grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-md">
          <p className="text-lg text-muted">{link === 'moved' ? 'Control of this event has moved to another device.' : link === 'taken' ? 'Another device is running this event. To control it here, open "📱 Control from phone" on that device and scan its QR code.' : link === 'missing' ? 'This event was not found on this device or in Firebase.' : link === 'error' ? 'Could not connect to Firebase.' : 'Loading event…'}</p>
          {(link === 'moved' || link === 'taken') && (
            <div className="mt-5 flex flex-col gap-2">
              <a href={`#cc/screen/${code}`} className="rounded-xl bg-info px-5 py-3 font-bold text-ink">Show the projector screen on this device</a>
              <a href="#cc" className="text-sm text-muted underline">Back to events</a>
            </div>
          )}
        </div>
      </div>
    );
  }
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** Create a new event: claim a fresh code, build the state from the bank, save locally and to Firebase. */
export async function createEvent(name: string, date: string, teams: number) {
  const { DEFAULT_BANK, DEFAULT_PLAN } = await import('../bank');
  const { newCode } = await import('../fb');
  await signIn();
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    if (!(await claim(code))) continue;
    const s = E.newEvent(code, structuredClone(DEFAULT_BANK), DEFAULT_PLAN as unknown as E.Plan, {
      name: name.trim() || E.DEFAULT_CONFIG.name, date,
      teamNos: Array.from({ length: teams }, (_, k) => k + 1),
    });
    saveLocal(s);
    await hostWrite(code, { host: JSON.stringify(s), pub: E.buildPub(s), allowed: Object.fromEntries(s.cfg.teamNos.map((n) => [n, true])) }, true);
    rememberEvent({ code, name: s.cfg.name, at: Date.now() });
    return code;
  }
  throw new Error('Could not get a free event code. Try again.');
}
