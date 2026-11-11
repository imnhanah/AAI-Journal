// Desktop Journal Setup v2 (SETUP_V2 in TradingJournal.jsx), after aaicorefx-desktop-journal-setup.html.
// Phones keep the existing Setup screens. Every change goes through the same handlers as the old page.
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, ArrowRight, Award, CandlestickChart, Check, ChevronDown, Database, Download, GripVertical, Info, Layers, ListChecks, LogIn, Pencil, Plus, Search, ShieldCheck, Sun, Trash2, Upload, X } from 'lucide-react';
import CertificateArchive from './CertificateArchive.jsx';
import { ThemeSelect } from './JournalControls';
import { DEFAULT_INSTRUMENTS, INSTRUMENT_GROUPS, instrumentGroup, normalizeInstrument, sameInstrument } from './instrumentCatalog';
import { activeRoutineItems, deleteRoutineItem, reorderRoutine, resetCountdown, restoreRoutineItems, routineItems, routineWeekStats, updateRoutineItem } from './dailyRoutine';
import './desktopJournalSetup.css';

const SECTIONS = [
  ['Workflow', [['daily-routine', 'Daily routine', Sun], ['rules', 'Trading rules', ListChecks], ['risk-presets', 'Risk presets', ShieldCheck]]],
  ['Libraries', [['instruments', 'Instruments', CandlestickChart], ['mistakes', 'Mistakes', AlertTriangle], ['confluences', 'Confluences', Layers], ['entries', 'Entry types', LogIn]]],
  ['Data', [['certificates', 'Certificates', Award], ['mappings', 'Import mappings', ArrowLeftRight], ['backup', 'Data & backup', Database]]],
];
const ICONS = Object.fromEntries(SECTIONS.flatMap(([, list]) => list.map(([id, , Icon]) => [id, Icon])));
const GROUPS = [['before', 'Before the chart'], ['pretrade', 'Pre-trade']];
const lower = (value) => String(value || '').trim().toLowerCase();
const symbolOf = (instrument) => typeof instrument === 'string' ? instrument : instrument?.symbol;
const mappingKey = (userId) => `aaicorefx-management:${userId}:import-mappings`;
const readMappings = (userId) => { try { const saved = JSON.parse(window.localStorage.getItem(mappingKey(userId))); return Array.isArray(saved) ? saved : []; } catch { return []; } };
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const trimNumber = (value) => String(Number(Number(value).toFixed(2)));

