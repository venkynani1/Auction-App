import { useMemo, useRef, useState } from 'react';
import * as E from '../engine';
import type { Config, Group, HostState, Lot, Participation, Question } from '../types';
import { GROUPS } from '../types';
import { deleteEvent, hostClearTeam, hostResetPin, serverNow } from '../fb';
import { forgetEvent, useHost } from './store';
import { CodeBlock, Partic, TeamBadge } from '../ui';
import { Btn, confirmDialog, cx, Field, Label, Modal, toast } from '../../components/ui';
import { saveFile } from '../../lib/util';
import { parseCSV, toCSV } from '../../lib/csv';

// =====================================================================================================
export function TeamsTab() {
  const { s, act, online } = useHost();
  const [edit, setEdit] = useState<number | null>(null);
  const [names, setNames] = useState(['', '', '', '']);
  const [pinFor, setPinFor] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [nos, setNos] = useState(() => rangeText(s.cfg.teamNos));
  const locked = s.stage !== 'registration';
  const rows = Object.values(s.teams).sort((a, b) => a.no - b.no);

  const saveNos = () => {
    const list = parseRanges(nos);
    if (!list) return toast('Use numbers and ranges, e.g. 1-20, 25, 30.', 'warn');
    if (list.length < 2 || list.length > 80) return toast('Use 2 to 80 teams.', 'warn');
    act((x) => E.configure(x, { teamNos: list }), 'Team numbers saved.');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="panel flex flex-wrap items-end gap-4 p-5">
        <Field label="Team numbers that may register" hint={locked ? 'Locked once the event starts.' : 'Numbers and ranges, e.g. 1-20 or 1-10, 12, 15'}>
          <div className="flex gap-2"><input id="team-nos" className="field !w-64" disabled={locked} value={nos} onChange={(e) => setNos(e.target.value)} /><Btn variant="subtle" disabled={locked} onClick={saveNos}>Save</Btn></div>
        </Field>
        <Field label="Registration code (optional)" hint="If set, teams must type it to register.">
          <input id="reg-code" className="field !w-48" maxLength={20} value={s.cfg.regCode} onChange={(e) => act((x) => E.configure(x, { regCode: e.target.value.trim() }))} />
        </Field>
        <Btn variant={s.regOpen ? 'subtle' : 'primary'} onClick={() => act((x) => E.setRegOpen(x, !x.regOpen))}>{s.regOpen ? 'Close registration' : 'Open registration'}</Btn>
        <div className="ml-auto text-sm text-muted">{E.registeredTeams(s).length} registered · {online.size} online</div>
      </div>

      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[860px] text-sm">
          <thead><tr className="label border-b border-line text-left"><th className="p-3">Team</th><th className="p-3">Status</th><th className="p-3">Members</th><th className="p-3 text-right">Purse</th><th className="p-3 text-right">Points</th><th className="p-3" /></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.no} className={cx('border-b border-line/50', !t.eligible && 'opacity-50')}>
                <td className="p-3"><TeamBadge no={t.no} /></td>
                <td className="p-3">
                  {t.members ? <span className="inline-flex items-center gap-1.5"><span className={cx('h-2 w-2 rounded-full', online.has(t.no) ? 'bg-ok' : 'bg-line-2')} />{online.has(t.no) ? 'Online' : 'Offline'}</span> : <span className="text-dim">Not registered</span>}
                  {!t.eligible && <span className="ml-2 text-warn">removed</span>}
                </td>
                <td className="p-3">{t.members ? t.members.join(', ') : '—'}</td>
                <td className="p-3 text-right num">{t.members ? E.money(E.purseOf(s, t.no)) : ''}</td>
                <td className="p-3 text-right num">{t.members ? E.pointsOf(s, t.no) : ''}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    {t.members && <Btn size="xs" variant="ghost" onClick={() => { setEdit(t.no); setNames([...t.members!]); }}>Edit names</Btn>}
                    {t.members && <Btn size="xs" variant="ghost" onClick={() => { setPinFor(t.no); setPin(''); }}>Reset PIN</Btn>}
                    {t.members && <Btn size="xs" variant="ghost" className="hover:!text-live" onClick={async () => {
                      if (!(await confirmDialog(`Clear Team ${t.no}'s registration?`, 'Names, PIN and the signed-in phone are removed so the team can register again. Purchases and points are kept.', 'Clear'))) return;
                      try { await hostClearTeam(s.code, t.no); act((x) => E.editTeam(x, t.no, null), `Team ${t.no} can register again.`); } catch { toast('Not done: only the main device can change PINs and registrations (or there is no connection).', 'warn'); }
                    }}>Clear</Btn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={edit !== null} onClose={() => setEdit(null)} title={`Team ${edit} members`}>
        <div className="grid gap-2">{names.map((n, i) => <input key={i} id={`member-${i}`} className="field" value={n} maxLength={40} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Member ${i + 1}`} />)}</div>
        <div className="mt-4 flex justify-end"><Btn variant="primary" onClick={() => { if (act((x) => E.editTeam(x, edit!, names), 'Saved.')) setEdit(null); }}>Save</Btn></div>
      </Modal>
      <Modal open={pinFor !== null} onClose={() => setPinFor(null)} title={`New PIN for Team ${pinFor}`}>
        <p className="text-sm text-muted">The team's phone is signed out. Tell the team the new PIN; they sign back in with their team number and this PIN.</p>
        <input id="new-pin" className="field mt-3 text-center font-[family-name:var(--font-display)] text-3xl tracking-[.4em] num" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setPin(String(Math.floor(1000 + Math.random() * 9000)))}>Random</Btn>
          <Btn variant="primary" disabled={!/^\d{4,6}$/.test(pin)} onClick={async () => {
            try { await hostResetPin(s.code, pinFor!, pin); const no = pinFor!; act((x) => ({ ...x, rev: x.rev + 1, audit: [{ at: Date.now(), action: 'PIN reset', detail: `Team ${no}` }, ...x.audit] }), `Team ${no} PIN is now ${pin}.`); setPinFor(null); } catch { toast('Not done: only the main device can change PINs and registrations (or there is no connection).', 'warn'); }
          }}>Set PIN</Btn>
        </div>
      </Modal>
    </div>
  );
}

const rangeText = (nos: number[]) => {
  const out: string[] = [];
  let i = 0;
  while (i < nos.length) { let j = i; while (j + 1 < nos.length && nos[j + 1] === nos[j]! + 1) j++; out.push(i === j ? `${nos[i]}` : `${nos[i]}-${nos[j]}`); i = j + 1; }
  return out.join(', ');
};
function parseRanges(t: string): number[] | null {
  const out = new Set<number>();
  for (const part of t.split(/[,\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2] ?? m[1]);
    if (b < a || b - a > 200) return null;
    for (let k = a; k <= b; k++) out.add(k);
  }
  return [...out].sort((x, y) => x - y);
}

// =====================================================================================================
export function LotsTab() {
  const { s, act } = useHost();
  const lots = s.lots.filter((l) => !l.practice).slice().reverse();
  return (
    <div className="panel overflow-x-auto scroll-thin">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <h3 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase">Questions played</h3>
        <span className="text-sm text-muted">{lots.length} so far · {E.unusedQuestions(s).length} unused left in the bank</span>
      </div>
      <table className="w-full min-w-[860px] text-sm">
        <thead><tr className="label text-left"><th className="p-2 pl-4">Lot</th><th className="p-2">Question</th><th className="p-2">Level</th><th className="p-2">Status</th><th className="p-2">Bought by</th><th className="p-2 text-right">Price</th><th className="p-2">Points</th></tr></thead>
        <tbody>
          {lots.length === 0 && <tr><td colSpan={7} className="p-4 text-muted">Nothing played yet. Press NEXT QUESTION on Live control.</td></tr>}
          {lots.map((l) => (
            <tr key={l.id} className="border-t border-line/50">
              <td className="p-2 pl-4 font-[family-name:var(--font-display)] font-bold whitespace-nowrap">{E.lotLabel(l)}</td>
              <td className="p-2">{l.title} <span className="text-dim">· {l.category}</span></td>
              <td className="p-2">{l.difficulty}</td>
              <td className="p-2 capitalize">{l.status === 'skipped' ? 'unsold' : l.status}{l.result?.stealTried ? ' · opened to all' : ''}</td>
              <td className="p-2">{l.owner ? `Team ${l.owner}` : '—'}</td>
              <td className="p-2 text-right num">{l.price ? E.money(l.price) : ''}</td>
              <td className="p-2">{(l.result?.scores ?? []).map((x) => `T${x.team} +${x.pts}`).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="hidden">{String(!!act)}</span>
    </div>
  );
}

// =====================================================================================================
const blankQ = (): Question => ({ id: `q${Date.now().toString(36)}`, group: 'tech', category: '', difficulty: 'Easy', title: '', prompt: '', code: '', type: 'mcq', options: ['', '', '', ''], answer: 0, accept: [], explain: '', image: '', active: true });

export function BankTab() {
  const { s, act } = useHost();
  const [q, setQ] = useState('');
  const [g, setG] = useState<'all' | Group>('all');
  const [edit, setEdit] = useState<Question | null>(null);
  const [preview, setPreview] = useState<Question | null>(null);
  const [imp, setImp] = useState(false);
  const used = new Map(s.lots.filter((l) => l.questionId).map((l) => [l.questionId!, l]));
  const list = s.bank.filter((x) => (g === 'all' || x.group === g) && `${x.id} ${x.title} ${x.prompt} ${x.category}`.toLowerCase().includes(q.toLowerCase()));
  const counts = Object.fromEntries(Object.keys(GROUPS).map((k) => [k, s.bank.filter((x) => x.group === k && x.active).length]));

  const exportBank = async (kind: 'json' | 'csv') => {
    const text = kind === 'json' ? JSON.stringify(s.bank, null, 2) : bankToCSV(s.bank);
    if ((await saveFile(`code-and-chaos-questions.${kind}`, text, kind === 'json' ? 'application/json' : 'text/csv')) === 'failed') toast('Download blocked.', 'warn');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="panel flex flex-wrap items-center gap-2 p-4">
        <input id="bank-search" className="field !w-64" placeholder="Search questions" value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="bank-group" className="field !w-auto" value={g} onChange={(e) => setG(e.target.value as typeof g)}>
          <option value="all">All groups ({s.bank.length})</option>
          {Object.entries(GROUPS).map(([k, v]) => <option key={k} value={k}>{v} ({counts[k]})</option>)}
        </select>
        <div className="ml-auto flex flex-wrap gap-2">
          <Btn variant="primary" onClick={() => setEdit(blankQ())}>＋ Add question</Btn>
          <Btn variant="outline" onClick={() => setImp(true)}>Import</Btn>
          <Btn variant="outline" onClick={() => exportBank('json')}>Export JSON</Btn>
          <Btn variant="outline" onClick={() => exportBank('csv')}>Export CSV</Btn>
        </div>
      </div>
      <p className="text-xs text-dim">Answers stay on this laptop and in a host-only part of Firebase. Phones and the projector only receive a question when it's revealed, and the answer only after the window closes. The built-in questions are also in the app's public source code, so edit or replace them if teams might look.</p>
      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="label border-b border-line text-left"><th className="p-2 pl-4">Id</th><th className="p-2">Question</th><th className="p-2">Group</th><th className="p-2">Level</th><th className="p-2">Type</th><th className="p-2">Used by</th><th className="p-2" /></tr></thead>
          <tbody>
            {list.map((x) => {
              const u = used.get(x.id);
              return (
                <tr key={x.id} className={cx('border-b border-line/50', !x.active && 'opacity-50')}>
                  <td className="p-2 pl-4 font-mono text-xs">{x.id}</td>
                  <td className="p-2"><b>{x.title}</b> <span className="text-muted">· {x.prompt}</span></td>
                  <td className="p-2 text-muted">{GROUPS[x.group]}</td>
                  <td className="p-2">{x.difficulty}</td>
                  <td className="p-2 uppercase text-muted">{x.type}</td>
                  <td className="p-2">{u ? <span className="text-info">{E.lotLabel(u)} R{u.round}</span> : ''}</td>
                  <td className="p-2"><div className="flex justify-end gap-1">
                    <Btn size="xs" variant="ghost" onClick={() => setPreview(x)}>Preview</Btn>
                    <Btn size="xs" variant="ghost" onClick={() => setEdit(structuredClone(x))}>Edit</Btn>
                    <Btn size="xs" variant="ghost" onClick={() => act((st) => E.archiveQuestion(st, x.id, !x.active))}>{x.active ? 'Archive' : 'Restore'}</Btn>
                    <Btn size="xs" variant="ghost" className="hover:!text-live" onClick={async () => { if (await confirmDialog(`Delete ${x.id}?`, 'This removes it from this event\'s bank.', 'Delete')) act((st) => E.deleteQuestion(st, x.id)); }}>Delete</Btn>
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <QuestionEditor q={edit} onClose={() => setEdit(null)} />
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} wide>
        {preview && <QuestionPreview q={preview} />}
      </Modal>
      <ImportModal open={imp} onClose={() => setImp(false)} />
    </div>
  );
}

function QuestionPreview({ q }: { q: Question }) {
  return (
    <div>
      <Label>{q.category} · {q.difficulty}</Label>
      <p className="mt-1 text-xl font-semibold">{q.prompt}</p>
      <CodeBlock code={q.code} className="mt-2" />
      {q.image && <img src={q.image} alt="" className="mt-2 max-h-60 rounded-xl" />}
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {q.type === 'oneword' ? <p>Accepted: <b className="text-ok">{q.accept.join(', ')}</b></p> : q.options.map((o, i) => <div key={i} className={cx('rounded-lg border px-3 py-2', i === q.answer ? 'border-ok bg-ok/10 text-ok' : 'border-line')}>{String.fromCharCode(65 + i)}. {o}</div>)}
      </div>
      {q.explain && <p className="mt-3 text-sm text-muted">{q.explain}</p>}
    </div>
  );
}

function QuestionEditor({ q, onClose }: { q: Question | null; onClose: () => void }) {
  const { act } = useHost();
  const [v, setV] = useState<Question | null>(q);
  const [k, setK] = useState<Question | null>(q);
  if (q !== k) { setK(q); setV(q); }
  if (!v) return null;
  const set = <K extends keyof Question>(f: K, x: Question[K]) => setV({ ...v, [f]: x });
  return (
    <Modal open onClose={onClose} title={v.title ? `Edit ${v.id}` : 'New question'} wide>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Id"><input id="q-id" className="field font-mono" value={v.id} onChange={(e) => set('id', e.target.value)} /></Field>
        <Field label="Group"><select id="q-group" className="field" value={v.group} onChange={(e) => set('group', e.target.value as Group)}>{Object.entries(GROUPS).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></Field>
        <Field label="Difficulty"><select id="q-diff" className="field" value={v.difficulty} onChange={(e) => set('difficulty', e.target.value as Question['difficulty'])}><option>Easy</option><option>Medium</option><option>Hard</option></select></Field>
        <Field label="Type"><select id="q-type" className="field" value={v.type} onChange={(e) => { const t = e.target.value as Question['type']; setV({ ...v, type: t, options: t === 'tf' ? ['True', 'False'] : t === 'oneword' ? [] : v.options.length >= 2 && v.type !== 'tf' ? v.options : ['', '', '', ''], answer: 0 }); }}><option value="mcq">Multiple choice</option><option value="tf">True / false</option><option value="oneword">One word</option></select></Field>
        <div className="sm:col-span-2"><Field label="Title (shown before bidding)"><input id="q-title" className="field" value={v.title} onChange={(e) => set('title', e.target.value)} /></Field></div>
        <div className="sm:col-span-2"><Field label="Category"><input id="q-cat" className="field" value={v.category} onChange={(e) => set('category', e.target.value)} /></Field></div>
        <div className="sm:col-span-4"><Field label="Question"><textarea id="q-prompt" className="field min-h-[60px]" value={v.prompt} onChange={(e) => set('prompt', e.target.value)} /></Field></div>
        <div className="sm:col-span-4"><Field label="Code snippet (optional, 5 lines max)"><textarea id="q-code" className="field code-block min-h-[80px]" value={v.code} onChange={(e) => set('code', e.target.value)} /></Field></div>
        {v.type === 'oneword' ? (
          <div className="sm:col-span-4"><Field label="Accepted answers (comma separated; first is shown)"><input id="q-accept" className="field" value={v.accept.join(', ')} onChange={(e) => set('accept', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></Field></div>
        ) : (
          <div className="sm:col-span-4">
            <Label className="mb-1">Options (tick the correct one)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {v.options.map((o, i) => (
                <label key={i} className="flex items-center gap-2">
                  <input type="radio" name="q-answer" checked={v.answer === i} onChange={() => set('answer', i)} className="h-4 w-4 accent-[var(--color-info)]" />
                  <input aria-label={`Option ${i + 1}`} className="field" value={o} disabled={v.type === 'tf'} onChange={(e) => set('options', v.options.map((x, j) => (j === i ? e.target.value : x)))} />
                </label>
              ))}
            </div>
            {v.type === 'mcq' && <div className="mt-2 flex gap-2">{v.options.length < 6 && <Btn size="xs" variant="ghost" onClick={() => set('options', [...v.options, ''])}>+ option</Btn>}{v.options.length > 2 && <Btn size="xs" variant="ghost" onClick={() => setV({ ...v, options: v.options.slice(0, -1), answer: Math.min(v.answer, v.options.length - 2) })}>− option</Btn>}</div>}
          </div>
        )}
        <div className="sm:col-span-3"><Field label="Short explanation (shown with the answer)"><input id="q-explain" className="field" value={v.explain} onChange={(e) => set('explain', e.target.value)} /></Field></div>
        <Field label="Image URL (optional)"><input id="q-image" className="field" value={v.image} onChange={(e) => set('image', e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={() => { if (act((x) => E.saveQuestion(x, v), 'Question saved.')) onClose(); }}>Save</Btn></div>
    </Modal>
  );
}

const CSV_HEAD = ['id', 'group', 'category', 'difficulty', 'type', 'title', 'prompt', 'code', 'options', 'answer', 'accept', 'explain', 'image', 'active'];
function bankToCSV(bank: Question[]) {
  return '﻿' + toCSV([CSV_HEAD, ...bank.map((q) => [q.id, q.group, q.category, q.difficulty, q.type, q.title, q.prompt, q.code, q.options.join(' | '), q.type === 'oneword' ? '' : q.options[q.answer] ?? '', q.accept.join(' | '), q.explain, q.image, q.active ? 'yes' : 'no'])]);
}
function parseBank(text: string): { qs: Question[]; error: string | null } {
  const t = text.trim();
  try {
    if (t.startsWith('[') || t.startsWith('{')) {
      const v = JSON.parse(t) as unknown;
      const arr = (Array.isArray(v) ? v : (v as { questions?: unknown[] }).questions ?? []) as Partial<Question>[];
      const qs = arr.map((x) => ({ ...blankQ(), ...x, code: x.code ?? '', accept: x.accept ?? [], image: x.image ?? '', explain: x.explain ?? '', active: x.active !== false } as Question));
      return { qs, error: null };
    }
    const rows = parseCSV(t);
    const h = rows[0]?.map((x) => x.trim().toLowerCase()) ?? [];
    const col = (n: string) => h.indexOf(n);
    if (col('id') < 0 || col('prompt') < 0) return { qs: [], error: `CSV needs a header row with: ${CSV_HEAD.join(', ')}` };
    const qs = rows.slice(1).map((r) => {
      const g = (n: string) => (col(n) >= 0 ? (r[col(n)] ?? '').trim() : '');
      const type = (g('type') || 'mcq') as Question['type'];
      const options = type === 'tf' ? ['True', 'False'] : g('options').split('|').map((x) => x.trim()).filter(Boolean);
      const ans = g('answer');
      const idx = /^\d+$/.test(ans) && Number(ans) < options.length && !options.includes(ans) ? Number(ans) : options.findIndex((o) => o.toLowerCase() === ans.toLowerCase());
      return {
        ...blankQ(), id: g('id'), group: (g('group') || 'tech') as Group, category: g('category'), difficulty: (g('difficulty') || 'Easy') as Question['difficulty'],
        type, title: g('title'), prompt: g('prompt'), code: g('code').replace(/\\n/g, '\n'), options, answer: idx,
        accept: g('accept').split('|').map((x) => x.trim()).filter(Boolean), explain: g('explain'), image: g('image'), active: g('active').toLowerCase() !== 'no',
      };
    }).filter((q) => q.id);
    return { qs, error: null };
  } catch (e) {
    return { qs: [], error: `Could not read the file: ${(e as Error).message}` };
  }
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { act } = useHost();
  const [text, setText] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => (text.trim() ? parseBank(text) : null), [text]);
  const firstBad = parsed?.qs.map((q) => E.validateQuestion(q)).find(Boolean) ?? null;
  return (
    <Modal open={open} onClose={onClose} title="Import questions" wide>
      <p className="text-sm text-muted">JSON (an array of questions, as exported) or CSV with columns: <code className="text-xs">{CSV_HEAD.join(', ')}</code>. Options are separated by <code>|</code>; answer is the correct option's text. Questions with an existing id are replaced.</p>
      <div className="mt-3 flex gap-2">
        <Btn variant="outline" onClick={() => file.current?.click()}>Choose file</Btn>
        <input ref={file} id="bank-file" type="file" accept=".json,.csv,text/csv,application/json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) f.text().then(setText); }} />
      </div>
      <textarea id="bank-paste" className="field mt-3 min-h-[160px] font-mono text-xs" placeholder="…or paste here" value={text} onChange={(e) => setText(e.target.value)} />
      {parsed && <p className={cx('mt-2 text-sm', parsed.error || firstBad ? 'text-warn' : 'text-ok')}>{parsed.error ?? firstBad ?? `${parsed.qs.length} questions ready.`}</p>}
      <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" disabled={!parsed || !!parsed.error || !!firstBad || !parsed.qs.length} onClick={() => { if (act((x) => E.importQuestions(x, parsed!.qs), `Imported ${parsed!.qs.length} questions.`)) { setText(''); onClose(); } }}>Import</Btn></div>
    </Modal>
  );
}

// =====================================================================================================
export function SettingsTab() {
  const { s, act, role } = useHost();
  const c = s.cfg;
  const locked = s.stage !== 'registration';
  const set = (patch: Partial<Config>) => act((x) => E.configure(x, patch));
  const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
  const restore = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="panel p-5">
        <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase">Event</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Event name"><input id="set-name" className="field" value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Date"><input id="set-date" type="date" className="field" value={c.date} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Starting purse (lakh)" hint={locked ? 'Locked after start.' : E.money(c.purse)}><input id="set-purse" className="field num" type="number" disabled={locked} value={c.purse} onChange={(e) => set({ purse: num(e.target.value, 100, 100000) })} /></Field>
          <Field label="Minimum bid increment (lakh)"><input id="set-inc" className="field num" type="number" value={c.inc} onChange={(e) => set({ inc: num(e.target.value, 1, 1000) })} /></Field>
          <Field label="Auction timer (seconds)"><input id="set-auction" className="field num" type="number" value={c.auctionSec} onChange={(e) => set({ auctionSec: num(e.target.value, 5, 300) })} /></Field>
          <Field label="Answer timer (seconds, max 10)"><input id="set-answer" className="field num" type="number" max={10} value={c.answerSec} onChange={(e) => set({ answerSec: num(e.target.value, 3, 10) })} /></Field>
          <Field label="If the winner is wrong: other correct teams get (% of reward)"><input id="set-steal" className="field num" type="number" value={Math.round(c.stealShare * 100)} onChange={(e) => set({ stealShare: num(e.target.value, 0, 100) / 100 })} /></Field>
          <Field label="Default bidding">
            <select id="set-bidmode" className="field" value={c.bidMode ?? 'physical'} onChange={(e) => set({ bidMode: e.target.value as 'physical' | 'mobile' })}><option value="physical">Out loud (host enters the winner)</option><option value="mobile">On team phones</option></select>
          </Field>
          <Field label="Points per ₹1 Cr left at the end"><input id="set-conv" className="field num" type="number" value={c.conv} onChange={(e) => set({ conv: num(e.target.value, 0, 1000) })} /></Field>
          <Field label="Planned length (minutes, for the timer)"><input id="set-minutes" className="field num" type="number" value={E.EVENT_MINUTES(c)} onChange={(e) => set({ schedule: [num(e.target.value, 10, 600)] })} /></Field>
          <Field label="Practice purse (lakh)"><input id="set-ppurse" className="field num" type="number" value={c.practicePurse} onChange={(e) => set({ practicePurse: num(e.target.value, 100, 100000) })} /></Field>
          <Field label="Leaderboard on the projector">
            <select id="set-board" className="field" value={c.board} onChange={(e) => set({ board: e.target.value as Config['board'] })}><option value="always">Always</option><option value="between">Between lots only</option><option value="hidden">Hidden until the end</option></select>
          </Field>
          <div className="flex flex-col gap-2 pt-5">
            <label className="flex items-center gap-2"><input id="set-auto" type="checkbox" checked={c.auto} onChange={(e) => set({ auto: e.target.checked })} className="h-4 w-4" /> Reveal the challenge automatically after SOLD</label>
            <label className="flex items-center gap-2"><input id="set-sound" type="checkbox" checked={c.sound} onChange={(e) => set({ sound: e.target.checked })} className="h-4 w-4" /> Sound effects on the projector</label>
          </div>
        </div>
        <Label className="mb-2 mt-5">Price and reward by difficulty (applies to the next questions)</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['Medium', 'Hard'] as const).map((d) => {
            const lv = E.levelOf(c, d);
            const setLv = (patch: Partial<{ base: number; reward: number }>) => set({ levels: { ...(c.levels ?? E.DEFAULT_CONFIG.levels!), [d]: { ...lv, ...patch } } });
            return (
              <div key={d} className="rounded-xl border border-line p-3">
                <div className="mb-2 font-bold">{d}</div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Base price (lakh)"><input id={`set-${d}-base`} className="field num" type="number" value={lv.base} onChange={(e) => setLv({ base: num(e.target.value, 1, 10000) })} /></Field>
                  <Field label="Reward (points)"><input id={`set-${d}-reward`} className="field num" type="number" value={lv.reward} onChange={(e) => setLv({ reward: num(e.target.value, 0, 10000) })} /></Field>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="panel p-5">
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase">Results &amp; backup</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn variant="primary" onClick={async () => { if ((await saveFile(`code-and-chaos-${s.code}-results.csv`, E.exportResultsCSV(s), 'text/csv')) === 'failed') toast('Download blocked.', 'warn'); }}>Export results (CSV)</Btn>
            <Btn variant="outline" onClick={async () => { if ((await saveFile(`code-and-chaos-${s.code}-backup.json`, JSON.stringify(s), 'application/json')) === 'failed') toast('Download blocked.', 'warn'); }}>Download backup</Btn>
            <Btn variant="outline" onClick={() => restore.current?.click()}>Restore backup…</Btn>
            <input ref={restore} id="restore-file" type="file" accept=".json" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              try {
                const v = JSON.parse(await f.text()) as HostState;
                if (v.v !== 1 || v.code !== s.code) return toast(v.code && v.code !== s.code ? `That backup is for event ${v.code}.` : 'Not a Code & Chaos backup.', 'warn');
                if (!(await confirmDialog('Restore this backup?', 'The current game state is replaced by the backup.', 'Restore'))) return;
                act(() => ({ ...v, rev: s.rev + 1, audit: [{ at: Date.now(), action: 'Backup restored', detail: new Date(v.savedAt).toLocaleString() }, ...v.audit] }), 'Backup restored.');
              } catch { toast('Could not read that file.', 'warn'); }
            }} />
          </div>
          <p className="mt-2 text-xs text-dim">The game also saves itself in this browser and in Firebase after every action.</p>
        </div>
        <div className="panel border-live/40 p-5">
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase text-live">Delete event</h3>
          <p className="mt-1 text-sm text-muted">Removes this event for everyone: teams, scores, questions and history. Export the results first if you want to keep them.</p>
          <Btn variant="danger" className="mt-3" disabled={role !== 'main'} onClick={async () => {
            if (!(await confirmDialog(`Delete event ${s.code}?`, 'Team phones and the projector will show "no event". This cannot be undone.', 'Delete event'))) return;
            const r = await deleteEvent(s.code);
            if (r !== 'ok') return toast(r === 'denied' ? 'Only the main device can delete the event.' : 'Could not reach Firebase. Nothing was deleted.', 'warn');
            forgetEvent(s.code);
            location.hash = 'cc';
          }}>Delete this event</Btn>
          {role !== 'main' && <p className="mt-2 text-xs text-dim">Only the main device can delete the event.</p>}
        </div>
        <div className="panel p-5">
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase">Audit log</h3>
          <div className="mt-2 flex max-h-[420px] flex-col gap-1 overflow-auto text-sm scroll-thin">
            {s.audit.map((a, i) => <div key={i} className="flex gap-3 border-b border-line/40 py-1"><span className="w-20 shrink-0 text-dim num">{new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span className={cx('font-semibold', /OVERRIDE|VOID/.test(a.action) && 'text-warn')}>{a.action}</span><span className="text-muted">{a.detail}</span></div>)}
          </div>
        </div>
        <div className="panel p-5">
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase">Points ledger</h3>
          <div className="mt-2 flex max-h-[300px] flex-col gap-1 overflow-auto text-sm scroll-thin">
            {[...s.ledger].reverse().map((e) => <div key={e.id} className="flex gap-3 border-b border-line/40 py-1"><span className="w-12 shrink-0 font-bold">T{e.team}</span><span className="w-24 shrink-0 num">{e.purse ? E.money(e.purse) : ''}</span><span className="w-16 shrink-0 num">{e.points ? `${e.points > 0 ? '+' : ''}${e.points}` : ''}</span><span className="text-muted">{e.reason}{e.practice ? ' (practice)' : ''}</span></div>)}
          </div>
        </div>
      </section>
      <span className="hidden">{serverNow()}</span>
    </div>
  );
}
