import {useEffect, useMemo, useState} from 'react';
import {ArrowDownRight, ArrowDownUp, ArrowUpRight, Check, MoreHorizontal, Pencil, Plus, ScanLine, SlidersHorizontal, Trash2, X} from 'lucide-react';
import {ThemeSelect} from './JournalControls';
import {loadJournalImage} from './journalCloudCache';
import {useConfirmation} from './ConfirmationDialog.jsx';
import {markupStatus} from './markupLifecycle.js';
import './markupsRedesign.css';
import './desktopMarkups.css';

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
function Charts({items,empty,onView}) { return items.length ? <div className="mk2-shots">{items.map((item,index)=><MarkupChart key={index} item={item} onView={onView}/>)}</div> : <div className="mk2-empty"><b>No charts saved</b>{empty}</div>; }

export default function MarkupsRedesign({markups=[],trades=[],onNew,onEdit,onDelete,onTrade,onViewImage}) {
  const confirm=useConfirmation();
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
  const statusFor=markup=>linkedFor(markup).length ? 'Executed' : markupStatus(markup.status);
  const statusClass=status=>String(status||'Planned').toLowerCase().replace(/\s+/g,'-');
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
    return [...filtered].sort((a,b)=>sort==='Best P&L'?totalFor(b)-totalFor(a):sort==='Worst P&L'?totalFor(a)-totalFor(b):sort==='Oldest'?`${a.date||''} ${a.time||''}`.localeCompare(`${b.date||''} ${b.time||''}`):`${b.date||''} ${b.time||''}`.localeCompare(`${a.date||''} ${a.time||''}`));
  },[markups,trades,instrumentFilter,yearFilter,monthFilter,weekFilter,alignmentFilter,linkFilter,resultFilter,sort]);
  const current=rows.find(markup=>String(markup.id)===String(selectedId))||rows[0];
  const linked=current?linkedFor(current):[];
  const pnl=current?totalFor(current):0;
  const pre=current?shots(current,'pre'):[];
  const post=current?shots(current,'post'):[];
  const plan=current?[['Structure',current.structure],['Levels / zones',current.levels],['Expectations',current.notes]].filter(([,value])=>String(value||'').trim()):[];
  const planFilled=current?Math.round(plan.length/3*100):0;
  const sorts=[['Newest first','newest'],['Oldest','oldest'],['Linked','linked'],['Unlinked','unlinked'],['Profit','profit'],['Loss','loss']];
  const sortActive=value=>(value==='newest'&&sort==='Newest'&&linkFilter==='All'&&resultFilter==='All')||(value==='oldest'&&sort==='Oldest'&&linkFilter==='All'&&resultFilter==='All')||(value==='linked'&&linkFilter==='Linked'&&resultFilter==='All')||(value==='unlinked'&&linkFilter==='Unlinked')||(value==='profit'&&resultFilter==='Profit')||(value==='loss'&&resultFilter==='Loss');
  const applySort=value=>{if(value==='newest'){setSort('Newest');setLinkFilter('All');setResultFilter('All');}if(value==='oldest'){setSort('Oldest');setLinkFilter('All');setResultFilter('All');}if(value==='linked'){setSort('Newest');setLinkFilter('Linked');setResultFilter('All');}if(value==='unlinked'){setSort('Newest');setLinkFilter('Unlinked');setResultFilter('All');}if(value==='profit'){setSort('Best P&L');setLinkFilter('Linked');setResultFilter('Profit');}if(value==='loss'){setSort('Worst P&L');setLinkFilter('Linked');setResultFilter('Loss');}};
  const activeSort=sorts.find(([,value])=>sortActive(value));
  const byDate=!activeSort||activeSort[1]==='newest'||activeSort[1]==='oldest';
  const groups=byDate?Array.from(rows.reduce((all,markup)=>{const key=monthKey(markup.date);if(!all.has(key))all.set(key,{key,label:monthLabel(markup.date),items:[]});all.get(key).items.push(markup);return all;},new Map()).values()):(rows.length?[{key:'sorted',label:activeSort[0],items:rows}]:[]);
  const filterCount=[instrumentFilter,monthFilter,weekFilter,alignmentFilter,linkFilter,resultFilter].filter(value=>value!=='All').length+(yearFilter!==currentYear?1:0);
  const clearFilters=()=>{setInstrumentFilter('All');setYearFilter(currentYear);setMonthFilter('All');setWeekFilter('All');setAlignmentFilter('All');setLinkFilter('All');setResultFilter('All');};
  const biasOf=markup=>String(markup.bias||'').toLowerCase().startsWith('bull')?'bull':String(markup.bias||'').toLowerCase().startsWith('bear')?'bear':'none';
  const biasIcon=(bias,size)=>bias==='bull'?<ArrowUpRight size={size} aria-hidden="true"/>:bias==='bear'?<ArrowDownRight size={size} aria-hidden="true"/>:<ScanLine size={size} aria-hidden="true"/>;
  const count=(value,word)=>`${value} ${word}${value===1?'':'s'}`;
  return <section className="mk2" aria-label="Markups session planner">
    <div className="mk2-toolbar">
      <button type="button" className={`mk2-tool ${filtersOpen?'is-on':''}`} aria-expanded={filtersOpen} onClick={()=>{setFiltersOpen(value=>!value);setSortOpen(false);}}><SlidersHorizontal size={15} aria-hidden="true"/>Filter{filterCount>0&&<b>{filterCount}</b>}</button>
      <button type="button" className={`mk2-tool ${sortOpen?'is-on':''}`} aria-expanded={sortOpen} onClick={()=>{setSortOpen(value=>!value);setFiltersOpen(false);}}><ArrowDownUp size={15} aria-hidden="true"/>Sort</button>
      <button type="button" className="mk2-tool" onClick={()=>{resetFilters();setFiltersOpen(false);setSortOpen(false);}}>Reset</button>
      <span className="mk2-count mk2-num">{count(rows.length,'markup')}{yearFilter==='All'?'':` · ${yearFilter}`}</span>
    </div>
    <div className={`mk2-panel ${filtersOpen?'is-open':''}`} aria-hidden={!filtersOpen}><div><div className="mk2-card mk2-pad">
      <div className="mk2-row"><div><h4>Filter markups</h4><p className="mk2-sub">Narrow the list by instrument, date, alignment with your trade, or result.</p></div><div className="mk2-panel-actions"><span className="mk2-match mk2-num">{rows.length} {rows.length===1?'markup matches':'markups match'}</span><button type="button" className="mk2-small" tabIndex={filtersOpen?0:-1} onClick={clearFilters}>Clear all</button><button type="button" className="mk2-icon is-small" aria-label="Close filters" tabIndex={filtersOpen?0:-1} onClick={()=>setFiltersOpen(false)}><X size={14}/></button></div></div>
      <div className="mk2-filter-grid">
        <div className="mk2-field"><span>Instrument</span><ThemeSelect compact label="Instrument" value={instrumentFilter} onChange={event=>setInstrumentFilter(event.target.value)}>{instruments.map(value=><option key={value} value={value}>{value==='All'?'All Instruments':value}</option>)}</ThemeSelect></div>
        <div className="mk2-field"><span>Year</span><ThemeSelect compact label="Year" value={yearFilter} onChange={event=>{setYearFilter(event.target.value);setMonthFilter('All');setWeekFilter('All');}}>{years.map(value=><option key={value} value={value}>{value==='All'?'All Years':value}</option>)}</ThemeSelect></div>
        <div className="mk2-field"><span>Month</span><ThemeSelect compact label="Month" value={monthFilter} onChange={event=>{setMonthFilter(event.target.value);setWeekFilter('All');}}>{availableMonths.map(value=><option key={value} value={value}>{value==='All'?'All Months':monthLabel(`${value}-01`)}</option>)}</ThemeSelect></div>
        <div className="mk2-field"><span>Week</span><ThemeSelect compact disabled={monthFilter==='All'} label="Week" value={weekFilter} onChange={event=>setWeekFilter(event.target.value)}><option value="All">{monthFilter==='All'?'Select a month first':'All Weeks'}</option>{[1,2,3,4,5,6].map(value=><option key={value} value={value}>Week {value}</option>)}</ThemeSelect></div>
        <div className="mk2-field"><span>Alignment</span><ThemeSelect compact label="Alignment" value={alignmentFilter} onChange={event=>setAlignmentFilter(event.target.value)}><option value="All">All alignments</option><option>Aligned</option><option>Against markup</option><option>Not linked</option><option>No bias</option></ThemeSelect></div>
        <div className="mk2-field"><span>Result</span><ThemeSelect compact label="Result" value={resultFilter} onChange={event=>setResultFilter(event.target.value)}><option value="All">All Results</option><option>Profit</option><option>Loss</option><option>Break-even</option><option>No linked trades</option></ThemeSelect></div>
      </div>
    </div></div></div>
    <div className={`mk2-panel ${sortOpen?'is-open':''}`} aria-hidden={!sortOpen}><div><div className="mk2-card mk2-pad">
      <h4>Sort markups</h4><p className="mk2-sub">Choose how the list is ordered.</p>
      <div className="mk2-sort-grid">{sorts.map(([label,value])=><button type="button" key={value} className={`mk2-sort ${sortActive(value)?'is-on':''}`} aria-pressed={sortActive(value)} tabIndex={sortOpen?0:-1} onClick={()=>applySort(value)}>{label}</button>)}</div>
    </div></div></div>
    {rows.length?<div className="mk2-layout">
      <aside className="mk2-card mk2-list" aria-label="Markups"><div className="mk2-list-scroll">{groups.map(group=><div key={group.key} role="group" aria-label={group.label}>
        <div className="mk2-month-head"><span>{group.label}</span><span className="mk2-num">{count(group.items.length,'markup')}</span></div>
        {group.items.map(markup=>{const bias=biasOf(markup),links=linkedFor(markup).length,on=String(current?.id)===String(markup.id);return <button type="button" key={markup.id} className={`mk2-item ${on?'is-on':''}`} aria-pressed={on} onClick={()=>setSelectedId(markup.id)}>
          <span className={`mk2-bias-icon is-${bias}`}>{biasIcon(bias,16)}</span>
          <span className="mk2-item-copy"><b>{markup.instrument||'Untitled markup'}</b><small className="mk2-num">{dateLabel(markup.date)} · {markup.time||'—'} · {markup.market||'No session'}</small></span>
          <span className={`mk2-pill ${links?'is-gain':''}`}>{count(links,'trade')}</span>
        </button>;})}
      </div>)}</div></aside>
      {current&&<section className="mk2-detail" aria-label="Markup detail">
        <div className="mk2-card mk2-head">
          <div className="mk2-head-copy"><h2>{current.instrument||'Untitled markup'}<span className={`mk2-chip is-${biasOf(current)}`}>{biasOf(current)!=='none'&&biasIcon(biasOf(current),13)}{current.bias||'No bias'}</span><span className={`mk-chip mk-chip--status mk-chip--status-${statusClass(statusFor(current))}`}>{statusFor(current)==='Executed'&&<Check size={13} aria-hidden="true"/>}{statusFor(current)}</span></h2><p className="mk2-num">{dateLabel(current.date)} · {current.time||'—'} · {current.market||'No session'}</p></div>
          <div className="mk2-actions"><button type="button" className="mk2-btn is-primary" onClick={()=>onTrade?.(current)}><Plus size={15} aria-hidden="true"/>Trade</button><button type="button" className="mk2-icon" title="Edit markup" aria-label="Edit markup" onClick={()=>onEdit?.(current)}><Pencil size={15}/></button><div className="mk2-more"><button type="button" className="mk2-icon" aria-label="Markup actions" aria-expanded={moreOpen} onClick={()=>setMoreOpen(open=>!open)}><MoreHorizontal size={16}/></button>{moreOpen&&<div role="menu"><button type="button" role="menuitem" className="mk2-menu-delete" onClick={async()=>{setMoreOpen(false);if(await confirm({title:'Delete markup?',description:'Delete this markup? This cannot be undone.',confirmLabel:'Delete markup'}))onDelete?.(current.id);}}><Trash2 size={14} aria-hidden="true"/>Delete markup</button></div>}</div></div>
        </div>
        <div className="mk2-card mk2-summary">
          <div><small>Linked P&amp;L</small><div className={`mk2-value mk2-num ${linked.length?(pnl<0?'is-loss':'is-gain'):''}`}>{linked.length?money(pnl):'—'}</div><em>{linked.length?`from ${count(linked.length,'linked trade')}`:'No linked trades yet'}</em></div>
          <div><small>Plan filled</small><div className="mk2-value mk2-num">{planFilled}%</div><div className="mk2-bar"><i data-chart-fill="horizontal" style={{width:`${planFilled}%`}}/></div><em>{pre.length+post.length?`${count(pre.length+post.length,'chart')} saved`:'No charts saved'}</em></div>
        </div>
        <div className="mk2-two">
          <div className="mk2-card mk2-pad"><h3>Pre-session plan</h3>{plan.length?<div className="mk2-steps">{plan.map(([label,value],index)=><div className="mk2-step" key={label}><i>{index+1}</i><div><small>{label}</small><p>{value}</p></div></div>)}</div>:<div className="mk2-empty"><b>No plan saved</b>Write the structure, levels and expectations before the session.</div>}</div>
          <div className="mk2-card mk2-pad"><div className="mk2-row"><h3>Linked trades</h3><span className="mk2-pill">{linked.length} linked</span></div>{linked.length?<div className="mk2-trades">{linked.map(trade=><div className="mk2-trade" key={trade.id}><div><b>{trade.asset||'Trade'} · {trade.direction||'—'}</b><small className="mk2-num">{dateLabel(trade.date)} · {trade.time||'—'} · R:R {trade.rr?`${Number(trade.rr).toFixed(2)}R`:'—'}</small></div><b className={`mk2-num ${Number(trade.pnl)<0?'is-loss':'is-gain'}`}>{money(trade.pnl)}</b></div>)}</div>:<div className="mk2-empty"><b>No linked trades</b>Use “+ Trade” to log a trade against this markup.</div>}</div>
        </div>
        <div className="mk2-two">
          <div className="mk2-card mk2-pad"><div className="mk2-row"><h3>Pre-session charts</h3><span className="mk2-pill">{count(pre.length,'chart')}</span></div><Charts items={pre} empty="Add a chart to capture the context." onView={onViewImage}/></div>
          <div className="mk2-card mk2-pad"><div className="mk2-row"><h3>Post-session charts</h3><span className="mk2-pill">{count(post.length,'chart')}</span></div><Charts items={post} empty="Add a chart after the session to compare." onView={onViewImage}/></div>
        </div>
      </section>}
    </div>:<div className="mk2-card mk2-pad"><div className="mk2-empty"><b>{markups.length?'No markups match':'No markups yet'}</b>{markups.length?'Try another filter.':'Create a markup to plan the session before you trade.'}<button type="button" className="mk2-btn is-primary" onClick={()=>markups.length?clearFilters():onNew?.()}>{markups.length?'Clear filters':<><Plus size={15} aria-hidden="true"/>New markup</>}</button></div></div>}
  </section>;
}
