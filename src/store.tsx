import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SEED_ITEMS } from './data';
import { money, round2, teamColor, uid } from './lib/util';

// ------------------------------------------------------------------ model
export type RoundNo = 1 | 2 | 3 | 4;
export type SlipId = 'points51' | 'swap' | 'battery' | 'cash10' | 'double';

export interface Item {
  id: string;
  round: RoundNo;
  lot: number;
  name: string;
  role: string;
  base: number;              // crores; 0 = open bidding
  points: number | null;     // null = not set yet
  status: 'available' | 'sold' | 'unsold';
  teamId?: string;
  price?: number;
  soldAt?: number;
  slip?: SlipId;             // round 4: which slip was inside
  slipNote?: string;
}
export interface Team { id: string; name: string; color: string; pin: string }
export interface Adj { id: string; teamId: string; pts: number; cash: number; label: string; at: number }
export interface Live { itemId: string; bid: number; teamId: string | null; bids: number; phase: 'bidding' | 'sold' | 'unsold' }
export type Screen = 'lot' | 'board' | 'finale' | 'join' | 'bids';
export type BidMode = 'unique' | 'highest' | 'lowest';
/** A window in which teams bid from their phones. Bids themselves live in Firebase under this id. */
export interface TeamBids { id: string; open: boolean; itemId: string | null; show: BidMode | null; at: number }

export interface State {
  v: 2;
  settings: { eventName: string; startPurse: number; ptsPerCr: number; teamPins: boolean };
  teams: Team[];
  items: Item[];
  adjs: Adj[];
  round: RoundNo;
  live: Live | null;
  screen: Screen;
  finaleStep: number;          // 0 nothing, 1 third, 2 second, 3 champion
  finalized: boolean;          // purse points only count after 'Calculate final points'
  rooms: { open: boolean; code: string };
  bids: TeamBids | null;
  log: { at: number; text: string }[];
  flash: { id: string; kind: 'sold' | 'unsold' | 'slip' | 'round'; at: number } | null;
  rev: number;
  at: number;
}

export const ROUNDS: Record<RoundNo, { name: string; short: string; color: string; rule: string }> = {
  1: { name: 'Actors & Actresses', short: 'Actors', color: '#FF6A3D', rule: 'Photo, base price and points are shown.' },
  2: { name: 'Cricketers', short: 'Cricketers', color: '#2FD58A', rule: 'Points are hidden until the player is sold.' },
  3: { name: 'Singers & Music Directors', short: 'Music', color: '#A07BFF', rule: 'Every base price is ₹50 L. Points stay secret.' },
  4: { name: 'Mystery Round', short: 'Mystery', color: '#FF4FA3', rule: '4 of 5 sealed slips. Bid blind; the slip is opened after the sale.' },
};

export const SLIPS: Record<SlipId, { title: string; text: string }> = {
  points51: { title: 'Instant 51 points', text: 'The team gets 51 points straight away.' },
  swap: { title: 'Player swap', text: 'Swap one of your players with a player from another team.' },
  battery: { title: 'Battery bonus', text: 'Pick one person from another team. You get double their phone battery % as points.' },
  cash10: { title: '₹10 Cr cash', text: 'You get ₹10 Cr added to your purse.' },
  double: { title: 'Double spend', text: 'You get 2 points for every ₹1 Cr you have spent.' },
};

export const roomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

/** 4-digit team PIN; avoids easy ones like 0000 or 1234. */
export function makePin(): string {
  for (;;) {
    const p = String(Math.floor(1000 + Math.random() * 9000));
    if (!/^(\d)\1{3}$/.test(p) && !'0123456789'.includes(p) && !'9876543210'.includes(p)) return p;
  }
}

export function makeTeams(n: number, existing: Team[] = []): Team[] {
  return Array.from({ length: n }, (_, i) => existing[i] ?? { id: uid('t'), name: `Team ${i + 1}`, color: teamColor(i), pin: makePin() });
}

