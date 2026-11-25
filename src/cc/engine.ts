// Code & Chaos game engine. Pure functions: (state, input) → new state. The host laptop runs it;
// Firebase rules make sure phones can only write bids/answers that the engine will accept.
import type {
  Config, Current, Entry, HostState, Lot, LotResult, Participation, Priv, Pub, PubLot, PubQuestion, PubRow,
  Question, RawAnswer, RawBid, Score, TeamRec, VaultContent, Window,
} from './types';

export class GameError extends Error {}
const fail = (msg: string): never => { throw new GameError(msg); };

export const ROUND_META: Record<number, { name: string; short: string; color: string; tag: string }> = {
  0: { name: 'Practice Auction', short: 'Practice', color: '#94A3B8', tag: 'Dummy money. Nothing here counts.' },
  1: { name: 'The Smart Market', short: 'Smart Market', color: '#22E3FF', tag: 'Easy tech and fun challenges. Bid by raising your hand.' },
  2: { name: 'Crack the Code', short: 'Crack the Code', color: '#8B5CFF', tag: 'Technical challenges. Rewards stay secret until the hammer falls.' },
  3: { name: 'The Open Market', short: 'Open Market', color: '#FFC83D', tag: 'Bid from your phone. Highest bid when the timer ends wins.' },
  4: { name: 'Mystery Takeover', short: 'Mystery', color: '#FF4FD8', tag: 'Four sealed vaults, then a free jackpot for everyone.' },
};

export const DEFAULT_VAULTS: VaultContent[] = [
  { kind: 'points', value: 300, title: 'Instant Points', text: '+300 points straight away.' },
  { kind: 'cash', value: 200, title: 'Cash Injection', text: '+₹2 Cr virtual cash.' },
  { kind: 'double', value: 500, title: 'Double Reward Challenge', text: 'Answer correctly for +500 points. Wrong answer: nothing.' },
  { kind: 'trap', value: 0, title: 'Mystery Trap', text: 'The vault is empty. No reward.' },
];

export const DEFAULT_CONFIG: Config = {
  name: 'BID WARS 2.0: Code & Chaos',
  date: '',
  teamNos: Array.from({ length: 20 }, (_, i) => i + 1),
  purse: 1000, inc: 10, auctionSec: 25, answerSec: 10,
  share: 0.2, stealShare: 0.5, conv: 50,
  board: 'always', sound: true, auto: false,
  practicePurse: 1000,
  schedule: [5, 3, 10, 12, 12, 12, 6],
  crowdReward: 50, jackpotReward: 300,
  vaultPool: DEFAULT_VAULTS,
  regCode: '',
};

export const MAX_ANSWER_SEC = 10;
export const EVENT_MINUTES = (cfg: Config) => cfg.schedule.reduce((a, b) => a + b, 0);

let n = 0;
export const id = (p: string) => `${p}${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function money(lakh: number) {
  const neg = lakh < 0 ? '−' : '';
  const a = Math.abs(Math.round(lakh));
  if (a < 100) return `${neg}₹${a} L`;
  const cr = a / 100;
  return `${neg}₹${Number.isInteger(cr) ? cr : +cr.toFixed(2)} Cr`;
}

export function lotLabel(l: Pick<Lot, 'kind' | 'seq' | 'round'>) {
  if (l.kind === 'vault') return `VAULT ${l.seq}`;
  if (l.kind === 'jackpot') return 'FINAL JACKPOT';
  if (l.kind === 'crowd') return 'CROWD QUESTION';
  if (l.kind === 'practice') return 'PRACTICE LOT';
  return `LOT ${String(l.seq).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ creating an event
function lotFrom(q: Question | undefined, round: Lot['round'], seq: number, base: number, reward: number, part: Participation, kind: Lot['kind'] = 'question'): Lot {
  return {
    id: id('l'), round, seq, kind, mode: kind === 'jackpot' ? 'free' : round === 3 ? 'mobile' : 'physical',
    title: q?.title ?? 'Challenge', category: q?.category ?? '', difficulty: q?.difficulty ?? 'Easy',
    base, reward, participation: part, questionId: q?.id ?? null, vault: null,
    status: 'pending', owner: null, price: null, soldAt: null, result: null, practice: kind === 'practice',
  };
}

export interface Plan {
  practice: string;
  r1: readonly (readonly [string, number, number, string])[];
  r2: readonly (readonly [string, number, number, string])[];
  r3: readonly (readonly [string, number, number, string])[];
  vaults: readonly number[];
  vaultQuestion: string;
  jackpot: string;
}

export function shuffle<T>(a: T[], rnd = Math.random): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; }
  return b;
}

export function newEvent(code: string, bank: Question[], plan: Plan, cfg: Partial<Config> = {}): HostState {
  const config = { ...DEFAULT_CONFIG, ...cfg };
  const q = (qid: string) => bank.find((x) => x.id === qid);
  const lots: Lot[] = [];
  lots.push({ ...lotFrom(q(plan.practice), 0, 1, 50, 100, 'open', 'practice'), mode: 'physical' });
  ([['r1', 1], ['r2', 2], ['r3', 3]] as const).forEach(([k, r]) => plan[k].forEach(([qid, base, reward, part], i) => lots.push(lotFrom(q(qid), r, i + 1, base, reward, part as Participation))));
  // Vault contents are shuffled once, now, and kept on the host only.
  const contents = shuffle(config.vaultPool.slice(0, plan.vaults.length));
  plan.vaults.forEach((base, i) => lots.push({
    ...lotFrom(undefined, 4, i + 1, base, 0, 'exclusive', 'vault'),
    title: `Vault ${String.fromCharCode(65 + i)}`, category: 'Mystery', difficulty: '?',
    vault: contents[i] ?? { kind: 'trap', value: 0, title: 'Mystery Trap', text: 'The vault is empty.' },
    questionId: contents[i]?.kind === 'double' ? plan.vaultQuestion : null,
  }));
  lots.push({ ...lotFrom(q(plan.jackpot), 4, 5, 0, config.jackpotReward, 'open', 'jackpot'), title: 'Final Jackpot' });
  const teams: Record<string, TeamRec> = {};
  for (const no of config.teamNos) teams[no] = { no, members: null, regAt: null, eligible: true };
  return {
    v: 1, code, rev: 0, savedAt: Date.now(), cfg: config, stage: 'registration', regOpen: true,
    clockStart: null, liveStart: null, overtime: false, teams, bank, lots, cur: null,
    ledger: [], audit: [{ at: Date.now(), action: 'Event created', detail: `Code ${code}` }], finalStep: 0, finalAt: null,
  };
}

