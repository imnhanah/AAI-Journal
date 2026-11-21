import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Flag, List, Search, SlidersHorizontal, X} from 'lucide-react';
import {NewsReleaseHero} from './NewsAlerts.jsx';
import {useNavStep} from './useBackNavigation.js';
import {DEFAULT_NEWS_FILTERS, NEWS_CURRENCIES, toggleNewsCurrency} from './newsPreferences.js';
import {newsDayTiming, newsEventTiming, newsFilterCount, newsImpactDots, newsWeekTitle} from './mobileNews.js';
import {phoneScrollTarget, scrollPhoneTo} from './phoneScroll.js';
import './mobileNewsScreen.css';
import './mobileNewsMockup.css';

const FF_URL = 'https://www.forexfactory.com/calendar';
const DAY_LIMIT = 6;
const IMPACT_LABEL = {high:'High', medium:'Medium', low:'Low', holiday:'Holiday'};
const weekKeysFor = keys => { if(!keys.length) return []; const start = new Date(keys[0]); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); return [...Array(7)].map((_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day.toDateString(); }); };
const shortDay = date => date.toLocaleDateString(undefined, {weekday:'short'}).toUpperCase();
const shortRange = date => date.toLocaleDateString('en-GB', {day:'numeric', month:'short'});
const value = item => item === undefined || item === null || item === '' ? '—' : item;
const toIso = date => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
const fromIso = iso => { const [y,m,d] = iso.split('-'); return new Date(+y, +m-1, +d); };
const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function FilterSheet({filters, onFilters, categories, allCategories, onCategories, weekOffset, onWeek, today, onToday, onReset, count, onClose}) {
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
  const chip = (text, on, onClick, dot) => <button type="button" key={text} aria-pressed={on} onClick={onClick}><i>{dot && <u className={`is-${dot}`}/>}{text}</i></button>;
  const tile = (text, on, onClick) => <button type="button" key={text} role="checkbox" aria-checked={on} className="tj-nx-tile" onClick={onClick}><span aria-hidden="true"><Check size={12} strokeWidth={3.2}/></span>{text}</button>;
  return <div className="tj-nx-sheet-layer"><div className="tj-nx-scrim" onClick={onClose}/><section ref={dialog} className="tj-nx-sheet" role="dialog" aria-modal="true" aria-label="News filters">
    <button type="button" className="tj-nx-grab" aria-label="Close filters" onClick={onClose}><i/></button>
    <header><span className="tj-nx-sheet-ico" aria-hidden="true"><SlidersHorizontal size={18}/></span><div><h2>Filters</h2><small>{count} event{count === 1 ? '' : 's'} match</small></div><button type="button" className="tj-nx-x" aria-label="Close filters" onClick={onClose}><X size={17}/></button></header>
    <div className="tj-nx-sheet-body">
      <div className="tj-nx-group"><div><span>Date range</span></div><section className="tj-nx-group-rg">{chip('Today', today, () => onToday())}{[[0,'This week'],[1,'Next week'],[-1,'Last week']].map(([offset, text]) => chip(text, !today && weekOffset === offset, () => onWeek(offset)))}</section><p>The feed covers last, current and next week.</p></div>
      <div className="tj-nx-group"><div><span>Currencies</span><button type="button" onClick={() => onFilters(current => ({...current, currencies:[]}))}>All</button></div><section className="tj-nx-group-cur">{NEWS_CURRENCIES.map(currency => chip(currency, !filters.currencies.length || filters.currencies.includes(currency), () => onFilters(current => ({...current, currencies:toggleNewsCurrency(current.currencies, currency)}))))}</section></div>
      <div className="tj-nx-group"><div><span>Impact</span><button type="button" onClick={() => onFilters(current => ({...current, impact:{high:true, medium:true, low:true}}))}>All</button></div><section className="tj-nx-group-imp">{[['high','High'],['medium','Medium'],['low','Low']].map(([level, text]) => chip(text, filters.impact[level], () => onFilters(current => ({...current, impact:{...current.impact, [level]:!current.impact[level]}})), level))}</section></div>
      <div className="tj-nx-group"><div><span>Categories</span><button type="button" onClick={() => onCategories(allCategories)}>All</button></div><section className="tj-nx-group-cat">{allCategories.map(category => tile(category, categories.includes(category), () => onCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category])))}</section></div>
    </div>
    <footer><button type="button" className="tj-nx-foot-reset" onClick={onReset}>Reset</button><button type="button" className="tj-nx-foot-show" onClick={onClose}>Show {count} event{count === 1 ? '' : 's'}</button></footer>
  </section></div>;
}

