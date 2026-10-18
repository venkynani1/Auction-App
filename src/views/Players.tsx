import { useMemo, useRef, useState } from 'react';
import { ROUNDS, useStore, type Item, type RoundNo } from '../store';
import { fileToPhoto, money, nameKey } from '../lib/util';
import { parseCSV } from '../lib/csv';
import { getPhoto, photoCount, setPhoto, usePhotos } from '../lib/photos';
import { Btn, confirmDialog, cx, Field, Modal, toast } from '../components/ui';
import { Photo } from '../components/bits';

export function PlayersView() {
  const { state, dispatch } = useStore();
  usePhotos();
  const [round, setRound] = useState<RoundNo>(1);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Item> | null>(null);
  const [imp, setImp] = useState(false);
  const bulk = useRef<HTMLInputElement>(null);
  const one = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const items = state.items.filter((i) => i.round === round && i.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.lot - b.lot);
  const withPhoto = state.items.filter((i) => getPhoto(i.id)).length;

  const onBulk = async (files: FileList | null) => {
    if (!files?.length) return;
    const byKey = new Map(state.items.map((i) => [nameKey(i.name), i]));
    let ok = 0; const miss: string[] = [];
    for (const f of Array.from(files)) {
      const it = byKey.get(nameKey(f.name));
      if (!it) { miss.push(f.name); continue; }
      try { await setPhoto(it.id, await fileToPhoto(f)); ok++; } catch { miss.push(f.name); }
    }
    toast(`Added ${ok} photo${ok === 1 ? '' : 's'}.${miss.length ? ` No match for ${miss.length}: ${miss.slice(0, 3).join(', ')}${miss.length > 3 ? '…' : ''}` : ''}`, miss.length ? 'warn' : 'ok');
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-black uppercase">Players & photos</h1>
          <p className="text-muted">{state.items.length} lots · {withPhoto} with photos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="gold" onClick={() => bulk.current?.click()}>⬆ Add many photos</Btn>
          <Btn variant="outline" onClick={() => setImp(true)}>Import CSV</Btn>
          <Btn variant="outline" onClick={() => setEdit({ round })}>＋ Add player</Btn>
        </div>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        <b className="text-fg">Add many photos:</b> select a whole folder of pictures at once (for example the <code>photos</code> folder made by the photo script). Each file is matched to a player by its file name, e.g. <code>Thalapathy Vijay.jpg</code>. Or click any photo below to set one.
      </p>
      <input ref={bulk} id="bulk-photos" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void onBulk(e.target.files); e.target.value = ''; }} />
      <input ref={one} id="one-photo" type="file" accept="image/*" className="sr-only" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f || !target.current) return;
        try { await setPhoto(target.current, await fileToPhoto(f)); toast('Photo saved.', 'ok'); } catch { toast('That image could not be read.', 'warn'); }
      }} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {([1, 2, 3, 4] as RoundNo[]).map((r) => (
          <Btn key={r} size="sm" variant={round === r ? 'gold' : 'subtle'} onClick={() => setRound(r)}>R{r} · {ROUNDS[r].short} ({state.items.filter((i) => i.round === r).length})</Btn>
        ))}
        <input id="player-search" className="field !w-56 !py-1.5" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((i) => {
          const team = state.teams.find((t) => t.id === i.teamId);
          return (
            <div key={i.id} className="panel flex min-w-0 flex-col overflow-hidden">
              <button className="group relative" onClick={() => { target.current = i.id; one.current?.click(); }} title="Click to set the photo">
                <Photo item={i} className="aspect-[4/5] w-full !rounded-none !border-0" />
                <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-xs font-semibold opacity-0 transition group-hover:opacity-100">{getPhoto(i.id) ? 'Change photo' : 'Add photo'}</span>
              </button>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="text-xs text-dim num">Lot {i.lot}</div><div className="truncate font-semibold" title={i.name}>{i.name}</div></div>
                </div>
                <div className="text-xs text-muted">{i.base ? money(i.base) : 'open'} · {i.round === 4 ? 'slip' : `${i.points ?? '—'} pts`}</div>
                <div className={cx('text-xs font-semibold', i.status === 'sold' ? 'text-ok' : i.status === 'unsold' ? 'text-warn' : 'text-dim')}>
                  {i.status === 'sold' ? `Sold to ${team?.name} · ${money(i.price ?? 0)}` : i.status === 'unsold' ? 'Unsold' : 'Available'}
                </div>
                <div className="mt-auto flex gap-1 pt-1">
                  <Btn size="xs" variant="ghost" onClick={() => setEdit(i)}>Edit</Btn>
                  {i.status !== 'available' && <Btn size="xs" variant="ghost" onClick={() => dispatch({ type: 'REQUEUE', itemId: i.id })}>↺ Re-auction</Btn>}
                  {getPhoto(i.id) && <Btn size="xs" variant="ghost" onClick={() => setPhoto(i.id, null)}>✕ Photo</Btn>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {items.length === 0 && <p className="mt-6 text-center text-muted">No players here yet.</p>}

      <Editor value={edit} onClose={() => setEdit(null)} />
      <ImportModal open={imp} onClose={() => setImp(false)} />
      <span className="sr-only">{photoCount()}</span>
    </div>
  );
}

function Editor({ value, onClose }: { value: Partial<Item> | null; onClose: () => void }) {
  const { dispatch } = useStore();
  const [v, setV] = useState<Partial<Item>>({});
  const key = value ? value.id ?? 'new' : null;
  const [k, setK] = useState<string | null>(null);
  if (key !== k) { setK(key); setV(value ? { ...value } : {}); }
  if (!value) return null;
  const set = <K extends keyof Item>(f: K, x: Item[K]) => setV((o) => ({ ...o, [f]: x }));
  const save = () => {
    if (!v.name?.trim()) return toast('Give the player a name.', 'warn');
    dispatch({ type: 'ITEM_SAVE', item: { ...v, name: v.name.trim() } });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={value.id ? 'Edit player' : 'Add player'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Name"><input id="ed-name" className="field" value={v.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus /></Field></div>
        <Field label="Round">
          <select id="ed-round" className="field" value={v.round ?? 1} onChange={(e) => set('round', Number(e.target.value) as RoundNo)} disabled={!!value.id}>
            {([1, 2, 3, 4] as RoundNo[]).map((r) => <option key={r} value={r}>{r} · {ROUNDS[r].name}</option>)}
          </select>
        </Field>
        <Field label="Role"><input id="ed-role" className="field" value={v.role ?? ''} onChange={(e) => set('role', e.target.value)} /></Field>
        <Field label="Base price (₹ Cr)" hint="50 L = 0.5"><input id="ed-base" className="field num" type="number" step="0.05" min="0" value={v.base ?? ''} onChange={(e) => set('base', Number(e.target.value))} /></Field>
        <Field label="Points"><input id="ed-points" className="field num" type="number" step="1" value={v.points ?? ''} onChange={(e) => set('points', e.target.value === '' ? null : Number(e.target.value))} /></Field>
      </div>
      <div className="mt-6 flex justify-between gap-2">
        {value.id ? <Btn variant="ghost" className="hover:!text-live" onClick={async () => { if (await confirmDialog(`Delete ${value.name}?`, 'The player is removed from the list. If sold, the money goes back to the team.', 'Delete')) { dispatch({ type: 'ITEM_DELETE', id: value.id! }); void setPhoto(value.id!, null); onClose(); } }}>Delete</Btn> : <span />}
        <div className="flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="gold" onClick={save}>Save</Btn></div>
      </div>
    </Modal>
  );
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const [text, setText] = useState('');
  const parsed = useMemo(() => {
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const h = rows[0]!.map((x) => x.toLowerCase().replace(/[^a-z]/g, ''));
    const col = (...n: string[]) => h.findIndex((x) => n.includes(x));
    const c = { name: col('name'), round: col('round'), role: col('role', 'type', 'category'), base: col('baseprice', 'base', 'price'), points: col('points', 'pts') };
    if (c.name < 0) return [];
    return rows.slice(1).map((r) => {
      const g = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
      const rn = Math.min(4, Math.max(1, Number(g(c.round)) || 1)) as RoundNo;
      const baseRaw = g(c.base).toLowerCase();
      const base = baseRaw.includes('l') ? Number(baseRaw.replace(/[^\d.]/g, '')) / 100 : Number(baseRaw.replace(/[^\d.]/g, '')) || (rn === 3 ? 0.5 : 1);
      return { name: g(c.name), round: rn, role: g(c.role), base, points: g(c.points) === '' ? null : Number(g(c.points)) };
    }).filter((x) => x.name);
  }, [text]);
  return (
    <Modal open={open} onClose={onClose} title="Import players (CSV)" wide>
      <p className="text-sm text-muted">Columns: <code className="text-fg">Name, Round, Role, BasePrice, Points</code>. Round is 1–4. BasePrice in crores (0.5) or with L (50L). Save an Excel sheet as CSV and paste it here.</p>
      <textarea id="csv-text" className="field mt-3 min-h-[200px] font-mono text-xs" placeholder={'Name,Round,Role,BasePrice,Points\nDhanush,1,Actor,1.5,17'} value={text} onChange={(e) => setText(e.target.value)} />
      <p className="mt-2 text-sm">{parsed.length ? <b className="text-ok">{parsed.length} players ready</b> : <span className="text-dim">Nothing to import yet.</span>}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="gold" disabled={!parsed.length} onClick={() => { dispatch({ type: 'ITEMS_IMPORT', items: parsed }); toast(`Imported ${parsed.length} players.`, 'ok'); setText(''); onClose(); }}>Import</Btn>
      </div>
    </Modal>
  );
}