// ------------------------------------------------------------------ derived values
const live = (e: Entry) => !e.practice;
export function purseOf(s: HostState, team: number, practice = s.stage === 'practice') {
  const start = practice ? s.cfg.practicePurse : s.cfg.purse;
  return s.ledger.filter((e) => e.team === team && e.practice === practice).reduce((a, e) => a + e.purse, start);
}
export function pointsOf(s: HostState, team: number, practice = s.stage === 'practice') {
  return s.ledger.filter((e) => e.team === team && e.practice === practice).reduce((a, e) => a + e.points, 0);
}
export const registeredTeams = (s: HostState) => Object.values(s.teams).filter((t) => t.members && t.eligible).sort((a, b) => a.no - b.no);
export const findLot = (s: HostState, lotId: string | null | undefined) => s.lots.find((l) => l.id === lotId);
export const curLot = (s: HostState) => (s.cur ? findLot(s, s.cur.lotId) : undefined);
export const question = (s: HostState, qid: string | null) => s.bank.find((q) => q.id === qid);

export function standings(s: HostState, practice = s.stage === 'practice'): PubRow[] {
  const rows = registeredTeams(s).map((t) => ({ team: t.no, points: pointsOf(s, t.no, practice), purse: purseOf(s, t.no, practice), rank: 0 }));
  rows.sort((a, b) => b.points - a.points || b.purse - a.purse || a.team - b.team);
  rows.forEach((r, i) => { r.rank = i > 0 && r.points === rows[i - 1]!.points && r.purse === rows[i - 1]!.purse ? rows[i - 1]!.rank : i + 1; });
  return rows;
}

export function finalRows(s: HostState) {
  const rows = registeredTeams(s).map((t) => {
    const purse = purseOf(s, t.no, false);
    const points = pointsOf(s, t.no, false);
    const cashPts = Math.floor(Math.max(0, purse) / 100) * s.cfg.conv;
    return { team: t.no, points, purse, cashPts, final: points + cashPts, rank: 0, members: t.members ?? [] };
  });
  rows.sort((a, b) => b.final - a.final || b.points - a.points || b.purse - a.purse || a.team - b.team);
  rows.forEach((r, i) => { r.rank = i > 0 && r.final === rows[i - 1]!.final && r.points === rows[i - 1]!.points && r.purse === rows[i - 1]!.purse ? rows[i - 1]!.rank : i + 1; });
  return rows;
}

/** Which round the host is in right now (for the schedule). */
export function activeRound(s: HostState): number {
  if (s.stage === 'registration') return -1;
  if (s.stage === 'practice') return 0;
  if (s.stage === 'final') return 5;
  const l = curLot(s);
  if (l && l.round > 0) return l.round;
  const done = s.lots.filter((x) => !x.practice && x.status !== 'pending');
  const last = done.reduce((m, x) => Math.max(m, x.round), 1);
  return last;
}

/** Schedule check: minutes ahead (+) or behind (−) for the current part of the event. */
export function scheduleStatus(s: HostState, now: number) {
  if (!s.clockStart) return { elapsed: 0, part: 'Not started', delta: 0, state: 'on' as const, overDeadline: false };
  const elapsed = (now - s.clockStart) / 60000;
  const starts: number[] = [];
  s.cfg.schedule.reduce((a, m) => { starts.push(a); return a + m; }, 0);
  // activeRound: -1 registration, 0 practice, 1–4 rounds, 5 results → schedule parts 0…6
  const part = Math.max(0, Math.min(6, activeRound(s) + 1));
  const names = ['Registration', 'Rules & practice', 'Round 1', 'Round 2', 'Round 3', 'Round 4', 'Results'];
  const start = starts[part]!;
  const end = start + s.cfg.schedule[part]!;
  const delta = elapsed > end ? end - elapsed : elapsed < start ? start - elapsed : 0;
  const total = EVENT_MINUTES(s.cfg);
  return { elapsed, part: names[part]!, delta, state: delta < -0.5 ? 'behind' as const : delta > 0.5 ? 'ahead' as const : 'on' as const, overDeadline: elapsed >= total, plannedEnd: end, total };
}

// ------------------------------------------------------------------ state helpers
function mut(s: HostState, f: (d: HostState) => void, audit?: [string, string]): HostState {
  const d: HostState = structuredClone(s);
  f(d);
  if (audit) d.audit.unshift({ at: Date.now(), action: audit[0], detail: audit[1] });
  if (d.audit.length > 500) d.audit.length = 500;
  d.rev = s.rev + 1;
  d.savedAt = Date.now();
  return d;
}
function lotOf(d: HostState, lotId: string) { return d.lots.find((l) => l.id === lotId) ?? fail('That lot no longer exists.'); }
function needCur(d: HostState, ...status: Lot['status'][]) {
  const l = d.cur ? d.lots.find((x) => x.id === d.cur!.lotId) : undefined;
  if (!l || !d.cur) return fail('No lot is active.');
  if (status.length && !status.includes(l.status)) fail(`This lot is ${l.status}, not ${status.join(' or ')}.`);
  return { l, c: d.cur };
}
function ledger(d: HostState, team: number, purse: number, points: number, reason: string, lotId: string | null, practice: boolean) {
  d.ledger.push({ id: id('e'), at: Date.now(), team, purse, points, reason, lotId, practice });
}

