import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {displayWeekdays} from './displayPreferences.js';
import PhoneHeaderSlot from './PhoneHeaderSlot.jsx';
import {calendarCellAmount} from './mobileCalendar.js';
import {addCalendarCashMovements, buildCalendarMonthGrid, calendarDayOfWeekPerformance, calendarMonthSummary, calendarMonthlyPerformance, calendarWeeklyBreakdown, calendarWeeklyPerformance} from './calendarAggregation.js';
import './mobileCalendarV2.css';

const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_LIMIT = 8;
const dateFromISO = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? new Date(`${value}T12:00:00`) : null;
const monthLabel = value => value.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
const toneOf = value => Number(value) > 0 ? 'pos' : Number(value) < 0 ? 'neg' : '';
const percent = value => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

function PeriodCards({rows, type, formatDate, formatMoney}) {
  const [showAll,setShowAll] = useState(false);
  useEffect(() => setShowAll(false), [type]);
  if (!rows.length) return <p className="tj-mcal-empty">No closed trades are available for this period.</p>;
  const label = row => type === 'monthly' ? monthLabel(dateFromISO(`${row.key}-01`)) : `${formatDate?.(row.key) || row.key} – ${formatDate?.(row.endKey) || row.endKey}`;
  const newest = [...rows].reverse(), shown = showAll ? newest : newest.slice(0, PERIOD_LIMIT);
  const byPnl = [...rows].sort((left, right) => right.pnl - left.pnl), best = byPnl[0], worst = byPnl.at(-1);
  const average = rows.reduce((sum, row) => sum + row.pnl, 0) / rows.length, word = type === 'monthly' ? 'month' : 'week';
  return <>
    <div className="tj-mcal-periods">{shown.map(row => <article key={row.key} className={`tj-mcal-period ${toneOf(row.pnl)}`}>
      <div className="tj-mcal-period-top"><span>{label(row)}</span><em className={row.pnl >= 0 ? 'pos' : 'neg'}>{row.pnl >= 0 ? 'PROFIT' : 'LOSS'}</em></div>
      <div className="tj-mcal-period-mid"><b className={toneOf(row.pnl)}>{formatMoney(row.pnl)}</b><em className={row.pctGain >= 0 ? 'pos' : 'neg'}>{percent(row.pctGain)}</em></div>
      <div className="tj-mcal-period-foot"><span>{row.count} trade{row.count === 1 ? '' : 's'}</span><i className="tj-mcal-track"><u className={row.winRate < 50 ? 'is-low' : ''} style={{width:`${Math.max(2, Math.min(100, row.winRate))}%`}}/></i><span>{row.winRate.toFixed(0)}% win</span></div>
    </article>)}</div>
    {newest.length > shown.length && <button type="button" className="tj-mcal-more" onClick={() => setShowAll(true)}><span>Show {newest.length - shown.length} more</span></button>}
    <div className="tj-mcal-tiles is-three">
      <div><small>Best {word}</small><b className={toneOf(best.pnl)}>{formatMoney(best.pnl)}</b><span>{label(best)}</span></div>
      <div><small>Worst {word}</small><b className={toneOf(worst.pnl)}>{formatMoney(worst.pnl)}</b><span>{label(worst)}</span></div>
      <div><small>Avg {type === 'monthly' ? 'monthly' : 'weekly'}</small><b className={toneOf(average)}>{formatMoney(average)}</b><span>Average</span></div>
    </div>
  </>;
}

function WeekdayInsight({rows, formatMoney}) {
  if (!rows.length) return <p className="tj-mcal-empty">No closed trades are available for this period.</p>;
  const max = Math.max(1, ...rows.map(row => Math.abs(row.pnl))), best = rows[0], worst = rows.at(-1);
  return <>
    <div className="tj-mcal-weekdays-list">{rows.map(row => <div className="tj-mcal-dow" key={row.dow}><div><b>{DOW_FULL[row.dow]}</b><b className={toneOf(row.pnl)}>{formatMoney(row.pnl)}</b></div><i className="tj-mcal-track is-thick"><u className={row.pnl < 0 ? 'is-loss' : ''} style={{width:`${Math.max(2, Math.abs(row.pnl) / max * 100)}%`}}/></i><p>{row.winRate.toFixed(0)}% win rate · {row.count} trade{row.count === 1 ? '' : 's'}</p></div>)}</div>
    <div className="tj-mcal-tiles"><div><small>Most profitable day</small><b className={toneOf(best.pnl)}>{DOW_FULL[best.dow]}</b><span>{formatMoney(best.pnl)} · {best.winRate.toFixed(0)}% WR</span></div><div><small>Least profitable day</small><b className={toneOf(worst.pnl)}>{DOW_FULL[worst.dow]}</b><span>{formatMoney(worst.pnl)} · {worst.winRate.toFixed(0)}% WR</span></div></div>
  </>;
}

