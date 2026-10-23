// Team rooms: the host laptop publishes a small public snapshot to Firebase Realtime Database;
// each participant's phone reads only the status node and its own team node.
//
// Database layout:  events/<CODE>/owner          uid of the host laptop (anonymous sign-in)
//                   events/<CODE>/status         round, current lot, open/closed …
//                   events/<CODE>/teams/<no>     one node per team (1-based team number)
//                   events/<CODE>/bids/<win>/<no> one bid per team per bidding window (written by phones, read by host only)
//                   events/<CODE>/pins/<no>      team PINs (never readable; the rules compare against them)
//                   events/<CODE>/pinCheck/<no>/<device>  phones prove they know the PIN when joining
import type { FirebaseApp } from 'firebase/app';
import type { Database } from 'firebase/database';
import { ROUNDS, SLIPS, teamRows, type State } from '../store';

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};
export const roomsConfigured = !!(config.apiKey && config.databaseURL && config.projectId);

// ------------------------------------------------------------------ public payload
export type RoomPhase = 'closed' | 'waiting' | 'running' | 'done' | 'final';

export interface RoomStatus {
  event: string;
  phase: RoomPhase;
  teamCount: number;
  round: number;
  roundName: string;
  roundColor: string;
  live: null | {
    lot: number; name: string; role: string; round: number; base: number; bid: number;
    leader: number | null; leaderName: string | null; state: 'bidding' | 'sold' | 'unsold';
  };
  reveal: number;          // finale step on the projector (0–3)
  bidding: null | { id: string; open: boolean; lot: string | null; base: number | null };
  pinRequired: boolean;
  updatedAt: number;
}

export interface RoomPlayer { name: string; role: string; round: number; price: number; pts: number | null; note: string | null }
export interface RoomTeam {
  no: number; name: string; color: string;
  startPurse: number; purse: number; spent: number;
  points: number; pursePts: number; final: number; rank: number | null;
  players: RoomPlayer[];
  bonuses: { label: string; pts: number; cash: number }[];
  /** Id of the bidding window this team has already bid in (no amount, so other teams can't peek). */
  bidWin: string | null;
}

export function buildStatus(s: State): RoomStatus {
  const anySale = s.items.some((i) => i.status !== 'available');
  const allDone = s.items.length > 0 && s.items.every((i) => i.status !== 'available');
  const phase: RoomPhase = !s.rooms.open ? 'closed'
    : s.finalized ? 'final'
      : allDone && !s.live ? 'done'
        : anySale || s.live ? 'running' : 'waiting';
  const R = ROUNDS[s.round];
  const it = s.live ? s.items.find((i) => i.id === s.live!.itemId) : undefined;
  const leaderId = it?.status === 'sold' ? it.teamId : s.live?.teamId;
  const leaderIdx = s.teams.findIndex((t) => t.id === leaderId);
  return {
    event: s.settings.eventName,
    phase,
    teamCount: s.teams.length,
    round: s.round,
    roundName: R.name,
    roundColor: R.color,
    live: it && s.live ? {
      lot: it.lot, name: it.name, role: it.role ?? '', round: it.round, base: it.base,
      bid: it.status === 'sold' ? it.price ?? s.live.bid : s.live.bid,
      leader: leaderIdx >= 0 ? leaderIdx + 1 : null,
      leaderName: leaderIdx >= 0 ? s.teams[leaderIdx]!.name : null,
      state: s.live.phase,
    } : null,
    reveal: s.finalized ? s.finaleStep : 0,
    pinRequired: s.settings.teamPins,
    bidding: s.bids ? (() => {
      const lot = s.bids.itemId ? s.items.find((i) => i.id === s.bids!.itemId) : undefined;
      return { id: s.bids.id, open: s.bids.open, lot: lot ? lot.name : null, base: lot ? lot.base : null };
    })() : null,
    updatedAt: Date.now(),
  };
}

/** Points a team may see for one of its own players right now (same rules as the projector). */
function visiblePts(round: number, pts: number | null, finalized: boolean): number | null {
  if (finalized) return pts ?? 0;
  if (round === 1 || round === 2) return pts ?? 0;
  return null; // round 3 secret, round 4 is a slip
}

export function buildTeams(s: State, bidNos: ReadonlySet<number> = new Set()): Record<string, RoomTeam> {
  const rows = teamRows(s);
  const out: Record<string, RoomTeam> = {};
  rows.forEach((r) => {
    const no = r.index + 1;
    // The rank is only sent once the projector has revealed the champion, so phones don't spoil the reveal.
    const showRank = s.finalized && s.finaleStep >= 3;
    out[String(no)] = {
      no, name: r.team.name, color: r.team.color,
      startPurse: s.settings.startPurse,
      purse: r.remaining, spent: r.spent,
      points: r.points, pursePts: r.pursePts, final: r.final,
      rank: showRank ? r.rank : null,
      players: r.items.slice().sort((a, b) => (a.soldAt ?? 0) - (b.soldAt ?? 0)).map((i) => ({
        name: i.name, role: i.role ?? '', round: i.round, price: i.price ?? 0,
        pts: visiblePts(i.round, i.points, s.finalized),
        note: i.slip ? `${SLIPS[i.slip].title}: ${i.slipNote ?? ''}` : null,
      })),
      bonuses: s.adjs.filter((a) => a.teamId === r.team.id).map((a) => ({ label: a.label, pts: a.pts, cash: a.cash })),
      bidWin: s.bids && bidNos.has(no) ? s.bids.id : null,
    };
  });
  return out;
}