// ------------------------------------------------------------------ setup & registration
export function configure(s: HostState, patch: Partial<Config>) {
  if (s.stage !== 'registration' && (patch.purse !== undefined || patch.teamNos !== undefined)) fail('Purse and teams are locked once the event has started.');
  if (patch.answerSec !== undefined && (patch.answerSec > MAX_ANSWER_SEC || patch.answerSec < 3)) fail('Answer time must be 3 to 10 seconds.');
  return mut(s, (d) => {
    Object.assign(d.cfg, patch);
    if (patch.teamNos) {
      const nos = [...new Set(patch.teamNos)].filter((x) => Number.isInteger(x) && x > 0 && x < 1000).sort((a, b) => a - b);
      d.cfg.teamNos = nos;
      for (const no of nos) d.teams[no] ??= { no, members: null, regAt: null, eligible: true };
      for (const k of Object.keys(d.teams)) if (!nos.includes(Number(k)) && !d.teams[k]!.members) delete d.teams[k];
      for (const k of Object.keys(d.teams)) d.teams[k]!.eligible = nos.includes(Number(k));
    }
  }, ['Settings changed', Object.keys(patch).join(', ')]);
}

/** A registration that a phone wrote. First valid registration per team wins; the host can edit later. */
export function applyRegistration(s: HostState, no: number, members: string[], at: number) {
  const t = s.teams[no];
  if (!t || t.members) return s;
  const clean = members.map((m) => String(m ?? '').trim().slice(0, 40));
  if (clean.length !== 4 || clean.some((m) => !m)) return s;
  return mut(s, (d) => { d.teams[no] = { ...d.teams[no]!, members: clean, regAt: at }; });
}

export function editTeam(s: HostState, no: number, members: string[] | null) {
  return mut(s, (d) => {
    const t = d.teams[no] ?? fail(`Team ${no} is not in this event.`);
    if (members && (members.length !== 4 || members.some((m) => !m.trim()))) fail('Enter all four names.');
    t.members = members ? members.map((m) => m.trim()) : null;
    if (!members) t.regAt = null;
  }, [members ? 'Registration edited' : 'Registration cleared', `Team ${no}`]);
}

export function setRegOpen(s: HostState, open: boolean) {
  return mut(s, (d) => { d.regOpen = open; }, [open ? 'Registration opened' : 'Registration closed', '']);
}

export function startClock(s: HostState, now: number) {
  if (s.clockStart) return s;
  return mut(s, (d) => { d.clockStart = now; }, ['Event timer started', '']);
}

export function startPractice(s: HostState, now: number) {
  if (s.stage !== 'registration') fail('Practice is only available before the event starts.');
  return mut(s, (d) => { d.stage = 'practice'; d.clockStart ??= now; d.cur = null; }, ['Practice started', '']);
}

export function startLive(s: HostState, now: number) {
  if (s.stage === 'live' || s.stage === 'final') fail('The event is already running.');
  if (s.cur) {
    const l = curLot(s);
    if (l && ['auction', 'settlement', 'answer', 'steal'].includes(l.status)) fail('Finish the practice lot first.');
  }
  if (!registeredTeams(s).length) fail('No teams have registered yet.');
  return mut(s, (d) => {
    d.stage = 'live';
    d.regOpen = false;
    d.liveStart = now;
    d.clockStart ??= now;
    d.cur = null;
    // Practice money and points stay in the ledger marked "practice" and never count.
  }, ['Event started', `${registeredTeams(s).length} teams, purse ${money(s.cfg.purse)} each`]);
}

// ------------------------------------------------------------------ auctions
export function canStartLot(s: HostState, now: number) {
  if (s.stage === 'final') return 'The event is finished.';
  if (s.cur) {
    const l = curLot(s)!;
    if (!['done', 'skipped'].includes(l.status)) return 'Finish the current lot first.';
  }
  const sch = scheduleStatus(s, now);
  if (s.stage === 'live' && sch.overDeadline && !s.overtime) return 'The 60-minute deadline has passed. Finish up, or allow overtime.';
  return null;
}

export function startLot(s: HostState, lotId: string, now: number) {
  const why = canStartLot(s, now);
  if (why) fail(why);
  const l0 = findLot(s, lotId) ?? fail('Unknown lot.');
  if (l0.status !== 'pending') fail('That lot has already been used.');
  if (l0.practice !== (s.stage === 'practice')) fail(l0.practice ? 'The practice lot is only for practice.' : 'Start the actual event first.');
  if (s.stage === 'registration') fail('Start the practice or the event first.');
  if (l0.kind === 'jackpot') return startFree(s, lotId, now);
  return mut(s, (d) => {
    const l = lotOf(d, lotId);
    l.status = 'auction';
    d.cur = { lotId, deadline: now + d.cfg.auctionSec * 1000, high: null, verbal: null, win: null, shownAt: now };
  }, ['Auction started', `${lotLabel(l0)} ${l0.title}`]);
}

export function extendAuction(s: HostState, sec: number) {
  return mut(s, (d) => {
    const { c } = needCur(d, 'auction');
    c.deadline = (c.deadline ?? Date.now()) + sec * 1000;
  }, ['Auction timer extended', `+${sec}s`]);
}

