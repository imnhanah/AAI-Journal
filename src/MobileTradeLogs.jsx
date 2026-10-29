import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,ChevronUp,SlidersHorizontal,ArrowDownUp,RotateCcw,X} from 'lucide-react';
import {ThemeDate} from './JournalControls';
import {PHONE_LOG_TITLE,PHONE_REVIEW_NEEDED,phoneTradeId} from './mobileTradeFilters.js';
import './mobileTradeLogs.css';

export default function MobileTradeLogs({balance,netReturn,netPnl,winRate,wins,losses,be,alignment,alignmentNote,extraStats,trades,decorate,pagination,page,pageCount,count,filters,onFilters,onReset,onSort,onReview,renderScreenshot,money,date,time}) {
  const [allStats,setAllStats]=useState(false),[expanded,setExpanded]=useState(null),[sheet,setSheet]=useState(null);
  const dialog=useRef(null),start=useRef(null);
  useEffect(()=>{
    if(!sheet)return;
    const prior=document.activeElement;
    const siblings=[...document.querySelectorAll('.tj-topbar,.tj-mobile-bottom')];
    const states=siblings.map(node=>[node,node.inert]);siblings.forEach(node=>{node.inert=true;});
    const targets=()=>[...dialog.current.querySelectorAll('button,input,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length);
    dialog.current.querySelector('.tj-phone-log-close')?.focus();
    const keydown=event=>{
      if(event.key==='Escape'){event.stopPropagation();setSheet(null);}
      if(event.key==='Tab'){const nodes=targets(),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown',keydown);
    return()=>{document.removeEventListener('keydown',keydown);states.forEach(([node,inert])=>{node.inert=inert;});requestAnimationFrame(()=>prior?.isConnected&&prior.focus());};
  },[sheet]);
  const choices=(label,key,options)=><fieldset><legend>{label}</legend><div className="tj-phone-log-pills">{options.map(([value,text])=><button type="button" key={value} aria-pressed={filters[key]===value} onClick={()=>onFilters({...filters,[key]:value})}>{text}</button>)}</div></fieldset>;
  return <>
    <div className="tj-phone-logs" inert={sheet?'':undefined}>
      <section className="tj-phone-log-balance"><small>ACCOUNT BALANCE</small><span className="tj-phone-log-return">{netReturn>=0?'+':''}{netReturn.toFixed(2)}%</span><strong>{money(balance).replace(/^\+/,'')}</strong><p>Net return {money(netPnl)}</p></section>
      <div className="tj-phone-log-stats"><section><small>WIN RATE</small><strong>{winRate.toFixed(0)}%</strong><p>{wins}W · {losses}L · {be} B/E</p></section><section><small>PLAN ALIGNMENT</small><strong>{alignment==null?'—':`${alignment.toFixed(0)}%`}</strong><i className="tj-phone-log-progress"><b style={{width:`${Math.max(0,Math.min(100,alignment||0))}%`}}/></i><p>{alignmentNote}</p></section>{allStats&&extraStats.map(stat=><section key={stat.label}><small>{stat.label}</small><strong>{stat.value}</strong><p>{stat.note}</p></section>)}</div>
      <button type="button" className="tj-phone-log-all-stats" aria-expanded={allStats} onClick={()=>setAllStats(value=>!value)}>All stats <b>{extraStats.length} more</b>{allStats?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
      <div className="tj-phone-log-toolbar"><button type="button" onClick={()=>setSheet('filter')}><SlidersHorizontal size={16}/>Filter</button><button type="button" onClick={()=>setSheet('sort')}><ArrowDownUp size={16}/>Sort</button><button type="button" onClick={()=>{onReset();setExpanded(null);}}><RotateCcw size={16}/>Reset</button><span aria-label={`Page ${page} of ${pageCount}`}>{page}/{pageCount}</span></div>
      <div className="tj-phone-log-list">{trades.map(raw=>{
        const info=decorate(raw),t=info.trade,open=expanded===t.id;
        return <article key={t.id} className={`tj-phone-log-card is-${info.result}`}>
          <div className="tj-phone-log-card-head"><div><strong>{t.asset||'No instrument'}</strong><span className={`tj-phone-log-direction ${t.direction==='BUY'?'tj-green':'tj-red'}`}>{t.direction}</span><small>{t.entrySession||t.session||'No session'}</small></div><div className="tj-phone-log-pnl"><strong className={info.running?'tj-amber':info.result==='be'?'tj-blue':t.pnl>=0?'tj-green':'tj-red'}>{info.running?'Running':money(t.pnl)}</strong><small>{info.running?'Open trade':`${info.return>=0?'+':''}${info.return.toFixed(2)}%`}</small></div></div>
          <div className="tj-phone-log-meta"><span>{date(t.date)} · {time(t.time)}</span><span>RR {t.rr?`${t.rr.toFixed(2)}R`:'—'}</span><span>Confluence {info.confluences}</span></div>
          {open&&<div id={phoneTradeId(t.id)} className="tj-phone-log-details"><div className="tj-phone-log-detail-boxes"><div><small>ENTRY MODEL</small><strong>{t.entryType||t.confluenceSession||'—'}</strong></div><div><small>MARKUP</small><strong className={info.linked?'tj-purple-txt':''}>{info.linked?'Linked':'Not linked'}</strong></div><div><small>MISTAKES</small><strong>{t.mistakes?.length||0}</strong>{t.mistakes?.length>0&&<p>{t.mistakes.join(' · ')}</p>}</div><div><small>SESSION</small><strong>{t.entrySession||t.session||'—'}</strong></div></div><div className="tj-phone-log-shots">{info.screenshots.length?info.screenshots.slice(0,2).map(renderScreenshot):<span>No screenshots attached</span>}</div></div>}
          <div className={`tj-phone-log-card-footer ${open?'is-expanded':''}`}><button type="button" className="tj-phone-log-review" disabled={info.running} onClick={()=>onReview(t,info.reviewed)}>{info.running?'Open':info.reviewed?'Reviewed':'Write review'}</button><button type="button" aria-expanded={open} aria-controls={open?phoneTradeId(t.id):undefined} aria-label={`${open?'Collapse trade':'Expand trade'} ${t.asset} ${date(t.date)} ${time(t.time)}`} onClick={()=>setExpanded(open?null:t.id)}>{open?<ChevronUp size={20}/>:<ChevronDown size={20}/>}</button></div>
        </article>;
      })}{!trades.length&&<p className="tj-phone-log-empty">No trades match these filters.</p>}</div>
      {pagination}
    </div>
    {sheet&&<div className="tj-phone-log-sheet-layer"><div className="tj-phone-log-backdrop" onClick={()=>setSheet(null)}/><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={PHONE_LOG_TITLE} className="tj-phone-log-sheet"><button type="button" className="tj-phone-log-handle" aria-label="Close filters" onClick={()=>setSheet(null)} onTouchStart={event=>{start.current=event.touches[0].clientY;}} onTouchEnd={event=>{if(start.current!==null&&event.changedTouches[0].clientY-start.current>60)setSheet(null);start.current=null;}}><span/></button><header><h2 id={PHONE_LOG_TITLE}>{sheet==='filter'?'Filter trades':'Sort trade log'}</h2><button type="button" className="tj-phone-log-close" aria-label="Close filters" onClick={()=>setSheet(null)}><X size={20}/></button></header>
      <div className="tj-phone-log-sheet-body">{sheet==='filter'?<>
        {choices('Result','result',[['All','All'],['win','Wins'],['loss','Losses'],['be','Break-even']])}
        {choices('Direction','direction',[['All','All'],['BUY','Buy'],['SELL','Sell']])}
        <fieldset><legend>Session</legend><div className="tj-phone-log-pills">{['Asia','London','NY AM','NY PM'].map(session=><button type="button" key={session} aria-pressed={filters.sessions.includes(session)} onClick={()=>onFilters({...filters,sessions:filters.sessions.includes(session)?filters.sessions.filter(item=>item!==session):[...filters.sessions,session]})}>{session}</button>)}</div></fieldset>
        {choices('Review','review',[['All','All'],[PHONE_REVIEW_NEEDED,'Needs review'],['reviewed','Reviewed']])}
        <div className="tj-phone-log-dates"><label><span>From</span><ThemeDate label="From" value={filters.from} max={filters.to||undefined} onChange={event=>onFilters({...filters,from:event.target.value})}/></label><label><span>To</span><ThemeDate label="To" value={filters.to} min={filters.from||undefined} onChange={event=>onFilters({...filters,to:event.target.value})}/></label></div>
      </>:<div className="tj-phone-log-sort">{[['date','desc','Newest first'],['date','asc','Oldest first'],['pnl','desc','Highest P&L'],['pnl','asc','Lowest P&L']].map(([key,direction,label])=><button type="button" key={label} onClick={()=>{onSort(key,direction);setSheet(null);}}>{label}</button>)}</div>}</div>
      {sheet==='filter'&&<footer><button type="button" onClick={onReset}>Reset</button><button type="button" className="tj-btn-primary" onClick={()=>setSheet(null)}>Show {count} trades</button></footer>}
    </section></div>}
  </>;
}
