import React, {useEffect, useRef, useState} from 'react';
import {LayoutGrid, Calendar, List, Ellipsis, Plus, Bookmark, BookOpen, CircleCheck, BarChart2, Smile, Newspaper, Trophy, Landmark, FlaskConical, SlidersHorizontal, CreditCard, User, Moon, Sun, LogOut, ChevronDown, X} from 'lucide-react';
import {MOBILE_MEDIA, MOBILE_MORE_PAGES, mobileRoutineStatus} from './mobileNavigation.js';
import {translate} from './localization';
const icons = {markups:Bookmark,reviews:CircleCheck,'case-studies':BookOpen,analytics:BarChart2,psychology:Smile,news:Newspaper,challenge:Trophy,finance:Landmark,backtest:FlaskConical,management:SlidersHorizontal};

export default function MobileShell({page, sheet, onSheet, nav, onNavigate, displayName, avatar, initials, verified, account, accounts, onSelectAccount, onAddAccount, routine, busy, tradeLocked, challengeEnabled, financeEnabled, theme, onTheme, onProfile, onAccount, onLogout, onStartDay, onNewMarkup, onLogTrade, search, blocked=false}) {
  const [phone,setPhone] = useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  const [failedAvatar,setFailedAvatar] = useState(null);
  const sheetRef = useRef(null), dragStart = useRef(null), opener = useRef(null);
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
  const go=id=>{onSheet(null);onNavigate(id);};
  const action=callback=>()=>{onSheet(null);callback();};
  const status=mobileRoutineStatus(routine);
  const moreActive=MOBILE_MORE_PAGES.includes(page);
  const sheetTitle={more:'More',add:'Add to your day',search:'Search',workspace:'Switch journal'}[sheet];
  return <>
    <nav className="tj-mobile-bottom" aria-label="Phone navigation" inert={sheet || blocked ? '' : undefined}>
      <button type="button" aria-current={page==='dashboard'?'page':undefined} onClick={()=>go('dashboard')}><LayoutGrid/><span>Dashboard</span></button>
      <button type="button" aria-current={page==='calendar'?'page':undefined} onClick={()=>go('calendar')}><Calendar/><span>Calendar</span></button>
      <button type="button" className="tj-mobile-add" aria-label="Add to your day" aria-expanded={sheet==='add'} onClick={event=>{opener.current=event.currentTarget;onSheet('add');}}><Plus/></button>
      <button type="button" aria-current={page==='tradelog'?'page':undefined} onClick={()=>go('tradelog')}><List/><span>Logs</span></button>
      <button type="button" aria-current={moreActive?'page':undefined} aria-expanded={sheet==='more'} onClick={event=>{opener.current=event.currentTarget;onSheet('more');}}><Ellipsis/><span>More</span></button>
    </nav>
    {sheet && <div className="tj-mobile-sheet-layer">
      <div className="tj-mobile-sheet-backdrop" aria-hidden="true" onClick={()=>onSheet(null)}/>
      <section ref={sheetRef} className={`tj-mobile-sheet tj-mobile-sheet-${sheet}`} role="dialog" aria-modal="true" aria-label={translate(sheetTitle)}>
        <button type="button" className="tj-mobile-sheet-handle" aria-label="Close menu" onClick={()=>onSheet(null)} onPointerDown={event=>{dragStart.current=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={event=>{if(dragStart.current != null && event.clientY-dragStart.current>60)onSheet(null);dragStart.current=null;}}><i aria-hidden="true"/></button>
        {sheet==='more' && <>
          <header className="tj-mobile-identity"><button type="button" className="tj-mobile-person" onClick={action(onProfile)} aria-label="Open profile settings"><span className="tj-mobile-avatar">{avatar && failedAvatar !== avatar ? <img src={avatar} alt="Profile" onError={()=>setFailedAvatar(avatar)}/> : initials}</span><span><strong>{displayName}</strong>{verified && <small>Verified</small>}</span></button><button type="button" className="tj-mobile-workspace" onClick={()=>onSheet('workspace')} aria-label="Switch journal"><b>{account.name?.slice(0,1).toUpperCase()}</b><span>{account.name}</span><ChevronDown size={16}/></button></header>
          <div className="tj-mobile-more-grid">{MOBILE_MORE_PAGES.map(id=>{const item=nav.find(n=>n.id===id),Icon=icons[id];const disabled=(id==='challenge'&&!challengeEnabled)||(id==='finance'&&!financeEnabled);return <button type="button" key={id} disabled={disabled} aria-current={page===id?'page':undefined} title={disabled?'Enable it in Account settings':undefined} onClick={()=>go(id)}><Icon/><span>{translate(item.label)}</span></button>;})}</div>
          <div className="tj-mobile-utilities"><button type="button" disabled={tradeLocked} onClick={action(onAccount)}><CreditCard/><span>Account</span></button><button type="button" onClick={action(onProfile)}><User/><span>Profile</span></button><button type="button" onClick={onTheme}><span aria-hidden="true">{theme==='dark'?<Moon/>:<Sun/>}</span><span>Theme</span></button><button type="button" className="tj-mobile-danger" onClick={action(onLogout)}><LogOut/><span>Log Out</span></button></div>
        </>}
        {sheet==='add' && <><h2>ADD TO YOUR DAY</h2><div className="tj-mobile-add-options">
          <button type="button" disabled={busy} onClick={action(onStartDay)}><span className="tj-mobile-action-icon tj-mobile-start-icon"><Sun/></span><span><strong>Start Day</strong><small>{status.skipped?'Markups open straight to the entry form.':status.completed?'Daily routine · done today':'Daily routine · not done today'}</small></span>{!status.skipped && <b className={status.completed?'tj-mobile-routine-done':'tj-mobile-routine-pending'}>{status.ticked} / {status.total}</b>}</button>
          <button type="button" disabled={tradeLocked} onClick={action(onLogTrade)}><span className="tj-mobile-action-icon"><Plus/></span><span><strong>Log trade</strong><small>{tradeLocked?'Trade Locked':'Record a trade result'}</small></span></button>
          <button type="button" disabled={busy} onClick={action(onNewMarkup)}><span className="tj-mobile-action-icon"><Bookmark/></span><span><strong>New markup</strong><small>Plan a setup before the entry</small></span></button>
        </div><button type="button" className="tj-mobile-cancel" onClick={()=>onSheet(null)}>Cancel</button></>}
        {sheet==='search' && <><header className="tj-mobile-sheet-title"><h2>Search</h2><button type="button" aria-label="Close search" onClick={()=>onSheet(null)}><X/></button></header>{search}</>}
        {sheet==='workspace' && <><h2>Switch journal</h2><div className="tj-mobile-journals">{accounts.map(item=><button type="button" key={item.id} aria-current={item.id===account.id?'true':undefined} onClick={()=>{onSelectAccount(item.id);onSheet('more');}}><span>{item.name}</span>{item.id===account.id && <CircleCheck/>}</button>)}</div><button type="button" className="tj-mobile-cancel" onClick={action(onAddAccount)}>Add account</button><button type="button" className="tj-mobile-cancel" onClick={()=>onSheet('more')}>Back</button></>}
      </section>
    </div>}
  </>;
}
