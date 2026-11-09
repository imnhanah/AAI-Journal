import React, {useEffect, useRef, useState} from 'react';
import {AlertTriangle, ChevronRight, Layers, Plus, Scale, Search, ShieldCheck, TrendingUp, X} from 'lucide-react';
import {ConfirmDeleteButton} from './JournalControls';
import {Popup, TextField} from './MobileAccountSettings';
import {phoneScrollTarget, scrollPhoneTo} from './phoneScroll.js';
import './mobileProfileSettings.css';
import './mobileDailyRoutine.css';
import './mobileSetupLists.css';

const KINDS = {
  mistake:{name:'Mistakes', one:'mistake', tone:'is-mistake', Glyph:AlertTriangle, placeholder:'e.g. Chased the move', note:'Tag these on a trade to see which habits cost you most.'},
  confluence:{name:'Confluences', one:'confluence', tone:'is-accent', Glyph:Layers, placeholder:'e.g. HTF Bullish Trend', note:'Reasons that line up before you enter.'},
  'entry type':{name:'Entry types', one:'entry type', tone:'is-entry', Glyph:TrendingUp, placeholder:'e.g. Pro Trend', note:'How the trade relates to the higher-timeframe trend.'},
  rule:{name:'Trading rules', one:'trading rule', tone:'is-rule', Glyph:ShieldCheck, placeholder:'Write the rule in full', note:'Your own rules, shown when you log and evaluate a trade.', numbered:true},
};
const PREVIEW_ROWS = 9;
const RISK_CHOICES = [0.25, 0.5, 1, 2];
const CARD_TONES = ['is-accent', 'is-entry', 'is-amber'];
const plural = (count, one) => `${count} ${one}${count === 1 ? '' : 's'}`;

function useToast() {
  const [text, setText] = useState(''), timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = message => { setText(message); clearTimeout(timer.current); timer.current = setTimeout(() => setText(''), 1600); };
  return [text, show];
}

const Hero = ({Glyph, count, text}) => <section className="tj-ml-hero"><span><Glyph size={22} aria-hidden="true"/></span><div><b>{count}</b><p>{text}</p></div></section>;

const Fab = ({label, onClick}) => <button type="button" className="tj-ml-fab" onClick={onClick}><Plus size={22} aria-hidden="true"/>{label}</button>;

function ItemSheet({kind, row, initial, rows, onClose, onSubmit, onDelete}) {
  const editing = !!row;
  const [value, setValue] = useState(row?.label ?? initial ?? '');
  const text = value.trim();
  const duplicate = rows.some(item => item.id !== row?.id && item.label.toLowerCase() === text.toLowerCase());
  const label = kind.numbered ? 'Rule' : 'Name';
  return <Popup title={`${editing ? 'Edit' : 'Add'} ${kind.one}`} hint={editing ? 'Past trades keep the name they were logged with.' : 'Appears wherever you log a trade.'} onClose={onClose} dirty={value !== (row?.label ?? initial ?? '')} footer={<>
    <button type="button" disabled={!text || duplicate} onClick={() => onSubmit(text)}>{editing ? 'Save changes' : `Add ${kind.one}`}</button>
    {editing && <ConfirmDeleteButton className="tj-mr-delete" title={`Delete ${row.label}`} onClick={onDelete}>{`Delete ${kind.one}`}</ConfirmDeleteButton>}
  </>}>
    {kind.numbered
      ? <label className="tj-ma-field"><span>{label}</span><span className="tj-ma-input"><textarea value={value} placeholder={kind.placeholder} onChange={event => setValue(event.target.value)}/></span></label>
      : <TextField label={label} value={value} placeholder={kind.placeholder} autoComplete="off" onChange={event => setValue(event.target.value)}/>}
    {duplicate && <p className="tj-mp-status is-error" role="alert">This {kind.one} is already in your list.</p>}
  </Popup>;
}

