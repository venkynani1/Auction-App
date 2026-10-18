import { useState } from 'react';
import { ROUNDS, standings, teamRows, useStore, type TeamRow } from '../store';
import { money } from '../lib/util';
import { Btn, cx, Field, Modal, TeamDot, toast } from '../components/ui';
import { Podium, Thumb } from '../components/bits';

export function TeamsView() {
  const { state, dispatch } = useStore();
  const rows = teamRows(state);
  const [sort, setSort] = useState<'order' | 'rank'>('rank');
  const [open, setOpen] = useState<TeamRow | null>(null);
  const [adj, setAdj] = useState<TeamRow | null>(null);
  const list = sort === 'rank' ? standings(state) : rows;
  const openRow = open ? rows.find((r) => r.team.id === open.team.id) ?? null : null;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-black uppercase">Teams & scores</h1>
          <p className="text-muted">Starting purse {money(state.settings.startPurse)} · {state.settings.ptsPerCr} point per full ₹1 Cr left · everything updates after each sale</p>
        </div>
        <div className="flex gap-2">
          <Btn size="sm" variant={sort === 'rank' ? 'gold' : 'subtle'} onClick={() => setSort('rank')}>By rank</Btn>
          <Btn size="sm" variant={sort === 'order' ? 'gold' : 'subtle'} onClick={() => setSort('order')}>Team order</Btn>
        </div>
      </div>

      <div className="panel mt-4 h-[360px] p-4"><Podium state={state} /></div>

      <div className="panel mt-4 overflow-x-auto scroll-thin">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="label border-b border-line text-left">
              <th className="p-3">#</th><th className="p-3">Team name</th><th className="p-3 text-right">Purse</th><th className="p-3 text-right">Spent</th>
              <th className="p-3 text-right">Remaining purse</th><th className="p-3 text-right">Player pts</th><th className="p-3 text-right">Bonus pts</th>
              <th className="p-3 text-right">Points</th><th className="p-3 text-right">Purse pts</th><th className="p-3 text-right text-gold-2">Final points</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.team.id} className={cx('border-b border-line/60', r.rank <= 3 && 'bg-gold/5')}>
                <td className={cx('p-3 font-[family-name:var(--font-display)] text-lg font-black num', r.rank <= 3 ? 'text-gold-2' : 'text-muted')}>{r.rank}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2"><TeamDot color={r.team.color} />
                    <input aria-label="Team name" className="w-full min-w-[160px] rounded-md bg-transparent px-1 py-0.5 font-semibold hover:bg-panel-2 focus:bg-panel-2 focus:outline-none" value={r.team.name} onChange={(e) => dispatch({ type: 'TEAM_RENAME', id: r.team.id, name: e.target.value })} />
                  </div>
                </td>
                <td className="p-3 text-right num">{money(state.settings.startPurse + r.bonusCash)}</td>
                <td className="p-3 text-right num">{money(r.spent)}</td>
                <td className={cx('p-3 text-right font-bold num', r.remaining < 0 && 'text-live')}>{money(r.remaining)}</td>
                <td className="p-3 text-right num">{r.itemPts}</td>
                <td className="p-3 text-right num">{r.bonusPts}</td>
                <td className="p-3 text-right font-bold num">{r.points}</td>
                <td className="p-3 text-right num">{r.pursePts}</td>
                <td className="p-3 text-right font-[family-name:var(--font-display)] text-xl font-black text-gold-2 num">{r.final}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Btn size="xs" variant="outline" onClick={() => setAdj(r)}>± Points / cash</Btn>
                    <Btn size="xs" variant="ghost" onClick={() => setOpen(r)}>{r.items.length} players</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-dim">Final points = player points + bonus points + purse points (1 per full ₹1 Cr left; ₹2.5 Cr left = 2 points).</p>

      <AdjustModal row={adj} onClose={() => setAdj(null)} />
      <Modal open={!!openRow} onClose={() => setOpen(null)} title={openRow?.team.name ?? ''} wide>
        {openRow && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[['Remaining', money(openRow.remaining)], ['Spent', money(openRow.spent)], ['Points', String(openRow.points)], ['Final', String(openRow.final)]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-panel-2 p-3"><div className="label">{k}</div><div className="font-[family-name:var(--font-display)] text-2xl font-black num">{v}</div></div>
              ))}
            </div>
            <div>
              <h3 className="label mb-2">Players bought</h3>
              {openRow.items.length === 0 && <p className="text-sm text-muted">None yet.</p>}
              <div className="flex flex-col gap-1.5">
                {openRow.items.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 rounded-lg bg-panel-2/60 px-3 py-2 text-sm">
                    <Thumb item={i} size={28} />
                    <span className="min-w-0 flex-1"><b>{i.name}</b> <span className="text-muted">· {ROUNDS[i.round].short}{i.slip ? ` · ${i.slipNote}` : ''}</span></span>
                    <span className="num">{money(i.price ?? 0)}</span>
                    <span className="w-14 text-right font-bold num">{i.points ?? 0} pts</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="label mb-2">Bonuses & adjustments</h3>
              {state.adjs.filter((a) => a.teamId === openRow.team.id).length === 0 && <p className="text-sm text-muted">None.</p>}
              {state.adjs.filter((a) => a.teamId === openRow.team.id).map((a) => (
                <div key={a.id} className="flex items-center gap-3 border-b border-line/60 py-1.5 text-sm">
                  <span className="flex-1">{a.label}</span>
                  {a.pts !== 0 && <b className={cx('num', a.pts < 0 ? 'text-live' : 'text-ok')}>{a.pts > 0 ? '+' : ''}{a.pts} pts</b>}
                  {a.cash !== 0 && <b className={cx('num', a.cash < 0 ? 'text-live' : 'text-ok')}>{a.cash > 0 ? '+' : '−'}{money(Math.abs(a.cash))}</b>}
                  <Btn size="xs" variant="ghost" onClick={() => dispatch({ type: 'ADJ_DEL', id: a.id })}>Remove</Btn>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AdjustModal({ row, onClose }: { row: TeamRow | null; onClose: () => void }) {
  const { dispatch } = useStore();
  const [pts, setPts] = useState('');
  const [cash, setCash] = useState('');
  const [label, setLabel] = useState('');
  const go = (sign: 1 | -1) => {
    const p = Number(pts || 0), c = Number(cash || 0);
    if (!p && !c) return toast('Type points or cash first.', 'warn');
    dispatch({ type: 'ADJ_ADD', teamId: row!.team.id, pts: sign * p, cash: sign * c, label: label || (sign > 0 ? 'Bonus' : 'Penalty') });
    toast(`${sign > 0 ? 'Added to' : 'Taken from'} ${row!.team.name}.`, 'ok');
    setPts(''); setCash(''); setLabel(''); onClose();
  };
  return (
    <Modal open={!!row} onClose={onClose} title={`Adjust ${row?.team.name ?? ''}`}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Points"><input id="adj-pts" className="field num" type="number" step="1" min="0" value={pts} onChange={(e) => setPts(e.target.value)} autoFocus /></Field>
          <Field label="Cash (₹ Cr)"><input id="adj-cash" className="field num" type="number" step="0.25" min="0" value={cash} onChange={(e) => setCash(e.target.value)} /></Field>
        </div>
        <Field label="Reason (shows in the activity log)"><input id="adj-label" className="field" placeholder="Best chant, special challenge…" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="ok" size="lg" onClick={() => go(1)}>＋ Add</Btn>
          <Btn variant="danger" size="lg" onClick={() => go(-1)}>− Take away</Btn>
        </div>
      </div>
    </Modal>
  );
}
