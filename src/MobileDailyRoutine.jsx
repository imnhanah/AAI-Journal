import React, {useEffect, useRef, useState} from 'react';
import {AlertTriangle, Check, ChevronDown, ChevronUp, Info, Minus, Plus, X} from 'lucide-react';
import {Popup, TextField} from './MobileAccountSettings';
import BackButton from './BackButton.jsx';
import {activeRoutineItems, addRoutineItem, deleteRoutineItem, reorderRoutine, restoreRoutineItems, routineItems, routineWeekStats, updateRoutineItem} from './dailyRoutine.js';
import './mobileProfileSettings.css';
import './mobileDailyRoutine.css';

const GROUPS = [['before', 'Before the chart'], ['pretrade', 'Pre-trade']];
const groupName = group => GROUPS.find(([value]) => value === group)?.[1];
const DAY_ICONS = {full:Check, partial:Minus, missed:X};

function Switch({label, on, disabled, onChange}) {
  return <button type="button" className="tj-ma-switch" role="switch" aria-label={label} aria-checked={on} disabled={disabled} onClick={onChange}><i aria-hidden="true"/></button>;
}

function Week({stats}) {
  return <div className="tj-mr-week" role="list" aria-label="This trading week, Monday through Friday">{stats.tradingWeek.map(day => {
    const saved = stats.completionState(day.key);
    // A day that is still open has not been missed yet.
    const state = day.today && saved === 'missed' ? 'today' : saved;
    const Glyph = DAY_ICONS[state];
    const name = new Date(`${day.key}T12:00:00Z`).toLocaleDateString(undefined, {weekday:'narrow', timeZone:'UTC'});
    return <div key={day.key} role="listitem" className={day.today ? 'is-today' : ''} aria-label={`${day.key}: ${state}`}><span className={`is-${state}`}>{Glyph && <Glyph size={18} strokeWidth={2.4} aria-hidden="true"/>}</span>{name}</div>;
  })}</div>;
}

function ItemSheet({item, busy, error, onClose, onSubmit, onDelete}) {
  const editing = !!item;
  const [label, setLabel] = useState(item?.label || '');
  const [group, setGroup] = useState(item?.group || 'before');
  const [enabled, setEnabled] = useState(item ? item.enabled !== false : true);
  const submit = () => onSubmit(editing ? {label:label.trim(), group, enabled} : {label:label.trim(), group});
  return <Popup title={editing ? 'Edit item' : 'New routine item'} hint={editing ? 'Changes apply to every workspace.' : 'Shows in every workspace.'} onClose={onClose} dirty={label !== (item?.label || '') || group !== (item?.group || 'before') || enabled !== (item ? item.enabled !== false : true)} footer={<>
    <button type="button" disabled={busy || !label.trim()} onClick={submit}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add item'}</button>
    {editing && <button type="button" className="tj-mr-delete" disabled={busy} onClick={onDelete}>Delete item</button>}
  </>}>
    <TextField label="Item" value={label} maxLength={160} placeholder="e.g. Checked the calendar" autoComplete="off" onChange={event => setLabel(event.target.value)}/>
    <div className="tj-ma-field"><span>When it appears</span><div className="tj-mr-chips" role="radiogroup" aria-label="When it appears">{GROUPS.map(([value, text]) => <button type="button" key={value} role="radio" aria-checked={group === value} className={value === 'pretrade' ? 'is-pre' : ''} onClick={() => setGroup(value)}>{text}</button>)}</div></div>
    {editing && <div className="tj-mr-on"><span>On</span><Switch label="Item on" on={enabled} onChange={() => setEnabled(value => !value)}/></div>}
    {error && <p className="tj-mp-status is-error" role="alert">{error}</p>}
  </Popup>;
}

