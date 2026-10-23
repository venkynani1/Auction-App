import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { initPhotos } from './lib/photos';
import { unlockAudio } from './lib/sound';
import { Wordmark } from './components/Brand';
import { ConfettiLayer } from './components/Confetti';
import { Btn, ConfirmHost, cx, ToastHost, toast } from './components/ui';
import { Console } from './views/Console';
import { Projector } from './views/Projector';
import { TeamsView } from './views/Teams';
import { PlayersView } from './views/Players';
import { SetupView } from './views/Setup';
import { parseRoomHash, RoomApp } from './views/Room';
import { useRoomPublisher } from './lib/useRoomPublisher';
import { useTeamBids } from './lib/useBids';

type Route = 'console' | 'projector' | 'show' | 'teams' | 'players' | 'setup';
const ROUTES: Route[] = ['console', 'projector', 'show', 'teams', 'players', 'setup'];
const NAV: [Route, string][] = [['console', 'Console'], ['projector', 'Projector'], ['teams', 'Teams & scores'], ['players', 'Players & photos'], ['setup', 'Setup']];
const read = (): Route => { const h = location.hash.slice(1) as Route; return ROUTES.includes(h) ? h : 'console'; };

function Shell() {
  const { state, undo, canUndo } = useStore();
  const [route, setRoute] = useState<Route>(read);
  const [muted, setMuted] = useState(() => { try { return sessionStorage.getItem('bw-mute') === '1'; } catch { return false; } });
  useEffect(() => { const on = () => { setRoute(read()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  useEffect(() => { try { sessionStorage.setItem('bw-mute', muted ? '1' : '0'); } catch { /* ignore */ } }, [muted]);
  useEffect(() => { void initPhotos(); }, []);
  const { bids: teamBids } = useTeamBids(state);
  const roomLink = useRoomPublisher(state, true, new Set(teamBids.map((b) => b.no)));
  useEffect(() => {
    if (route !== 'show') return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') location.hash = 'projector'; };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [route]);

  const goFull = () => {
    location.hash = 'show';
    try { void document.documentElement.requestFullscreen?.().catch(() => {}); } catch { /* not allowed here */ }
  };

  return (
    <div className="min-h-full bg-ink" onClick={unlockAudio}>
      <ConfettiLayer />
      {route !== 'show' && (
        <header className="sticky z-50 border-b border-line bg-ink/90 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
          <div className="mx-auto flex min-h-14 max-w-[1680px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
            <a href="#console" aria-label="Home"><Wordmark name={state.settings.eventName} size="sm" /></a>
            <nav className="order-3 -mx-1 flex w-full gap-0.5 overflow-x-auto scroll-thin lg:order-none lg:w-auto lg:flex-1">
              {NAV.map(([r, l]) => (
                <a key={r} href={`#${r}`} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition', route === r ? 'bg-panel-2 text-gold-2' : 'text-muted hover:text-fg')}>{l}</a>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1.5">
              <Btn size="sm" variant="ghost" disabled={!canUndo} onClick={() => { undo(); toast('Last action undone.', 'ok'); }} title="Undo (Ctrl+Z)">↶ Undo</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</Btn>
              {route === 'projector' && <Btn size="sm" variant="gold" onClick={goFull}>Full screen</Btn>}
            </div>
          </div>
        </header>
      )}
      {route === 'console' && <Console muted={muted} />}
      {(route === 'projector' || route === 'show') && <Projector fullscreen={route === 'show'} />}
      {route === 'teams' && <TeamsView />}
      {route === 'players' && <PlayersView />}
      {route === 'setup' && <SetupView roomLink={roomLink} />}
      {route === 'show' && (
        <button className="fixed right-3 top-3 z-[75] rounded-lg bg-panel/70 px-3 py-1.5 text-xs text-muted opacity-0 transition hover:opacity-100 focus:opacity-100" onClick={() => { try { void document.exitFullscreen?.(); } catch { /* */ } location.hash = 'projector'; }}>Exit full screen (Esc)</button>
      )}
      <ConfirmHost />
      <ToastHost />
    </div>
  );
}

export function App() {
  // Phones that scanned the room QR get the participant view only, never the host's game.
  const [room, setRoom] = useState(() => parseRoomHash(location.hash));
  useEffect(() => { const on = () => setRoom(parseRoomHash(location.hash)); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  if (room) return <RoomApp code={room.code} team={room.team} />;
  return <StoreProvider><Shell /></StoreProvider>;
}