export function freshState(): State {
  const lots: Record<number, number> = {};
  return {
    v: 2,
    settings: { eventName: 'BID WARS', startPurse: 100, ptsPerCr: 1, teamPins: true },
    teams: makeTeams(20),
    items: SEED_ITEMS.map((s) => ({ ...s, id: uid('p'), lot: (lots[s.round] = (lots[s.round] ?? 0) + 1), status: 'available' as const, round: s.round as RoundNo, points: s.points as number | null })),
    adjs: [],
    round: 1,
    live: null,
    screen: 'lot',
    finaleStep: 0,
    finalized: false,
    rooms: { open: false, code: roomCode() },
    bids: null,
    log: [],
    flash: null,
    rev: 0,
    at: Date.now(),
  };
}

// ------------------------------------------------------------------ derived
export interface TeamRow {
  team: Team; index: number; items: Item[]; spent: number; itemPts: number; bonusPts: number; bonusCash: number;
  remaining: number; points: number; pursePts: number; final: number; rank: number;
}

export function teamRows(s: State): TeamRow[] {
  const rows = s.teams.map((team, index) => {
    const items = s.items.filter((i) => i.status === 'sold' && i.teamId === team.id);
    const spent = round2(items.reduce((a, i) => a + (i.price ?? 0), 0));
    const itemPts = items.reduce((a, i) => a + (i.points ?? 0), 0);
    const adjs = s.adjs.filter((a) => a.teamId === team.id);
    const bonusPts = adjs.reduce((a, x) => a + x.pts, 0);
    const bonusCash = round2(adjs.reduce((a, x) => a + x.cash, 0));
    const remaining = round2(s.settings.startPurse + bonusCash - spent);
    const points = itemPts + bonusPts;
    // Purse points are added only once the host presses 'Calculate final points'.
    const pursePts = s.finalized ? Math.max(0, Math.floor(remaining + 1e-9)) * s.settings.ptsPerCr : 0;
    return { team, index, items, spent, itemPts, bonusPts, bonusCash, remaining, points, pursePts, final: points + pursePts, rank: 0 };
  });
  rows.slice().sort((a, b) => b.final - a.final || b.remaining - a.remaining || a.index - b.index).forEach((r, i) => (r.rank = i + 1));
  return rows;
}
export const standings = (s: State) => teamRows(s).sort((a, b) => a.rank - b.rank);

export function queue(s: State, round = s.round) {
  return s.items.filter((i) => i.round === round && i.status === 'available' && i.id !== s.live?.itemId).sort((a, b) => a.lot - b.lot);
}

/** What the audience may see about an item's points right now. */
export function pointsShown(item: Item, live: Live | null): 'show' | 'hidden' | 'secret' {
  const sold = item.status === 'sold' || (live?.itemId === item.id && live.phase === 'sold');
  if (item.round === 1) return 'show';
  if (item.round === 2) return sold ? 'show' : 'hidden';
  if (item.round === 3) return 'secret';
  return 'hidden';
}

// ------------------------------------------------------------------ actions
export type Action =
  | { type: 'OPEN_LOT'; itemId: string }
  | { type: 'SET_BID'; bid: number }
  | { type: 'SET_LEADER'; teamId: string | null }
  | { type: 'SOLD' }
  | { type: 'UNSOLD' }
  | { type: 'CLOSE_LOT' }
  | { type: 'APPLY_SLIP'; itemId: string; slip: SlipId; value?: number; swap?: { mine: string; theirs: string } }
  | { type: 'REQUEUE'; itemId: string }
  | { type: 'ADJ_ADD'; teamId: string; pts: number; cash: number; label: string }
  | { type: 'ADJ_DEL'; id: string }
  | { type: 'ADJ_BULK'; teamIds: string[]; pts: number; label: string }
  | { type: 'BIDS_OPEN' }
  | { type: 'BIDS_CLOSE' }
  | { type: 'BIDS_SHOW'; mode: BidMode | null }
  | { type: 'BIDS_END' }
  | { type: 'BIDS_APPLY'; teamId: string; amount: number }
  | { type: 'SET_ROUND'; round: RoundNo }
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'FINALE_STEP'; step: number }
  | { type: 'FINALIZE'; on: boolean }
  | { type: 'ROOMS_OPEN'; open: boolean }
  | { type: 'ROOMS_NEW_CODE' }
  | { type: 'SETTINGS'; patch: Partial<State['settings']> }
  | { type: 'TEAMS_COUNT'; n: number }
  | { type: 'TEAM_RENAME'; id: string; name: string }
  | { type: 'TEAM_PINS_NEW'; id?: string }
  | { type: 'TEAM_PINS_SET'; pins: Record<number, string> }
  | { type: 'TEAM_NAMES'; names: string[] }
  | { type: 'ITEM_SAVE'; item: Partial<Item> & { id?: string } }
  | { type: 'ITEM_DELETE'; id: string }
  | { type: 'ITEMS_IMPORT'; items: Omit<Item, 'id' | 'lot' | 'status'>[] }
  | { type: 'RESET_SALES' }
  | { type: 'LOAD'; state: State };