export default function MobileDailyRoutine({routine, onUpdate, summaryRef}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [toast, setToast] = useState('');
  const [tab, setTab] = useState('all'), [reordering, setReordering] = useState(false);
  const [sheet, setSheet] = useState(null); // null, 'new', or the id of the item being edited
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const items = routineItems(routine);
  const activeCount = activeRoutineItems(routine).length;
  const stats = routineWeekStats(routine);
  const on = routine.enabled;
  const percent = stats.todayTotal ? Math.round(stats.todayDone / stats.todayTotal * 100) : 0;
  const hasInsight = stats.historicalRows.length && stats.mostMissed?.missed;
  const count = value => value === 'all' ? items.length : items.filter(item => item.group === value).length;
  const editingItem = sheet && sheet !== 'new' ? items.find(item => item.id === sheet) : null;

  const save = async (change, message) => {
    setBusy(true); setError('');
    try {
      await onUpdate(change);
      if (message) { setToast(message); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 1600); }
      return true;
    } catch (reason) { setError(reason.message || 'Your routine could not be saved.'); return false; } finally { setBusy(false); }
  };
  const closeSheet = () => { setSheet(null); setError(''); };
  const submitSheet = async change => {
    const saved = editingItem ? await save(r => updateRoutineItem(r, editingItem, change), 'Saved') : await save(r => addRoutineItem(r, change), 'Item added');
    if (saved) setSheet(null);
  };
  const removeItem = async () => { if (await save(r => deleteRoutineItem(r, editingItem), 'Item deleted')) setSheet(null); };
  // Moving down is the next item moving up: reorderRoutine places an item before its target.
  const move = (index, step) => {
    const item = items[index], other = items[index + step];
    return save(r => step < 0 ? reorderRoutine(r, item.id, other.id) : reorderRoutine(r, other.id, item.id));
  };
  const toggleReorder = () => { setReordering(value => !value); setTab('all'); };

  return <div className="tj-ma tj-mp tj-mr">
    <div className="tj-ma-scroll">
      <header className="tj-ma-head" ref={summaryRef}><div className="tj-mr-title">
        <BackButton/>
        <div><h1>Daily routine</h1><small>{activeCount} on · same in every workspace</small></div>
        <Switch label="Daily routine" on={on} disabled={busy} onChange={() => save(r => ({...r, enabled:!r.enabled}), on ? 'Daily routine off' : 'Daily routine on')}/>
      </div></header>
      {error && !sheet && <p className="tj-mp-status is-error" role="alert">{error}</p>}

      <div className={on ? '' : 'tj-mr-off'} inert={on ? undefined : ''}>
        <section className="tj-mr-hero" aria-label="Routine progress">
          <div className="tj-mr-top">
            <div><small>Routine progress</small><h2>Today's routine</h2><p>{stats.todayCompletion ? 'Saved for today' : 'Not started yet'}</p></div>
            <div className="tj-mr-ring" style={{'--ring':`${percent}%`}} role="img" aria-label={`${stats.todayDone} of ${stats.todayTotal} done today`}><i><b>{stats.todayDone}</b><span>of {stats.todayTotal}</span></i></div>
          </div>
          <div className="tj-mr-stats">
            <div><small>Current streak</small><b>{stats.history.streak}</b><span>days</span></div>
            <div><small>This week</small><b>{stats.completedThisWeek}</b><span>/{stats.recentTradingDays.length} full</span></div>
          </div>
          <Week stats={stats}/>
          <div className="tj-mr-legend"><span><i className="is-full"/>Full</span><span><i className="is-partial"/>Partial</span><span><i className="is-missed"/>Missed</span></div>
        </section>

        <div className="tj-mr-attn">
          <span><AlertTriangle size={20} aria-hidden="true"/></span>
          <div><small>Needs attention</small><strong>{hasInsight ? stats.mostMissed.label : 'Complete today to start your insight'}</strong><p>{hasInsight ? `${stats.mostMissed.missed} missed check${stats.mostMissed.missed === 1 ? '' : 's'} across saved routines.` : 'Your weekly consistency and missed-item trends will build here.'}</p></div>
        </div>
        <div className="tj-mr-note"><Info size={18} aria-hidden="true"/><span>Opens before your <b>first markup or trade of the day</b> and comes back when the <b>Tokyo session opens</b>. Items show in the order below.</span></div>

        <div className="tj-mr-sech">
          <div><h3>Checklist</h3><small>{items.length} items · {items.filter(item => item.enabled !== false).length} on</small></div>
          <button type="button" aria-pressed={reordering} onClick={toggleReorder}><span>{reordering ? 'Done' : 'Reorder'}</span></button>
        </div>
        <div className="tj-mr-tabs" role="group" aria-label="Show routine items" data-scroll-row="true">{[['all', 'All'], ...GROUPS].map(([value, text]) => <button type="button" key={value} aria-pressed={tab === value} disabled={reordering && value !== 'all'} onClick={() => setTab(value)}><span>{text}<i>{count(value)}</i></span></button>)}</div>

        {items.some(item => tab === 'all' || item.group === tab)
          ? <div className="tj-mr-list">{items.map((item, index) => tab !== 'all' && item.group !== tab ? null : <div key={item.id} className={`tj-mr-item ${item.group === 'pretrade' ? 'is-pre' : ''} ${item.enabled === false ? 'is-disabled' : ''}`}>
              <span className="tj-mr-num">{index + 1}</span>
              <button type="button" className="tj-mr-txt" aria-haspopup="dialog" disabled={reordering} aria-label={`Edit ${item.label}`} onClick={() => setSheet(item.id)}><strong>{item.label}</strong><small>{groupName(item.group)}</small></button>
              {reordering
                ? <span className="tj-mr-move">
                    <button type="button" aria-label={`Move ${item.label} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}><b><ChevronUp size={16}/></b></button>
                    <button type="button" aria-label={`Move ${item.label} down`} disabled={busy || index === items.length - 1} onClick={() => move(index, 1)}><b><ChevronDown size={16}/></b></button>
                  </span>
                : <Switch label={item.label} on={item.enabled !== false} disabled={busy} onChange={() => save(r => updateRoutineItem(r, item, {enabled:item.enabled === false}))}/>}
            </div>)}</div>
          : <p className="tj-mr-empty">Nothing here yet. Add an item to start this list.</p>}
        <button type="button" className="tj-mr-restore" disabled={busy} onClick={() => save(restoreRoutineItems, 'Recommended items restored')}>Restore recommended items</button>
      </div>
    </div>

    {on && <button type="button" className="tj-mr-fab" onClick={() => setSheet('new')}><Plus size={22} aria-hidden="true"/>Add item</button>}
    {toast && <div className="tj-mr-toast" role="status">{toast}</div>}
    {(sheet === 'new' || editingItem) && <ItemSheet item={editingItem} busy={busy} error={error} onClose={closeSheet} onSubmit={submitSheet} onDelete={removeItem}/>}
  </div>;
}
