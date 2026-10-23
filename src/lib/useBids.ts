import { useEffect, useState } from 'react';
import { roomsConfigured, subscribeAsHost } from './rooms';
import { toBids, type Bid, type RawBid } from './bids';
import type { State } from '../store';

/** Live list of team bids for the current bidding window (host console and projector). */
export function useTeamBids(state: State): { bids: Bid[]; error: boolean } {
  const code = state.rooms.code;
  const win = state.bids?.id ?? null;
  const [raw, setRaw] = useState<Record<string, RawBid> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setRaw(null); setError(false);
    if (!roomsConfigured || !win) return;
    let off = () => {};
    let alive = true;
    subscribeAsHost<Record<string, RawBid>>(`events/${code}/bids/${win}`, (v) => alive && setRaw(v), () => alive && setError(true))
      .then((u) => { if (alive) off = u; else u(); }).catch(() => alive && setError(true));
    return () => { alive = false; off(); };
  }, [code, win]);
  const names = state.teams;
  return { bids: toBids(raw, (no) => names[no - 1]?.name ?? ''), error };
}
