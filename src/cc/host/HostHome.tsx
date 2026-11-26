import { useState } from 'react';
import { ccConfigured } from '../fb';
import { createEvent, forgetEvent, myEvents } from './store';
import { deleteEvent } from '../fb';
import { Btn, confirmDialog, Field, toast } from '../../components/ui';

export function HostHome() {
  const [name, setName] = useState('BID WARS 2.0: Code & Chaos');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [teams, setTeams] = useState('20');
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(myEvents);

  const create = async () => {
    const n = Number(teams);
    if (!Number.isInteger(n) || n < 2 || n > 80) return toast('Choose 2 to 80 teams.', 'warn');
    setBusy(true);
    try {
      const code = await createEvent(name, date, n);
      location.hash = `cc/host/${code}`;
    } catch (e) {
      console.error(e);
      toast(String((e as Error).message || 'Could not create the event. Check the Firebase setup.'), 'warn');
    } finally { setBusy(false); }
  };

  return (
    <div className="stage-bg min-h-screen">
      <div className="circuit pointer-events-none fixed inset-0 opacity-50" />
      <main className="relative mx-auto max-w-3xl px-4 py-10">
        <a href="#" className="label hover:text-fg">← All games</a>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(40px,7vw,72px)] font-bold uppercase leading-[.9]"><span className="cyan-text">Code</span> <span className="text-gold">&amp;</span> <span className="cyan-text">Chaos</span></h1>
        <p className="mt-2 text-lg text-muted">Bid smart. Think fast. Rule the arena. Host dashboard.</p>

        {!ccConfigured ? (
          <div className="panel mt-8 p-6">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">Firebase isn't connected yet</h2>
            <p className="mt-2 text-muted">Code &amp; Chaos uses the same Firebase project as Classic's team rooms. Follow "Firebase setup" in the README, paste the updated <code>database.rules.json</code>, then redeploy.</p>
          </div>
        ) : (
          <>
            <section className="panel mt-8 p-6">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase">New event</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto]">
                <Field label="Event name"><input id="ev-name" className="field" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Date"><input id="ev-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                <Field label="Teams"><input id="ev-teams" type="number" min={2} max={80} className="field !w-24 num" value={teams} onChange={(e) => setTeams(e.target.value)} /></Field>
              </div>
              <p className="mt-3 text-sm text-dim">Defaults: 4 players and one phone per team, ₹10 Cr purse, one continuous auction with 136 medium and hard questions. You finish whenever you like. You can change everything before the event starts.</p>
              <Btn variant="primary" size="lg" className="mt-5" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create event'}</Btn>
            </section>

            <section className="panel mt-6 p-6">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase">Your events</h2>
              <p className="text-sm text-dim">Events this browser hosts. An event can only be run from the computer that created it.</p>
              <div className="mt-4 flex flex-col gap-2">
                {list.length === 0 && <p className="text-muted">None yet.</p>}
                {list.map((e) => (
                  <div key={e.code} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel-2/60 p-3">
                    <span className="rounded-lg bg-info/15 px-2.5 py-1 font-[family-name:var(--font-display)] text-lg font-bold tracking-widest text-info">{e.code}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{e.name}</span>
                    <span className="text-xs text-dim">{new Date(e.at).toLocaleDateString()}</span>
                    <Btn size="sm" variant="primary" onClick={() => (location.hash = `cc/host/${e.code}`)}>Open</Btn>
                    <Btn size="sm" variant="ghost" className="hover:!text-live" onClick={async () => {
                      if (!(await confirmDialog(`Delete event ${e.code}?`, 'The event is deleted for everyone: teams, scores, questions and history. Team phones and the projector will show "no event". This cannot be undone.', 'Delete event'))) return;
                      const r = ccConfigured ? await deleteEvent(e.code) : 'denied';
                      if (r === 'offline') return toast('Could not reach Firebase. Nothing was deleted.', 'warn');
                      forgetEvent(e.code); setList(myEvents());
                      toast(r === 'ok' ? `Event ${e.code} deleted.` : `Removed from this list. Only the main device of ${e.code} can delete it from Firebase.`, r === 'ok' ? 'ok' : 'info');
                    }}>Delete</Btn>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