// Mistakes, Confluences, Entry types and Trading rules. The parent keeps saving as it always has.
export function MobileSetupList({type, rows, emptyNote, onAdd, onRename, onDelete}) {
  const kind = KINDS[type];
  const [search, setSearch] = useState(''), [expanded, setExpanded] = useState(false), [sheet, setSheet] = useState(null);
  const [toast, showToast] = useToast();
  const root = useRef(null);
  const query = search.trim().toLowerCase();
  const matches = rows.map((row, index) => ({...row, number:index + 1})).filter(row => row.label.toLowerCase().includes(query));
  const shown = query || expanded || kind.numbered ? matches : matches.slice(0, PREVIEW_ROWS);

  const submit = async text => {
    if (sheet.row) { await onRename(sheet.row.id, text); setSheet(null); showToast('Saved'); return; }
    await onAdd(text);
    setSheet(null); setSearch(''); setExpanded(true); showToast('Added');
    requestAnimationFrame(() => { const scroller=phoneScrollTarget(root.current); scrollPhoneTo(root.current,{top:scroller?.scrollHeight,behavior:'smooth'}); });
  };
  const remove = async () => { await onDelete(sheet.row.id); setSheet(null); showToast('Deleted'); };

  return <section className={`tj-ml ${kind.tone}`} ref={root}>
    <Hero Glyph={kind.Glyph} count={rows.length} text={`${rows.length === 1 ? kind.one : `${kind.one}s`} · ${kind.note}`}/>
    <label className="tj-ml-search">
      <Search size={20} aria-hidden="true"/>
      <input aria-label={`Search ${kind.name.toLowerCase()}`} placeholder={`Search ${kind.name.toLowerCase()}`} autoComplete="off" value={search} onChange={event => setSearch(event.target.value)}/>
      {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><b><X size={12}/></b></button>}
    </label>

    {shown.length > 0
      ? <div className="tj-ml-list">{shown.map(row => {
          const inner = <><span className="tj-ml-dot">{kind.numbered ? row.number : <kind.Glyph size={16} aria-hidden="true"/>}</span><strong>{row.label}</strong>{row.locked ? <em>{row.tag}</em> : <ChevronRight className="tj-ml-chev" size={16} aria-hidden="true"/>}</>;
          return row.locked
            ? <div className="tj-ml-item" key={row.id}>{inner}</div>
            : <button type="button" className="tj-ml-item" key={row.id} aria-haspopup="dialog" onClick={() => setSheet({row})}>{inner}</button>;
        })}</div>
      : <div className="tj-ml-empty">
          <b>{query ? `No match for “${search.trim()}”` : `No ${kind.one}s yet`}</b>
          <p>{query ? 'Not in your list yet.' : emptyNote}</p>
          <button type="button" onClick={() => setSheet({initial:search.trim()})}>{query ? `Add “${search.trim()}”` : `Add ${kind.one}`}</button>
        </div>}
    {matches.length > shown.length && <button type="button" className="tj-ml-more" onClick={() => setExpanded(true)}>Show {matches.length - shown.length} more</button>}

    <Fab label="Add" onClick={() => setSheet({})}/>
    {toast && <div className="tj-ml-toast" role="status">{toast}</div>}
    {sheet && <ItemSheet kind={kind} row={sheet.row} initial={sheet.initial} rows={rows} onClose={() => setSheet(null)} onSubmit={submit} onDelete={remove}/>}
  </section>;
}