// ------------------------------------------------------------------ firebase
let ready: Promise<{ app: FirebaseApp; db: Database }> | null = null;
function fb() {
  ready ??= (async () => {
    const { initializeApp } = await import('firebase/app');
    const { getDatabase } = await import('firebase/database');
    const app = initializeApp(config);
    return { app, db: getDatabase(app) };
  })();
  return ready;
}

let hostUid: Promise<string> | null = null;
async function signInHost() {
  hostUid ??= (async () => {
    const { app } = await fb();
    const { getAuth, signInAnonymously } = await import('firebase/auth');
    const auth = getAuth(app);
    // Wait for a saved sign-in to load, so the projector window is the same "laptop" as the console window.
    await auth.authStateReady();
    const cred = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
    return cred.user.uid;
  })().catch((e) => { hostUid = null; throw e; });
  return hostUid;
}

/** Make sure this laptop owns the room code. Returns false if another computer already owns it. */
export async function claimRoom(code: string): Promise<boolean> {
  const uid = await signInHost();
  const { db } = await fb();
  const { ref, get, set } = await import('firebase/database');
  const owner = ref(db, `events/${code}/owner`);
  const cur = (await get(owner)).val() as string | null;
  if (cur && cur !== uid) return false;
  if (!cur) await set(owner, uid);
  return true;
}

/** Write only the parts that changed since the last publish. */
const last = new Map<string, string>();
export async function publish(code: string, status: RoomStatus, teams: Record<string, RoomTeam>, removedTeams: string[] = [], pins: Record<string, string> | null = null) {
  const { db } = await fb();
  const { ref, update } = await import('firebase/database');
  const patch: Record<string, unknown> = {};
  const put = (path: string, v: unknown) => {
    const key = `${code}/${path}`;
    const json = JSON.stringify(v, (k, x) => (k === 'updatedAt' ? undefined : x));
    if (last.get(key) === json) return;
    last.set(key, json);
    patch[path] = v;
  };
  put('pins', pins);
  put('status', status);
  for (const [no, t] of Object.entries(teams)) put(`teams/${no}`, t);
  for (const no of removedTeams) { patch[`teams/${no}`] = null; last.delete(`${code}/teams/${no}`); }
  if (Object.keys(patch).length) await update(ref(db, `events/${code}`), patch);
}
export const forgetPublished = () => last.clear();

export async function subscribe<T>(path: string, cb: (v: T | null) => void, onError?: (e: Error) => void): Promise<() => void> {
  const { db } = await fb();
  const { ref, onValue } = await import('firebase/database');
  return onValue(ref(db, path), (snap) => cb(snap.val() as T | null), (e) => onError?.(e));
}

/** Phone side: place this team's one bid. The server stamps the time, so "fastest" is fair across phones. */
export async function submitBid(code: string, win: string, no: number, amount: number, name: string, pin: string) {
  const { db } = await fb();
  const { ref, set, serverTimestamp } = await import('firebase/database');
  await set(ref(db, `events/${code}/bids/${win}/${no}`), { amount, at: serverTimestamp(), name, pin });
}

const DEVICE_KEY = 'bidwars-device';
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = Math.random().toString(36).slice(2, 12); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return Math.random().toString(36).slice(2, 12); }
}

/** Phone side: true if the PIN is right. The database rules accept this write only with the correct PIN. */
export async function checkPin(code: string, no: number, pin: string): Promise<'ok' | 'wrong' | 'offline'> {
  const { db } = await fb();
  const { ref, set, serverTimestamp } = await import('firebase/database');
  try {
    await set(ref(db, `events/${code}/pinCheck/${no}/${deviceId()}`), { pin, at: serverTimestamp() });
    return 'ok';
  } catch (e) {
    return /permission/i.test(String((e as { code?: string })?.code ?? e)) ? 'wrong' : 'offline';
  }
}

/** Host side: subscribe after signing in, for nodes only the room owner may read (bids). */
export async function subscribeAsHost<T>(path: string, cb: (v: T | null) => void, onError?: (e: Error) => void) {
  await signInHost();
  return subscribe(path, cb, onError);
}

export function joinUrl(code: string) {
  return `${location.origin}${location.pathname}#join/${code}`;
}
