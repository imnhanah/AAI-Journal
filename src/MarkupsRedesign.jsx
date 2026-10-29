import {useEffect, useMemo, useState} from 'react';
import {ArrowDownRight, ArrowUpRight, Check, MoreHorizontal, Pencil, Plus, X} from 'lucide-react';
import {ThemeSelect} from './JournalControls';
import {loadJournalImage} from './journalCloudCache';
import './markupsRedesign.css';

const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const dateParts=value=>{ const [year,month,day]=String(value||'').slice(0,10).split('-'); return {year,month,day}; };
const dateLabel=value=>{const {year,month,day}=dateParts(value);return year?`${day}/${month}/${year}`:'—';};
const monthLabel=value=>{const {year,month}=dateParts(value);return year?`${months[Number(month)-1]} ${year}`:'Undated';};
const monthKey=value=>{const {year,month}=dateParts(value);return `${year}-${month}`;};
const money=value=>`${Number(value||0)<0?'−':'+'}$${Math.abs(Number(value||0)).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const shots=(markup,prefix)=>Object.entries(markup.screenshots||{}).filter(([key])=>key.toLowerCase().startsWith(prefix)).flatMap(([,items])=>Array.isArray(items)?items:[]);
const source=item=>{
  if(typeof item==='string')return item;
  const value=item?.src||item?.url||item?.dataUrl||item?.source||item?.data||item?.image||item?.preview||item?.file?.dataUrl||item?.file?.src||'';
  return typeof value==='string'?value:source(value);
};

function MarkupChart({item,onView}) {
  const raw=source(item);
  const [resolved,setResolved]=useState('');
  const [error,setError]=useState(false);
  useEffect(()=>{let active=true;setResolved('');setError(false);if(!raw){setError(true);return undefined;}loadJournalImage(raw).then(value=>{if(active)setResolved(value);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[raw]);
  const open=()=>resolved&&onView?.(resolved);
  return <figure className={error?'mk-chart-error':''} role={resolved?'button':undefined} tabIndex={resolved?0:undefined} onClick={open} onKeyDown={event=>{if(resolved&&(event.key==='Enter'||event.key===' ')){event.preventDefault();open();}}}>{resolved?<img src={resolved} alt="Markup chart" loading="lazy"/>:<span>{error?'Image unavailable':'Loading chart…'}</span>}</figure>;
}
function Charts({items,empty,onView}) { return items.length ? <div className={`mk-charts mk-charts--${Math.min(items.length, 4)}`}>{items.map((item,index)=><MarkupChart key={index} item={item} onView={onView}/>)}</div> : <div className="mk-empty">{empty}</div>; }

export default function MarkupsRedesign({markups=[],trades=[],onNew,onEdit,onDelete,onTrade,onViewImage}) {
  const currentYear=String(new Date().getFullYear());
  const [selectedId,setSelectedId]=useState(markups[0]?.id);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [sortOpen,setSortOpen]=useState(false);
  const [instrumentFilter,setInstrumentFilter]=useState('All');
  const [yearFilter,setYearFilter]=useState(currentYear);
  const [monthFilter,setMonthFilter]=useState('All');
  const [weekFilter,setWeekFilter]=useState('All');
  const [alignmentFilter,setAlignmentFilter]=useState('All');
  const [linkFilter,setLinkFilter]=useState('All');
  const [resultFilter,setResultFilter]=useState('All');
  const [sort,setSort]=useState('Newest');
  const [moreOpen,setMoreOpen]=useState(false);
  const linkedFor=markup=>trades.filter(trade=>String(trade.premarketMarkupId||'')===String(markup.id));
  const totalFor=markup=>linkedFor(markup).reduce((sum,trade)=>sum+Number(trade.pnl||0),0);
  const instruments=useMemo(()=>['All',...new Set(markups.map(markup=>markup.instrument).filter(Boolean))],[markups]);
  const years=useMemo(()=>['All',...new Set(markups.map(markup=>dateParts(markup.date).year).filter(Boolean))],[markups]);
  const availableMonths=useMemo(()=>['All',...new Set(markups.map(markup=>String(markup.date||'').slice(0,7)).filter(Boolean))],[markups]);
  const resetFilters=()=>{setInstrumentFilter('All');setYearFilter(currentYear);setMonthFilter('All');setWeekFilter('All');setAlignmentFilter('All');setLinkFilter('All');setResultFilter('All');setSort('Newest');setSelectedId(markups[0]?.id);};
  const rows=useMemo(()=>{
    const filtered=markups.filter(markup=>{
      const linked=linkedFor(markup), pnl=totalFor(markup), {year,day}=dateParts(markup.date);
      const isAligned=linked.length&&linked.every(trade=>String(trade.direction||'').toLowerCase()===(String(markup.bias||'').toLowerCase().startsWith('bull')?'buy':'sell'));
      return (instrumentFilter==='All'||markup.instrument===instrumentFilter)
        && (yearFilter==='All'||year===yearFilter)
        && (monthFilter==='All'||String(markup.date||'').slice(0,7)===monthFilter)
        && (weekFilter==='All'||Math.ceil(Number(day||0)/7)===Number(weekFilter))
        && (linkFilter==='All'||(linkFilter==='Linked'?linked.length>0:linked.length===0))
        && (resultFilter==='All'||(resultFilter==='Profit'?pnl>0:resultFilter==='Loss'?pnl<0:resultFilter==='Break-even'?pnl===0&&linked.length>0:linked.length===0))
        && (alignmentFilter==='All'||(alignmentFilter==='Aligned'?isAligned:alignmentFilter==='Against markup'?linked.length&&!isAligned:alignmentFilter==='Not linked'?linked.length===0:!markup.bias));
    });
    return [...filtered].sort((a,b)=>sort==='Best P&L'?totalFor(b)-totalFor(a):sort==='Worst P&L'?totalFor(a)-totalFor(b):`${b.date||''} ${b.time||''}`.localeCompare(`${a.date||''} ${a.time||''}`));
  },[markups,trades,instrumentFilter,yearFilter,monthFilter,weekFilter,alignmentFilter,linkFilter,resultFilter,sort]);
  const current=rows.find(markup=>String(markup.id)===String(selectedId))||rows[0];
  const linked=current?linkedFor(current):[];
  const pnl=current?totalFor(current):0;
  const pre=current?shots(current,'pre'):[];
  const post=current?shots(current,'post'):[];
  const plan=current?[['Structure',current.structure],['Levels / zones',current.levels],['Expectations',current.notes]].filter(([,value])=>String(value||'').trim()):[];
  const planFilled=current?Math.round(plan.length/3*100):0;
  let previous='';
  const groups=[];
  rows.forEach(markup=>{const key=monthKey(markup.date);if(key!==previous){previous=key;const sum=rows.filter(item=>monthKey(item.date)===key).reduce((total,item)=>total+totalFor(item),0);groups.push({type:'group',key,label:monthLabel(markup.date),sum});}groups.push({type:'item',markup});});
  return <section className="mk-wrap" aria-label="Markups session planner">
    <div className="mk-bar"><div className="mk-group"><button className={`mk-btn ${filtersOpen?'mk-btn-active':''}`} aria-expanded={filtersOpen} onClick={()=>{setFiltersOpen(value=>!value);setSortOpen(false);}}>Filter</button><button className={`mk-btn ${sortOpen?'mk-btn-active':''}`} aria-expanded={sortOpen} onClick={()=>{setSortOpen(value=>!value);setFiltersOpen(false);}}>Sort</button></div><span className="mk-page">Page 1 of 1</span></div>{filtersOpen&&<div className="mk-filter-panel"><div className="mk-filter-head"><strong>Filter markups</strong><div><span>{rows.length} markups match</span><button className="mk-filter-clear" onClick={resetFilters}>Clear all</button><button className="mk-filter-close" onClick={()=>setFiltersOpen(false)} aria-label="Close filters"><X/></button></div></div><div className="mk-filter-grid"><label>Instrument<ThemeSelect compact label="Instrument" value={instrumentFilter} onChange={event=>setInstrumentFilter(event.target.value)}>{instruments.map(value=><option key={value} value={value}>{value==='All'?'All Instruments':value}</option>)}</ThemeSelect></label><label>Year<ThemeSelect compact label="Year" value={yearFilter} onChange={event=>{setYearFilter(event.target.value);setMonthFilter('All');setWeekFilter('All');}}>{years.map(value=><option key={value} value={value}>{value==='All'?'All Years':value}</option>)}</ThemeSelect></label><label>Month<ThemeSelect compact label="Month" value={monthFilter} onChange={event=>{setMonthFilter(event.target.value);setWeekFilter('All');}}>{availableMonths.map(value=><option key={value} value={value}>{value==='All'?'All Months':monthLabel(`${value}-01`)}</option>)}</ThemeSelect></label><label>Week<ThemeSelect compact disabled={monthFilter==='All'} label="Week" value={weekFilter} onChange={event=>setWeekFilter(event.target.value)}><option value="All">{monthFilter==='All'?'Select a month first':'All Weeks'}</option>{[1,2,3,4,5,6].map(value=><option key={value} value={value}>Week {value}</option>)}</ThemeSelect></label><label>Alignment<ThemeSelect compact label="Alignment" value={alignmentFilter} onChange={event=>setAlignmentFilter(event.target.value)}><option value="All">All alignments</option><option>Aligned</option><option>Against markup</option><option>Not linked</option><option>No bias</option></ThemeSelect></label><label>Result<ThemeSelect compact label="Result" value={resultFilter} onChange={event=>setResultFilter(event.target.value)}><option value="All">All Results</option><option>Profit</option><option>Loss</option><option>Break-even</option><option>No linked trades</option></ThemeSelect></label></div></div>}{sortOpen&&<div className="mk-sort-panel"><strong>Sort markups</strong><div>{[['Newest first','newest'],['Oldest','oldest'],['Linked','linked'],['Unlinked','unlinked'],['Profit','profit'],['Loss','loss']].map(([label,value])=>{const active=(value==='newest'&&sort==='Newest'&&linkFilter==='All'&&resultFilter==='All')||(value==='oldest'&&sort==='Oldest')||(value==='linked'&&linkFilter==='Linked')||(value==='unlinked'&&linkFilter==='Unlinked')||(value==='profit'&&resultFilter==='Profit')||(value==='loss'&&resultFilter==='Loss');return <button key={value} className={active?'is-active':''} onClick={()=>{if(value==='newest'){setSort('Newest');setLinkFilter('All');setResultFilter('All');}if(value==='oldest'){setSort('Oldest');setLinkFilter('All');setResultFilter('All');}if(value==='linked'){setSort('Newest');setLinkFilter('Linked');setResultFilter('All');}if(value==='unlinked'){setSort('Newest');setLinkFilter('Unlinked');setResultFilter('All');}if(value==='profit'){setSort('Best P&L');setLinkFilter('Linked');setResultFilter('Profit');}if(value==='loss'){setSort('Worst P&L');setLinkFilter('Linked');setResultFilter('Loss');}setSortOpen(false);}}>{label}</button>;})}</div></div>}
    <div className={`mk-md ${current?'mk-md-has-markup':''}`}><div className="mk-list" role="listbox" aria-label="Markups">{groups.length?groups.map(entry=>entry.type==='group'?<div className="mk-gh" key={entry.key}><span>{entry.label}</span></div>:<button key={entry.markup.id} className="mk-it" aria-current={String(current?.id)===String(entry.markup.id)} onClick={()=>setSelectedId(entry.markup.id)}><span className="mk-bi">{String(entry.markup.bias||'').toLowerCase().startsWith('bull')?<ArrowUpRight/>:<ArrowDownRight/>}</span><span className="mk-a"><b>{entry.markup.instrument||'Untitled markup'}</b><span>{dateLabel(entry.markup.date)} · {entry.markup.time||'—'} · {entry.markup.market||'No session'}</span></span><span className="mk-pn"><small>{linkedFor(entry.markup).length} trade{linkedFor(entry.markup).length===1?'':'s'}</small></span></button>):<div className="mk-none">No markups match this filter.</div>}</div>
    {current?<section className="mk-dtl"><div className="mk-hd"><div><h2>{current.instrument||'Untitled markup'}<span className="mk-chip mk-chip--bias">{String(current.bias||'').toLowerCase().startsWith('bull')?<ArrowUpRight/>:<ArrowDownRight/>}{current.bias||'No bias'}</span><span className="mk-chip mk-chip--status"><Check/> {current.status||'PLANNED'}</span></h2><p className="mk-sub">{dateLabel(current.date)} · {current.time||'—'} · {current.market||'No session'}</p></div><div className="mk-acts"><button className="mk-btn mk-btn--primary" onClick={()=>onTrade?.(current)}><Plus/> Trade</button><button className="mk-icon" aria-label="Edit markup" onClick={()=>onEdit?.(current)}><Pencil/></button><div className="mk-more-menu"><button className="mk-icon" aria-label="Markup actions" aria-expanded={moreOpen} onClick={()=>setMoreOpen(open=>!open)}><MoreHorizontal/></button>{moreOpen&&<div role="menu"><button role="menuitem" onClick={()=>{setMoreOpen(false);if(window.confirm('Delete this markup?'))onDelete?.(current.id);}}>Delete markup</button></div>}</div></div></div>
      <div className="mk-out"><div className="mk-box"><div className="mk-k">Linked P&amp;L</div><div className={`mk-big ${pnl<0?'mk-neg':'mk-pos'}`}>{money(pnl)}</div><div className="mk-mut">from {linked.length} linked trade{linked.length===1?'':'s'}</div></div><div className="mk-box"><div className="mk-k">Plan filled</div><div className="mk-big">{planFilled}%</div><div className="mk-meter"><i style={{width:`${planFilled}%`}}/></div><div className="mk-mut">{pre.length+post.length} charts saved</div></div></div>
      <div className="mk-cols"><div className="mk-box"><h3>Pre-session plan</h3>{plan.length?<div className="mk-steps">{plan.map(([label,value],index)=><div className="mk-step" key={label}><i>{index+1}</i><div><div className="mk-k">{label}</div><b>{value}</b></div></div>)}</div>:<div className="mk-empty">No plan written yet</div>}</div><div className="mk-box"><h3>Linked trades <span>{linked.length} linked</span></h3>{linked.length?<div className="mk-linked-list">{linked.map(trade=><div className="mk-trade" key={trade.id}><div><b>{trade.asset||'Trade'} · {trade.direction||'—'}</b><span>{dateLabel(trade.date)} · {trade.time||'—'} · R:R {trade.rr?`${Number(trade.rr).toFixed(2)}R`:'—'}</span></div><span className={`mk-tp ${Number(trade.pnl)<0?'mk-neg':'mk-pos'}`}>{money(trade.pnl)}</span></div>)}</div>:<div className="mk-empty">No trades linked yet</div>}</div></div>
      <div className="mk-lanes"><div className="mk-box"><h3>Pre-session charts <span>{pre.length} charts</span></h3><Charts items={pre} empty="No pre-session charts yet" onView={onViewImage}/></div><div className="mk-box"><h3>Post-session charts <span>{post.length} charts</span></h3><Charts items={post} empty="No post-session charts yet" onView={onViewImage}/></div></div>
    </section>:<div className="mk-none">Nothing to show.</div>}</div></section>;
}
