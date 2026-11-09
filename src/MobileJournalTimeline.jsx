import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowRight, ChevronDown, ChevronLeft, ChevronUp, Ellipsis, ImagePlus, Pencil, Plus, Search, SlidersHorizontal, X} from 'lucide-react';
import {ThemeSelect} from './JournalControls.jsx';
import PhoneHeaderSlot from './PhoneHeaderSlot.jsx';
import {useNavStep} from './useBackNavigation.js';
import {useStepMotion} from './MobilePageStage.jsx';
import {phoneScrollTarget} from './phoneScroll.js';
import {PHONE_LOG_TITLE, PHONE_REVIEW_NEEDED} from './mobileTradeFilters.js';
import {journalActiveFilters, journalClearFilter, journalFilterOptions, journalHeldLabel, journalMonths, journalNewestFirst, journalTradeMoney} from './mobileJournalTimeline.js';
import './mobileJournalTimeline.css';

const PAGE_SIZE = 40, TAPE_LIMIT = 30;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const tone = value => Number(value) > 0 ? 'pos' : Number(value) < 0 ? 'neg' : '';
const rrText = value => Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}R` : '—';
const asDate = value => new Date(`${value}T12:00:00`);

function Tape({rows, money, onOpen}) {
  const shown = rows.slice(0, TAPE_LIMIT).reverse();
  if(!shown.length) return null;
  const width = 330, maximum = Math.max(1, ...shown.map(row => Math.abs(row.trade.pnl))), step = width / shown.length, bar = Math.min(26, step * .62);
  return <svg className="tj-jr-tape" viewBox={`0 0 ${width} 70`} preserveAspectRatio="none" role="img" aria-label={`P&L of the last ${shown.length} closed trades. Tap a bar to open that trade.`}>
    <line x1="0" x2={width} y1="35" y2="35" stroke="var(--border)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
    {shown.map((row, index) => { const pnl = row.trade.pnl, height = Math.max(4, Math.abs(pnl) / maximum * 30), x = step * index + (step - bar) / 2; return <rect key={row.trade.id} x={x} y={pnl >= 0 ? 35 - height : 35} width={bar} height={height} rx={Math.min(6, bar / 2)} fill={pnl >= 0 ? 'var(--phone-gain)' : 'var(--phone-drop)'} opacity=".9" style={{cursor:'pointer'}} onClick={() => onOpen(row.trade.id)}><title>{money(pnl)}</title></rect>; })}
  </svg>;
}

function FilterSheet({filters, onFilters, onReset, count, options, onClose}) {
  const dialog = useRef(null);
  useEffect(() => {
    const prior = document.activeElement;
    const siblings = [...document.querySelectorAll('.tj-topbar,.tj-mobile-bottom')], states = siblings.map(node => [node, node.inert]);
    siblings.forEach(node => { node.inert = true; });
    dialog.current?.querySelector('button')?.focus();
    const key = event => {
      if(event.key === 'Escape'){event.stopPropagation();onClose();}
      if(event.key === 'Tab'){const nodes = [...dialog.current.querySelectorAll('button')].filter(node => !node.disabled), first = nodes[0], last = nodes.at(-1); if(event.shiftKey && document.activeElement === first){event.preventDefault();last?.focus();} else if(!event.shiftKey && document.activeElement === last){event.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); states.forEach(([node, inert]) => { node.inert = inert; }); requestAnimationFrame(() => prior?.isConnected && prior.focus()); };
  }, [onClose]);
  const group = (label, key, values, all = '') => <div className="tj-jr-fgroup" key={key}><span>{label}</span><div>{values.map(([value, text]) => <button type="button" key={value || 'all'} aria-pressed={(filters[key] ?? all) === value} onClick={() => onFilters({...filters, [key]:value, ...(key === 'month' ? {week:''} : {})})}><i>{text}</i></button>)}</div></div>;
  const list = (values, format = value => value) => [['', 'All'], ...values.map(value => [value, format(value)])];
  return <div className="tj-jr-sheet-layer"><div className="tj-jr-sheet-scrim" onClick={onClose}/><section ref={dialog} className="tj-jr-sheet" role="dialog" aria-modal="true" aria-labelledby={PHONE_LOG_TITLE}>
    <button type="button" className="tj-jr-grab" aria-label="Close filters" onClick={onClose}><i/></button>
    <header><h2 id={PHONE_LOG_TITLE}>Filter trades</h2><span>{count} trade{count === 1 ? '' : 's'} match</span></header>
    <div className="tj-jr-sheet-body">
      {group('Result', 'result', [['All','All'],['win','Wins'],['loss','Losses'],['be','Break-even'],['running','Running']], 'All')}
      {group('Instrument', 'instrument', list(options.instruments))}
      {group('Year', 'year', list(options.years))}
      {group('Month', 'month', list(options.months, value => MONTHS[Number(value) - 1] || value))}
      {filters.month ? group('Week', 'week', [['','All'],...['1','2','3','4','5'].map(week => [week, `W${week}`])]) : <div className="tj-jr-fgroup"><span>Week</span><p>Select a month first</p></div>}
      <div className="tj-jr-fgroup"><span>Session</span><div>{[...new Set(['Asia','London','NY AM','NY PM'])].map(session => <button type="button" key={session} aria-pressed={filters.sessions.includes(session)} onClick={() => onFilters({...filters, sessions:filters.sessions.includes(session) ? filters.sessions.filter(item => item !== session) : [...filters.sessions, session]})}><i>{session}</i></button>)}</div></div>
      {group('Entry model', 'model', list(options.models))}
      {group('Direction', 'direction', [['All','All'],['BUY','Buy'],['SELL','Sell']], 'All')}
      {group('Review', 'review', [['All','All'],[PHONE_REVIEW_NEEDED,'Needs review'],['reviewed','Reviewed']], 'All')}
    </div>
    <footer><button type="button" onClick={onReset}>Clear all</button><button type="button" className="is-go" onClick={onClose}>Show {count}</button></footer>
  </section></div>;
}

function TradeList({rows, netPnl, money, filters, onFilters, onReset, options, search, onSearch, onOpen, count, onNewTrade, locked}) {
  const [sheet,setSheet] = useState(false), [searching,setSearching] = useState(Boolean(search)), [limit,setLimit] = useState(PAGE_SIZE);
  useEffect(() => setLimit(PAGE_SIZE), [filters, search]);
  const closed = rows.filter(row => !row.running), wins = closed.filter(row => row.trade.pnl > 0).length, losses = closed.filter(row => row.trade.pnl < 0).length;
  const chips = journalActiveFilters(filters);
  const months = useMemo(() => journalMonths(rows.slice(0, limit).map(row => row.trade)), [rows, limit]);
  const byId = useMemo(() => new Map(rows.map(row => [row.trade.id, row])), [rows]);
  const closeSheet = React.useCallback(() => setSheet(false), []);
  useNavStep('trade-filters', sheet, closeSheet);
  return <>
    <PhoneHeaderSlot><div className="tj-jr-actions"><button type="button" aria-label="Search trades" aria-expanded={searching} onClick={() => { if(searching) onSearch(''); setSearching(open => !open); }}><span><Search size={16}/></span></button><button type="button" aria-label="Filter trades" onClick={() => setSheet(true)}><span><SlidersHorizontal size={16}/>{chips.length > 0 && <b>{chips.length}</b>}</span></button></div></PhoneHeaderSlot>
    {searching && <label className="tj-jr-search"><Search size={16} aria-hidden="true"/><input type="search" autoFocus value={search} onChange={event => onSearch(event.target.value)} placeholder="Search trades, notes, instruments" aria-label="Search trades"/></label>}
    <section className="tj-jr-hero"><small>Net P&amp;L{chips.length || search ? ' · filtered' : ''}</small><strong className={tone(netPnl)}>{money(netPnl)}</strong><p>{count} trade{count === 1 ? '' : 's'} · {wins} win{wins === 1 ? '' : 's'} · {losses} loss{losses === 1 ? '' : 'es'}</p><Tape rows={closed} money={money} onOpen={onOpen}/></section>
    <div className="tj-jr-log-trade-wrap"><button type="button" className="tj-jr-log-trade" disabled={locked} onClick={onNewTrade} aria-label={locked ? 'Trade entry is locked' : 'Log Trade'} title={locked ? 'Trade entry is paused by the account loss limit' : undefined}><Plus size={20}/></button></div>
    {chips.length > 0 && <div className="tj-jr-active" data-scroll-row="true">{chips.map(chip => <button type="button" key={`${chip.key}-${chip.label}`} aria-label={`Remove filter ${chip.label}`} onClick={() => onFilters(journalClearFilter(filters, chip))}><span>{chip.label}<X size={13}/></span></button>)}</div>}
    {months.map(month => { const total = rows.filter(row => (row.trade.date || row.trade.closeDate || '').startsWith(month.key) && !row.running).reduce((sum, row) => sum + row.trade.pnl, 0), label = month.key === 'undated' ? 'Undated' : asDate(`${month.key}-15`).toLocaleDateString(undefined, {month:'short', year:'numeric'}); return <div className="tj-jr-month" key={month.key}>
      <div className="tj-jr-month-head"><b>{label}</b><span className={tone(total)}>{money(total)}</span></div>
      {month.trades.map((trade, index) => { const row = byId.get(trade.id), info = row, previous = month.trades[index - 1], day = trade.date ? asDate(trade.date) : null, dot = info.running ? 'is-run' : trade.pnl < 0 ? 'is-loss' : 'is-win'; return <button type="button" key={trade.id} className="tj-jr-event" onClick={() => onOpen(trade.id)}>
        <span className="tj-jr-date">{previous?.date !== trade.date && day ? <><b>{day.getDate()}</b><small>{day.toLocaleDateString(undefined, {weekday:'short'})}</small></> : null}</span>
        <span className={`tj-jr-dot ${dot}`} aria-hidden="true"/>
        <span className="tj-jr-card"><span className="tj-jr-card-top"><span><b>{trade.asset || 'No instrument'}</b><em className={trade.direction === 'BUY' ? 'is-buy' : 'is-sell'}>{trade.direction}</em></span><i className={dot}>{info.running ? 'Running' : rrText(trade.rr)}</i></span><span className="tj-jr-card-bottom"><span>{[trade.time, trade.entrySession || trade.session, trade.entryType || trade.confluenceSession].filter(Boolean).join(' · ')}</span><span className={tone(trade.pnl)}>{info.running ? '' : money(trade.pnl)}</span></span></span>
      </button>; })}
    </div>; })}
    {rows.length > limit && <button type="button" className="tj-jr-more" onClick={() => setLimit(value => value + PAGE_SIZE)}><span>Show {Math.min(PAGE_SIZE, rows.length - limit)} more</span></button>}
    {!rows.length && <div className="tj-jr-empty"><p>No trades match these filters.</p><button type="button" onClick={onReset}>Clear filters</button></div>}
    {sheet && <FilterSheet filters={filters} onFilters={onFilters} onReset={onReset} count={count} options={options} onClose={closeSheet}/>}
  </>;
}

function Ring({checked, total}) {
  const size = 64, stroke = 7, radius = (size - stroke) / 2, length = 2 * Math.PI * radius, share = total ? checked / total : 0;
  return <span className="tj-jr-ring"><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--phone-track)" strokeWidth={stroke}/><circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--phone-gain)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(length * share).toFixed(1)} ${length.toFixed(1)}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}/></svg><b>{total ? `${checked}/${total}` : '—'}</b></span>;
}

function TradeDetail({row, position, total, money, date, balances, markups, noteOf, renderScreenshot, onStep, onReview, onEdit, onDelete, onLinkMarkup}) {
  const {trade, running, result} = row;
  const [tab,setTab] = useState('Overview'), [actions,setActions] = useState(false), [confirming,setConfirming] = useState(false), [link,setLink] = useState(trade.premarketMarkupId || '');
  useEffect(() => { setActions(false); setConfirming(false); setLink(trade.premarketMarkupId || ''); }, [trade.id, trade.premarketMarkupId]);
  const figures = journalTradeMoney(trade, balances), held = journalHeldLabel(trade), note = noteOf(trade);
  const rules = trade.ruleEvaluations || [], checked = rules.filter(rule => rule.checked).length;
  const confluences = trade.confluence || trade.types || [], mistakes = trade.mistakes || [];
  const linked = markups.find(markup => markup.id === trade.premarketMarkupId);
  const maximum = Math.max(1e-9, ...figures.accounts.map(account => Math.abs(account.pnl)));
  const tabs = ['Overview','Process','Media','Notes'], tabIndex = tabs.indexOf(tab);
  const tile = (label, value, tint = '', extra = '') => <div className="tj-jr-tile"><small>{label}</small><b className={`${tint} ${extra}`}>{value}</b></div>;
  return <>
    <PhoneHeaderSlot><div className="tj-jr-detail-nav"><div><button type="button" aria-label="Older trade" disabled={position >= total - 1} onClick={() => onStep(1)}><span><ChevronUp size={16}/></span></button><small>{position + 1} / {total}</small><button type="button" aria-label="Newer trade" disabled={position <= 0} onClick={() => onStep(-1)}><span><ChevronDown size={16}/></span></button></div></div></PhoneHeaderSlot>
    <section className={`tj-jr-detail-hero is-${running ? 'run' : trade.pnl > 0 ? 'win' : trade.pnl < 0 ? 'loss' : 'flat'}`}>
      <h2>{trade.asset || 'No instrument'}<em className={trade.direction === 'BUY' ? 'is-buy' : 'is-sell'}>{trade.direction}</em></h2>
      <p>{trade.date ? date(trade.date) : '—'} · {trade.entrySession || trade.session || 'No session'}</p>
      <strong className={running ? 'amb' : tone(trade.pnl)}>{running ? 'Open' : rrText(trade.rr)}</strong>
      {!running && <div className={`tj-jr-detail-money ${tone(trade.pnl)}`}>{money(trade.pnl)} <span>· {row.return >= 0 ? '+' : ''}{row.return.toFixed(2)}% net return</span></div>}
      {held && <div className="tj-jr-held"><div>Entry<b>{trade.time}</b></div><div><span>Held {held}</span></div><div>Exit<b>{trade.closeTime}</b></div></div>}
      <div className="tj-jr-detail-actions"><button type="button" className="is-primary" disabled={running} onClick={() => onReview(trade, row.reviewed)}>{running ? 'Trade open' : row.reviewed ? 'Reviewed' : 'Write review'}</button><button type="button" aria-label="Edit trade" onClick={() => onEdit(trade)}><Pencil size={18}/></button><button type="button" aria-label="More actions" aria-expanded={actions} onClick={() => { setActions(open => !open); setConfirming(false); }}><Ellipsis size={18}/></button></div>
      {actions && <button type="button" className={`tj-jr-delete ${confirming ? 'is-armed' : ''}`} onClick={() => { if(confirming) onDelete(trade.id); else setConfirming(true); }}>{confirming ? 'Tap again to permanently delete' : 'Delete trade'}</button>}
    </section>
    <div className="tj-jr-tabs" role="tablist" aria-label="Trade sections" style={{'--tab-index':tabIndex}}><i aria-hidden="true"/>{tabs.map(name => <button type="button" role="tab" key={name} aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div>
    {tab === 'Overview' && <><div className="tj-jr-tiles">{tile('Gross P&L', figures.gross == null ? '—' : money(figures.gross), tone(figures.gross))}{tile('Costs', figures.costs ? money(-Math.abs(figures.costs)) : '—')}{tile('Held for', held || '—')}{tile('Entry model', trade.entryType || trade.confluenceSession || '—', '', 'is-text')}</div>
      <article className="tj-jr-panel"><header><h3>By account</h3>{figures.accounts.length > 0 && <small>{money(trade.pnl)}</small>}</header>{figures.accounts.length ? <>{figures.accounts.length > 1 && <div className="tj-jr-split">{figures.accounts.map(account => <i key={account.id} className={account.pnl < 0 ? 'is-loss' : ''} style={{flex:Math.abs(account.pnl) / maximum || .02}}/>)}</div>}{figures.accounts.map(account => <div className="tj-jr-account" key={account.id}><span>{account.name}</span><b className={tone(account.pnl)}>{money(account.pnl)}</b></div>)}</> : <p>Account split was not recorded for this trade.</p>}</article></>}
    {tab === 'Process' && <><article className="tj-jr-panel tj-jr-rules"><Ring checked={checked} total={rules.length}/><div><b>Rules checked</b><small>{rules.length ? checked === rules.length ? 'Every rule confirmed' : `${rules.length - checked} not confirmed` : 'Not recorded'}</small></div></article>
      <article className="tj-jr-panel"><header><h3>Mood shift</h3></header>{trade.moodBefore || trade.moodAfter ? <div className="tj-jr-mood"><span className="tj-jr-chip is-ok">{trade.moodBefore || '—'}</span><ArrowRight size={16}/><span className="tj-jr-chip is-bad">{trade.moodAfter || '—'}</span></div> : <p>Not recorded.</p>}</article>
      <article className="tj-jr-panel"><header><h3>Mistakes</h3><small>{mistakes.length}</small></header>{mistakes.length ? <div className="tj-jr-chips">{mistakes.map(item => <span className="tj-jr-chip is-bad" key={item}>{item}</span>)}</div> : <p>None logged.</p>}</article>
      <article className="tj-jr-panel"><header><h3>Confluences</h3><small>{confluences.length} logged</small></header>{confluences.length ? <div className="tj-jr-chips">{confluences.map(item => <span className="tj-jr-chip is-ok" key={item}>{item}</span>)}</div> : <p>Nothing tagged on this trade.</p>}<button type="button" className="tj-jr-add" onClick={() => onEdit(trade)}><span><Plus size={14}/>Edit confluences</span></button></article></>}
    {tab === 'Media' && (row.screenshots.length ? <><div className="tj-jr-shots" data-scroll-row="true">{row.screenshots.map(shot => <div className="tj-jr-shot" key={shot.key}>{renderScreenshot(shot)}<span>{shot.label}</span></div>)}</div><p className="tj-jr-shots-note">{row.screenshots.length} saved{row.screenshots.length > 1 ? ' · swipe' : ''}</p></> : <article className="tj-jr-panel"><p>No screenshots saved.</p><button type="button" className="tj-jr-add is-wide" onClick={() => onEdit(trade)}><span><ImagePlus size={16}/>Add image</span></button></article>)}
    {tab === 'Notes' && <><article className="tj-jr-panel"><header><h3>Note</h3></header>{note ? <div className="tj-jr-note">{note}</div> : <p>No note yet.</p>}</article>
      <article className="tj-jr-panel"><header><h3>Linked markup</h3><small>{linked ? linked.status || 'Linked' : 'Not linked'}</small></header><ThemeSelect label="Linked markup" value={link} onChange={event => setLink(event.target.value)}><option value="">No linked markup</option>{markups.map(markup => <option key={markup.id} value={markup.id}>{[markup.date, markup.instrument, markup.bias].filter(Boolean).join(' · ')}</option>)}</ThemeSelect><button type="button" className="tj-jr-add is-wide" disabled={link === (trade.premarketMarkupId || '')} onClick={() => onLinkMarkup(trade, link)}><span>Save link</span></button></article></>}
  </>;
}

export default function MobileJournalTimeline({trades, allTrades, decorate, netPnl, count, filters, onFilters, onReset, search, onSearch, money, date, balances, markups, noteOf, renderScreenshot, onReview, onEdit, onDelete, onLinkMarkup, onNewTrade, locked=false}) {
  const rootRef = useRef(null), listScroll = useRef(0);
  const [selected,setSelected] = useState(null);
  useNavStep('trade-detail', !!selected, () => setSelected(null));
  const rows = useMemo(() => journalNewestFirst(trades).map(decorate), [trades, decorate]);
  const options = useMemo(() => journalFilterOptions(allTrades), [allTrades]);
  const content = () => phoneScrollTarget(rootRef.current);
  const position = rows.findIndex(row => row.trade.id === selected);
  useStepMotion(position >= 0 ? 1 : 0);
  const open = id => { listScroll.current = content()?.scrollTop || 0; setSelected(id); };
  useEffect(() => { if(selected) content()?.scrollTo({top:0}); }, [selected]);
  const back = () => { setSelected(null); requestAnimationFrame(() => content()?.scrollTo({top:listScroll.current})); };
  useEffect(() => { if(selected && position < 0) setSelected(null); }, [selected, position]);
  return <main className="tj-jr" aria-label="Trade Logs" ref={rootRef}>
    {position >= 0 ? <TradeDetail row={rows[position]} position={position} total={rows.length} money={money} date={date} balances={balances} markups={markups} noteOf={noteOf} renderScreenshot={renderScreenshot} onStep={delta => setSelected(rows[position + delta]?.trade.id ?? selected)} onReview={onReview} onEdit={onEdit} onDelete={onDelete} onLinkMarkup={onLinkMarkup}/>
    : <TradeList rows={rows} netPnl={netPnl} money={money} filters={filters} onFilters={onFilters} onReset={onReset} options={options} search={search} onSearch={onSearch} onOpen={open} count={count} onNewTrade={onNewTrade} locked={locked}/>}
  </main>;
}