function EventCard({event, open, onToggle, renderDetails}) {
  const impact = event.impact || 'low';
  return <article className={`tj-nx-event is-${impact}${open ? ' is-open' : ''}`}>
    <button type="button" aria-label={`Event details: ${event.title}, ${event.currency}, ${event.time}`} aria-expanded={open} onClick={onToggle}>
      <i className="tj-nx-bar" aria-hidden="true"/>
      <span className="tj-nx-evm"><b>{event.time}</b><em>{event.currency}</em></span>
      <span className="tj-nx-evn"><b>{event.title}</b><span className={`tj-nx-ip is-${impact}`}><u className={`is-${impact}`}/>{IMPACT_LABEL[impact] || impact}{impact === 'holiday' ? ' · Bank holiday' : ''}</span></span>
      <span className="tj-nx-evv"><span><small>F</small>{value(event.forecast)}</span><span><small>P</small>{value(event.previous)}</span></span>
      <ChevronDown size={16} className="tj-nx-chev"/>
    </button>
    {open && <div className="tj-nx-event-detail">{renderDetails(event)}</div>}
  </article>;
}

export default function MobileNews({tab, onTab, feed, dayKeys, byDay, count, filters, onFilters, categories, allCategories, onCategories, weekOffset, onWeek, canGoBack, selected, isSelected, onSelect, renderDetails, holidays, holidayNote, timezone, gmtLabel}) {
  const rootRef = useRef(null);
  const [sheet,setSheet] = useState(false), [today,setToday] = useState(false), [expanded,setExpanded] = useState({}), [activeDay,setActiveDay] = useState('');
  const [gridView, setGridView] = useState(false);
  const [search, setSearch] = useState('');
  const [selDay, setSelDay] = useState('');
  const [calMonthOff, setCalMonthOff] = useState(0);

  const todayKey = new Date().toDateString();
  const todayIso = toIso(new Date());

  // Hero stats
  const weekEvents = useMemo(() => Object.values(byDay).flat(), [byDay]);
  const highCount = useMemo(() => weekEvents.filter(e => e.impact === 'high').length, [weekEvents]);
  const busiestEntry = useMemo(() => {
    let best = {key: '', count: 0};
    dayKeys.forEach(k => { const c = (byDay[k] || []).length; if (c > best.count) best = {key: k, count: c}; });
    return best;
  }, [byDay, dayKeys]);
  const busiestDay = busiestEntry.count > 0 ? new Date(busiestEntry.key).toLocaleDateString(undefined, {weekday: 'short'}) : '—';
  const weekIsos = useMemo(() => new Set(dayKeys.map(k => toIso(new Date(k)))), [dayKeys]);
  const weekHolidayCount = useMemo(() => holidays.filter(h => h.dateValue && weekIsos.has(toIso(h.dateValue))).length, [holidays, weekIsos]);

  const matchesSearch = useCallback(event => {
    if (!search) return true;
    return (event.title + ' ' + event.currency).toLowerCase().includes(search.toLowerCase());
  }, [search]);

  const filteredByDay = useMemo(() => {
    if (!search) return byDay;
    const result = {};
    Object.entries(byDay).forEach(([key, events]) => {
      const filtered = events.filter(matchesSearch);
      if (filtered.length) result[key] = filtered;
    });
    return result;
  }, [byDay, search, matchesSearch]);

  const keys = useMemo(() => {
    const base = today ? dayKeys.filter(key => key === todayKey) : dayKeys;
    return search ? base.filter(key => filteredByDay[key]) : base;
  }, [today, dayKeys, todayKey, search, filteredByDay]);

  const shownCount = today ? (filteredByDay[todayKey] || []).length : Object.values(filteredByDay).reduce((s,e) => s + e.length, 0);

  const isoByDay = useMemo(() => {
    const map = {};
    Object.entries(byDay).forEach(([key, events]) => {
      const d = new Date(key);
      if (!isNaN(d)) map[toIso(d)] = search ? events.filter(matchesSearch) : events;
    });
    return map;
  }, [byDay, search, matchesSearch]);

  const calBase = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + calMonthOff);
    return d;
  }, [calMonthOff]);

  const calCells = useMemo(() => {
    const y = calBase.getFullYear(), m = calBase.getMonth();
    const days = new Date(y, m+1, 0).getDate();
    const first = (new Date(y, m, 1).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < first; i++) { const d = new Date(y, m, 1-first+i); cells.push({out:true, date:d, iso:toIso(d)}); }
    for (let d = 1; d <= days; d++) { const date = new Date(y, m, d); cells.push({out:false, date, iso:toIso(date)}); }
    while (cells.length % 7) { const d = new Date(y, m+1, cells.length-first-days+1); cells.push({out:true, date:d, iso:toIso(d)}); }
    return cells;
  }, [calBase]);

  const selEvents = useMemo(() => selDay ? (isoByDay[selDay] || []) : [], [selDay, isoByDay]);

  const scroller = () => phoneScrollTarget(rootRef.current);
  const closeSheet = useCallback(() => setSheet(false), []);
  useNavStep('news-filters', sheet, closeSheet);
  const chooseWeek = offset => { setToday(false); setActiveDay(''); onWeek(offset); };
  const chooseToday = () => { setToday(true); setActiveDay(''); onWeek(0); };
  const reset = () => { onFilters(DEFAULT_NEWS_FILTERS); onCategories(allCategories); chooseWeek(0); setSearch(''); };
  const filterCount = newsFilterCount(filters, categories, allCategories, weekOffset) + (today ? 1 : 0);

  const inHolidays = tab === 'holidays';
  const showCalGrid = gridView && !inHolidays;

  useEffect(() => {
    const content = scroller();
    if (!content || tab !== 'calendar' || showCalGrid) return undefined;
    let frame = 0;
    const update = () => { frame = 0; const limit = content.getBoundingClientRect().top + 130; let current = ''; rootRef.current?.querySelectorAll('[data-news-day]').forEach(section => { if(section.getBoundingClientRect().top <= limit) current = section.dataset.newsDay; }); if(current) setActiveDay(current); };
    const onScroll = () => { if(!frame) frame = requestAnimationFrame(update); };
    content.addEventListener('scroll', onScroll, {passive:true});
    return () => { content.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [tab, showCalGrid]);

  const jumpToDay = key => { setActiveDay(key); const content = scroller(), section = rootRef.current?.querySelector(`[data-news-day="${key}"]`); if(!content || !section) return; const top=content===document.scrollingElement ? window.scrollY+section.getBoundingClientRect().top-104 : content.scrollTop+section.getBoundingClientRect().top-content.getBoundingClientRect().top-104; scrollPhoneTo(rootRef.current,{top,behavior:'smooth'}); };

  const first = keys[0] ? new Date(keys[0]) : null, last = keys.length ? new Date(keys.at(-1)) : null;
  const current = keys.includes(activeDay) ? activeDay : keys[0];
  const stripKeys = today ? keys : (weekKeysFor(dayKeys).length ? weekKeysFor(dayKeys) : keys);
  const calMonthLabel = `${MON[calBase.getMonth()]} ${calBase.getFullYear()}`;

  return <main className="tj-nx" aria-label="News" ref={rootRef}>
    {/* Stats hero card */}
    <div className="tj-nx-stats-card">
      <div className="tj-nx-stats-top">
        <span className="tj-nx-stats-eyebrow">Insights · News</span>
        <h2 className="tj-nx-stats-title"><em>Plan around market events.</em><br/>Know the high-impact windows.</h2>
        <p className="tj-nx-stats-desc">Use the calendar to identify high-impact releases and bank holidays before choosing a session or placing risk.</p>
      </div>
      <div className="tj-nx-stats-row">
        <div className="tj-nx-stat">
          <small>High impact</small>
          <b className="tj-nx-stat-drop">{highCount}</b>
          <span>this week</span>
        </div>
        <div className="tj-nx-stat">
          <small>Busiest day</small>
          <b>{busiestDay}</b>
          <span>{busiestEntry.count > 0 ? `${busiestEntry.count} event${busiestEntry.count !== 1 ? 's' : ''}` : 'Quiet week'}</span>
        </div>
        <div className="tj-nx-stat">
          <small>Bank holidays</small>
          <b className="tj-nx-stat-blue">{weekHolidayCount}</b>
          <span>this week</span>
        </div>
      </div>
      <NewsReleaseHero/>
    </div>

    {/* Segment: Event list | Calendar */}
    <div className="tj-nx-seg" role="tablist" aria-label="News view" style={{'--seg-index': showCalGrid ? 1 : 0}}>
      <i aria-hidden="true"/>
      <button type="button" role="tab" aria-selected={!showCalGrid}
        onClick={() => { setGridView(false); if (inHolidays) onTab('calendar'); }}>
        <List size={15}/> Event list
      </button>
      <button type="button" role="tab" aria-selected={showCalGrid}
        onClick={() => { setGridView(true); if (inHolidays) onTab('calendar'); }}>
        <Calendar size={15}/> Calendar
      </button>
    </div>

    {/* Search */}
    <div className="tj-nx-toolbar">
      <label className="tj-nx-search">
        <Search size={15}/>
        <input type="search" placeholder="Search events" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search events"/>
        {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={13}/></button>}
      </label>
    </div>

    {/* Filter chips */}
    <div className="tj-nx-chips">
      <button type="button" className={`tj-nx-chip tj-nx-chip-fb${filterCount > 0 ? ' is-counted' : ''}`} onClick={() => setSheet(true)}>
        <SlidersHorizontal size={14}/> Filters{filterCount > 0 && <em>{filterCount}</em>}
      </button>
      {[['high','High'],['medium','Medium'],['low','Low']].map(([level, label]) => (
        <button key={level} type="button"
          className={`tj-nx-chip${filters.impact[level] ? ' is-on' : ''}`}
          aria-pressed={filters.impact[level]}
          onClick={() => onFilters(f => ({...f, impact:{...f.impact, [level]:!f.impact[level]}}))}>
          <u className={`is-${level}`}/>{label}
        </button>
      ))}
      <button type="button"
        className={`tj-nx-chip${inHolidays ? ' is-on' : ''}`}
        aria-pressed={inHolidays}
        onClick={() => { onTab(inHolidays ? 'calendar' : 'holidays'); setGridView(false); }}>
        <Flag size={14}/> Bank holidays
      </button>
    </div>

    {/* Content */}
    {inHolidays ? <div className="tj-nx-holidays">
      <header><h2>Upcoming bank holidays</h2><p>Thin liquidity and gaps are common around these dates.</p></header>
      {holidays.map((holiday, index) => <article key={`${holiday.name}-${index}`} className="tj-nx-holiday"><span className="tj-nx-holiday-date"><small>{holiday.dateValue.toLocaleDateString(undefined, {month:'short'})}</small><b>{holiday.dateValue.getDate()}</b></span><span><em>{holiday.country}</em><b>{holiday.name}</b></span><i>{holiday.status}</i></article>)}
      <p className="tj-nx-note">{holidayNote}</p>
    </div>
    : feed.source === 'loading' ? <div className="tj-nx-empty"><div className="tj-spinner"/><p>Loading calendar…</p></div>
    : showCalGrid ? <>
      <div className="tj-nx-month-nav"><b>{calMonthLabel}</b><div><button type="button" aria-label="Previous month" onClick={() => setCalMonthOff(o => o-1)}><span><ChevronLeft size={16}/></span></button><button type="button" aria-label="Next month" onClick={() => setCalMonthOff(o => o+1)}><span><ChevronRight size={16}/></span></button></div></div>
      <div className="tj-nx-cal-grid" role="grid" aria-label={calMonthLabel}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d} role="columnheader" className="tj-nx-cal-wh">{d}</div>)}
        {calCells.map((cell, i) => { const events = isoByDay[cell.iso] || []; const isToday = cell.iso === todayIso; const isSel = cell.iso === selDay; return <button key={i} type="button" role="gridcell" className={`tj-nx-cal-cell${cell.out ? ' is-out' : ''}${isToday ? ' is-today' : ''}${isSel ? ' is-sel' : ''}`} aria-label={`${cell.date.toLocaleDateString(undefined, {weekday:'long', day:'numeric'})}, ${events.length} event${events.length !== 1 ? 's' : ''}`} aria-pressed={isSel} onClick={() => !cell.out && setSelDay(cell.iso === selDay ? '' : cell.iso)}><b>{cell.date.getDate()}</b><div className="tj-nx-cal-dots">{newsImpactDots(events, 3).map((impact, j) => <u key={j} className={`is-${impact}`}/>)}</div></button>; })}
      </div>
      {selDay ? <div className="tj-nx-cal-sel">
        <div className="tj-nx-cal-sel-head"><h3>{fromIso(selDay).toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'})}{selDay === todayIso && <i> Today</i>}</h3><small>{selEvents.length} event{selEvents.length !== 1 ? 's' : ''}</small></div>
        {selEvents.length > 0 ? <div className="tj-nx-cal-sel-events">{selEvents.map((event, index) => <EventCard key={`${event.title}-${event.currency}-${event.time}-${index}`} event={event} open={isSelected(event)} onToggle={() => onSelect(isSelected(event) ? null : event)} renderDetails={renderDetails}/>)}</div>
        : <div className="tj-nx-empty" style={{padding:'18px 20px 20px'}}><p>No events on this day.</p></div>}
        <div className="tj-nx-cal-tz"><span>All times in {timezone} {gmtLabel}</span><a href={FF_URL} target="_blank" rel="noopener noreferrer">Open FF <ExternalLink size={12}/></a></div>
      </div> : <div className="tj-nx-foot"><span>All times shown in {timezone} {gmtLabel}</span><a href={FF_URL} target="_blank" rel="noopener noreferrer">Open FF <ExternalLink size={12}/></a></div>}
      {holidays.length > 0 && <section className="tj-nx-holcard"><div className="tj-nx-holcard-head"><span aria-hidden="true"><Flag size={17}/></span><div><h3>Bank holidays</h3><small>Thin liquidity and gaps are common around these dates</small></div></div>{holidays.slice(0, 6).map((holiday, index) => <div key={`${holiday.name}-${index}`} className="tj-nx-holcard-row"><span className="tj-nx-holiday-date"><small>{holiday.dateValue.toLocaleDateString(undefined, {month:'short'})}</small><b>{holiday.dateValue.getDate()}</b></span><span><b>{holiday.name}</b><em>{holiday.country}</em></span><i>{holiday.status}</i></div>)}</section>}
    </>
    : !keys.length ? <div className="tj-nx-empty"><p><b>{feed.source === 'unavailable' ? 'Calendar feed unavailable' : search ? 'No events match your search.' : 'No events match this range and these filters.'}</b></p><p>{feed.source === 'unavailable' ? 'No live or cached calendar data is available. Check ForexFactory directly before planning around releases.' : 'The feed supports last, current and next week.'}</p>{feed.source !== 'unavailable' && <button type="button" onClick={reset}>Reset filters</button>}</div>
    : <>
      <div className="tj-nx-week"><div><b>{today ? 'Today' : newsWeekTitle(weekOffset)}</b><small>{first ? `${shortRange(first)} – ${shortRange(last)}` : 'No dates in this view'} · {gmtLabel}</small></div><div><button type="button" aria-label="Previous news week" disabled={!canGoBack} onClick={() => chooseWeek(weekOffset - 1)}><span><ChevronLeft size={16}/></span></button><button type="button" aria-label="Next news week" disabled={weekOffset >= 1} onClick={() => chooseWeek(weekOffset + 1)}><span><ChevronRight size={16}/></span></button></div></div>
      <div className="tj-nx-days">{stripKeys.map(key => { const date = new Date(key), events = filteredByDay[key] || [], has = keys.includes(key); return <button type="button" key={key} disabled={!has} aria-pressed={key === current} className={`${key === todayKey ? 'is-today' : ''}${events.some(e => e.impact === 'high') ? ' is-hot' : ''}`} aria-label={`${date.toLocaleDateString(undefined, {weekday:'long', day:'numeric'})}, ${events.length} event${events.length === 1 ? '' : 's'}`} onClick={() => jumpToDay(key)}><small>{shortDay(date)}</small><b>{String(date.getDate()).padStart(2, '0')}</b><span>{newsImpactDots(events, 3).map((impact, index) => <u key={index} className={`is-${impact}`}/>)}</span></button>; })}</div>
      {keys.map(key => { const date = new Date(key), events = filteredByDay[key] || [], timing = newsDayTiming(key, todayKey), open = !!expanded[key], shown = open ? events : events.slice(0, DAY_LIMIT); return <section key={key} className="tj-nx-day" data-news-day={key}>
        <div className="tj-nx-day-head"><b>{shortDay(date)} {String(date.getDate()).padStart(2, '0')}</b>{newsImpactDots(events, 8).map((impact, index) => <u key={index} className={`is-${impact}`}/>)}<small>{events.length} event{events.length === 1 ? '' : 's'}</small><i className={timing === 'Today' ? 'is-today' : ''}>{timing}</i></div>
        {shown.map((event, index) => <EventCard key={`${event.title}-${event.currency}-${event.time}-${index}`} event={event} open={isSelected(event)} onToggle={() => onSelect(isSelected(event) ? null : event)} renderDetails={renderDetails}/>)}
        {events.length > DAY_LIMIT && <button type="button" className="tj-nx-more" onClick={() => setExpanded(state => ({...state, [key]:!open}))}><span>{open ? 'Show less' : `Show ${events.length - DAY_LIMIT} more`}</span></button>}
      </section>; })}
      <div className="tj-nx-foot"><span>All times shown in {timezone} {gmtLabel}</span><a href={FF_URL} target="_blank" rel="noopener noreferrer">Open FF <ExternalLink size={12}/></a></div>
    </>}
    {sheet && <FilterSheet filters={filters} onFilters={onFilters} categories={categories} allCategories={allCategories} onCategories={onCategories} weekOffset={weekOffset} onWeek={chooseWeek} today={today} onToday={chooseToday} onReset={reset} count={shownCount} onClose={closeSheet}/>}
  </main>;
}
