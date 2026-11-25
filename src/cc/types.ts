// Code & Chaos data model. Money is always whole lakhs (₹1 Cr = 100).

export type Group = 'coding' | 'tech' | 'cloud' | 'movies' | 'sports' | 'logic' | 'emoji';
export const GROUPS: Record<Group, string> = {
  coding: 'Coding & debugging', tech: 'Technology & AI', cloud: 'Cloud, SQL & testing',
  movies: 'Movies & entertainment', sports: 'Cricket & sports', logic: 'Logic & reasoning', emoji: 'Visual & emoji',
};

export interface Question {
  id: string;
  group: Group;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  title: string;
  prompt: string;
  code: string;           // short snippet, shown in a code block (≤ 5 lines)
  type: 'mcq' | 'tf' | 'oneword';
  options: string[];      // mcq / tf
  answer: number;         // index into options (mcq / tf)
  accept: string[];       // oneword: accepted answers (first one is shown as "the" answer)
  explain: string;
  image: string;          // optional image URL
  active: boolean;
}

export type Participation = 'open' | 'exclusive' | 'steal';
export type LotKind = 'question' | 'vault' | 'jackpot' | 'crowd' | 'practice';
export type LotStatus = 'pending' | 'auction' | 'settlement' | 'sold' | 'unsold' | 'vault' | 'answer' | 'steal' | 'results' | 'done' | 'skipped';
export type VaultKind = 'points' | 'cash' | 'double' | 'trap';

export interface VaultContent { kind: VaultKind; value: number; title: string; text: string }

export interface Score { team: number; pts: number; role: 'owner' | 'other' | 'steal' | 'all' }
export interface LotResult {
  answer: string;             // the correct answer, as text
  explain: string;
  ownerCorrect: boolean | null;
  scores: Score[];
  submitted: number;
  correct: number;
  stealTried: boolean;
}

export interface Lot {
  id: string;
  round: 0 | 1 | 2 | 3 | 4;     // 0 = practice
  seq: number;                 // lot number inside its round (vault number in round 4)
  kind: LotKind;
  mode: 'physical' | 'mobile' | 'free';
  title: string;
  category: string;
  difficulty: string;
  base: number;                // lakhs
  reward: number;              // points
  participation: Participation;
  questionId: string | null;
  vault: VaultContent | null;  // hidden until opened
  status: LotStatus;
  owner: number | null;
  price: number | null;
  soldAt: number | null;
  result: LotResult | null;
  practice: boolean;
}

export interface Window {
  id: string;                  // answer path key; a replay gets a new id
  n: 1 | 2;                    // 2 = steal window
  elig: 'all' | 'owner' | 'others';
  owner: number | null;
  reward: number;
  opened: number;              // server ms
  deadline: number;            // server ms
}

export interface Current {
  lotId: string;
  deadline: number | null;     // auction deadline (server ms)
  high: { team: number; amount: number; at: number } | null;   // mobile auctions only
  verbal: { team: number | null; amount: number | null } | null; // optional, physical
  win: Window | null;
  shownAt: number;             // when this state started (for animations)
}

export interface TeamRec { no: number; members: string[] | null; regAt: number | null; eligible: boolean }

export interface Entry { id: string; at: number; team: number; purse: number; points: number; reason: string; lotId: string | null; practice: boolean }
export interface Audit { at: number; action: string; detail: string }

export interface Config {
  name: string;
  date: string;
  teamNos: number[];
  purse: number;              // lakhs
  inc: number;                // lakhs
  auctionSec: number;
  answerSec: number;          // ≤ 10
  share: number;              // open: other correct teams get this share of the reward (0.2)
  stealShare: number;         // steal reward share (0.5)
  conv: number;               // final points per ₹1 Cr left in the purse
  board: 'always' | 'between' | 'hidden';
  sound: boolean;
  auto: boolean;              // reveal the challenge automatically after the SOLD animation
  practicePurse: number;
  schedule: number[];         // minutes: registration, practice, r1, r2, r3, r4, results
  crowdReward: number;
  jackpotReward: number;
  vaultPool: VaultContent[];
  regCode: string;            // optional code teams must type to register ('' = none)
}

export type Stage = 'registration' | 'practice' | 'live' | 'final';

export interface HostState {
  v: 1;
  code: string;
  rev: number;
  savedAt: number;
  cfg: Config;
  stage: Stage;
  regOpen: boolean;
  clockStart: number | null;   // event timer 00:00 (server ms)
  liveStart: number | null;
  overtime: boolean;
  teams: Record<string, TeamRec>;
  bank: Question[];
  lots: Lot[];
  cur: Current | null;
  ledger: Entry[];
  audit: Audit[];
  finalStep: number;           // 0 hidden … 3 champion
  finalAt: number | null;
}