/** Time is up (or the host ended it early): wait for the host to settle. */
export function endAuction(s: HostState, now: number) {
  const l = curLot(s);
  if (!l || l.status !== 'auction') return s;
  return mut(s, (d) => {
    const { l: lot, c } = needCur(d, 'auction');
    lot.status = 'settlement';
    c.deadline = Math.min(c.deadline ?? now, now);
    c.shownAt = now;
  });
}

export function setVerbal(s: HostState, team: number | null, amount: number | null) {
  return mut(s, (d) => { const { c } = needCur(d, 'auction', 'settlement'); c.verbal = { team, amount }; });
}

/** Mobile auction: recompute the leading bid from the raw bids phones wrote (rules already checked each one). */
export function applyBids(s: HostState, raw: Record<string, Record<string, RawBid>> | null) {
  const l = curLot(s);
  if (!l || l.mode !== 'mobile' || !s.cur || !['auction', 'settlement'].includes(l.status)) return s;
  const practice = l.practice;
  let best: { team: number; amount: number; at: number } | null = null;
  for (const [teamKey, bids] of Object.entries(raw ?? {})) {
    const team = Number(teamKey);
    if (!s.teams[team]?.members || !s.teams[team]!.eligible) continue;
    const purse = purseOf(s, team, practice);
    for (const b of Object.values(bids ?? {})) {
      if (!b || typeof b.a !== 'number' || typeof b.at !== 'number') continue;
      if (b.a < l.base || b.a > purse) continue;
      if (s.cur.deadline && b.at > s.cur.deadline) continue;
      if (!best || b.a > best.amount || (b.a === best.amount && b.at < best.at)) best = { team, amount: b.a, at: b.at };
    }
  }
  const same = JSON.stringify(best) === JSON.stringify(s.cur.high);
  if (same) return s;
  return mut(s, (d) => { d.cur!.high = best; });
}

export function minNextBid(s: HostState) {
  const l = curLot(s);
  if (!l || !s.cur) return null;
  return s.cur.high ? s.cur.high.amount + s.cfg.inc : l.base;
}

export interface SettleInput { team: number; price: number; override?: string }
export function settle(s: HostState, input: SettleInput, now: number) {
  const l0 = curLot(s);
  if (!l0) fail('No lot is active.');
  if (l0!.status === 'sold' || l0!.owner !== null) return s; // a repeated click: already sold, change nothing
  if (l0!.status !== 'settlement' && l0!.status !== 'auction') fail('This lot is not waiting for a sale.');
  const t = s.teams[input.team];
  if (!t || !t.members) fail(`Team ${input.team} is not registered.`);
  if (!t!.eligible) fail(`Team ${input.team} is not playing in this event.`);
  const price = Math.round(input.price);
  if (!Number.isFinite(price) || price < l0!.base) fail(`The price must be at least the base price, ${money(l0!.base)}.`);
  if (price !== l0!.base && price % s.cfg.inc !== 0) fail(`Prices go up in steps of ${money(s.cfg.inc)}.`);
  const purse = purseOf(s, input.team, l0!.practice);
  if (price > purse) fail(`Team ${input.team} only has ${money(purse)} left.`);
  const high = s.cur!.high;
  const isOverride = l0!.mode === 'mobile' && !!high && (high.team !== input.team || high.amount !== price);
  if (l0!.mode === 'mobile' && high && isOverride && !input.override?.trim()) fail('This changes the phone auction result. Give a reason to override it.');
  if (l0!.mode === 'mobile' && !high && !input.override?.trim()) fail('No phone bids came in. Give a reason to sell it anyway, or mark it unsold.');
  return mut(s, (d) => {
    const { l, c } = needCur(d);
    l.status = 'sold'; l.owner = input.team; l.price = price; l.soldAt = now;
    c.shownAt = now;
    ledger(d, input.team, -price, 0, `Bought ${lotLabel(l)} ${l.title}`, l.id, l.practice);
  }, [isOverride || (l0!.mode === 'mobile' && !high) ? 'Sale OVERRIDE' : 'Sold', `${lotLabel(l0!)} → Team ${input.team} for ${money(price)}${input.override ? ` (reason: ${input.override})` : ''}`]);
}

export function markUnsold(s: HostState, now: number) {
  return mut(s, (d) => {
    const { l, c } = needCur(d, 'auction', 'settlement');
    l.status = 'unsold'; c.shownAt = now; c.deadline = null;
  }, ['Unsold', `${lotLabel(curLot(s)!)}`]);
}

// ------------------------------------------------------------------ answer windows
function openWindow(d: HostState, l: Lot, now: number, n: 1 | 2, elig: Window['elig'], reward: number) {
  const sec = Math.min(MAX_ANSWER_SEC, d.cfg.answerSec);
  d.cur!.win = { id: `${n === 1 ? 'a' : 's'}${id('')}`, n, elig, owner: l.owner, reward, opened: now, deadline: now + sec * 1000 };
  d.cur!.shownAt = now;
  l.status = n === 1 ? 'answer' : 'steal';
}

/** Show the question and start the 10-second window in one step. */
export function revealChallenge(s: HostState, now: number) {
  return mut(s, (d) => {
    const { l } = needCur(d, 'sold');
    if (l.kind === 'vault') fail('Open the vault instead.');
    if (!question(d, l.questionId)) fail('This lot has no question. Pick one on the Lots page.');
    const elig: Window['elig'] = l.participation === 'open' ? 'all' : 'owner';
    openWindow(d, l, now, 1, elig, l.reward);
  }, ['Challenge revealed', lotLabel(curLot(s)!)]);
}

