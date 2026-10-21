import { useEffect, useRef, useState } from 'react';
import type { State } from '../store';
import { buildStatus, buildTeams, claimRoom, forgetPublished, publish, roomsConfigured } from './rooms';

export type PublishState = 'off' | 'connecting' | 'live' | 'taken' | 'error';

/** Host side: mirrors the game to Firebase whenever it changes (debounced). */
export function useRoomPublisher(state: State, enabled: boolean): PublishState {
  const [st, setSt] = useState<PublishState>('off');
  const claimed = useRef<string | null>(null);
  const everOpen = useRef(false);
  const teamCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    if (!roomsConfigured || !enabled) return;
    if (state.rooms.open) everOpen.current = true;
    if (!state.rooms.open && !everOpen.current) { setSt('off'); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const s = latest.current;
      const code = s.rooms.code;
      try {
        if (claimed.current !== code) {
          setSt('connecting');
          forgetPublished();
          if (!(await claimRoom(code))) { setSt('taken'); return; }
          claimed.current = code;
        }
        const prevCount = teamCount.current;
        teamCount.current = s.teams.length;
        const removed = prevCount > s.teams.length ? Array.from({ length: prevCount - s.teams.length }, (_, i) => String(s.teams.length + i + 1)) : [];
        await publish(code, buildStatus(s), buildTeams(s), removed);
        setSt(s.rooms.open ? 'live' : 'off');
      } catch (e) {
        console.error('Room publish failed', e);
        claimed.current = null;
        setSt('error');
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state, enabled]);

  return roomsConfigured ? st : 'off';
}
