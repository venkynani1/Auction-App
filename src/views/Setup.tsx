import { useState } from 'react';
import { freshState, parseBackup, ROUNDS, standings, useStore } from '../store';
import { copyText, saveFile } from '../lib/util';
import { toCSV } from '../lib/csv';
import { allPhotos, clearPhotos, setPhoto } from '../lib/photos';
import { Btn, confirmDialog, Field, Label, toast } from '../components/ui';

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-black uppercase">{title}</h2>
      {desc && <p className="mt-1 max-w-3xl text-sm text-muted">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function SetupView() {
  const { state, dispatch, saved } = useStore();
  const s = state.settings;
  const [names, setNames] = useState('');
  const [backup, setBackup] = useState('');
  const used = new Set([...state.items.map((i) => i.teamId), ...state.adjs.map((a) => a.teamId)]);
  const minTeams = Math.max(2, ...state.teams.map((t, i) => (used.has(t.id) ? i + 1 : 0)));

  const exportResults = async () => {
    const rows = standings(state);
    const csv = '﻿' + toCSV([
      ['Rank', 'Team', 'Final points', 'Points', 'Player points', 'Bonus points', 'Purse points', 'Remaining purse (Cr)', 'Spent (Cr)', 'Players'],
      ...rows.map((r) => [r.rank, r.team.name, r.final, r.points, r.itemPts, r.bonusPts, r.pursePts, r.remaining, r.spent, r.items.map((i) => i.name).join('; ')]),
      [],
      ['Round', 'Lot', 'Player', 'Status', 'Team', 'Price (Cr)', 'Points', 'Slip'],
      ...state.items.filter((i) => i.status !== 'available').map((i) => [ROUNDS[i.round].name, i.lot, i.name, i.status, state.teams.find((t) => t.id === i.teamId)?.name ?? '', i.price ?? '', i.points ?? '', i.slipNote ?? '']),
      [],
      ['Adjustments'], ['Team', 'Reason', 'Points', 'Cash (Cr)'],
      ...state.adjs.map((a) => [state.teams.find((t) => t.id === a.teamId)?.name, a.label, a.pts, a.cash]),
    ]);
    const r = await saveFile('bid-wars-results.csv', csv, 'text/csv');
    if (r === 'failed') { await copyText(csv); toast('Download blocked here; results copied to the clipboard instead.', 'warn'); }
  };

  const saveBackup = async (withPhotos: boolean) => {
    const data = JSON.stringify({ app: 'bidwars-live', savedAt: new Date().toISOString(), state, photos: withPhotos ? allPhotos() : undefined });
    const r = await saveFile(`bid-wars-backup${withPhotos ? '-with-photos' : ''}.json`, data, 'application/json');
    if (r === 'failed') toast('Download blocked here. Try the hosted version of the app.', 'warn');
  };

  const loadBackup = async (text: string) => {
    const st = parseBackup(text);
    if (!st) return toast('That is not a BID WARS backup file.', 'warn');
    if (!(await confirmDialog('Load this backup?', 'The current game is replaced by the backup.', 'Load backup'))) return;
    dispatch({ type: 'LOAD', state: st });
    try {
      const photos = JSON.parse(text).photos as Record<string, string> | undefined;
      if (photos) for (const [id, url] of Object.entries(photos)) await setPhoto(id, url);
    } catch { /* ignore */ }
    toast('Backup loaded.', 'ok');
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-black uppercase">Setup</h1>
        <p className="text-muted">Everything saves automatically in this browser. {saved ? <span className="text-ok">Saved.</span> : <span className="text-warn">Saving is blocked here: keep a backup file.</span>}</p>
      </div>

      <Section title="How to run the night" desc="One laptop, two windows.">
        <ol className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            'Set the purse and team names below.',
            'Add photos on the Players page (you can select the whole photos folder at once).',
            'Open this app in a second window, drag it to the projector screen, click “Projector” and then “Full screen”.',
            'Run the auction from “Console” in the first window. The projector follows every click.',
            'Use “Projector shows → Leaderboard” between rounds, and “Final results” at the end.',
            'Export the results at the end, and save a backup now and then.',
          ].map((t, i) => <li key={i} className="flex gap-3 rounded-xl bg-panel-2/60 p-3"><b className="text-gold-2">{i + 1}</b><span>{t}</span></li>)}
        </ol>
      </Section>

      <Section title="Event and purse">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Event name"><input id="set-name" className="field" value={s.eventName} onChange={(e) => dispatch({ type: 'SETTINGS', patch: { eventName: e.target.value } })} /></Field>
          <Field label="Starting purse per team (₹ Cr)" hint="Most expensive player is ₹8 Cr. A big purse makes leftover cash worth a lot of points."><input id="set-purse" className="field num" type="number" min="1" step="1" value={s.startPurse} onChange={(e) => Number(e.target.value) > 0 && dispatch({ type: 'SETTINGS', patch: { startPurse: Number(e.target.value) } })} /></Field>
          <Field label="Points per full ₹1 Cr left"><input id="set-ppc" className="field num" type="number" min="0" step="0.5" value={s.ptsPerCr} onChange={(e) => dispatch({ type: 'SETTINGS', patch: { ptsPerCr: Number(e.target.value) } })} /></Field>
        </div>
      </Section>

      <Section title="Teams" desc="Rename teams here or on the Teams page.">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Number of teams">
            <input id="set-teams" className="field !w-28 num" type="number" min={minTeams} max={40} value={state.teams.length} onChange={(e) => { const n = Number(e.target.value); if (n >= minTeams) dispatch({ type: 'TEAMS_COUNT', n }); }} />
          </Field>
          {[20, 22, 25].map((n) => <Btn key={n} size="sm" variant={state.teams.length === n ? 'gold' : 'subtle'} disabled={n < minTeams} onClick={() => dispatch({ type: 'TEAMS_COUNT', n })}>{n} teams</Btn>)}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div>
            <Label className="mb-2">Paste team names (one per line)</Label>
            <textarea id="set-names" className="field min-h-[160px]" placeholder={'Chennai Mavericks\nMumbai Titans\n…'} value={names} onChange={(e) => setNames(e.target.value)} />
            <Btn className="mt-2" variant="gold" disabled={!names.trim()} onClick={() => { dispatch({ type: 'TEAM_NAMES', names: names.split('\n') }); setNames(''); toast('Team names updated.', 'ok'); }}>Use these names</Btn>
          </div>
          <div className="max-h-[230px] overflow-auto rounded-xl bg-panel-2/40 p-3 text-sm scroll-thin">
            {state.teams.map((t, i) => <div key={t.id} className="flex gap-2 py-0.5"><span className="w-6 text-dim num">{i + 1}</span><span style={{ color: t.color }}>●</span>{t.name}</div>)}
          </div>
        </div>
      </Section>

      <Section title="Save, export, reset">
        <div className="flex flex-wrap gap-2">
          <Btn variant="gold" onClick={exportResults}>⬇ Export results (Excel CSV)</Btn>
          <Btn variant="outline" onClick={() => saveBackup(false)}>⬇ Save backup</Btn>
          <Btn variant="outline" onClick={() => saveBackup(true)}>⬇ Save backup with photos</Btn>
          <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-line-2 px-4 text-[15px] hover:border-gold">
            ⬆ Load backup file
            <input id="load-backup" type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const r = new FileReader(); r.onload = () => loadBackup(String(r.result)); r.readAsText(f); } }} />
          </label>
        </div>
        <textarea id="paste-backup" className="field mt-3 min-h-[70px] font-mono text-xs" placeholder="…or paste a backup here" value={backup} onChange={(e) => setBackup(e.target.value)} />
        <Btn size="sm" variant="subtle" className="mt-2" disabled={!backup.trim()} onClick={() => loadBackup(backup)}>Load pasted backup</Btn>

        <div className="mt-6 grid gap-3 rounded-2xl border border-live/30 bg-live/5 p-4 sm:grid-cols-2">
          <div>
            <Label className="mb-2 !text-live">Start the auction again</Label>
            <Btn variant="danger" className="w-full" onClick={async () => { if (await confirmDialog('Clear all sales?', 'Every sale, bonus and score is cleared. Teams, players and photos stay.', 'Clear sales')) dispatch({ type: 'RESET_SALES' }); }}>Clear sales (keep setup)</Btn>
          </div>
          <div>
            <Label className="mb-2 !text-live">Factory reset</Label>
            <Btn variant="danger" className="w-full" onClick={async () => { if (await confirmDialog('Reset everything?', 'Teams, players, photos and results go back to the original list. This cannot be undone.', 'Reset everything')) { dispatch({ type: 'LOAD', state: freshState() }); await clearPhotos(); } }}>Reset everything</Btn>
          </div>
        </div>
      </Section>
    </div>
  );
}
