import React, {useEffect, useMemo, useRef, useState} from 'react';
import {CalendarDays, ChevronDown, ChevronRight, ChevronUp, LineChart, ShieldCheck, TriangleAlert} from 'lucide-react';
import {ThemeSelect} from './JournalControls.jsx';
import PhoneHeaderSlot from './PhoneHeaderSlot.jsx';
import {markupStatus} from './markupLifecycle.js';
import {mobileChartLine, mobileSmoothPath} from './mobileDashboardV6.js';
import {pulseBreakdown, pulseInsights, pulseMoney, pulseMonthly, pulseTicks} from './mobileAnalyticsPulse.js';
import {scrollPhoneTo} from './phoneScroll.js';
import './mobileAnalyticsPulse.css';

const tone = value => Number(value) > 0 ? 'pos' : Number(value) < 0 ? 'neg' : '';
const NOTE_ICONS = {chart:LineChart, warn:TriangleAlert, shield:ShieldCheck};
const LENSES = [['equity','Equity'],['daily','Daily'],['monthly','Monthly']];
const BREAKDOWNS = [['model','Entry model'],['conf','Confluence'],['inst','Instrument'],['session','Session'],['plan','Markup plan']];
const LIST_LIMIT = 5, DAILY_LIMIT = 14;
const CHART = {width:340, height:170, top:12, bottom:40};

function Ring({percent, size = 38, stroke = 5}) {
  const radius = (size - stroke) / 2, length = 2 * Math.PI * radius, middle = size / 2;
  return <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true"><circle cx={middle} cy={middle} r={radius} fill="none" stroke="var(--phone-track)" strokeWidth={stroke}/><circle cx={middle} cy={middle} r={radius} fill="none" stroke="var(--pulse-tone)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(length * Math.min(100, Math.max(0, percent)) / 100).toFixed(1)} ${length.toFixed(1)}`} transform={`rotate(-90 ${middle} ${middle})`}/></svg>;
}

function EquityChart({points, index, onIndex}) {
  const ref = useRef(null);
  const values = points.map(point => Number(point.equity) || 0);
  const low = Math.min(...values), high = Math.max(...values), pad = ((high - low) || Math.abs(high) || 1) * .12;
  const floor = low - pad, ceil = high + pad, plot = CHART.height - CHART.top - CHART.bottom;
  const y = value => CHART.top + (ceil - value) / (ceil - floor) * plot;
  const x = position => 6 + position * (CHART.width - 12) / Math.max(1, points.length - 1);
  const coords = values.map((value, position) => [x(position), y(value)]);
  const path = mobileSmoothPath(coords), base = CHART.height - CHART.bottom;
  const grid = [0, .5, 1].map(share => floor + (ceil - floor) * (.15 + share * .7));
  const inspect = event => {
    const rect = ref.current.getBoundingClientRect();
    const viewX = (event.clientX - rect.left) / rect.width * CHART.width;
    onIndex(Math.max(0, Math.min(points.length - 1, Math.round((viewX - 6) / (CHART.width - 12) * (points.length - 1)))));
  };
  const active = coords[index];
  return <svg ref={ref} className="tj-pulse-chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label={`Account balance after each event, from ${values[0].toFixed(2)} to ${values.at(-1).toFixed(2)}. Drag to read each balance.`}
    onPointerDown={event => { event.currentTarget.setPointerCapture?.(event.pointerId); inspect(event); }} onPointerMove={event => { if(event.buttons || event.pointerType === 'touch') inspect(event); }}>
    <defs><linearGradient id="tjPulseEquityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--phone-purple)" stopOpacity=".3"/><stop offset="1" stopColor="var(--phone-purple)" stopOpacity="0"/></linearGradient></defs>
    {grid.map(value => <g key={value}><line x1="0" x2={CHART.width} y1={y(value)} y2={y(value)} stroke="var(--phone-track)" strokeDasharray="3 4"/><text x="3" y={y(value) - 3}>{Math.round(value).toLocaleString()}</text></g>)}
    <path d={`${path} L${coords.at(-1)[0]},${base} L${coords[0][0]},${base} Z`} fill="url(#tjPulseEquityFill)"/>
    <path d={path} fill="none" stroke="var(--phone-purple)" strokeWidth="2.3" strokeLinecap="round"/>
    <line x1={active[0]} x2={active[0]} y1="8" y2={base} stroke="var(--phone-muted)" strokeDasharray="2 3" opacity=".7"/>
    <circle cx={active[0]} cy={active[1]} r="5.5" fill="var(--phone-purple)" stroke="var(--card)" strokeWidth="2.5"/>
    <text x="6" y="158">{points[0].label || 'Start'}</text><text x={CHART.width - 6} y="158" textAnchor="end">{points.at(-1).label}</text>
  </svg>;
}

function BarsChart({values, labels, selected, onSelect, currency}) {
  const {ticks, high, low} = pulseTicks(values);
  const width = 340, height = 190, left = 46, right = 336, plot = height - 40, count = values.length;
  const y = value => 10 + (high - value) / ((high - low) || 1) * plot;
  const step = (right - left) / count, bar = Math.min(24, step * .62), labelEvery = Math.max(1, Math.ceil(count / 6));
  const short = value => { const size = Math.abs(value); const text = size >= 1000 ? `${(size / 1000).toFixed(size >= 10000 ? 0 : 1)}K` : `${size}`; return `${value < 0 ? '-' : value > 0 ? '+' : ''}${text}`; };
  return <svg className="tj-pulse-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Bar chart in ${currency}. Tap a bar for detail.`}>
    {ticks.map(tick => <g key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="var(--phone-track)" strokeDasharray={tick === 0 ? undefined : '3 4'}/><text x={left - 6} y={y(tick) + 4} textAnchor="end">{short(tick)}</text></g>)}
    {values.map((value, index) => { const size = Math.max(3, Math.abs(y(value) - y(0))), center = left + step * index + step / 2, top = value >= 0 ? y(0) - size : y(0); return <g key={`${labels[index]}-${index}`}>
      <rect x={center - bar / 2} y={top} width={bar} height={size} rx={Math.min(5, bar / 2)} fill={value >= 0 ? 'var(--phone-gain)' : 'var(--phone-drop)'} opacity={index === selected ? 1 : .55}/>
      {index === selected && <rect x={center - bar / 2 - 2} y={top - 2} width={bar + 4} height={size + 4} rx="7" fill="none" stroke="var(--text)" strokeWidth="1.2"/>}
      {(index % labelEvery === 0 || index === count - 1 && labelEvery === 1) && <text x={center} y={height - 8} textAnchor="middle">{labels[index]}</text>}
      <rect x={center - step / 2} y="0" width={step} height={height - 24} fill="transparent" style={{cursor:'pointer'}} onClick={() => onSelect(index)}/>
    </g>; })}
  </svg>;
}