const NO_UNDO = new Set<Action['type']>(['SET_BID', 'SET_LEADER', 'SET_SCREEN', 'LOAD']);

function log(d: State, text: string) {
  d.log.unshift({ at: Date.now(), text });
  if (d.log.length > 300) d.log.length = 300;
}

export function reducer(s: State, a: Action): State {
  if (a.type === 'LOAD') return { ...a.state, rev: s.rev + 1, at: Date.now() };
  const d: State = structuredClone(s);
  const item = (id?: string) => d.items.find((i) => i.id === id);
  const team = (id?: string | null) => d.teams.find((t) => t.id === id);
  const live = d.live;

  switch (a.type) {
    case 'OPEN_LOT': {
      const it = item(a.itemId);
      if (!it || (live && live.phase === 'bidding')) return s;
      if (it.status !== 'available') return s;
      d.round = it.round;
      d.live = { itemId: it.id, bid: it.base, teamId: null, bids: 0, phase: 'bidding' };
      d.screen = 'lot';
      d.flash = null;
      break;
    }
    case 'SET_BID':
      if (!live || live.phase !== 'bidding') return s;
      live.bid = Math.max(0, round2(a.bid));
      break;
    case 'SET_LEADER':
      if (!live || live.phase !== 'bidding') return s;
      if (a.teamId !== live.teamId) live.bids++;
      live.teamId = a.teamId;
      break;
    case 'SOLD': {
      if (!live || live.phase !== 'bidding' || !live.teamId) return s;
      const it = item(live.itemId)!;
      const t = team(live.teamId)!;
      it.status = 'sold'; it.teamId = t.id; it.price = live.bid; it.soldAt = Date.now();
      live.phase = 'sold';
      d.flash = { id: uid('f'), kind: 'sold', at: Date.now() };
      log(d, `SOLD: ${it.name} to ${t.name} for ${money(live.bid)}${it.round === 1 || it.round === 2 ? ` (${it.points ?? '?'} pts)` : ''}`);
      break;
    }
    case 'UNSOLD': {
      if (!live || live.phase !== 'bidding') return s;
      const it = item(live.itemId)!;
      it.status = 'unsold';
      live.phase = 'unsold';
      d.flash = { id: uid('f'), kind: 'unsold', at: Date.now() };
      log(d, `UNSOLD: ${it.name}`);
      break;
    }
    case 'CLOSE_LOT':
      if (live?.phase === 'bidding') log(d, `Cancelled: ${item(live.itemId)?.name} goes back to the list`);
      d.live = null;
      break;
    case 'APPLY_SLIP': {
      const it = item(a.itemId);
      if (!it || it.status !== 'sold' || !it.teamId || it.slip) return s;
      const t = team(it.teamId)!;
      const def = SLIPS[a.slip];
      let note = def.text;
      if (a.slip === 'points51') d.adjs.push({ id: uid('a'), teamId: t.id, pts: 51, cash: 0, label: `Mystery: ${def.title}`, at: Date.now() });
      if (a.slip === 'cash10') d.adjs.push({ id: uid('a'), teamId: t.id, pts: 0, cash: 10, label: `Mystery: ${def.title}`, at: Date.now() });
      if (a.slip === 'battery') {
        const pct = Math.max(0, Math.round(a.value ?? 0));
        const v = pct * 2;
        d.adjs.push({ id: uid('a'), teamId: t.id, pts: v, cash: 0, label: `Mystery: battery ${pct}% × 2`, at: Date.now() });
        note = `${t.name} gets ${v} points (battery ${pct}% × 2).`;
      }
      if (a.slip === 'double') {
        const spent = teamRows(d).find((r) => r.team.id === t.id)!.spent;
        const v = Math.round(spent * 2);
        d.adjs.push({ id: uid('a'), teamId: t.id, pts: v, cash: 0, label: `Mystery: double spend (₹${spent} Cr spent)`, at: Date.now() });
        note = `${t.name} has spent ${money(spent)}, so gets ${v} points.`;
      }
      if (a.slip === 'swap') {
        const mine = item(a.swap?.mine), theirs = item(a.swap?.theirs);
        if (!mine || !theirs || mine.teamId !== t.id || !theirs.teamId || theirs.teamId === t.id) return s;
        const other = team(theirs.teamId)!;
        mine.teamId = other.id; theirs.teamId = t.id;
        note = `${t.name} takes ${theirs.name} from ${other.name} and gives ${mine.name}.`;
      }
      it.slip = a.slip; it.slipNote = note;
      d.flash = { id: uid('f'), kind: 'slip', at: Date.now() };
      log(d, `Mystery slip for ${t.name}: ${def.title}. ${note}`);
      break;
    }
    case 'REQUEUE': {
      const it = item(a.itemId);
      if (!it || it.status === 'available') return s;
      if (it.slip) d.adjs = d.adjs.filter((x) => !(x.teamId === it.teamId && x.label.startsWith('Mystery') && x.at >= (it.soldAt ?? 0)));
      log(d, `${it.name} returned to the list${it.teamId ? ` (refunded ${money(it.price ?? 0)} to ${team(it.teamId)?.name})` : ''}`);
      Object.assign(it, { status: 'available', teamId: undefined, price: undefined, soldAt: undefined, slip: undefined, slipNote: undefined });
      if (d.live?.itemId === it.id) d.live = null;
      break;
    }
    case 'ADJ_ADD': {
      if (!team(a.teamId) || (!a.pts && !a.cash)) return s;
      d.adjs.push({ id: uid('a'), teamId: a.teamId, pts: a.pts, cash: round2(a.cash), label: a.label || 'Adjustment', at: Date.now() });
      log(d, `${team(a.teamId)!.name}: ${a.pts ? `${a.pts > 0 ? '+' : ''}${a.pts} pts ` : ''}${a.cash ? `${a.cash > 0 ? '+' : '−'}${money(Math.abs(a.cash))} ` : ''}(${a.label || 'adjustment'})`);
      break;
    }
    case 'ADJ_BULK': {
      const ts = a.teamIds.map((id) => team(id)).filter(Boolean) as Team[];
      if (!ts.length || !a.pts) return s;
      const label = a.label.trim() || 'Activity';
      for (const t of ts) d.adjs.push({ id: uid('a'), teamId: t.id, pts: a.pts, cash: 0, label, at: Date.now() });
      log(d, `${label}: ${a.pts > 0 ? '+' : ''}${a.pts} pts to ${ts.length === 1 ? ts[0]!.name : `${ts.length} teams (${ts.map((t) => t.name).join(', ')})`}`);
      break;
    }
    case 'BIDS_OPEN':
      d.bids = { id: uid('b'), open: true, itemId: live?.phase === 'bidding' ? live.itemId : null, show: null, at: Date.now() };
      log(d, `Team bids opened${d.bids.itemId ? ` for ${item(d.bids.itemId)?.name}` : ''}`);
      break;
    case 'BIDS_CLOSE':
      if (!d.bids?.open) return s;
      d.bids.open = false;
      log(d, 'Team bids closed');
      break;
    case 'BIDS_SHOW':
      if (!d.bids) return s;
      d.bids.show = a.mode;
      if (a.mode) { d.bids.open = false; d.screen = 'bids'; } else if (d.screen === 'bids') d.screen = 'lot';
      break;
    case 'BIDS_END':
      if (!d.bids) return s;
      d.bids = null;
      if (d.screen === 'bids') d.screen = 'lot';
      break;
    case 'BIDS_APPLY': {
      if (!live || live.phase !== 'bidding' || !team(a.teamId)) return s;
      live.bid = Math.max(0, round2(a.amount));
      if (live.teamId !== a.teamId) live.bids++;
      live.teamId = a.teamId;
      d.screen = 'lot';
      log(d, `Team bid used: ${team(a.teamId)!.name} at ${money(live.bid)}`);
      break;
    }
    case 'ADJ_DEL':
      d.adjs = d.adjs.filter((x) => x.id !== a.id);
      break;
    case 'SET_ROUND':
      if (live?.phase === 'bidding') return s;
      d.round = a.round; d.live = null; d.screen = 'lot';
      d.flash = { id: uid('f'), kind: 'round', at: Date.now() };
      break;
    case 'SET_SCREEN':
      if (a.screen === 'finale' && !d.finalized) return s;
      if (a.screen === 'bids' && !d.bids?.show) return s;
      d.screen = a.screen;
      break;
    case 'FINALE_STEP':
      if (!d.finalized) return s;
      d.finaleStep = Math.max(0, Math.min(3, a.step));
      d.screen = 'finale';
      break;
    case 'FINALIZE':
      if (a.on && live?.phase === 'bidding') return s;
      d.finalized = a.on;
      d.finaleStep = 0;
      if (a.on) { d.live = null; d.screen = 'board'; log(d, 'Final points calculated: purse points added for every team'); }
      else { if (d.screen === 'finale') d.screen = 'board'; log(d, 'Final calculation undone: purse points removed'); }
      break;
    case 'ROOMS_OPEN':
      d.rooms.open = a.open;
      if (a.open) d.screen = 'join';
      else if (d.screen === 'join') d.screen = 'lot';
      log(d, a.open ? 'Team rooms opened' : 'Team rooms closed');
      break;
    case 'ROOMS_NEW_CODE':
      d.rooms.code = roomCode();
      break;
    case 'SETTINGS':
      Object.assign(d.settings, a.patch);
      break;
    case 'TEAMS_COUNT': {
      const n = Math.max(2, Math.min(40, Math.round(a.n)));
      const removed = d.teams.slice(n).map((t) => t.id);
      if (removed.some((id) => d.items.some((i) => i.teamId === id) || d.adjs.some((x) => x.teamId === id))) return s;
      d.teams = makeTeams(n, d.teams);
      break;
    }
    case 'TEAM_RENAME': {
      const t = team(a.id);
      if (!t) return s;
      t.name = a.name;
      break;
    }
    case 'TEAM_PINS_SET': {
      let n = 0;
      for (const [k, pin] of Object.entries(a.pins)) {
        const t = d.teams[Number(k) - 1];
        if (t && /^\d{4}$/.test(pin)) { t.pin = pin; n++; }
      }
      if (!n) return s;
      log(d, `Loaded PINs for ${n} teams`);
      break;
    }
    case 'TEAM_PINS_NEW':
      for (const t of d.teams) if (!a.id || t.id === a.id) t.pin = makePin();
      log(d, a.id ? `New PIN for ${team(a.id)?.name}` : 'New PINs for every team');
      break;
    case 'TEAM_NAMES': {
      const names = a.names.map((n) => n.trim()).filter(Boolean);
      if (!names.length) return s;
      d.teams = makeTeams(Math.max(names.length, d.teams.length), d.teams);
      names.forEach((n, i) => (d.teams[i]!.name = n));
      break;
    }
    case 'ITEM_SAVE': {
      const ex = a.item.id ? item(a.item.id) : undefined;
      if (ex) Object.assign(ex, a.item);
      else {
        const round = (a.item.round ?? d.round) as RoundNo;
        const lot = Math.max(0, ...d.items.filter((i) => i.round === round).map((i) => i.lot)) + 1;
        d.items.push({ id: uid('p'), round, lot, name: 'New player', role: '', base: round === 3 ? 0.5 : 1, points: 10, status: 'available', ...a.item } as Item);
      }
      break;
    }
    case 'ITEM_DELETE':
      if (d.live?.itemId === a.id) d.live = null;
      d.items = d.items.filter((i) => i.id !== a.id);
      break;
    case 'ITEMS_IMPORT':
      for (const src of a.items) {
        const lot = Math.max(0, ...d.items.filter((i) => i.round === src.round).map((i) => i.lot)) + 1;
        d.items.push({ ...src, id: uid('p'), lot, status: 'available' });
      }
      log(d, `Imported ${a.items.length} players`);
      break;
    case 'RESET_SALES':
      d.items.forEach((i) => Object.assign(i, { status: 'available', teamId: undefined, price: undefined, soldAt: undefined, slip: undefined, slipNote: undefined }));
      Object.assign(d, { adjs: [], live: null, round: 1, screen: 'lot', finaleStep: 0, finalized: false, flash: null, log: [] });
      log(d, 'All sales and adjustments cleared');
      break;
  }
  d.rev = s.rev + 1;
  d.at = Date.now();
  return d;
}

