import React, { useEffect, useRef, useState } from 'react';
import { X, Check, GripVertical, Trash2, Pencil, Sun, Moon, Utensils, Activity, Wind, VolumeX, Heart, BarChart2, Newspaper, WalletCards, ShieldCheck } from 'lucide-react';
import { activeRoutineItems, APP_ROUTINE_ITEMS, REQUIRE_ALL, resetCountdown, routineDayKey, routineHistory, reorderRoutine, routineItems } from './dailyRoutine';
import { ThemeSelect } from './JournalControls';
import { getCalendarWindow } from './forexFactory';
import { archivedNewsEvents } from './newsArchive';
import './dailyRoutine.css';
import './mobileRoutine.css';
import {MOBILE_MEDIA} from './mobileNavigation.js';

export function DailyRoutineProfileCard({routine,onUpdate,onManagement}) {
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  return <section className="tj-personal-appearance-card tj-profile-routine-card">
    <header className="tj-profile-routine-heading"><strong>Daily routine</strong><span className="tj-profile-routine-status">{routine.enabled?'On':'Off'}</span></header>
    <div className="tj-profile-routine-toggle-row">
      <button className="tj-settings-switch" role="switch" aria-label="Daily routine" aria-checked={routine.enabled} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onUpdate(r=>({...r,enabled:!r.enabled}));}catch(e){setError(e.message);}finally{setBusy(false);}}}><i/></button>
      <div><strong>Start Day routine</strong></div>
    </div>
    <div className="tj-profile-routine-items-row"><div><strong>Routine items</strong></div><button className="tj-btn-outline" onClick={onManagement}>Open Management ↗</button></div>
    {error&&<p role="alert">{error}</p>}
  </section>;
}