// Swipeable readout notes with position dots.
export function CalendarReadoutNotes({children}) {
  const ref = useRef(null), count = React.Children.count(children);
  const [active,setActive] = useState(0);
  const onScroll = () => { const rail = ref.current, card = rail?.firstElementChild; if(card) setActive(Math.min(count - 1, Math.round(rail.scrollLeft / (card.getBoundingClientRect().width + 10)))); };
  return <><div className="tj-mcal-notes" ref={ref} data-scroll-row="true" onScroll={onScroll}>{children}</div><div className="tj-mcal-dots" aria-hidden="true">{Array.from({length:count}, (_, index) => <i key={index} className={index === active ? 'is-on' : ''}/>)}</div></>;
}

export default function MobileCalendarV2({account, monthCursor, setMonthCursor, onDayClick, formatMoney, formatDate, cashImpact, renderReadout}) {
  const [insight, setInsight] = useState('daily');
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const monthSummary = useMemo(() => calendarMonthSummary(account.trades, year, month, account.breakevenCap), [account.trades, account.breakevenCap, year, month]);
  const byDay = useMemo(() => addCalendarCashMovements(monthSummary.byDay, account.financeMovements, cashImpact), [monthSummary.byDay, account.financeMovements, cashImpact]);
  const weeks = useMemo(() => buildCalendarMonthGrid(year, month, byDay), [year, month, byDay]);
  const weekly = useMemo(() => calendarWeeklyBreakdown(account.trades, year, month, account.breakevenCap), [account.trades, account.breakevenCap, year, month]);
  const dailyRows = useMemo(() => calendarDayOfWeekPerformance(account.trades, account.breakevenCap), [account.trades, account.breakevenCap]);
  const weeklyRows = useMemo(() => calendarWeeklyPerformance(account.trades, account.breakevenCap, account.balance), [account.trades, account.breakevenCap, account.balance]);
  const monthlyRows = useMemo(() => calendarMonthlyPerformance(account.trades, account.breakevenCap, account.balance), [account.trades, account.breakevenCap, account.balance]);
  const firstActive = useMemo(() => Object.keys(byDay).sort().at(-1) || '', [byDay]);
  const [selectedDate, setSelectedDate] = useState(firstActive);
  useEffect(() => {
    const inMonth = selectedDate?.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);
    if (!inMonth) setSelectedDate(firstActive);
  }, [year, month, firstActive, selectedDate]);
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const net = monthSummary.netPnl, total = monthSummary.trades.length, breakeven = Math.max(0, total - monthSummary.wins - monthSummary.losses);
  const heat = Math.max(1, ...weeks.flat().filter(cell => cell?.count).map(cell => Math.abs(cell.pnl)));
  const selectedWeekIndex = weeks.findIndex(cells => cells.some(cell => cell?.iso === selectedDate));
  const insights = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']], insightIndex = insights.findIndex(([value]) => value === insight);

  const moveMonth = offset => setMonthCursor(new Date(year, month + offset, 1));
  const selectDay = cell => {
    setSelectedDate(cell.iso);
    if (cell.count || cell.cashCount) onDayClick(cell.iso);
  };
  const selectWeek = cells => { const dated = cells.filter(Boolean); setSelectedDate((dated.find(cell => cell.count) || dated[0])?.iso || ''); };

  return <main className="tj-mobile-calendar-v2" aria-label="Trading Calendar">
    <PhoneHeaderSlot><div className="tj-phone-month-nav"><button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={18}/></button><strong aria-label={monthLabel(monthCursor)}>{monthCursor.toLocaleDateString(undefined,{month:'short',year:'numeric'})}</strong><button type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={18}/></button></div></PhoneHeaderSlot>
    <section className={`tj-mcal-hero ${total ? toneOf(net) : ''}`} aria-label="Monthly summary">
      <div className="tj-mcal-hero-top"><small>Month net</small>{!isCurrentMonth && <button type="button" onClick={() => setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1))}><span>This month</span></button>}</div>
      <strong className={toneOf(net)}>{formatMoney(net)}</strong>
      <div className="tj-mcal-hero-chips"><span><i className="is-win"/>{monthSummary.wins} win{monthSummary.wins === 1 ? '' : 's'}</span><span><i className="is-loss"/>{monthSummary.losses} loss{monthSummary.losses === 1 ? '' : 'es'}</span><span><i className="is-flat"/>{breakeven} B/E</span><span>{monthSummary.activeDays} active day{monthSummary.activeDays === 1 ? '' : 's'}</span></div>
    </section>
    <section className="tj-mcal-card-grid" aria-label={monthLabel(monthCursor)}>
      <div className="tj-mcal-v2-weekdays">{displayWeekdays().map(day => <span key={day}>{day.slice(0, 3)}</span>)}</div>
      <div className="tj-mcal-v2-grid">{weeks.flat().map((cell, index) => cell ? <button type="button" key={cell.iso} className={`${cell.count ? 'has-trades' : ''} ${cell.cashCount ? 'has-cash' : ''} ${cell.iso === todayISO ? 'is-today' : ''} ${cell.iso === selectedDate ? 'is-selected' : ''}`} style={cell.count ? {background:`color-mix(in srgb,var(--phone-${cell.pnl >= 0 ? 'gain' : 'drop'}) ${Math.round(24 + Math.abs(cell.pnl) / heat * 34)}%,var(--phone-raised))`} : undefined} onClick={() => selectDay(cell)} aria-label={`${cell.iso}${cell.count ? `, ${cell.count} closed trade${cell.count === 1 ? '' : 's'}, ${formatMoney(cell.pnl)}` : ', no closed trades'}${cell.cashCount ? `, ${cell.cashCount} cash movement${cell.cashCount === 1 ? '' : 's'}` : ''}`}><span>{cell.day}</span>{cell.count > 0 && <em>{cell.count}</em>}{cell.count ? <b>{calendarCellAmount(cell.pnl)}</b> : cell.cashCount ? <b className="tj-mcal-v2-cash">↔</b> : null}</button> : <span key={`blank-${index}`} aria-hidden="true"/>)}</div>
    </section>
    <div className="tj-mcal-weeks" data-scroll-row="true">{weekly.map((week, index) => { const share = account.balance ? week.pnl / account.balance * 100 : 0; return <button type="button" key={week.label} aria-pressed={index === selectedWeekIndex} className={`tj-mcal-week ${week.count ? toneOf(week.pnl) : ''} ${index === selectedWeekIndex ? 'is-on' : ''}`} onClick={() => selectWeek(weeks[index])}><small>{week.label}</small><b className={week.count ? toneOf(week.pnl) : ''}>{week.count ? percent(share) : '0.00%'}</b><span>{week.count ? `${week.count} day${week.count === 1 ? '' : 's'} · ${week.winRate.toFixed(0)}% win` : 'Quiet week'}</span></button>; })}</div>
    <div className="tj-mcal-section"><h2>Performance insights</h2></div>
    <div className="tj-mcal-seg" role="tablist" aria-label="Performance period" style={{'--seg-index':insightIndex}}><i aria-hidden="true"/>{insights.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={insight === value} onClick={() => setInsight(value)}>{label}</button>)}</div>
    {insight === 'daily' ? <WeekdayInsight rows={dailyRows} formatMoney={formatMoney}/> : <PeriodCards rows={insight === 'weekly' ? weeklyRows : monthlyRows} type={insight} formatDate={formatDate} formatMoney={formatMoney}/>}
    {renderReadout?.(insight)}
    <p className="tj-mcal-footnote">Cash movements remain separate from these realised trade results.</p>
  </main>;
}