// ------------------------------------------------------------------ store
const KEY = 'bidwars-live:state';
const isState = (x: unknown): x is State => !!x && (x as State).v === 2 && Array.isArray((x as State).teams) && Array.isArray((x as State).items);
/** Fill in fields added after a save was made. */
function normalize(st: State): State {
  return {
    ...st,
    settings: { ...st.settings, teamPins: st.settings.teamPins ?? true },
    teams: st.teams.map((t) => (t.pin ? t : { ...t, pin: makePin() })),
    finalized: st.finalized ?? false, bids: st.bids ?? null, rooms: st.rooms?.code ? st.rooms : { open: false, code: roomCode() } };
}

function load(): State {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (isState(v)) {
      const n = normalize(v);
      // New PINs were made for an older save: store them now so every window sees the same ones.
      if (v.teams.some((t) => !t.pin)) { try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ } }
      return n;
    }
  } catch { /* ignore */ }
  const f = freshState();
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* ignore */ }
  return f;
}

export const parseBackup = (text: string): State | null => {
  try { const v = JSON.parse(text); const st = v?.state ?? v; return isState(st) ? normalize(st) : null; } catch { return null; }
};

interface Store { state: State; dispatch: (a: Action) => void; undo: () => void; canUndo: boolean; saved: boolean }
const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;
const TAB = uid('w');

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(load);
  const ref = useRef(state);
  const stack = useRef<State[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [saved, setSaved] = useState(true);
  const chan = useRef<BroadcastChannel | null>(null);

  const commit = useCallback((next: State) => {
    ref.current = next;
    setState(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); setSaved(true); } catch { setSaved(false); }
    try { chan.current?.postMessage({ from: TAB, state: next }); } catch { /* ignore */ }
  }, []);

  const dispatch = useCallback((a: Action) => {
    const prev = ref.current;
    const next = reducer(prev, a);
    if (next === prev) return;
    if (!NO_UNDO.has(a.type)) {
      stack.current.push(prev);
      if (stack.current.length > 40) stack.current.shift();
      setCanUndo(true);
    }
    commit(next);
  }, [commit]);

  const undo = useCallback(() => {
    const prev = stack.current.pop();
    setCanUndo(stack.current.length > 0);
    if (prev) commit({ ...prev, rev: ref.current.rev + 1, at: Date.now(), flash: null });
  }, [commit]);

  useEffect(() => {
    const accept = (s: unknown) => {
      if (!isState(s)) return;
      if (s.rev > ref.current.rev || (s.rev === ref.current.rev && s.at > ref.current.at)) { const n = normalize(s); ref.current = n; setState(n); }
    };
    try {
      chan.current = new BroadcastChannel('bidwars-live');
      chan.current.onmessage = (e) => { if (e.data?.from !== TAB) accept(e.data.state); };
    } catch { /* ignore */ }
    const onStorage = (e: StorageEvent) => { if (e.key === KEY && e.newValue) { try { accept(JSON.parse(e.newValue)); } catch { /* ignore */ } } };
    window.addEventListener('storage', onStorage);
    return () => { chan.current?.close(); window.removeEventListener('storage', onStorage); };
  }, []);

  const value = useMemo(() => ({ state, dispatch, undo, canUndo, saved }), [state, dispatch, undo, canUndo, saved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
