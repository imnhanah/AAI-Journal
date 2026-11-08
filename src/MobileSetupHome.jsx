import React, {useState} from 'react';
import {AlertTriangle, ArrowLeftRight, ChevronRight, Database, Gauge, Layers, ListChecks, Sun, Target, TrendingUp} from 'lucide-react';
import {activeRoutineItems, routineWeekStats} from './dailyRoutine.js';
import './mobileSetup.css';

const ROWS = {
  instruments:['is-blue',TrendingUp,'Pairs, metals, indices, crypto'],
  mistakes:['is-red',AlertTriangle,'Tag where execution drifts'],
  confluences:['is-purple',Layers,'Reasons a setup is valid'],
  entries:['is-amber',Target,'How you enter the market'],
  rules:['is-slate',ListChecks,'Rules you grade each trade against'],
  'risk-presets':['is-amber',Gauge,'Quick risk and R:R choices for logging'],
  mappings:['is-slate',ArrowLeftRight,'Match broker names to your instruments'],
  backup:['is-green',Database,'Save or restore a copy of your journal'],
};
const GROUPS = [['Your lists',['instruments','mistakes','confluences','entries','rules']],['Risk',['risk-presets']],['Data',['mappings','backup']]];

function Row({tone,Icon,label,note,count,onClick}) {
  return <button type="button" className={`tj-setup-row ${tone}`} onClick={onClick}><i aria-hidden="true"><Icon size={21}/></i><span><b>{label}</b><small>{note}</small></span>{count !== '' && <em>{count}</em>}<ChevronRight size={16} aria-hidden="true"/></button>;
}

export default function MobileSetupHome({routine,onUpdateRoutine,lists,onChoose}) {
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const on = routine.enabled, active = activeRoutineItems(routine).length, stats = routineWeekStats(routine), byId = Object.fromEntries(lists.map(([id,label,count]) => [id,{label,count}]));
  const toggle = async () => { setBusy(true); setError(''); try { await onUpdateRoutine(r=>({...r,enabled:!r.enabled})); } catch (reason) { setError(reason.message || 'Could not change the routine.'); } finally { setBusy(false); } };
  return <div className="tj-setup-home">
    <section className="tj-setup-glance"><header><div><small>Daily routine</small><h2>{on ? 'Routine is on' : 'Routine is off'}</h2></div><button type="button" className="tj-setup-switch" role="switch" aria-checked={on} aria-label="Daily routine on or off" disabled={busy} onClick={toggle}><i aria-hidden="true"/></button></header>
      {error && <p role="alert">{error}</p>}
      <div><div><span>Today</span><b>{stats.todayDone}/{stats.todayTotal}</b></div><div><span>Streak</span><b>{stats.history.streak}<small> days</small></b></div><div><span>This week</span><b>{stats.completedThisWeek}<small>/{stats.recentTradingDays.length} full</small></b></div></div>
    </section>
    <h3>Workflow</h3>
    <div className="tj-setup-list"><Row tone="is-green" Icon={Sun} label="Daily routine" note={`${active} items on · before the chart & pre-trade`} count={active} onClick={() => onChoose('daily-routine')}/></div>
    {GROUPS.map(([title,ids]) => <React.Fragment key={title}><h3>{title}</h3><div className="tj-setup-list">{ids.map(id => { const [tone,Icon,note] = ROWS[id]; return <Row key={id} tone={tone} Icon={Icon} label={byId[id]?.label} note={note} count={byId[id]?.count ?? ''} onClick={() => onChoose(id)}/>; })}</div></React.Fragment>)}
    <p className="tj-setup-note">Changes apply across your journal, trade logging and Review. Risk presets and import mappings are saved on this device.</p>
  </div>;
}