function Hero({points, days, months, currency, periodLabel, netPnl, openingBalance}) {
  const [lens,setLens] = useState('equity');
  const [equityIndex,setEquityIndex] = useState(null);
  const shownDays = days.slice(-DAILY_LIMIT);
  const [dayIndex,setDayIndex] = useState(null), [monthIndex,setMonthIndex] = useState(null);
  useEffect(() => { setEquityIndex(null); setDayIndex(null); setMonthIndex(null); }, [points, days, months]);
  const lensIndex = LENSES.findIndex(([id]) => id === lens);
  const averageDay = days.length ? days.reduce((sum, day) => sum + day.pnl, 0) / days.length : 0;
  let label, big, bigTone = '', sub, pill, pillTone = '', chart = null;
  if(lens === 'equity') {
    const index = equityIndex ?? points.length - 1, point = points[index];
    const change = point && openingBalance ? (point.equity / openingBalance - 1) * 100 : 0;
    label = 'Account balance';
    big = point ? pulseMoney(point.equity, currency, false) : pulseMoney(openingBalance, currency, false);
    sub = !point || index === points.length - 1 ? <><b className={tone(netPnl)}>{pulseMoney(netPnl, currency)}</b> {periodLabel}{points.length > 1 ? ' · drag the chart' : ''}</> : point.kind === 'start' ? `${point.label} · starting balance` : <>{point.label} · <b className={tone(point.change)}>{pulseMoney(point.change, currency)}</b> {point.kind === 'trade' ? 'trade' : 'cash'}</>;
    pill = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`; pillTone = tone(change);
    chart = points.length > 1 ? <EquityChart points={points} index={index} onIndex={setEquityIndex}/> : <p className="tj-pulse-empty">Log trades to draw your equity curve.</p>;
  } else if(lens === 'daily') {
    const index = dayIndex ?? shownDays.length - 1, day = shownDays[index];
    label = 'Daily P&L';
    big = day ? pulseMoney(day.pnl, currency) : '—'; bigTone = tone(day?.pnl);
    sub = day ? `${day.date} · average day ${pulseMoney(averageDay, currency)} · tap a bar` : 'No trading days yet';
    pill = day ? `${day.count || 1} trade${(day.count || 1) === 1 ? '' : 's'}` : '—';
    chart = shownDays.length ? <div className="tj-pulse-chart-pad"><BarsChart values={shownDays.map(item => item.pnl)} labels={shownDays.map(item => String(item.date).slice(5))} selected={index} onSelect={setDayIndex} currency={currency}/></div> : null;
  } else {
    const index = monthIndex ?? months.length - 1, month = months[index];
    const best = months.length ? months.reduce((top, item) => item.value > top.value ? item : top) : null;
    const average = months.length ? months.reduce((sum, item) => sum + item.value, 0) / months.length : 0;
    label = 'Monthly P&L';
    big = month ? (month.value ? pulseMoney(month.value, currency) : pulseMoney(0, currency)) : '—'; bigTone = tone(month?.value);
    sub = month ? `${month.key.slice(0, 4)} · best ${best.label} ${pulseMoney(best.value, currency)} · average ${pulseMoney(average, currency)}` : 'No months yet';
    pill = month?.label || '—';
    chart = months.length ? <div className="tj-pulse-chart-pad"><BarsChart values={months.map(item => item.value)} labels={months.map(item => item.label)} selected={index} onSelect={setMonthIndex} currency={currency}/></div> : null;
  }
  return <section className="tj-pulse-hero">
    <div className="tj-pulse-hero-top"><span className="tj-pulse-label">{label}</span><span className={`tj-pulse-pill ${pillTone}`}>{pill}</span></div>
    <div className={`tj-pulse-big ${bigTone}`}>{big}</div>
    <div className="tj-pulse-sub">{sub}</div>
    <div className="tj-pulse-lens" role="group" aria-label="Chart view" style={{'--lens-index':lensIndex}}><i aria-hidden="true"/>{LENSES.map(([id,text]) => <button key={id} type="button" className={id === lens ? 'is-on' : ''} aria-pressed={id === lens} onClick={() => setLens(id)}>{text}</button>)}</div>
    <div className="tj-pulse-chart-wrap">{chart}</div>
  </section>;
}

function Vitals({stats, points, currency}) {
  const ref = useRef(null);
  const [active,setActive] = useState(0);
  const profitFactor = Number.isFinite(stats.profitFactor) ? stats.profitFactor : null;
  const averageR = Number(stats.averageR) || 0, trades = stats.total || 0;
  const expectancy = trades ? stats.netPnl / trades : 0;
  const spark = useMemo(() => {
    const values = points.map(point => Number(point.equity) || 0);
    if(values.length < 2) return '';
    const low = Math.min(...values), high = Math.max(...values), range = (high - low) || 1;
    return mobileSmoothPath(values.map((value, index) => [2 + index * 116 / (values.length - 1), 3 + (high - value) / range * 18]));
  }, [points]);
  const cards = [
    {key:'Win rate', value:`${(stats.winRate || 0).toFixed(0)}%`, caption:`${stats.wins || 0} wins · ${stats.losses || 0} losses`, tint:'gain', ring:stats.winRate || 0},
    {key:'Profit factor', value:profitFactor == null ? '—' : profitFactor.toFixed(2), caption:profitFactor == null ? 'No losses yet' : `${pulseMoney(profitFactor, currency, false)} per ${pulseMoney(1, currency, false)} lost`, tint:'purple', gauge:(profitFactor || 0) / 3 * 100},
    {key:'Expectancy', value:pulseMoney(expectancy, currency), caption:'average per trade', tint:'gain', spark:true},
    {key:'Average R', value:`${averageR.toFixed(2)}`, caption:'per closed trade', tint:'amber', gauge:Math.abs(averageR) / 3 * 100},
    {key:'Recovery', value:`${Math.round(stats.recovery || 0)}%`, caption:'wins after a loss', tint:'purple', ring:stats.recovery || 0},
    {key:'Consistency', value:`${Math.round(stats.consistency || 0)}`, caption:'steady-day score', tint:'drop', gauge:stats.consistency || 0},
  ];
  useEffect(() => {
    const rail = ref.current;
    if(!rail) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const start = rail.getBoundingClientRect().left; let best = 0, closest = Infinity;
      [...rail.children].forEach((card, index) => { const distance = Math.abs(card.getBoundingClientRect().left - start); if(distance < closest){closest = distance;best = index;} });
      if(rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 4) best = rail.children.length - 1;
      setActive(best);
    };
    const onScroll = () => { if(!frame) frame = requestAnimationFrame(update); };
    rail.addEventListener('scroll', onScroll, {passive:true}); update();
    return () => { rail.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);
  return <><div className="tj-pulse-section"><h2>Vitals</h2><span>Swipe</span></div>
    <div className="tj-pulse-rail" ref={ref} data-scroll-row="true">{cards.map(card => <article key={card.key} className={`tj-pulse-vital is-${card.tint}`}>
      {card.ring != null && <span className="tj-pulse-vital-ring"><Ring percent={card.ring}/></span>}
      <div><small>{card.key}</small><strong>{card.value}</strong></div>
      <div><p>{card.caption}</p>{card.gauge != null && <div className="tj-pulse-gauge" aria-hidden="true"><i style={{width:`${Math.max(0, Math.min(100, card.gauge))}%`}}/></div>}{card.spark && spark && <svg className="tj-pulse-spark" viewBox="0 0 120 26" preserveAspectRatio="none" aria-hidden="true"><path d={spark} fill="none" stroke="var(--pulse-tone)" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></svg>}</div>
    </article>)}</div>
    <div className="tj-pulse-dots" aria-hidden="true">{cards.map((card, index) => <i key={card.key} className={index === active ? 'is-on' : ''}/>)}</div></>;
}

function Breakdown({listRef, by, onBy, open, onOpen, source, currency}) {
  const [showAll,setShowAll] = useState(false);
  useEffect(() => setShowAll(false), [by]);
  const rows = useMemo(() => pulseBreakdown(by, {...source, currency, statusFor:markupStatus}), [by, source, currency]);
  const openIndex = rows.findIndex(row => row.id === open);
  const limit = showAll || openIndex >= LIST_LIMIT ? rows.length : LIST_LIMIT;
  const shown = rows.slice(0, limit), maximum = Math.max(1, ...rows.map(row => Math.abs(Number(row.value) || 0)));
  return <><div className="tj-pulse-section"><h2>Break down by</h2><span>Tap a row</span></div>
    <div className="tj-pulse-chips" data-scroll-row="true" role="tablist" aria-label="Break down by">{BREAKDOWNS.map(([id,text]) => <button key={id} type="button" role="tab" aria-selected={by === id} className={by === id ? 'is-on' : ''} onClick={() => onBy(id)}><span>{text}</span></button>)}</div>
    <div className="tj-pulse-list" ref={listRef}>
      {shown.length ? shown.map((row, index) => { const isOpen = row.id === open, Chevron = isOpen ? ChevronUp : ChevronDown; return <article key={row.id} className="tj-pulse-row">
        <button type="button" aria-expanded={isOpen} onClick={() => onOpen(isOpen ? null : row.id)}>
          <span className={`tj-pulse-rank ${index === 0 && Number(row.value) > 0 ? 'is-top' : ''}`}>{index + 1}</span>
          <span className="tj-pulse-row-copy"><b>{row.name}</b><small>{row.sub}</small></span>
          <span className="tj-pulse-row-value"><b className={tone(row.value)}>{pulseMoney(row.value, currency)}</b>{row.grade && row.grade !== '-' && <em className={row.badGrade || /^[CD]/.test(row.grade) ? 'is-low' : ''}>{row.grade}</em>}</span>
          <Chevron size={16}/>
          <span className="tj-pulse-row-bar"><i className={Number(row.value) < 0 ? 'is-loss' : ''} style={{width:`${Math.max(4, Math.abs(Number(row.value) || 0) / maximum * 100)}%`}}/></span>
        </button>
        {isOpen && <div className="tj-pulse-row-detail">{row.details.map(item => <div key={item.label}><small>{item.label}</small><b className={item.tone}>{item.value}</b></div>)}</div>}
      </article>; }) : <p className="tj-pulse-empty">Nothing to break down here yet.</p>}
      {rows.length > limit && <button type="button" className="tj-pulse-more" onClick={() => setShowAll(true)}><span>Show {rows.length - limit} more</span></button>}
    </div></>;
}

// One note per swipe, with dots showing there are more to read.
function PulseNotes({count,children}) {
  const [active,setActive] = useState(0);
  const onScroll = event => { const rail = event.currentTarget, card = rail.firstElementChild; if (card) setActive(Math.min(count - 1, Math.round(rail.scrollLeft / (card.getBoundingClientRect().width + 10)))); };
  return <><div className="tj-pulse-notes" data-scroll-row="true" onScroll={onScroll}>{children}</div>{count > 1 && <div className="tj-pulse-note-dots" aria-hidden="true">{Array.from({length:count},(_,index) => <i key={index} className={index === active ? 'is-on' : ''}/>)}</div>}</>;
}

export default function MobileAnalyticsPulse({account, balances, selectedBalanceId, onSelectBalance, periodLabel, periodOpen, onPeriodToggle, monthOptions, selectedMonths, onToggleMonth, onClearMonths, stats, trades, markups, openingBalance, equityData, tagStats, confluenceStats, instrumentStats, sessionStats, tradingDays, gradeFor, liveGuardrails, onOpenAccountSettings}) {
  const currency = account.baseCurrency || 'USD';
  const rootRef = useRef(null), listRef = useRef(null);
  const [by,setBy] = useState('model'), [open,setOpen] = useState(null);
  const months = useMemo(() => pulseMonthly(trades), [trades]);
  const periodMarkups = useMemo(() => {
    const year = String(periodLabel || '').match(/\d{4}/)?.[0];
    return (markups || []).filter(markup => selectedMonths.length ? selectedMonths.includes(String(markup.date || '').slice(0, 7)) : !year || String(markup.date || '').startsWith(year));
  }, [markups, selectedMonths, periodLabel]);
  const source = useMemo(() => ({tagStats, confluenceStats, instrumentStats, sessionStats, trades, markups:periodMarkups, gradeFor}), [tagStats, confluenceStats, instrumentStats, sessionStats, trades, periodMarkups, gradeFor]);
  const notes = useMemo(() => pulseInsights({tagStats, confluenceStats, equityData, guardrails:liveGuardrails, currency}), [tagStats, confluenceStats, equityData, liveGuardrails, currency]);
  const chooseBy = id => { setBy(id); setOpen(null); };
  const runNote = note => {
    if(note.settings) return onOpenAccountSettings?.();
    if(note.jump?.top) return scrollPhoneTo(rootRef.current,{top:0,behavior:'smooth'});
    setBy(note.jump.by); setOpen(note.jump.id);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({behavior:'smooth', block:'start'}));
    return undefined;
  };
  return <main className="tj-pulse" aria-label="Analytics" ref={rootRef}>
    <PhoneHeaderSlot>
      {balances.length > 1 && <ThemeSelect value={selectedBalanceId} onChange={event => onSelectBalance?.(event.target.value)} label="Analytics account" leading={selectedBalanceId ? balances.findIndex(balance => balance.id === selectedBalanceId) + 1 : 'A'} variant="analytics-account"><option value="">All accounts</option>{balances.map(balance => <option key={balance.id} value={balance.id}>{balance.name}</option>)}</ThemeSelect>}
      <button type="button" className="tj-pulse-period" aria-expanded={periodOpen} onClick={onPeriodToggle}><span><CalendarDays size={14}/>{periodLabel}<ChevronDown size={14}/></span></button>
    </PhoneHeaderSlot>
    {periodOpen && <section className="tj-ma5-period-panel" aria-label="Analytics period"><div>{monthOptions.map(month => <button key={month.key} type="button" aria-pressed={selectedMonths.includes(month.key)} onClick={() => onToggleMonth(month.key)}>{month.short}<small>{month.count}</small></button>)}</div><footer><span>{selectedMonths.length ? `${selectedMonths.length} selected` : 'Whole year'}</span><button type="button" onClick={onClearMonths}>Clear</button></footer></section>}
    <Hero points={equityData} days={tradingDays} months={months} currency={currency} periodLabel={periodLabel} netPnl={stats.netPnl} openingBalance={openingBalance}/>
    <Vitals stats={stats} points={equityData} currency={currency}/>
    <Breakdown listRef={listRef} by={by} onBy={chooseBy} open={open} onOpen={setOpen} source={source} currency={currency}/>
    <div className="tj-pulse-section"><h2>Worth a look</h2><span>{notes.length} note{notes.length === 1 ? '' : 's'}</span></div>
    <PulseNotes count={notes.length}>{notes.map(note => { const Icon = NOTE_ICONS[note.icon]; return <button key={note.id} type="button" className={`tj-pulse-note is-${note.tone}`} onClick={() => runNote(note)}><span className="tj-pulse-note-icon"><Icon size={18}/></span><h3>{note.title}</h3><p>{note.lead}<b>{note.strong}</b>{note.text}</p><span className="tj-pulse-note-go">{note.action}<ChevronRight size={14}/></span></button>; })}</PulseNotes>
  </main>;
}