export function unsoldToCrowd(s: HostState, now: number) {
  return mut(s, (d) => {
    const { l } = needCur(d, 'unsold');
    if (l.kind === 'vault') fail('A vault cannot become a crowd question.');
    if (!question(d, l.questionId)) fail('This lot has no question.');
    l.kind = l.kind === 'practice' ? 'practice' : 'crowd';
    l.owner = null;
    l.participation = 'open';
    l.reward = Math.max(10, Math.floor(l.reward * d.cfg.share));
    openWindow(d, l, now, 1, 'all', l.reward);
  }, ['Unsold lot became a crowd question', lotLabel(curLot(s)!)]);
}

/** A free question for every team (used during the mystery round, or any time a lot was skipped). */
export function crowdQuestion(s: HostState, qid: string, now: number) {
  const why = s.cur && !['done', 'skipped', 'vault', 'unsold'].includes(curLot(s)!.status) ? 'Finish the current challenge first.' : null;
  if (why) fail(why);
  if (s.stage !== 'live' && s.stage !== 'practice') fail('Start the event first.');
  const q = question(s, qid) ?? fail('Pick a question.');
  const round = (Math.max(1, Math.min(4, activeRound(s))) as Lot['round']);
  return mut(s, (d) => {
    const prev = curLot(d);
    if (prev && prev.status === 'vault') prev.status = 'done';
    if (prev && prev.status === 'unsold') prev.status = 'skipped';
    const l: Lot = { ...lotFrom(q, round, 0, 0, d.cfg.crowdReward, 'open', 'crowd'), mode: 'free', practice: d.stage === 'practice' };
    d.lots.push(l);
    d.cur = { lotId: l.id, deadline: null, high: null, verbal: null, win: null, shownAt: now };
    openWindow(d, l, now, 1, 'all', l.reward);
  }, ['Crowd question', q.title]);
}

function startFree(s: HostState, lotId: string, now: number) {
  return mut(s, (d) => {
    const l = lotOf(d, lotId);
    if (!question(d, l.questionId)) fail('The jackpot has no question. Pick one on the Lots page.');
    d.cur = { lotId, deadline: null, high: null, verbal: null, win: null, shownAt: now };
    openWindow(d, l, now, 1, 'all', l.reward);
  }, ['Final jackpot started', '']);
}

export function answerIsRight(q: Question, c: number | string | undefined) {
  if (c === undefined || c === null) return false;
  if (q.type === 'oneword') {
    const norm = (x: string) => x.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
    const v = norm(String(c));
    return !!v && q.accept.some((a) => norm(a) === v);
  }
  return Number(c) === q.answer;
}
export const answerText = (q: Question) => (q.type === 'oneword' ? q.accept[0] ?? '' : q.options[q.answer] ?? '');

/**
 * Close the open answer window and score it. `answers` is everything phones wrote for this window
 * (the rules already rejected late or ineligible writes). Safe to call twice: the second call does nothing.
 */
export function closeWindow(s: HostState, winId: string, answers: Record<string, RawAnswer> | null, now: number): HostState {
  const l0 = curLot(s);
  const w0 = s.cur?.win;
  if (!l0 || !w0 || w0.id !== winId || !['answer', 'steal'].includes(l0.status)) return s;
  return mut(s, (d) => {
    const { l, c } = needCur(d, 'answer', 'steal');
    const w = c.win!;
    const q = question(d, l.questionId)!;
    const valid = Object.entries(answers ?? {})
      .map(([team, a]) => ({ team: Number(team), c: a?.c, at: a?.at ?? 0 }))
      .filter((a) => d.teams[a.team]?.members && d.teams[a.team]!.eligible && a.at <= w.deadline + 250)
      .filter((a) => w.elig === 'all' || (w.elig === 'owner' ? a.team === w.owner : a.team !== w.owner))
      .sort((a, b) => a.at - b.at || a.team - b.team);
    const right = valid.filter((a) => answerIsRight(q, a.c));
    const scores: Score[] = [];
    const prev = l.result;
    const isFree = l.kind === 'crowd' || l.kind === 'jackpot' || l.owner === null;
    let ownerCorrect: boolean | null = prev?.ownerCorrect ?? null;

    if (w.n === 1 && isFree) {
      for (const a of right) scores.push({ team: a.team, pts: w.reward, role: 'all' });
    } else if (w.n === 1 && l.kind === 'vault') {
      ownerCorrect = right.some((a) => a.team === w.owner);
      if (ownerCorrect) scores.push({ team: w.owner!, pts: w.reward, role: 'owner' });
    } else if (w.n === 1) {
      ownerCorrect = right.some((a) => a.team === w.owner);
      if (ownerCorrect) scores.push({ team: w.owner!, pts: w.reward, role: 'owner' });
      if (l.participation === 'open') {
        const other = Math.floor(w.reward * d.cfg.share);
        for (const a of right) if (a.team !== w.owner && other > 0) scores.push({ team: a.team, pts: other, role: 'other' });
      }
      if (l.participation === 'steal' && !ownerCorrect) {
        // The owner missed: open the steal window. Nobody learns the answer yet.
        l.result = { answer: '', explain: '', ownerCorrect: false, scores: [], submitted: valid.length, correct: 0, stealTried: true };
        openWindow(d, l, now, 2, 'others', Math.floor(l.reward * d.cfg.stealShare));
        d.audit.unshift({ at: Date.now(), action: 'Steal window opened', detail: lotLabel(l) });
        return;
      }
    } else {
      const first = right[0];
      if (first) scores.push({ team: first.team, pts: w.reward, role: 'steal' });
    }
    for (const sc of scores) ledger(d, sc.team, 0, sc.pts, `${sc.role === 'steal' ? 'Steal' : 'Correct answer'}: ${lotLabel(l)}`, l.id, l.practice);
    l.result = {
      answer: answerText(q), explain: q.explain, ownerCorrect, scores,
      submitted: valid.length + (prev?.submitted ?? 0), correct: right.length, stealTried: w.n === 2,
    };
    l.status = 'results';
    c.shownAt = now;
  });
}