/** Answer a phone wrote: choice is an option index (mcq/tf) or text (oneword). `at` is the server clock. */
export interface RawAnswer { c: number | string; at: number }
export interface RawBid { a: number; at: number }

// ---------------------------------------------------------------- public (projector + phones)
export interface PubLot {
  id: string; round: number; seq: number; kind: LotKind; mode: Lot['mode']; status: LotStatus;
  label: string; title: string; category: string; difficulty: string; base: number;
  reward: number | null;       // null = mystery
  participation: Participation | 'all';
  owner: number | null; price: number | null;
  deadline: number | null; minBid: number | null;
  high: { team: number; amount: number } | null;
  verbal: { team: number | null; amount: number | null } | null;
  vault: VaultContent | null;  // only after the vault is opened
  practice: boolean;
  shownAt: number;
}
export interface PubQuestion {
  lotId: string; win: string; n: 1 | 2; elig: Window['elig']; owner: number | null; reward: number;
  deadline: number; opened: number;
  title: string; category: string; prompt: string; code: string; image: string;
  type: Question['type']; options: string[];
  submitted: number;
}
export interface PubRow { team: number; points: number; purse: number; rank: number }
export interface PubFinal { step: number; rows: (PubRow & { final: number; cashPts: number; members: string[] })[] }

export interface Pub {
  v: 1;
  name: string; date: string;
  stage: Stage; regOpen: boolean; needCode: boolean;
  allowed: number[]; registered: number[];
  clockStart: number | null; liveStart: number | null;
  schedule: number[];
  round: number; roundName: string;
  cfg: { purse: number; inc: number; answerSec: number; auctionSec: number; share: number; stealShare: number; conv: number; sound: boolean };
  lot: PubLot | null;
  q: PubQuestion | null;
  res: (LotResult & { lotId: string }) | null;
  board: PubRow[] | null;
  history: { label: string; title: string; team: number | null; price: number | null; status: LotStatus }[];
  final: PubFinal | null;
  practice: boolean;
  at: number;
}

export interface Priv {
  no: number;
  members: string[];
  purse: number; points: number; practice: boolean;
  buys: { label: string; title: string; price: number; pts: number }[];
  last: { lotId: string; pts: number; correct: boolean | null } | null;
}

// Firebase drops nulls and empty arrays, so data read back is put back into shape here.
const n = <T,>(v: T | undefined | null): T | null => (v === undefined ? null : v);
const a = <T,>(v: T[] | Record<string, T> | undefined | null): T[] => (Array.isArray(v) ? v : v ? Object.values(v) : []);

export function normPub(p: Pub | null): Pub | null {
  if (!p) return null;
  const lot = p.lot ? {
    ...p.lot, reward: n(p.lot.reward), owner: n(p.lot.owner), price: n(p.lot.price), deadline: n(p.lot.deadline), minBid: n(p.lot.minBid),
    high: n(p.lot.high), verbal: p.lot.verbal ? { team: n(p.lot.verbal.team), amount: n(p.lot.verbal.amount) } : null, vault: n(p.lot.vault),
    category: p.lot.category ?? '', difficulty: p.lot.difficulty ?? '', practice: !!p.lot.practice,
  } : null;
  const q = p.q ? { ...p.q, owner: n(p.q.owner), options: a(p.q.options), code: p.q.code ?? '', image: p.q.image ?? '', category: p.q.category ?? '' } : null;
  const res = p.res ? { ...p.res, ownerCorrect: n(p.res.ownerCorrect), scores: a(p.res.scores), explain: p.res.explain ?? '', stealTried: !!p.res.stealTried } : null;
  return {
    ...p, name: p.name ?? '', date: p.date ?? '',
    allowed: a(p.allowed), registered: a(p.registered), schedule: a(p.schedule),
    clockStart: n(p.clockStart), liveStart: n(p.liveStart), lot, q, res,
    board: p.board ? a(p.board) : null,
    history: a(p.history).map((h) => ({ ...h, team: n(h.team), price: n(h.price) })),
    final: p.final ? { step: p.final.step ?? 0, rows: a(p.final.rows).map((r) => ({ ...r, members: a(r.members) })) } : null,
    practice: !!p.practice, regOpen: !!p.regOpen, needCode: !!p.needCode,
  };
}

export function normPriv(p: Priv | null): Priv | null {
  if (!p) return null;
  return { ...p, members: a(p.members), buys: a(p.buys), practice: !!p.practice, last: p.last ? { ...p.last, correct: n(p.last.correct) } : null };
}
