import React, {useEffect, useRef, useState} from 'react';
import {LayoutDashboard, Calendar, NotebookText, Briefcase, Pencil, BookOpen, CircleCheck, ClipboardCheck, BarChart3, Smile, Newspaper, Trophy, Landmark, FlaskConical, SlidersHorizontal, WalletCards, Lock, ChevronRight, X} from 'lucide-react';
import {MOBILE_MEDIA, MOBILE_MORE_PAGES, mobileRoutineStatus} from './mobileNavigation.js';
import {translate} from './localization';
import {isRoutineTradingDay} from './dailyRoutine.js';
import './mobileMoreMenu.css';
import './mobileQuickActions.css';
import './mobileBottomBar.css';
import './mobileMotion.css';
const icons = {markups:Pencil,reviews:ClipboardCheck,'case-studies':BookOpen,analytics:BarChart3,psychology:Smile,news:Newspaper,challenge:Trophy,finance:Landmark,backtest:FlaskConical,management:SlidersHorizontal};
const MORE_TILES = [['case-studies','is-green','Research & evidence'],['backtest','is-blue','Backtest your edge'],['finance','is-amber','Accounts & transfers'],['psychology','is-purple','Mindset & habits']];
const FLOATING_SHEETS = ['add'];

const RING_LENGTH = 201;
// The bar's centre button: today's checklist with its progress around the edge. It shows a close mark while open.
function WorkflowMark({open, percent}) {
  if (open) return <X size={26} strokeWidth={2.4} aria-hidden="true"/>;
  return <>
    <svg className="tj-mobile-add-ring" viewBox="0 0 70 70" aria-hidden="true"><circle className="is-track" cx="35" cy="35" r="32"/><circle className="is-progress" cx="35" cy="35" r="32" strokeDashoffset={RING_LENGTH * (1 - percent / 100)}/></svg>
    <ClipboardCheck size={28} strokeWidth={2} aria-hidden="true"/>
  </>;
}

