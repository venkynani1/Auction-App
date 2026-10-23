import type { BidMode } from '../store';

/** One team's bid as stored in Firebase: events/<CODE>/bids/<windowId>/<teamNo>. `at` is the server's clock. */
export interface RawBid { amount: number; at: number; name?: string }
export interface Bid { no: number; name: string; amount: number; at: number }
export interface RankedBid extends Bid { place: number; clash: boolean; winner: boolean }

export const MODE_LABEL: Record<BidMode, string> = { unique: 'Unique bid', highest: 'Highest bid', lowest: 'Lowest bid' };
export const MODE_RULE: Record<BidMode, string> = {
  unique: 'Highest amount that no other team bid. Ties go to the fastest bid.',
  highest: 'Biggest amount wins. Equal amounts: the fastest bid wins.',
  lowest: 'Smallest amount wins. Equal amounts: the fastest bid wins.',
};

export function toBids(raw: Record<string, RawBid> | null | undefined, teamName: (no: number) => string): Bid[] {
  return Object.entries(raw ?? {})
    .filter(([, b]) => b && typeof b.amount === 'number' && typeof b.at === 'number')
    .map(([no, b]) => ({ no: Number(no), name: teamName(Number(no)) || b.name || `Team ${no}`, amount: b.amount, at: b.at }));
}

const key = (n: number) => Math.round(n * 100); // compare money in lakhs, avoids 0.1 + 0.2 issues

/**
 * Orders bids for the projector; the first entry is the winner.
 * - highest / lowest: by amount, then by who bid first.
 * - unique: amounts only one team bid come first (highest first), then the clashing amounts.
 *   If every amount clashes, the fastest of the highest amount wins.
 */
export function rankBids(bids: Bid[], mode: BidMode): RankedBid[] {
  const count = new Map<number, number>();
  for (const b of bids) count.set(key(b.amount), (count.get(key(b.amount)) ?? 0) + 1);
  const clash = (b: Bid) => (count.get(key(b.amount)) ?? 0) > 1;
  const byAmount = (dir: 1 | -1) => (a: Bid, b: Bid) => dir * (key(a.amount) - key(b.amount)) || a.at - b.at || a.no - b.no;
  let sorted: Bid[];
  if (mode === 'lowest') sorted = bids.slice().sort(byAmount(1));
  else if (mode === 'highest') sorted = bids.slice().sort(byAmount(-1));
  else {
    const desc = byAmount(-1);
    sorted = bids.slice().sort((a, b) => Number(clash(a)) - Number(clash(b)) || desc(a, b));
  }
  return sorted.map((b, i) => ({ ...b, place: i + 1, clash: clash(b), winner: i === 0 }));
}

/** "+0.84 s" after the first bid. */
export function lag(at: number, first: number) {
  const s = (at - first) / 1000;
  return s < 0.005 ? 'first' : `+${s < 10 ? s.toFixed(2) : s.toFixed(1)} s`;
}