/** A serious technical problem: throw away this question's answers and run a fresh 10-second window. */
export function voidAndReplay(s: HostState, reason: string, now: number) {
  if (!reason.trim()) fail('Say why the question is being replayed.');
  return mut(s, (d) => {
    const { l } = needCur(d, 'answer', 'steal', 'results');
    d.ledger = d.ledger.filter((e) => !(e.lotId === l.id && e.points !== 0 && e.purse === 0));
    l.result = null;
    const elig: Window['elig'] = l.owner === null || l.participation === 'open' || l.kind === 'jackpot' || l.kind === 'crowd' ? 'all' : 'owner';
    openWindow(d, l, now, 1, elig, l.reward);
  }, ['Question VOIDED and replayed', `${lotLabel(curLot(s)!)}: ${reason}`]);
}

// ------------------------------------------------------------------ vaults
export function openVault(s: HostState, now: number) {
  return mut(s, (d) => {
    const { l, c } = needCur(d, 'sold');
    if (l.kind !== 'vault' || !l.vault) fail('This is not a vault.');
    const v = l.vault!;
    if (v.kind === 'points') ledger(d, l.owner!, 0, v.value, `Vault ${l.seq}: ${v.title}`, l.id, l.practice);
    if (v.kind === 'cash') ledger(d, l.owner!, v.value, 0, `Vault ${l.seq}: ${v.title}`, l.id, l.practice);
    l.status = 'vault';
    c.shownAt = now;
  }, ['Vault opened', `Vault ${curLot(s)!.seq}: ${curLot(s)!.vault?.title} → Team ${curLot(s)!.owner}`]);
}

export function startVaultChallenge(s: HostState, now: number) {
  return mut(s, (d) => {
    const { l } = needCur(d, 'vault');
    if (l.vault?.kind !== 'double') fail('This vault has no challenge.');
    if (!question(d, l.questionId)) fail('Pick a question for this vault on the Lots page.');
    openWindow(d, l, now, 1, 'owner', l.vault!.value);
  }, ['Vault challenge started', `Vault ${curLot(s)!.seq}`]);
}

// ------------------------------------------------------------------ finishing lots
export function finishLot(s: HostState) {
  const l = curLot(s);
  if (!l) return s;
  if (!['results', 'vault', 'unsold', 'sold'].includes(l.status)) fail('This lot is still running.');
  if (l.status === 'sold' && l.kind !== 'vault' && l.questionId) fail('Reveal the challenge first.');
  return mut(s, (d) => {
    const { l: lot } = needCur(d);
    lot.status = lot.status === 'unsold' ? 'skipped' : 'done';
    d.cur = null;
  });
}

export function skipLot(s: HostState, lotId: string) {
  const l = findLot(s, lotId) ?? fail('Unknown lot.');
  if (l.status !== 'pending') fail('Only lots that have not started can be skipped.');
  return mut(s, (d) => { lotOf(d, lotId).status = 'skipped'; }, ['Lot skipped', `${lotLabel(l)} ${l.title}`]);
}

export function unskipLot(s: HostState, lotId: string) {
  const l = findLot(s, lotId) ?? fail('Unknown lot.');
  if (l.status !== 'skipped' || l.owner !== null) fail('Only a skipped lot can be brought back.');
  return mut(s, (d) => { lotOf(d, lotId).status = 'pending'; }, ['Lot restored', `${lotLabel(l)} ${l.title}`]);
}

// ------------------------------------------------------------------ lot planning
export function editLot(s: HostState, lotId: string, patch: Partial<Pick<Lot, 'base' | 'reward' | 'participation' | 'questionId' | 'mode'>>) {
  const l = findLot(s, lotId) ?? fail('Unknown lot.');
  if (l.status !== 'pending') fail('This lot has already been played.');
  if (patch.questionId) {
    const used = s.lots.find((x) => x.id !== lotId && x.questionId === patch.questionId && x.status !== 'skipped');
    if (used) fail(`That question is already used by ${lotLabel(used)} (round ${used.round}).`);
  }
  return mut(s, (d) => {
    const lot = lotOf(d, lotId);
    Object.assign(lot, patch);
    if (patch.questionId && lot.kind !== 'vault') {
      const q = question(d, patch.questionId)!;
      lot.title = q.title; lot.category = q.category; lot.difficulty = q.difficulty;
    }
  });
}

export function moveLot(s: HostState, lotId: string, dir: -1 | 1) {
  const l = findLot(s, lotId) ?? fail('Unknown lot.');
  const same = s.lots.filter((x) => x.round === l.round && x.kind === l.kind && !x.practice).sort((a, b) => a.seq - b.seq);
  const i = same.findIndex((x) => x.id === lotId);
  const j = i + dir;
  if (j < 0 || j >= same.length) return s;
  if (same[i]!.status !== 'pending' || same[j]!.status !== 'pending') fail('Only lots that have not started can be moved.');
  return mut(s, (d) => {
    const a = lotOf(d, same[i]!.id), b = lotOf(d, same[j]!.id);
    [a.seq, b.seq] = [b.seq, a.seq];
  });
}