export function DailyRoutineManagement({routine,onUpdate}) {
  const [label,setLabel]=useState(''),[group,setGroup]=useState('before'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(null),[editLabel,setEditLabel]=useState(''),[editGroup,setEditGroup]=useState('before');
  const dragged=useRef(null);
  const pointerDrag=useRef(null);
  const save=async change=>{setBusy(true);setError('');try{await onUpdate(change);return true;}catch(e){setError(e.message);return false;}finally{setBusy(false);}};
  const items=routineItems(routine);
  const activeItems=items.filter(item=>item.enabled!==false);
  const now=new Date(), todayKey=routineDayKey(now), history=routineHistory(routine,now);
  const todayCompletion=routine.completions?.[todayKey];
  const todayDone=(todayCompletion?.tickedIds || []).filter(id=>activeItems.some(item=>item.id===id)).length;
  const todayTotal=todayCompletion?.total || activeItems.length;
  const midnight=Date.parse(`${todayKey}T00:00:00Z`), weekday=new Date(midnight).getUTCDay(), mondayOffset=weekday===0?-6:1-weekday;
  const tradingWeek=Array.from({length:5},(_,index)=>({key:routineDayKey(new Date(midnight+(mondayOffset+index)*86400000)),today:routineDayKey(new Date(midnight+(mondayOffset+index)*86400000))===todayKey}));
  const recentTradingDays=tradingWeek.filter(day=>day.key<=todayKey);
  const completionFor=key=>routine.completions?.[key];
  const completionState=key=>{if(key>todayKey)return 'upcoming';const row=completionFor(key);if(!row)return 'missed';const total=row.total||activeItems.length||1;return row.tickedIds.length>=total?'full':'partial';};
  const completedThisWeek=recentTradingDays.filter(day=>completionState(day.key)==='full').length;
  const historicalRows=Object.values(routine.completions||{});
  const mostMissed=activeItems.map(item=>({label:item.label,missed:historicalRows.filter(row=>!row.tickedIds.includes(item.id)).length})).sort((a,b)=>b.missed-a.missed)[0];
  const listDisabled=busy||!routine.enabled;
  const groupTag=item=><span className={`tj-routine-group-tag ${item.group==='pretrade'?'is-pretrade':''}`}>{item.group==='before'?'Before the chart':'Pre-trade'}</span>;
  const updateItem=(r,item,change)=>item.default?{...r,appItems:{...r.appItems,[item.id]:{...r.appItems[item.id],...change}}}:{...r,customItems:r.customItems.map(row=>row.id===item.id?{...row,...change}:row)};
  const deleteItem=(r,item)=>item.default?{...r,appItems:{...r.appItems,[item.id]:{...r.appItems[item.id],deleted:true,enabled:false}}}:{...r,customItems:r.customItems.filter(row=>row.id!==item.id),order:r.order.filter(id=>id!==item.id)};
  return <section className={`tj-routine-management ${routine.enabled?'':'is-routine-off'}`}><header><div><h2>Daily routine</h2><p>{activeRoutineItems(routine).length} items on · the same in every workspace</p></div><div className="tj-routine-management-status"><button type="button" className={`tj-routine-status-chip ${routine.enabled?'is-on':''}`} role="switch" aria-checked={routine.enabled} disabled={busy} onClick={()=>save(r=>({...r,enabled:!r.enabled}))}>• {routine.enabled?'Routine is on':'Routine is off'}</button><button type="button" className="tj-btn-outline" disabled={listDisabled} onClick={()=>save(r=>({...r,appItems:Object.fromEntries(APP_ROUTINE_ITEMS.map(item=>[item.id,{enabled:item.enabled,label:item.label,group:item.group,deleted:false}]))}))}>Restore recommended items</button></div></header>
    <div className="tj-routine-management-banner"><Sun size={15} aria-hidden="true"/><p>{routine.enabled?<>This checklist opens before your <strong>first markup or trade of the day</strong> and comes back when the <strong>Tokyo session opens.</strong> Items show in the order below.</>:<>Markups and trades open straight to their entry forms. Switch the routine on in Profile settings to use this checklist.</>}</p></div>
    {error&&<p role="alert">{error}</p>}<div className="tj-routine-section-heading"><h3>Routine items</h3><small>{items.length} items · {items.filter(item=>item.enabled!==false).length} on</small></div><div className="tj-routine-list" aria-disabled={listDisabled}><div className="tj-routine-add"><input className="tj-input" aria-label="Routine item" maxLength={160} placeholder="Add a routine item…" value={label} disabled={listDisabled} onChange={e=>setLabel(e.target.value)}/><ThemeSelect label="Routine item group" value={group} disabled={listDisabled} onChange={e=>setGroup(e.target.value)}><option value="before">Before the chart</option><option value="pretrade">Pre-trade checks</option></ThemeSelect><button className="tj-btn-primary" disabled={listDisabled||!label.trim()} onClick={async()=>{const item={id:`custom-${crypto.randomUUID()}`,label:label.trim(),group,order:items.length,enabled:true};if(await save(r=>({...r,customItems:[...r.customItems,item],order:[...r.order,item.id]})))setLabel('');}}>Add</button></div>
    <div className="tj-routine-custom">{items.map((item,index)=><div data-routine-id={item.id} key={item.id} className={`tj-routine-custom-card ${item.enabled===false?'is-paused':''} ${editing===item.id?'is-editing':''}`} draggable={!listDisabled&&editing!==item.id} onDragStart={e=>{if(listDisabled)return;dragged.current=item.id;e.dataTransfer.setData('text/plain',item.id);}} onDragEnd={()=>{dragged.current=null;}} onDragOver={e=>{if(!listDisabled)e.preventDefault();}} onDrop={e=>{e.preventDefault();const id=dragged.current;dragged.current=null;if(id&&!listDisabled)void save(r=>reorderRoutine(r,id,item.id));}}>
      <span className="tj-routine-drag-handle" onPointerDown={e=>{if(listDisabled||e.pointerType==="mouse")return;pointerDrag.current={id:item.id,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={e=>{const drag=pointerDrag.current;pointerDrag.current=null;if(listDisabled||!drag||Math.abs(e.clientY-drag.y)<16)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-routine-id]")?.dataset.routineId;if(target&&target!==drag.id)void save(r=>reorderRoutine(r,drag.id,target));}} onPointerCancel={()=>{pointerDrag.current=null;}} tabIndex={listDisabled?-1:0} role="button" aria-label={`Reorder ${item.label}`} title="Drag to reorder, or use Arrow Up / Arrow Down" onKeyDown={e=>{if(listDisabled)return;if(e.key==='ArrowUp'&&index>0){e.preventDefault();void save(r=>reorderRoutine(r,item.id,items[index-1].id));}if(e.key==='ArrowDown'&&index<items.length-1){e.preventDefault();void save(r=>reorderRoutine(r,item.id,items[index+1].id));}}}><GripVertical size={13}/></span>
      {editing===item.id?<div className="tj-routine-inline-edit"><input className="tj-input" aria-label={`Edit ${item.label}`} autoFocus maxLength={160} value={editLabel} disabled={listDisabled} onChange={e=>setEditLabel(e.target.value)}/><ThemeSelect label={`Group for ${item.label}`} value={editGroup} disabled={listDisabled} onChange={e=>setEditGroup(e.target.value)}><option value="before">Before the chart</option><option value="pretrade">Pre-trade checks</option></ThemeSelect><button className="tj-icon-btn" aria-label={`Save ${item.label}`} disabled={listDisabled||!editLabel.trim()} onClick={async()=>{if(await save(r=>updateItem(r,item,{label:editLabel.trim(),group:editGroup})))setEditing(null);}}><Check size={14}/></button><button className="tj-icon-btn" aria-label="Cancel item edit" disabled={busy} onClick={()=>setEditing(null)}><X size={14}/></button></div>:<><strong className="tj-routine-custom-label">{item.label}</strong>{groupTag(item)}<button className="tj-settings-switch" role="switch" aria-label={item.label} aria-checked={item.enabled!==false} disabled={listDisabled} onClick={()=>save(r=>updateItem(r,item,{enabled:item.enabled===false}))}><i/></button><span className="tj-routine-item-actions"><button className="tj-icon-btn" aria-label={`Edit ${item.label}`} disabled={listDisabled} onClick={()=>{setEditing(item.id);setEditLabel(item.label);setEditGroup(item.group);}}><Pencil size={14}/></button><button className="tj-icon-btn" aria-label={`Delete ${item.label}`} disabled={listDisabled} onClick={()=>save(r=>deleteItem(r,item))}><Trash2 size={14}/></button></span></>}
    </div>)}</div></div><aside className="tj-routine-management-preview" aria-label="Routine progress"><small>ROUTINE PROGRESS</small><div className="tj-routine-progress-heading"><div><h3>Today’s routine</h3><p>{todayCompletion?'Saved for today':'Not started yet'}</p></div><div className="tj-routine-progress-ring" style={{'--routine-progress':`${todayTotal?Math.round(todayDone/todayTotal*100):0}%`}}><b>{todayDone}<small>/{todayTotal}</small></b></div></div><div className="tj-routine-progress-stats"><div><small>CURRENT STREAK</small><strong>{history.streak}<span> days</span></strong></div><div><small>THIS WEEK</small><strong>{completedThisWeek}<span>/{recentTradingDays.length} full</span></strong></div></div><section className="tj-routine-week" aria-label="This trading week, Monday through Friday">{tradingWeek.map(day=>{const state=completionState(day.key),label=new Date(`${day.key}T12:00:00Z`).toLocaleDateString(undefined,{weekday:'narrow',timeZone:'UTC'});return <span key={day.key} className={`is-${state} ${day.today?'is-today':''}`} title={`${day.key}: ${state}`}><i/>{label}</span>;})}</section><div className="tj-routine-progress-legend"><span><i className="is-full"/>Full</span><span><i className="is-partial"/>Partial</span><span><i className="is-missed"/>Missed</span></div><div className="tj-routine-missed-item"><small>NEEDS ATTENTION</small><strong>{historicalRows.length&&mostMissed?.missed?mostMissed.label:'Complete today to start your insight'}</strong><p>{historicalRows.length&&mostMissed?.missed?`${mostMissed.missed} missed check${mostMissed.missed===1?'':'s'} across saved routines.`:'Your weekly consistency and missed-item trends will build here.'}</p></div><p className="tj-routine-progress-note">The routine opens before your <b>first markup or trade</b> and resets when the <b>Tokyo session opens.</b></p></aside>
  </section>;
}

const ROUTINE_ICONS = {slept_enough:Moon,ate_water:Utensils,moved:Activity,quiet_minute:Wind,phone_desk:VolumeX,looked_chart:BarChart2,read_news:Newspaper,checked_accounts:WalletCards,reviewed_rules:ShieldCheck,accepted_risk:Heart};

function RoutineRow({item,isChecked,busy,onToggle,news,todayNews,next,accountSummary,onNews,onGuardrails}) {
  const Icon=ROUTINE_ICONS[item.id] || Heart;
  return <div className={`tj-routine-row ${isChecked?'is-checked':''}`}>
    <label>
      <input type="checkbox" checked={isChecked} disabled={busy} onChange={onToggle}/>
      <span className="tj-routine-tick">{isChecked?<Check size={18}/>:<Icon size={18}/>}</span>
      <span className="tj-routine-row-copy"><strong>{item.label}</strong>
        {item.description&&<small>{item.description}</small>}
        {item.id==='read_news'&&<span className="tj-routine-news-detail">{news.loading?<small>Loading news…</small>:!news.available?<small>News unavailable</small>:<><small className="tj-routine-news-impact">{todayNews.length} high-impact today</small><small>{next?`Next: ${new Date(next.isoDate).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:'No more events today'}</small></>}</span>}
        {item.id==='checked_accounts'&&<><span className="tj-routine-account-detail"><span><small>Balance</small><b>{accountSummary.balance}</b></span><span><small>Daily cap</small><b>{accountSummary.cap.replace(/^Daily cap /,'')}</b></span><span><small>Level</small><b>{accountSummary.level ?? '—'}</b></span></span><small>{accountSummary.name}</small></>}
      </span>
    </label>
    {item.id==='read_news'&&<button type="button" disabled={busy} onClick={onNews}>Open News ↗</button>}
    {item.id==='checked_accounts'&&<button type="button" disabled={busy} onClick={onGuardrails}>Guardrails ↗</button>}
  </div>;
}

export default function DailyRoutinePopup({entryKind='markup',routine,firstName,sessionFor,accountSummary,onSave,onClose,onEdit,onNews,onGuardrails}) {
  const [phone,setPhone]=useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  useEffect(()=>{const media=window.matchMedia(MOBILE_MEDIA),update=()=>setPhone(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const [ticked,setTicked]=useState([]),[now,setNow]=useState(()=>new Date()),[busy,setBusy]=useState(false),[error,setError]=useState(''),[news,setNews]=useState({events:[],loading:true,available:false});
  const dialog=useRef(null), items=activeRoutineItems(routine), activeIds=new Set(items.map(item=>item.id));
  const checklist=useRef(null), dragStart=useRef(null);
  const [moreBelow,setMoreBelow]=useState(false);
  const updateScrollCue=()=>{const list=checklist.current;if(list)setMoreBelow(list.scrollHeight-list.clientHeight-list.scrollTop>2);};
  useEffect(()=>{
    const list=checklist.current;
    const observer=new ResizeObserver(updateScrollCue);
    observer.observe(list);
    [...list.children].forEach(child=>observer.observe(child));
    updateScrollCue();
    return()=>observer.disconnect();
  },[items.map(item=>item.id).join('|')]);
  const checked=ticked.filter(id=>activeIds.has(id)), done=items.length>0&&checked.length===items.length, almost=checked.length>=Math.ceil(items.length*2/3), history=routineHistory(routine,now);
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{let alive=true;getCalendarWindow().then(result=>{if(alive)setNews({events:archivedNewsEvents(result.archive),loading:false,available:result.results.some(row=>Array.isArray(row.events))});}).catch(()=>{if(alive)setNews({events:[],loading:false,available:false});});return()=>{alive=false;};},[]);
  useEffect(()=>{
    const prior=document.activeElement, overlay=dialog.current?.parentElement;
    const siblings=[...(overlay?.parentElement?.children || [])].filter(node=>node!==overlay);
    const states=siblings.map(node=>[node,node.inert]);siblings.forEach(node=>{node.inert=true;});
    dialog.current?.focus();
    return()=>{states.forEach(([node,inert])=>{node.inert=inert;});if(prior?.isConnected)prior.focus();};
  },[]);
  const todayNews=news.events.filter(event=>routineDayKey(new Date(event.isoDate))===routineDayKey(now)&&event.impact==='high');
  const next=todayNews.find(event=>Date.parse(event.isoDate)>now.getTime());
  const session=sessionFor(now), sessionCode=session==='London'?'LONDON':session==='NYC AM'?'NY AM':session==='NYC PM'?'NY PM':['Sydney','Tokyo'].includes(session)?'ASIA':'';
  return <div className="tj-routine-overlay"><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="daily-routine-title" className={`tj-routine-popup ${done?'is-complete':''} ${moreBelow?'has-more-below':''}`} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();if(!busy)onClose();}if(e.key==='Tab'){const nodes=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(node=>node.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
    {phone&&done&&<div className="tj-routine-phone-confetti" aria-hidden="true">{Array.from({length:18},(_,index)=><i key={index} style={{left:`${7+(index*37)%86}%`,top:4+(index*19)%30}}/>)}</div>}
    <button type="button" className="tj-routine-sheet-handle" aria-label="Close daily routine" disabled={busy} onClick={onClose} onTouchStart={event=>{dragStart.current=event.touches[0].clientY;}} onTouchEnd={event=>{if(!busy&&dragStart.current!==null&&event.changedTouches[0].clientY-dragStart.current>60)onClose();dragStart.current=null;}}><span/></button>
    <button type="button" className="tj-icon-btn tj-modal-close tj-routine-close" aria-label="Close daily routine" disabled={busy} onClick={onClose}><X size={20}/></button>
    <header><div className="tj-routine-heading-copy"><small>DAILY ROUTINE</small><h2 id="daily-routine-title">{done?'Ready to trade.':almost?'Almost there.':`Good morning, ${firstName}`}</h2><p>{done?(entryKind==='trade'?'Everything is ticked. Your trade form is one click away.':'Everything is ticked. Your first markup is one click away.'):`${now.toLocaleDateString([], {weekday:'long',day:'numeric',month:'short',timeZone:'UTC'})} · ${session} session`}</p></div><div className="tj-routine-heading-meta"><div className="tj-routine-history"><span>{history.days.map(day=><i key={day.key} title={`${day.key}: ${day.completed?'completed':'not completed'}`} className={`${day.completed?'is-done':''} ${day.today?'is-today':''}`}/>)}</span><small>{history.streak}-day streak</small></div><div className="tj-routine-ring" aria-label={`${checked.length} of ${items.length} routine items ticked`} style={{'--routine-progress':`${items.length?checked.length/items.length*100:0}%`}}><b>{checked.length}<small>/{items.length}</small></b></div></div></header>
    <div className="tj-routine-sessions">{['ASIA','LONDON','NY AM','NY PM'].map(code=><span key={code} className={code===sessionCode?'is-current':''}>{code}{code===sessionCode&&<><i aria-hidden="true"/>{phone&&<small>now</small>}</>}</span>)}</div>
    <div ref={checklist} className="tj-routine-columns" onScroll={updateScrollCue}>{['before','pretrade'].map(group=>{const rows=items.filter(item=>item.group===group);if(!rows.length)return null;return <section className="tj-routine-group" key={group}><header><small>{group==='before'?'Before the chart':'Pre-trade checks'}</small><small>{rows.filter(item=>checked.includes(item.id)).length} / {rows.length}</small></header><div className="tj-routine-group-rows">{rows.map(item=><RoutineRow key={item.id} item={item} isChecked={checked.includes(item.id)} busy={busy} onToggle={()=>setTicked(ids=>ids.includes(item.id)?ids.filter(id=>id!==item.id):[...ids,item.id])} news={news} todayNews={todayNews} next={next} accountSummary={accountSummary} onNews={onNews} onGuardrails={onGuardrails}/>)}</div></section>;})}</div>
    {error&&<p role="alert">{error}</p>}<footer><button type="button" className="tj-btn-outline" disabled={busy} onClick={onEdit}><span className="tj-routine-desktop-edit">‹ Edit routine</span><span className="tj-routine-phone-edit"><Pencil size={14}/> Edit</span></button><small>Resets when the Tokyo session opens · next in {resetCountdown(now)}</small><button type="button" className="tj-btn-primary" disabled={busy||(REQUIRE_ALL&&!done)} onClick={async()=>{setBusy(true);setError('');try{await onSave(checked);}catch(e){setError(e.message);setBusy(false);}}}>{busy?'Saving…':entryKind==='trade'?'Save & open trade →':'Save & open markup →'}</button></footer>
  </section></div>;
}