export default function MobileShell({page, sheet, onSheet, nav, onNavigate, displayName, avatar, initials, verified, account, accounts, onSelectAccount, onAddAccount, routine, busy, tradeLocked, challengeEnabled, financeEnabled, onProfile, onAccount, onStartDay, onContinueRoutine, search, blocked=false}) {
  const [phone,setPhone] = useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  const [failedAvatar,setFailedAvatar] = useState(null);
  const sheetRef = useRef(null), dragStart = useRef(null), opener = useRef(null);
  const [quickNote, setQuickNote] = useState(''), quickNoteTimer = useRef(null);
  const showQuickNote = text => { setQuickNote(text); clearTimeout(quickNoteTimer.current); quickNoteTimer.current = setTimeout(() => setQuickNote(''), 1600); };
  useEffect(() => () => clearTimeout(quickNoteTimer.current), []);
  useEffect(()=>{
    const media=window.matchMedia(MOBILE_MEDIA);
    const change=()=>{setPhone(media.matches);if(!media.matches)onSheet(null);};
    media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
  },[onSheet]);
  useEffect(()=>{
    if(!phone)return;
    if(!sheet){const previous=opener.current;opener.current=null;if(previous?.isConnected)previous.focus();return;}
    if(!opener.current && sheet==='search')opener.current=document.querySelector('.tj-mobile-search-trigger');
    const panel=sheetRef.current;
    (panel.querySelector('input') || panel.querySelector('button'))?.focus();
    const key=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onSheet(null);return;}
      if(event.key!=='Tab')return;
      const targets=[...panel.querySelectorAll('button:not(:disabled),input,a[href],select,textarea,[tabindex="0"]')].filter(e=>e.getClientRects().length);
      const first=targets[0],last=targets.at(-1);
      if(event.shiftKey && (document.activeElement===first || !panel.contains(document.activeElement))){event.preventDefault();last?.focus();}
      if(!event.shiftKey && (document.activeElement===last || !panel.contains(document.activeElement))){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',key,true);
    return()=>document.removeEventListener('keydown',key,true);
  },[phone,sheet,onSheet]);
  if(!phone)return null;
  const go=id=>{const via=sheet==='more'?'more':sheet==='add'?'sheet':'page';onSheet(null);onNavigate(id,via);};
  const action=callback=>()=>{onSheet(null);callback();};
  const status=mobileRoutineStatus(routine);
  const moreActive=MOBILE_MORE_PAGES.includes(page);
  const sheetTitle={more:'More',add:'Quick menu',search:'Search',workspace:'Switch journal'}[sheet];
  const due=!status.skipped&&!status.completed&&isRoutineTradingDay();
  const startDayLock=due&&!status.started?'Start your day first':'';
  const floating=FLOATING_SHEETS.includes(sheet);
  const current=id=>sheet!=='more'&&(page===id||(id==='journal'&&page==='tradelog'))?'page':undefined;
  // One indicator slides to the active tab instead of each tab drawing its own.
  const activeTab=sheet==='more'||moreActive?4:current('dashboard')?0:current('analytics')?1:current('calendar')?3:null;
  const toggle=name=>event=>{if(sheet===name){onSheet(null);return;}opener.current=event.currentTarget;onSheet(name);};
  // Tiles open their library, where creating happens. A locked tile explains itself instead.
  const quickTile=(id,Icon,label,tone,{lock='',note=''}={})=><button type="button" key={id} className={`tj-qa-tile ${tone} ${lock?'is-locked':''}`} aria-disabled={lock?'true':undefined} aria-current={current(id)} onClick={()=>lock?showQuickNote(lock):go(id)}>
    {lock&&<span className="tj-qa-lock"><Lock size={13} aria-hidden="true"/></span>}
    <span className="tj-qa-icon"><Icon size={22} aria-hidden="true"/></span>
    <span><strong>{label}</strong>{note&&<small>{note}</small>}</span>
  </button>;
  return <>
    <nav className={`tj-mobile-bottom ${floating?'is-sheet-open':''}`} aria-label="Phone navigation" inert={blocked || (sheet && !floating) ? '' : undefined}>
      <div className="tj-mobile-bar-bg" aria-hidden="true"/>
      <i className="tj-mobile-tab-indicator" data-tab={activeTab ?? undefined} aria-hidden="true"/>
      <button type="button" aria-current={current('dashboard')} onClick={()=>go('dashboard')}><span className="tj-mobile-tab-icon"><LayoutDashboard/></span><span>Dashboard</span></button>
      <button type="button" aria-current={current('analytics')} onClick={()=>go('analytics')}><span className="tj-mobile-tab-icon"><BarChart3/></span><span>Analytics</span></button>
      <button type="button" className={`tj-mobile-add ${due?'has-due':''}`} aria-label="Open quick menu" aria-description={due?'Start day is due':undefined} aria-expanded={sheet==='add'} onClick={toggle('add')}><WorkflowMark open={sheet==='add'} percent={status.completed?100:status.total?status.ticked/status.total*100:0}/></button>
      <button type="button" aria-current={current('calendar')} onClick={()=>go('calendar')}><span className="tj-mobile-tab-icon"><Calendar/></span><span>Calendar</span></button>
      <button type="button" aria-current={moreActive||sheet==='more'?'page':undefined} aria-expanded={sheet==='more'} onClick={toggle('more')}><span className="tj-mobile-tab-icon"><Briefcase/></span><span>More</span></button>
    </nav>
    {sheet && <div className={`tj-mobile-sheet-layer ${floating?'is-floating':''}`}>
      <div className="tj-mobile-sheet-backdrop" aria-hidden="true" onClick={()=>onSheet(null)}/>
      <section ref={sheetRef} className={`tj-mobile-sheet tj-mobile-sheet-${sheet}`} role="dialog" aria-modal="true" aria-label={translate(sheetTitle)}>
        <button type="button" className="tj-mobile-sheet-handle" aria-label="Close menu" onClick={()=>onSheet(null)} onPointerDown={event=>{dragStart.current=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={event=>{if(dragStart.current != null && event.clientY-dragStart.current>60)onSheet(null);dragStart.current=null;}}><i aria-hidden="true"/></button>
        {sheet==='more' && <>
          <div className="tj-more-body">
            <button type="button" className="tj-more-me" onClick={action(onProfile)}><span className="tj-more-avatar">{avatar&&failedAvatar!==avatar?<img src={avatar} alt="" onError={()=>setFailedAvatar(avatar)}/>:initials}</span><span><strong>{displayName}</strong><small><i aria-hidden="true"/>{account?.name}</small></span><span className="tj-more-go"><ChevronRight/></span></button>
            <h3>Workspace</h3>
            <div className="tj-more-tiles">{MORE_TILES.map(([id,tone,note])=>{const Icon=icons[id],disabled=id==='finance'&&!financeEnabled;return <button type="button" key={id} className={tone} disabled={disabled} aria-current={page===id?'page':undefined} onClick={()=>go(id)}><span className="tj-more-icon"><Icon/></span><span><strong>{translate(nav.find(n=>n.id===id).label)}</strong><small>{disabled?'Enable it in Account settings':note}</small></span></button>;})}</div>
            <h3>Tools</h3>
            <div className="tj-more-list">
              <button type="button" className="is-blue" aria-current={page==='news'?'page':undefined} onClick={()=>go('news')}><span className="tj-more-icon"><Newspaper/></span><span><strong>{translate(nav.find(n=>n.id==='news').label)}</strong><small>Market events & headlines</small></span><ChevronRight/></button>
              <button type="button" className="is-red" aria-current={page==='management'?'page':undefined} onClick={()=>go('management')}><span className="tj-more-icon"><SlidersHorizontal/></span><span><strong>{translate(nav.find(n=>n.id==='management').label)}</strong><small>Pairs, models & fields</small></span><ChevronRight/></button>
              <button type="button" className="is-amber" disabled={tradeLocked} onClick={action(onAccount)}><span className="tj-more-icon"><WalletCards/></span><span><strong>Account</strong><small>{tradeLocked?'Locked by your loss limit':'Trading accounts & balances'}</small></span><ChevronRight/></button>
            </div>
          </div>
        </>}
        {sheet==='add' && <div className="tj-qa">
          {due&&<button type="button" className="tj-qa-hero" disabled={busy} aria-label={status.unfinished?`Continue daily routine, ${status.ticked} of ${status.total} tasks completed`:undefined} onClick={action(onContinueRoutine)}>
            <span><ClipboardCheck size={22} aria-hidden="true"/></span>
            <strong>{status.unfinished?'Continue Start day':'Start day'}</strong>
            <span className="tj-qa-ring" style={{'--ring':`${status.total?Math.round(status.ticked/status.total*100):0}%`}}><i>{status.ticked}/{status.total}</i></span>
          </button>}
          <div className="tj-qa-grid">
            {quickTile('markups',Pencil,'Markup','is-blue',{lock:startDayLock})}
            {quickTile('journal',NotebookText,'Trade Logs','is-purple',{lock:startDayLock,note:tradeLocked?'Trade Locked':''})}
            {quickTile('reviews',ClipboardCheck,'Review','is-accent')}
            {quickTile('challenge',Trophy,'Challenge','is-amber',{lock:challengeEnabled?'':'Enable it in Account settings'})}
          </div>
        </div>}
        {sheet==='search' && <><header className="tj-mobile-sheet-title"><h2>Search</h2><button type="button" aria-label="Close search" onClick={()=>onSheet(null)}><X/></button></header>{search}</>}
        {sheet==='workspace' && <><h2>Switch journal</h2><div className="tj-mobile-journals">{accounts.map(item=><button type="button" key={item.id} aria-current={item.id===account.id?'true':undefined} onClick={()=>{onSelectAccount(item.id);onSheet('more');}}><span>{item.name}</span>{item.id===account.id && <CircleCheck/>}</button>)}</div><button type="button" className="tj-mobile-cancel" onClick={action(onAddAccount)}>Add account</button><button type="button" className="tj-mobile-cancel" onClick={()=>onSheet('more')}>Back</button></>}
      </section>
      {sheet==='add'&&quickNote&&<div className="tj-qa-toast" role="status">{quickNote}</div>}
    </div>}
  </>;
}