function PresetSheet({preset, presets, onClose, onSubmit, onDelete}) {
  const editing = !!preset;
  const [name, setName] = useState(preset?.name || ''), [risk, setRisk] = useState(String(preset?.risk ?? '1')), [rr, setRr] = useState(String(preset?.rr ?? '2'));
  const text = name.trim();
  const duplicate = presets.some(item => item !== preset && item.name.toLowerCase() === text.toLowerCase());
  const ready = text && !duplicate && Number(risk) > 0 && Number(rr) > 0;
  return <Popup title={editing ? 'Edit preset' : 'New preset'} hint="Quick risk and reward choices when logging a trade." onClose={onClose} dirty={name !== (preset?.name || '') || risk !== String(preset?.risk ?? '1') || rr !== String(preset?.rr ?? '2')} footer={<>
    <button type="button" disabled={!ready} onClick={() => onSubmit({name:text, risk:String(Number(risk)), rr:String(Number(rr))})}>{editing ? 'Save changes' : 'Add preset'}</button>
    {editing && <ConfirmDeleteButton className="tj-mr-delete" title={`Delete ${preset.name}`} onClick={onDelete}>Delete preset</ConfirmDeleteButton>}
  </>}>
    <TextField label="Preset name" value={name} placeholder="e.g. Standard" autoComplete="off" onChange={event => setName(event.target.value)}/>
    <div className="tj-ma-field"><span>Risk per trade</span><div className="tj-ml-chips" role="group" aria-label="Risk per trade">{RISK_CHOICES.map(choice => <button type="button" key={choice} aria-pressed={Number(risk) === choice} onClick={() => setRisk(String(choice))}>{choice}%</button>)}</div></div>
    <div className="tj-ml-two">
      <TextField label="Custom risk" suffix="%" inputMode="decimal" value={risk} onChange={event => setRisk(event.target.value)}/>
      <TextField label="Target" suffix="R" inputMode="decimal" value={rr} onChange={event => setRr(event.target.value)}/>
    </div>
    {duplicate && <p className="tj-mp-status is-error" role="alert">A preset with this name already exists.</p>}
  </Popup>;
}

export function MobileRiskPresets({presets, onSave}) {
  const [sheet, setSheet] = useState(null); // null, 'new', or the index being edited
  const [toast, showToast] = useToast();
  const editing = typeof sheet === 'number' ? presets[sheet] : null;
  const submit = change => {
    onSave(editing ? presets.map((item, index) => index === sheet ? {...item, ...change} : item) : [...presets, change]);
    setSheet(null); showToast(editing ? 'Saved' : 'Preset added');
  };
  const remove = () => { onSave(presets.filter((_, index) => index !== sheet)); setSheet(null); showToast('Preset deleted'); };

  return <section className="tj-ml is-accent">
    <Hero Glyph={Scale} count={presets.length} text={`${presets.length === 1 ? 'preset' : 'presets'} · quick risk and reward choices when logging a trade`}/>
    {presets.length === 0 && <div className="tj-ml-empty"><b>No presets yet</b><p>Add one to pick your risk faster when logging a trade.</p></div>}
    {presets.map((preset, index) => <button type="button" key={preset.name} className={`tj-ml-preset ${CARD_TONES[index % CARD_TONES.length]}`} aria-haspopup="dialog" onClick={() => setSheet(index)}>
      <span className="tj-ml-preset-top"><strong>{preset.name}</strong><ChevronRight className="tj-ml-chev" size={16} aria-hidden="true"/></span>
      <span className="tj-ml-nums"><span className="is-risk"><small>Risk</small><b>{preset.risk}%</b></span><span className="is-target"><small>Target</small><b>{preset.rr}R</b></span></span>
      <span className="tj-ml-bar" aria-hidden="true"><i/><i style={{flex:Number(preset.rr) || 1}}/></span>
      <span className="tj-ml-preset-note">Risk {preset.risk}% to make {+(Number(preset.risk) * Number(preset.rr)).toFixed(2)}%</span>
    </button>)}
    <p className="tj-ml-device">Saved on this device.</p>
    <Fab label="New preset" onClick={() => setSheet('new')}/>
    {toast && <div className="tj-ml-toast" role="status">{toast}</div>}
    {(sheet === 'new' || editing) && <PresetSheet preset={editing} presets={presets} onClose={() => setSheet(null)} onSubmit={submit} onDelete={remove}/>}
  </section>;
}