/** Give every unplayed question lot a fresh, unused question from the active bank. */
export function randomizeQuestions(s: HostState, rnd = Math.random) {
  return mut(s, (d) => {
    const used = new Set(d.lots.filter((l) => l.status !== 'pending' && l.questionId).map((l) => l.questionId!));
    const pool = shuffle(d.bank.filter((q) => q.active && !used.has(q.id)), rnd);
    for (const l of d.lots) {
      if (l.status !== 'pending' || l.practice) continue;
      if (l.kind === 'vault' && l.vault?.kind !== 'double') continue;
      const q = pool.pop();
      if (!q) break;
      l.questionId = q.id;
      if (l.kind !== 'vault') { l.title = l.kind === 'jackpot' ? 'Final Jackpot' : q.title; l.category = q.category; l.difficulty = q.difficulty; }
    }
  }, ['Questions randomised', '']);
}

export function saveQuestion(s: HostState, q: Question) {
  const bad = validateQuestion(q);
  if (bad) fail(bad);
  return mut(s, (d) => {
    const i = d.bank.findIndex((x) => x.id === q.id);
    if (i >= 0) d.bank[i] = q; else d.bank.push(q);
    for (const l of d.lots) if (l.questionId === q.id && l.status === 'pending' && l.kind !== 'vault' && l.kind !== 'jackpot') { l.title = q.title; l.category = q.category; l.difficulty = q.difficulty; }
  });
}

export function validateQuestion(q: Partial<Question>): string | null {
  if (!q.id || !/^[\w-]{1,40}$/.test(q.id)) return 'Each question needs a short id (letters, numbers, - or _).';
  if (!q.title?.trim()) return `${q.id}: add a title.`;
  if (!q.prompt?.trim()) return `${q.id}: add the question text.`;
  if (!['mcq', 'tf', 'oneword'].includes(q.type ?? '')) return `${q.id}: type must be mcq, tf or oneword.`;
  if ((q.code ?? '').split('\n').length > 6) return `${q.id}: keep code to five lines or fewer.`;
  if (q.type === 'oneword') {
    if (!q.accept?.length || !q.accept.some((a) => a.trim())) return `${q.id}: add at least one accepted answer.`;
  } else {
    const opts = q.options ?? [];
    if (opts.length < 2 || opts.length > 6 || opts.some((o) => !String(o).trim())) return `${q.id}: give 2 to 6 non-empty options.`;
    if (!Number.isInteger(q.answer) || q.answer! < 0 || q.answer! >= opts.length) return `${q.id}: the correct answer must be one of the options.`;
  }
  if (!['Easy', 'Medium', 'Hard'].includes(q.difficulty ?? '')) return `${q.id}: difficulty must be Easy, Medium or Hard.`;
  return null;
}

export function archiveQuestion(s: HostState, qid: string, active: boolean) {
  return mut(s, (d) => { const q = d.bank.find((x) => x.id === qid); if (q) q.active = active; });
}
export function deleteQuestion(s: HostState, qid: string) {
  if (s.lots.some((l) => l.questionId === qid && l.status !== 'skipped')) fail('This question is assigned to a lot. Archive it, or assign another question to the lot first.');
  return mut(s, (d) => { d.bank = d.bank.filter((x) => x.id !== qid); });
}
export function importQuestions(s: HostState, qs: Question[]) {
  for (const q of qs) { const bad = validateQuestion(q); if (bad) fail(bad); }
  const ids = new Set<string>();
  for (const q of qs) { if (ids.has(q.id)) fail(`Duplicate id ${q.id} in the file.`); ids.add(q.id); }
  return mut(s, (d) => {
    for (const q of qs) {
      const i = d.bank.findIndex((x) => x.id === q.id);
      if (i >= 0) d.bank[i] = q; else d.bank.push(q);
    }
  }, ['Questions imported', `${qs.length}`]);
}

// ------------------------------------------------------------------ host adjustments & finale
export function adjust(s: HostState, team: number, points: number, purse: number, reason: string) {
  if (!reason.trim()) fail('Give a reason.');
  if (!s.teams[team]?.members) fail(`Team ${team} is not registered.`);
  if (!points && !purse) fail('Enter points or cash.');
  return mut(s, (d) => ledger(d, team, Math.round(purse), Math.round(points), `Host: ${reason}`, null, d.stage === 'practice'),
    ['Manual adjustment', `Team ${team}: ${points ? `${points > 0 ? '+' : ''}${points} pts ` : ''}${purse ? `${money(purse)} ` : ''}(${reason})`]);
}

export function setOvertime(s: HostState, on: boolean) {
  return mut(s, (d) => { d.overtime = on; }, [on ? 'Overtime allowed' : 'Overtime off', '']);
}

export function finalize(s: HostState, now: number) {
  const l = curLot(s);
  if (l && ['auction', 'settlement', 'answer', 'steal'].includes(l.status)) fail('Settle the current lot first.');
  if (s.stage !== 'live') fail('Start the event first.');
  return mut(s, (d) => { d.stage = 'final'; d.cur = null; d.finalAt = now; d.finalStep = 0; }, ['Results finalised', '']);
}
export function setFinalStep(s: HostState, step: number) {
  return mut(s, (d) => { d.finalStep = Math.max(0, Math.min(3, step)); });
}
export function reopen(s: HostState) {
  if (s.stage !== 'final') return s;
  return mut(s, (d) => { d.stage = 'live'; d.finalAt = null; d.finalStep = 0; }, ['Results reopened', '']);
}

// ------------------------------------------------------------------ public views
export function boardVisible(s: HostState) {
  if (s.cfg.board === 'always') return true;
  if (s.cfg.board === 'hidden') return false;
  const l = curLot(s);
  return !l || ['done', 'skipped', 'results', 'vault'].includes(l.status);
}