function Toggle({ on, label, disabled, onChange }) {
  return <button type="button" className={`js2-sw ${on ? 'is-on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onChange}><i/></button>;
}

function SearchBox({ value, onChange, placeholder }) {
  return <label className="js2-sr"><Search size={15} aria-hidden="true"/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)}/>{value && <button type="button" aria-label="Clear search" onClick={() => onChange('')}><X size={13}/></button>}</label>;
}

function Head({ id, title, count, desc, children }) {
  const Icon = ICONS[id];
  return <header className="js2-ph"><span className="js2-pi"><Icon size={22}/></span><div className="js2-pt"><h2>{title}</h2><p>{count != null && <><b>{count}</b> · </>}{desc}</p></div>{children}</header>;
}

// Delete asks once more in place: the first press arms it, the second deletes, leaving the button cancels.
function DeleteButton({ label, disabled, onDelete }) {
  const [armed, setArmed] = useState(false);
  if (armed) return <button type="button" className="js2-dl" autoFocus disabled={disabled} onBlur={() => setArmed(false)} onKeyDown={(event) => event.key === 'Escape' && setArmed(false)} onClick={() => { setArmed(false); onDelete(); }}>Delete?</button>;
  return <button type="button" className="js2-ib is-dl" title={`Delete ${label}`} aria-label={`Delete ${label}`} disabled={disabled} onClick={() => setArmed(true)}><Trash2 size={15}/></button>;
}

// A name that renames in place. onRename returns an error message, or nothing when it saved.
function NameField({ label, editing, disabled, onEdit, onCancel, onRename }) {
  const [value, setValue] = useState(label);
  useEffect(() => { if (editing) setValue(label); }, [editing, label]);
  if (!editing) return <span className="js2-nm">{label}</span>;
  const save = async () => { if (await onRename(value.trim()) !== false) onCancel(); };
  return <span className="js2-ed-wrap"><input className="js2-ed" autoFocus maxLength={160} aria-label={`Rename ${label}`} value={value} disabled={disabled} onFocus={(event) => event.target.select()} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save(); if (event.key === 'Escape') onCancel(); }}/><button type="button" className="js2-ib is-ok" aria-label="Save name" disabled={disabled || !value.trim()} onClick={save}><Check size={15}/></button><button type="button" className="js2-ib" aria-label="Cancel rename" onClick={onCancel}><X size={15}/></button></span>;
  void onEdit;
}

function AddBar({ placeholder, label, disabled, onAdd, children }) {
  const [value, setValue] = useState('');
  const add = async () => { const text = value.trim(); if (!text) return; if (await onAdd(text) !== false) setValue(''); };
  return <div className="js2-ad"><label className="js2-in"><input aria-label={label || placeholder} placeholder={placeholder} maxLength={160} value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()}/></label>{children}<button type="button" className="js2-bn is-pri" disabled={disabled || !value.trim()} onClick={add}><Plus size={15}/>Add</button></div>;
}

function ListSection({ id, title, desc, one, many, placeholder, items, grid, onAdd, onRename, onDelete, toast }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const shown = items.filter((item) => lower(item.label).includes(lower(query)));
  const exists = (text, except) => items.some((item) => item.id !== except && lower(item.label) === lower(text));
  const add = (text) => { if (exists(text)) { toast('Already in the list'); return false; } onAdd(text); toast(`Added “${text}”`); };
  const rename = (item, text) => { if (!text) { toast('A name can’t be empty'); return false; } if (exists(text, item.id)) { toast('Already in the list'); return false; } if (text !== item.label) onRename(item.id, text); };
  return <>
    <Head id={id} title={title} count={plural(items.length, one, many)} desc={desc}><SearchBox value={query} onChange={setQuery} placeholder="Search this list…"/></Head>
    <AddBar placeholder={placeholder} onAdd={add}/>
    {shown.length ? <div className={`js2-list ${grid ? 'is-g2' : ''}`}>{shown.map((item) => <div className="js2-rw" key={item.id}>
      <NameField label={item.label} editing={editing === item.id} onCancel={() => setEditing(null)} onRename={(text) => rename(item, text)}/>
      {editing !== item.id && <div className="js2-ac">{item.locked ? <span className="js2-pr">{item.tag || 'Preset'}</span> : <><button type="button" className="js2-ib" title={`Rename ${item.label}`} aria-label={`Rename ${item.label}`} onClick={() => setEditing(item.id)}><Pencil size={15}/></button><DeleteButton label={item.label} onDelete={() => { onDelete(item.id); toast('Deleted'); }}/></>}</div>}
    </div>)}</div> : <div className="js2-em">{items.length ? 'No match.' : 'Nothing here yet.'}</div>}
  </>;
}

function RoutineSection({ routine, onUpdate, run, toast }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('before');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const save = async (change) => { setBusy(true); try { return await run(() => onUpdate(change)); } finally { setBusy(false); } };
  const items = routineItems(routine);
  const on = items.filter((item) => item.enabled !== false).length;
  const { todayCompletion, todayDone, todayTotal, history, tradingWeek, recentTradingDays, completionState, completedThisWeek, historicalRows, mostMissed } = routineWeekStats(routine);
  const listDisabled = busy || !routine.enabled;
  const move = (id, target, targetGroup) => {
    const item = items.find((row) => row.id === id);
    if (!item || listDisabled) return;
    void save((current) => {
      let next = current;
      if (target && target !== id) next = reorderRoutine(next, id, target);
      else if (!target) { const last = [...routineItems(next)].reverse().find((row) => row.group === targetGroup && row.id !== id); const after = last && routineItems(next)[routineItems(next).findIndex((row) => row.id === last.id) + 1]; if (after && after.id !== id) next = reorderRoutine(next, id, after.id); }
      return item.group !== targetGroup ? updateRoutineItem(next, item, { group: targetGroup }) : next;
    });
  };
  const rename = async (item, text) => { if (!text) { toast('A name can’t be empty'); return false; } if (text === item.label) return; return save((current) => updateRoutineItem(current, item, { label: text })); };
  const add = async (text) => { const item = { id: `custom-${crypto.randomUUID()}`, label: text, group, order: items.length, enabled: true }; const ok = await save((current) => ({ ...current, customItems: [...current.customItems, item], order: [...current.order, item.id] })); if (ok) toast(`Added “${text}”`); return ok; };
  const list = (key, title) => {
    const all = items.filter((item) => item.group === key), rows = all.filter((item) => lower(item.label).includes(lower(query)));
    return <div className="js2-gr" key={key}><div className="js2-gh"><b>{title}</b><small>{all.filter((item) => item.enabled !== false).length} of {all.length} on</small></div>
      <div className={`js2-list ${drag && over === key ? 'is-over' : ''}`} onDragOver={(event) => { if (drag) { event.preventDefault(); setOver(key); } }} onDragLeave={() => setOver(null)} onDrop={(event) => { event.preventDefault(); if (drag) move(drag, null, key); setDrag(null); setOver(null); }}>
        {rows.map((item) => { const index = items.indexOf(item), isEditing = editing === item.id;
          return <div key={item.id} data-routine-id={item.id} className={`js2-rw ${item.enabled === false ? 'is-off' : ''} ${drag === item.id ? 'is-dg' : ''} ${drag && over === item.id ? 'is-ov' : ''}`} draggable={!listDisabled && !isEditing}
            onDragStart={(event) => { setDrag(item.id); event.dataTransfer.effectAllowed = 'move'; try { event.dataTransfer.setData('text/plain', item.id); } catch { /* Some browsers refuse; the id is kept in state. */ } }}
            onDragEnd={() => { setDrag(null); setOver(null); }}
            onDragOver={(event) => { if (drag) { event.preventDefault(); event.stopPropagation(); setOver(item.id); } }}
            onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (drag) move(drag, item.id, item.group); setDrag(null); setOver(null); }}>
            <span className="js2-gp" role="button" tabIndex={listDisabled ? -1 : 0} aria-label={`Reorder ${item.label}`} title="Drag to reorder, or use Arrow Up / Arrow Down" onKeyDown={(event) => { if (listDisabled) return; if (event.key === 'ArrowUp' && index > 0) { event.preventDefault(); void save((current) => reorderRoutine(current, item.id, items[index - 1].id)); } if (event.key === 'ArrowDown' && index < items.length - 1) { event.preventDefault(); void save((current) => reorderRoutine(current, items[index + 1].id, item.id)); } }}><GripVertical size={15}/></span>
            <span className="js2-n">{index + 1}</span>
            <NameField label={item.label} editing={isEditing} disabled={listDisabled} onCancel={() => setEditing(null)} onRename={(text) => rename(item, text)}/>
            {!isEditing && <div className="js2-ac"><div className="js2-sl"><ThemeSelect label={`Group for ${item.label}`} compact value={item.group} disabled={listDisabled} onChange={(event) => save((current) => updateRoutineItem(current, item, { group: event.target.value }))}>{GROUPS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</ThemeSelect></div><Toggle on={item.enabled !== false} label={item.label} disabled={listDisabled} onChange={() => save((current) => updateRoutineItem(current, item, { enabled: item.enabled === false }))}/><button type="button" className="js2-ib" aria-label={`Edit ${item.label}`} disabled={listDisabled} onClick={() => setEditing(item.id)}><Pencil size={15}/></button><DeleteButton label={item.label} disabled={listDisabled} onDelete={async () => { if (await save((current) => deleteRoutineItem(current, item))) toast('Deleted'); }}/></div>}
          </div>; })}
        {!rows.length && <div className="js2-em">{all.length ? 'No match.' : 'Nothing here. Drag an item here to move it.'}</div>}
      </div></div>;
  };
  const day = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' });
  return <>
    <Head id="daily-routine" title="Daily routine" count={plural(activeRoutineItems(routine).length, 'item on', 'items on')} desc="the same in every workspace"><button type="button" className="js2-bn" disabled={listDisabled} onClick={async () => { if (await save(restoreRoutineItems)) toast('Recommended items restored'); }}>Restore recommended</button></Head>
    <div className="js2-st">
      <div><small>Today</small><b>{todayDone}<em>/{todayTotal}</em></b><span>{todayCompletion ? 'Saved for today' : 'Not started yet'}</span></div>
      <div><small>Current streak</small><b>{history.streak}<em> days</em></b><span>{history.streak ? 'Keep it going' : 'Complete a day to start'}</span></div>
      <div><small>This week</small><b>{completedThisWeek}<em>/{recentTradingDays.length} full</em></b><div className="js2-wk" aria-label="This trading week, Monday through Friday">{tradingWeek.map((entry) => { const state = completionState(entry.key); return <i key={entry.key} className={`is-${state} ${entry.today ? 'is-today' : ''}`} title={`${entry.key}: ${state}`}>{day(entry.key)}</i>; })}</div></div>
      <div className="is-att"><small>Needs attention</small><b>{historicalRows.length && mostMissed?.missed ? mostMissed.label : 'Nothing yet'}</b><span>{historicalRows.length && mostMissed?.missed ? `${plural(mostMissed.missed, 'missed check', 'missed checks')} across saved routines` : 'Missed-item trends build here.'}</span></div>
    </div>
    <div className="js2-set">
      <div className="js2-sr2"><div><b>Routine enabled</b><p>{routine.enabled ? 'Show the checklist before you start trading.' : 'Markups and trades open straight to their forms.'}</p></div><Toggle on={routine.enabled} label="Routine enabled" disabled={busy} onChange={async () => { const next = !routine.enabled; if (await save((current) => ({ ...current, enabled: next }))) toast(next ? 'Routine is on' : 'Routine is off'); }}/></div>
      <div className="js2-sr2"><div><b>Opens before</b><p>The routine must be completed before this action.</p></div><span className="js2-fx">First markup or trade</span></div>
      <div className="js2-sr2"><div><b>Resets when</b><p>Checks clear for the next day at this moment.</p></div><span className="js2-fx">Tokyo session opens · next in {resetCountdown()}</span></div>
    </div>
    <div className="js2-sec"><div className="js2-sh"><h3>Routine items</h3><span>{items.length} items · {on} on</span><SearchBox value={query} onChange={setQuery} placeholder="Search items…"/></div>
      {!routine.enabled && <p className="js2-fn">Switch the routine on to edit its items.</p>}
      <AddBar placeholder="Add a routine item…" label="Routine item" disabled={listDisabled} onAdd={add}><div className="js2-sl is-w"><ThemeSelect label="Routine item group" value={group} disabled={listDisabled} onChange={(event) => setGroup(event.target.value)}>{GROUPS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</ThemeSelect></div></AddBar>
      {GROUPS.map(([key, title]) => list(key, title))}
    </div>
  </>;
}

function InstrumentSection({ instruments, onSave, toast }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(INSTRUMENT_GROUPS[0]);
  const [closed, setClosed] = useState({});
  const [editing, setEditing] = useState(null);
  const isDefault = (instrument) => DEFAULT_INSTRUMENTS.some((item) => sameInstrument(item, symbolOf(instrument)));
  const custom = instruments.filter((item) => !isDefault(item)).map((item) => typeof item === 'string' ? { symbol: item, group: instrumentGroup(item) } : item);
  const available = [...DEFAULT_INSTRUMENTS.map((symbol) => ({ symbol, group: instrumentGroup(symbol), fixed: true })), ...custom];
  const add = (text) => {
    const next = normalizeInstrument(text);
    if (!next) { toast('Enter an instrument'); return false; }
    if (available.some((item) => sameInstrument(item.symbol, next))) { toast(`${next} is already in your list`); return false; }
    onSave([...instruments, { symbol: next, group }]); toast(`Added ${next} to ${group}`);
  };
  const rename = (old, text) => {
    const next = normalizeInstrument(text);
    if (!next) { toast('A name can’t be empty'); return false; }
    if (available.some((item) => item.symbol !== old && sameInstrument(item.symbol, next))) { toast(`${next} is already in your list`); return false; }
    onSave(instruments.map((item) => symbolOf(item) === old ? (typeof item === 'string' ? { symbol: next, group: instrumentGroup(item) } : { ...item, symbol: next }) : item));
  };
  const remove = (symbol) => { onSave(instruments.filter((item) => symbolOf(item) !== symbol)); toast(`Removed ${symbol}`); };
  return <>
    <Head id="instruments" title="Instrument management" count={plural(available.length, 'instrument', 'instruments')} desc="Choose a group when adding your own instrument. This decides where it appears in the journal."><SearchBox value={query} onChange={setQuery} placeholder="Search instruments…"/></Head>
    <AddBar placeholder="Add an instrument, e.g. EURGBP or NAS100" label="New instrument" onAdd={add}><div className="js2-sl is-w"><ThemeSelect label="Instrument group" value={group} onChange={(event) => setGroup(event.target.value)}>{INSTRUMENT_GROUPS.map((name) => <option key={name} value={name}>{name}</option>)}</ThemeSelect></div></AddBar>
    <p className="js2-fn">Built-in instruments stay in the list. Your own can be renamed or removed.</p>
    <div className="js2-ig">{INSTRUMENT_GROUPS.map((name) => {
      const all = available.filter((item) => item.group === name), hits = all.filter((item) => lower(item.symbol).includes(lower(query)));
      if (query.trim() && !hits.length) return null;
      const open = query.trim() || !closed[name];
      return <section className="js2-gc" key={name}><button type="button" className="js2-gt" aria-expanded={!!open} onClick={() => setClosed((current) => ({ ...current, [name]: !current[name] }))}><b>{name}</b><span>{all.length}</span><ChevronDown size={14} className={open ? 'is-up' : ''}/></button>
        {open && <div className="js2-ch">{hits.map((item) => item.fixed ? <span className="js2-c" key={item.symbol}>{item.symbol}</span> : editing === item.symbol
          ? <span className="js2-c is-ed" key={item.symbol}><NameField label={item.symbol} editing onCancel={() => setEditing(null)} onRename={(text) => rename(item.symbol, text)}/></span>
          : <span className="js2-c is-custom" key={item.symbol}>{item.symbol}<button type="button" aria-label={`Rename ${item.symbol}`} onClick={() => setEditing(item.symbol)}><Pencil size={11}/></button><button type="button" className="is-x" aria-label={`Remove ${item.symbol}`} onClick={() => remove(item.symbol)}><X size={11}/></button></span>)}{!hits.length && <small className="js2-mu">None in this group.</small>}</div>}
      </section>; })}</div>
  </>;
}

function PresetCard({ preset, onChange, onDelete }) {
  const [draft, setDraft] = useState({ risk: String(preset.risk), rr: String(preset.rr) });
  useEffect(() => setDraft({ risk: String(preset.risk), rr: String(preset.rr) }), [preset.risk, preset.rr]);
  const risk = Number(draft.risk) > 0 ? Number(draft.risk) : Number(preset.risk) || 0, rr = Number(draft.rr) > 0 ? Number(draft.rr) : Number(preset.rr) || 0;
  const commit = (field) => { const value = Number(draft[field]); if (value > 0 && (field !== 'risk' || value <= 100)) { if (String(value) !== String(preset[field])) onChange({ ...preset, [field]: String(value) }); } else setDraft((current) => ({ ...current, [field]: String(preset[field]) })); };
  const field = (key, label, unit) => <label><small>{label}</small><span className="js2-in is-s"><input inputMode="decimal" aria-label={`${preset.name} ${label.toLowerCase()}`} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} onBlur={() => commit(key)} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}/><em>{unit}</em></span></label>;
  return <article className="js2-pc"><header><b>{preset.name}</b><DeleteButton label={preset.name} onDelete={onDelete}/></header><div className="js2-pv">{field('risk', 'Risk', '%')}{field('rr', 'Target', 'R')}</div><div className="js2-bar" aria-hidden="true"><u className="is-l" style={{ flex: risk || 1 }}/><u className="is-g" style={{ flex: risk * rr || 1 }}/></div><small className="js2-mu">Risk {trimNumber(risk)}% · Target {trimNumber(rr)}R · Reward {trimNumber(risk * rr)}%</small></article>;
}

function RiskSection({ presets, onSave, toast }) {
  const [draft, setDraft] = useState({ name: '', risk: '1', rr: '2' });
  const add = () => {
    const name = draft.name.trim(), risk = Number(draft.risk), rr = Number(draft.rr);
    if (!name) { toast('Name the preset'); return; }
    if (presets.some((item) => lower(item.name) === lower(name))) { toast('A preset with that name exists'); return; }
    if (!(risk > 0 && risk <= 100) || !(rr > 0)) { toast('Risk and target must be numbers above zero'); return; }
    onSave([...presets, { name, risk: String(risk), rr: String(rr) }]); setDraft({ name: '', risk: '1', rr: '2' }); toast('Preset added');
  };
  const input = (key, label, placeholder) => <label><small>{label}</small><span className="js2-in"><input aria-label={label} inputMode={key === 'name' ? undefined : 'decimal'} placeholder={placeholder} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} onKeyDown={(event) => event.key === 'Enter' && add()}/></span></label>;
  return <>
    <Head id="risk-presets" title="Risk presets" count={plural(presets.length, 'preset', 'presets')} desc="Quick risk and risk-to-reward choices for trade logging."/>
    {presets.length ? <div className="js2-rp">{presets.map((preset, index) => <PresetCard key={`${preset.name}-${index}`} preset={preset} onChange={(next) => onSave(presets.map((item, at) => at === index ? next : item))} onDelete={() => { onSave(presets.filter((_, at) => at !== index)); toast('Deleted'); }}/>)}</div> : <div className="js2-em">No presets yet.</div>}
    <div className="js2-sec"><div className="js2-sh"><h3>New preset</h3></div><div className="js2-np">{input('name', 'Preset name', 'e.g. Standard')}{input('risk', 'Risk (%)')}{input('rr', 'Target (R)')}<button type="button" className="js2-bn is-pri" onClick={add}><Plus size={15}/>Add preset</button></div></div>
  </>;
}

function MappingSection({ userId, instruments, toast }) {
  const [mappings, setMappingsState] = useState(() => readMappings(userId));
  const [source, setSource] = useState('');
  const [target, setTarget] = useState(instruments[0] || 'EUR/USD');
  const setMappings = (next) => { setMappingsState(next); try { window.localStorage.setItem(mappingKey(userId), JSON.stringify(next)); } catch { toast('Could not save on this device'); } };
  const add = () => {
    const name = source.trim();
    if (!name) { toast('Enter the broker’s name'); return; }
    if (mappings.some((item) => lower(item.source) === lower(name))) { toast('That mapping already exists'); return; }
    setMappings([...mappings, { source: name, target }]); setSource(''); toast('Mapping added');
  };
  return <>
    <Head id="mappings" title="Import mappings" count={plural(mappings.length, 'saved mapping', 'saved mappings')} desc="Use this when your broker calls an instrument something different from your journal."/>
    <div className="js2-ad"><label className="js2-in"><input aria-label="Broker name" placeholder="Broker name, e.g. GOLDm" value={source} onChange={(event) => setSource(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()}/></label><span className="js2-ar" aria-hidden="true"><ArrowRight size={16}/></span><div className="js2-sl is-w"><ThemeSelect label="Journal instrument" value={target} onChange={(event) => setTarget(event.target.value)}>{instruments.map((instrument) => <option key={instrument} value={instrument}>{instrument}</option>)}</ThemeSelect></div><button type="button" className="js2-bn is-pri" disabled={!source.trim()} onClick={add}><Plus size={15}/>Add</button></div>
    {mappings.length ? <div className="js2-list">{mappings.map((item) => <div className="js2-rw" key={item.source}><span className="js2-nm"><b>{item.source}</b><span className="js2-map"><ArrowRight size={14}/></span>{item.target}</span><div className="js2-ac"><DeleteButton label={item.source} onDelete={() => { setMappings(mappings.filter((mapping) => mapping.source !== item.source)); toast('Deleted'); }}/></div></div>)}</div>
      : <div className="js2-mt"><span><ArrowLeftRight size={22}/></span><b>No import mappings yet</b><p>For example, map GOLDm to XAU/USD.</p></div>}
    <p className="js2-fn">Saved on this device.</p>
  </>;
}

function BackupSection({ onExportBackup, onImportBackup, snapshots = [], onRestoreSnapshot, protectedStorage, localOnly }) {
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null);
  const ago = (value) => { const days = Math.floor((Date.now() - Date.parse(value)) / 86400000); return days <= 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`; };
  const bytes = (value) => value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`;
  const latest = snapshots[0];
  return <>
    <Head id="backup" title="Data & backup" desc="Keep a complete copy before moving devices or making major changes."/>
    {localOnly && <p className="js2-fn">{latest ? `Last device backup ${ago(latest.createdAt)}.` : 'No device snapshot yet.'} Storage: <b>{protectedStorage === true ? 'Protected' : 'Not protected'}</b>{protectedStorage === true ? ', so your browser is less likely to clear local journal data.' : '. Browser storage may be cleared when space is needed.'}</p>}
    <div className="js2-bk">
      <div className="js2-bc"><span className="js2-bi"><Download size={22}/></span><b>Save a copy</b><p>Accounts, trades, markups, reviews, lists, and Daily Routine.</p><button type="button" className="js2-bn is-pri" onClick={onExportBackup}><Download size={15}/>Export backup</button></div>
      <div className="js2-bc is-w"><span className="js2-bi is-w"><Upload size={22}/></span><b>Restore a copy</b><p>Use a backup file to replace the journal on this device.</p><button type="button" className="js2-bn is-dng" onClick={() => fileRef.current?.click()}><Upload size={15}/>Import backup</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onImportBackup(file); }}/></div>
    </div>
    <div className="js2-nt"><Info size={16}/><p>Restoring replaces everything on this device. Export a backup first if you are not sure.</p></div>
    {localOnly && <div className="js2-sec"><div className="js2-sh"><h3>Device snapshots</h3><span>Created after changes, at most once per hour.</span></div>
      {snapshots.length ? <div className="js2-list">{snapshots.map((snapshot) => <div className="js2-rw" key={snapshot.id}><span className="js2-nm is-col"><b>{snapshot.kind === 'safety' ? 'Safety snapshot' : 'Automatic snapshot'}</b><small>{new Date(snapshot.createdAt).toLocaleString()} · {snapshot.tradeCount} trades · {bytes(snapshot.size)}</small></span><div className="js2-ac"><button type="button" className="js2-bn" onClick={() => setPending(snapshot)}>Restore</button></div></div>)}</div> : <div className="js2-em">No snapshots yet.</div>}
      {pending && <div className="js2-nt is-loss"><AlertTriangle size={16}/><p>Restore this snapshot? A safety snapshot of your current journal will be saved first.</p><button type="button" className="js2-bn" onClick={() => setPending(null)}>Cancel</button><button type="button" className="js2-bn is-dg" onClick={() => { onRestoreSnapshot?.(pending.id); setPending(null); }}>Restore snapshot</button></div>}
    </div>}
  </>;
}

export default function DesktopJournalSetup({ section, onSection, userId, account, certificates = [], typeTags = [], mistakeTags = [], mistakeDefaults = [], confluenceSessions = [], instruments = [], riskPresets = [], onRiskPresets, onTypeTags, onMistakes, onConfluence, onInstruments, onAddRule, onUpdateRule, onRemoveRule, onExportBackup, onImportBackup, snapshots, onRestoreSnapshot, protectedStorage, localOnly, routine, onUpdateRoutine }) {
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const toastTimer = useRef(null);
  const toast = (text) => { setMessage(text); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setMessage(''), 1900); };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const run = async (task) => { setPending((count) => count + 1); setError(''); try { await task(); return true; } catch (problem) { setError(problem?.message || 'Could not save that change.'); return false; } finally { setPending((count) => count - 1); } };
  const saveWith = (handler) => (value) => { void run(() => handler?.(value)); };
  const isMistakeDefault = (item) => mistakeDefaults.some((fixed) => lower(fixed) === lower(item));
  const customMistakes = mistakeTags.filter((item) => !isMistakeDefault(item));
  const allInstruments = [...DEFAULT_INSTRUMENTS, ...instruments.map(symbolOf).filter((symbol) => symbol && !DEFAULT_INSTRUMENTS.some((item) => sameInstrument(item, symbol)))];
  const rules = account?.rules || [];
  const counts = { 'daily-routine': activeRoutineItems(routine).length, rules: rules.length, 'risk-presets': riskPresets.length, instruments: allInstruments.length, mistakes: mistakeDefaults.length + customMistakes.length, confluences: typeTags.length, entries: confluenceSessions.length, certificates: certificates.length, mappings: section === 'mappings' ? null : readMappings(userId).length, backup: null };
  const stringList = (items, handler) => ({ items: items.map((item) => ({ id: item, label: item })), onAdd: (text) => saveWith(handler)([...items, text]), onRename: (id, text) => saveWith(handler)(items.map((item) => item === id ? text : item)), onDelete: (id) => saveWith(handler)(items.filter((item) => item !== id)) });
  const body = section === 'daily-routine' ? <RoutineSection routine={routine} onUpdate={onUpdateRoutine} run={run} toast={toast}/>
    : section === 'instruments' ? <InstrumentSection instruments={instruments} onSave={saveWith(onInstruments)} toast={toast}/>
    : section === 'risk-presets' ? <RiskSection presets={riskPresets} onSave={saveWith(onRiskPresets)} toast={toast}/>
    : section === 'mappings' ? <MappingSection userId={userId} instruments={allInstruments} toast={toast}/>
    : section === 'certificates' ? <CertificateArchive certificates={certificates} currency={account?.baseCurrency}/>
    : section === 'backup' ? <BackupSection onExportBackup={onExportBackup} onImportBackup={onImportBackup} snapshots={snapshots} onRestoreSnapshot={onRestoreSnapshot} protectedStorage={protectedStorage} localOnly={localOnly}/>
    : section === 'mistakes' ? <ListSection id="mistakes" title="Mistake management" one="mistake" many="mistakes" grid placeholder="Add a mistake…" desc="Mistakes you can tag on a trade when reviewing it. Presets are built in and cannot be removed." toast={toast} items={[...mistakeDefaults.map((item) => ({ id: item, label: item, locked: true, tag: 'Preset' })), ...customMistakes.map((item) => ({ id: item, label: item }))]} onAdd={(text) => saveWith(onMistakes)([...customMistakes, text])} onRename={(id, text) => saveWith(onMistakes)(customMistakes.map((item) => item === id ? text : item))} onDelete={(id) => saveWith(onMistakes)(customMistakes.filter((item) => item !== id))}/>
    : section === 'confluences' ? <ListSection id="confluences" title="Confluences" one="confluence" many="confluences" grid placeholder="Add a confluence…" desc="The reasons that line up behind an entry. Tag them when you log a trade." toast={toast} {...stringList(typeTags, onTypeTags)}/>
    : section === 'entries' ? <ListSection id="entries" title="Entry types" one="entry type" many="entry types" placeholder="Add an entry type…" desc="How you got into the trade, such as with or against the trend." toast={toast} {...stringList(confluenceSessions, onConfluence)}/>
    : <ListSection id="rules" title="Trading rules" one="trading rule" many="trading rules" placeholder="Add a trading rule…" desc="Your rules. Link them to a trade or a test to measure how often you follow them." toast={toast} items={rules.map((rule) => ({ id: rule.id, label: rule.text }))} onAdd={(text) => void run(() => onAddRule(text))} onRename={(id, text) => void run(() => onUpdateRule(id, text))} onDelete={(id) => void run(() => onRemoveRule(id))}/>;
  return <div className="js2">
    <section className="js2-hd"><div><span className="js2-eb">Setup</span><h1>Journal Setup</h1><p>Customize your trading workflow, rules, and journal preferences.</p></div><span className={`js2-sv ${pending ? 'is-saving' : ''} ${error ? 'is-err' : ''}`} role="status" aria-live="polite">{pending ? <><i/>Saving…</> : error ? <><AlertTriangle size={13}/>{error}</> : <><Check size={13}/>All changes saved</>}</span></section>
    <div className="js2-wr">
      <nav className="js2-card js2-nv" aria-label="Journal Setup sections">{SECTIONS.map(([group, list]) => <div className="js2-ng" key={group}><small>{group}</small>{list.map(([id, label, Icon]) => <button type="button" key={id} className={section === id ? 'is-on' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => onSection(id)}><span><Icon size={17}/></span>{label}{counts[id] != null && <em>{counts[id]}</em>}</button>)}</div>)}</nav>
      <section className="js2-card js2-pn" key={section}>{body}</section>
    </div>
    <div className={`js2-toast ${message ? 'is-on' : ''}`} role="status" aria-live="polite">{message}</div>
  </div>;
}
