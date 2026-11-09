import React, {useEffect, useRef, useState} from 'react';
import {Activity, ArrowUpRight, BarChart2, Check, ChevronDown, Heart, Moon, Newspaper, ShieldCheck, Target, Utensils, VolumeX, WalletCards, Wind, X} from 'lucide-react';
import {activeRoutineItems, REQUIRE_ALL, routineDayKey, routineProgress} from './dailyRoutine';
import {getCalendarWindow} from './forexFactory';
import {archivedNewsEvents} from './newsArchive';
import {getBackNavigation, useNavStep} from './useBackNavigation.js';
import {useLeaveGuard} from './useLeaveGuard.js';
import './mobileProfileSettings.css';
import './mobileStartDay.css';

const ICONS = {slept_enough:Moon, ate_water:Utensils, moved:Activity, quiet_minute:Wind, phone_desk:VolumeX, review_plan_goals:Target, looked_chart:BarChart2, read_news:Newspaper, checked_accounts:WalletCards, reviewed_rules:ShieldCheck, accepted_risk:Heart};
const GROUPS = [['before', 'Before the chart'], ['pretrade', 'Pre-trade checks']];

function NewsPanel({news, now, busy, onNews}) {
  const today = news.events.filter(event => routineDayKey(new Date(event.isoDate)) === routineDayKey(now) && event.impact === 'high');
  const next = today.find(event => Date.parse(event.isoDate) > now.getTime());
  const text = news.loading ? 'Loading news…' : !news.available ? 'News unavailable right now.' : `${today.length} high-impact today. ${next ? `Next at ${new Date(next.isoDate).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}.` : 'No more events today.'}`;
  return <>{text}<br/><button type="button" className="tj-sd-go" disabled={busy} onClick={onNews}>Open News<ArrowUpRight size={14} aria-hidden="true"/></button></>;
}

function AccountsPanel({summary, busy, onGuardrails}) {
  return <>
    <div className="tj-sd-chips"><span>{summary.name} · {summary.balance}</span><span>{summary.cap}</span>{summary.level != null && <span>Level {summary.level}</span>}</div>
    <button type="button" className="tj-sd-go" disabled={busy} onClick={onGuardrails}>Guardrails<ArrowUpRight size={14} aria-hidden="true"/></button>
  </>;
}