export function buildPub(s: HostState, answeredCount = 0): Pub {
  const l = curLot(s);
  const c = s.cur;
  const round = l ? l.round : Math.max(0, activeRound(s));
  let lot: PubLot | null = null;
  if (l && c) {
    const sold = l.owner !== null;
    const hideReward = l.kind === 'vault' || (l.round === 2 && !sold && l.kind === 'question');
    lot = {
      id: l.id, round: l.round, seq: l.seq, kind: l.kind, mode: l.mode, status: l.status,
      label: lotLabel(l), title: l.title, category: l.category, difficulty: l.difficulty, base: l.base,
      reward: hideReward ? null : l.reward,
      participation: l.kind === 'crowd' || l.kind === 'jackpot' ? 'all' : l.participation,
      owner: l.owner, price: l.price,
      deadline: l.status === 'auction' ? c.deadline : null,
      minBid: l.mode === 'mobile' && l.status === 'auction' ? (c.high ? c.high.amount + s.cfg.inc : l.base) : null,
      high: l.mode === 'mobile' && c.high ? { team: c.high.team, amount: c.high.amount } : null,
      verbal: l.mode === 'physical' ? c.verbal : null,
      vault: l.kind === 'vault' && ['vault', 'answer', 'results', 'done'].includes(l.status) ? l.vault : null,
      practice: l.practice,
      shownAt: c.shownAt,
    };
    if (l.kind === 'vault' && l.status === 'results' && lot.vault) lot.reward = lot.vault.value;
  }
  let q: PubQuestion | null = null;
  if (l && c?.win && ['answer', 'steal'].includes(l.status)) {
    const qq = question(s, l.questionId)!;
    q = {
      lotId: l.id, win: c.win.id, n: c.win.n, elig: c.win.elig, owner: c.win.owner, reward: c.win.reward,
      deadline: c.win.deadline, opened: c.win.opened,
      title: qq.title, category: qq.category, prompt: qq.prompt, code: qq.code, image: qq.image,
      type: qq.type, options: qq.type === 'oneword' ? [] : qq.options, submitted: answeredCount,
    };
  }
  const res = l && l.result && l.status === 'results' ? { ...l.result, lotId: l.id } : null;
  const history = s.lots
    .filter((x) => !x.practice && ['done', 'skipped', 'results', 'vault', 'sold'].includes(x.status) && x.kind !== 'crowd')
    .sort((a, b) => (b.soldAt ?? 0) - (a.soldAt ?? 0))
    .slice(0, 8)
    .map((x) => ({ label: lotLabel(x), title: x.title, team: x.owner, price: x.price, status: x.status }));
  const fr = s.stage === 'final' ? finalRows(s) : null;
  return {
    v: 1, name: s.cfg.name, date: s.cfg.date, stage: s.stage, regOpen: s.regOpen, needCode: !!s.cfg.regCode.trim(),
    allowed: s.cfg.teamNos.filter((no) => s.teams[no]?.eligible),
    registered: registeredTeams(s).map((t) => t.no),
    clockStart: s.clockStart, liveStart: s.liveStart, schedule: s.cfg.schedule,
    round, roundName: ROUND_META[round]?.name ?? '',
    cfg: { purse: s.cfg.purse, inc: s.cfg.inc, answerSec: Math.min(MAX_ANSWER_SEC, s.cfg.answerSec), auctionSec: s.cfg.auctionSec, share: s.cfg.share, stealShare: s.cfg.stealShare, conv: s.cfg.conv, sound: s.cfg.sound },
    lot, q, res,
    board: boardVisible(s) && s.stage !== 'registration' ? standings(s) : null,
    history,
    // Podium places stay out of the public data until the host reveals them.
    final: fr ? { step: s.finalStep, rows: fr.filter((r) => r.rank > 3 || s.finalStep >= 4 - r.rank) } : null,
    practice: s.stage === 'practice',
    at: Date.now(),
  };
}

export function buildPriv(s: HostState, no: number): Priv | null {
  const t = s.teams[no];
  if (!t || !t.members) return null;
  const practice = s.stage === 'practice';
  const buys = s.lots.filter((l) => l.owner === no && l.practice === practice).map((l) => ({
    label: lotLabel(l), title: l.title, price: l.price ?? 0,
    pts: s.ledger.filter((e) => e.lotId === l.id && e.team === no).reduce((a, e) => a + e.points, 0),
  }));
  const l = curLot(s);
  const last = l && l.status === 'results' && l.result ? {
    lotId: l.id,
    pts: l.result.scores.filter((x) => x.team === no).reduce((a, x) => a + x.pts, 0),
    correct: l.result.scores.some((x) => x.team === no),
  } : null;
  return { no, members: t.members, purse: purseOf(s, no, practice), points: pointsOf(s, no, practice), practice, buys, last };
}

export const exportResultsCSV = (s: HostState) => {
  const esc = (v: unknown) => { const x = String(v ?? ''); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  const rows: unknown[][] = [['Rank', 'Team', 'Members', 'Points', 'Purse left (lakh)', 'Cash points', 'Final points']];
  for (const r of finalRows(s)) rows.push([r.rank, r.team, r.members.join(' / '), r.points, r.purse, r.cashPts, r.final]);
  rows.push([], ['Lot', 'Round', 'Title', 'Status', 'Team', 'Price (lakh)', 'Points awarded']);
  for (const l of s.lots.filter((x) => !x.practice)) rows.push([lotLabel(l), l.round, l.title, l.status, l.owner ?? '', l.price ?? '', (l.result?.scores ?? []).map((x) => `T${x.team}:+${x.pts}`).join(' ')]);
  rows.push([], ['Time', 'Team', 'Purse change (lakh)', 'Points change', 'Reason']);
  for (const e of s.ledger.filter(live)) rows.push([new Date(e.at).toISOString(), e.team, e.purse, e.points, e.reason]);
  rows.push([], ['Time', 'Audit action', 'Detail']);
  for (const a of [...s.audit].reverse()) rows.push([new Date(a.at).toISOString(), a.action, a.detail]);
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
};

export type { Current };