export default function MobileStartDay({entryKind = 'markup', routine, accountSummary, onSave, onSaveTicks, onClose, onNews, onGuardrails, continueOnly = false, saveAndOpenMarkup = false}) {
  useNavStep('start-day', true, onClose);
  const [now] = useState(() => new Date());
  const items = activeRoutineItems(routine), activeIds = new Set(items.map(item => item.id));
  const [ticked, setTicked] = useState(() => routineProgress(routine, now).tickedIds);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [shut, setShut] = useState({}), [open, setOpen] = useState({});
  const [news, setNews] = useState({events:[], loading:true, available:false});
  const dialog = useRef(null), dragStart = useRef(null), savedIds = useRef(ticked);

  const checked = ticked.filter(id => activeIds.has(id));
  const saved = savedIds.current.filter(id => activeIds.has(id));
  const changed = checked.length !== saved.length || checked.some(id => !saved.includes(id));
  useLeaveGuard(changed && !busy, 'start-day');
  // Hardware back and the bottom bar are asked by the guard; every exit on this screen comes through here.
  const leaveThen = async action => { if (!busy && await getBackNavigation().confirmLeave()) action(); };
  // News and Guardrails are part of working through the list, so going to them keeps the ticks instead of asking.
  const saveThen = async action => {
    if (busy) return;
    if (!changed) { action(); return; }
    setBusy(true); setError('');
    try { await onSaveTicks(checked); action(); } catch (reason) { setError(reason.message || 'Your checklist could not be saved.'); setBusy(false); }
  };
  const done = items.length > 0 && checked.length === items.length;
  const percent = items.length ? Math.round(checked.length / items.length * 100) : 0;
  const opensEntry = saveAndOpenMarkup || !continueOnly;
  const label = busy ? 'Saving…' : opensEntry ? (entryKind === 'trade' && !saveAndOpenMarkup ? 'Save & open trade' : 'Save & open markup') : done ? 'Finish Start day' : 'Save progress';

  useEffect(() => {
    let alive = true;
    getCalendarWindow().then(result => { if (alive) setNews({events:archivedNewsEvents(result.archive), loading:false, available:result.results.some(row => Array.isArray(row.events))}); }).catch(() => { if (alive) setNews({events:[], loading:false, available:false}); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const prior = document.activeElement, overlay = dialog.current?.parentElement;
    const siblings = [...(overlay?.parentElement?.children || [])].filter(node => node !== overlay);
    const states = siblings.map(node => [node, node.inert]);
    siblings.forEach(node => { node.inert = true; });
    dialog.current?.focus();
    return () => { states.forEach(([node, inert]) => { node.inert = inert; }); if (prior?.isConnected) prior.focus(); };
  }, []);

  const toggle = id => { if (!busy) setTicked(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]); };
  const save = async () => { setBusy(true); setError(''); try { await onSave(checked); } catch (reason) { setError(reason.message || 'Your checklist could not be saved.'); setBusy(false); } };
  const keydown = event => {
    if (event.key === 'Escape') { event.stopPropagation(); leaveThen(onClose); }
    if (event.key === 'Tab') {
      const nodes = [...dialog.current.querySelectorAll('button:not(:disabled)')].filter(node => node.getClientRects().length), first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };

  return <div className="tj-sd-overlay">
    <section ref={dialog} tabIndex={-1} className="tj-sd" role="dialog" aria-modal="true" aria-labelledby="start-day-title" onKeyDown={keydown}>
      <header className="tj-sd-top">
        <button type="button" className="tj-sd-grab" aria-label="Close Start day" disabled={busy} onClick={() => leaveThen(onClose)} onTouchStart={event => { dragStart.current = event.touches[0].clientY; }} onTouchEnd={event => { if (dragStart.current !== null && event.changedTouches[0].clientY - dragStart.current > 60) leaveThen(onClose); dragStart.current = null; }}><i aria-hidden="true"/></button>
        <div className="tj-sd-head">
          <div className="tj-sd-ring" role="img" aria-label={`${checked.length} of ${items.length} routine items ticked`} style={{'--ring':`${percent}%`}}><i>{checked.length}/{items.length}</i></div>
          <div className="tj-sd-title"><h2 id="start-day-title">Start day</h2><p>{done ? 'All set. You can open the chart.' : 'Run these before you open the chart'}</p></div>
          <button type="button" className="tj-sd-close" aria-label="Close Start day" disabled={busy} onClick={() => leaveThen(onClose)}><span><X size={20}/></span></button>
        </div>
      </header>

      <div className="tj-sd-body">{GROUPS.map(([group, title]) => {
        const rows = items.filter(item => item.group === group);
        if (!rows.length) return null;
        const count = rows.filter(item => checked.includes(item.id)).length, closed = !!shut[group];
        return <section key={group} className={`tj-sd-sec ${group === 'pretrade' ? 'is-pre' : ''}`}>
          <button type="button" className="tj-sd-sec-head" aria-expanded={!closed} onClick={() => setShut(value => ({...value, [group]:!closed}))}>
            <span className="tj-sd-sec-name"><strong>{title}</strong><span className="tj-sd-bar" aria-hidden="true">{rows.map(item => <i key={item.id} className={checked.includes(item.id) ? 'is-done' : ''}/>)}</span></span>
            <span className={`tj-sd-count ${count === rows.length ? 'is-full' : ''}`}>{count}/{rows.length}</span>
            <ChevronDown className={`tj-sd-chev ${closed ? 'is-shut' : ''}`} size={18} aria-hidden="true"/>
          </button>
          {!closed && <div className="tj-sd-items">{rows.map(item => {
            const Icon = ICONS[item.id] || Heart, isOn = checked.includes(item.id), panel = item.id === 'read_news' || item.id === 'checked_accounts', expanded = !!open[item.id];
            return <div key={item.id} className={`tj-sd-item ${isOn ? 'is-on' : ''}`}>
              <div className="tj-sd-row" onClick={() => toggle(item.id)}>
                <button type="button" className="tj-sd-tick" role="checkbox" aria-checked={isOn} disabled={busy}><span className="tj-sd-icon"><Icon size={18} aria-hidden="true"/></span><strong>{item.label}</strong></button>
                {panel && <button type="button" className="tj-sd-expand" aria-label={`${expanded ? 'Hide' : 'Show'} ${item.label} details`} aria-expanded={expanded} disabled={busy} onClick={event => { event.stopPropagation(); setOpen(value => ({...value, [item.id]:!expanded})); }}><ChevronDown className={expanded ? 'is-open' : ''} size={16} aria-hidden="true"/></button>}
                <span className="tj-sd-check" aria-hidden="true"><Check size={15} strokeWidth={3}/></span>
              </div>
              {panel && expanded && <div className="tj-sd-panel">{item.id === 'read_news' ? <NewsPanel news={news} now={now} busy={busy} onNews={() => saveThen(onNews)}/> : <AccountsPanel summary={accountSummary} busy={busy} onGuardrails={() => saveThen(onGuardrails)}/>}</div>}
            </div>;
          })}</div>}
        </section>;
      })}</div>

      <footer className="tj-sd-foot">
        {error && <p role="alert">{error}</p>}
        <button type="button" className={done ? 'is-ready' : ''} disabled={busy || (REQUIRE_ALL && !done)} onClick={save}>{label}</button>
      </footer>
    </section>
  </div>;
}
