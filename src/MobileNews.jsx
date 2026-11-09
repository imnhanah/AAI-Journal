import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ChevronDown, ChevronLeft, ChevronRight, ExternalLink, SlidersHorizontal} from 'lucide-react';
import {NewsReleaseHero} from './NewsAlerts.jsx';
import {useNavStep} from './useBackNavigation.js';
import PhoneHeaderSlot from './PhoneHeaderSlot.jsx';
import {DEFAULT_NEWS_FILTERS, NEWS_CURRENCIES, toggleNewsCurrency} from './newsPreferences.js';
import {newsDayTiming, newsEventTiming, newsFilterCount, newsImpactDots, newsWeekTitle} from './mobileNews.js';
import {phoneScrollTarget, scrollPhoneTo} from './phoneScroll.js';
import './mobileNewsScreen.css';

const FF_URL = 'https://www.forexfactory.com/calendar';
const DAY_LIMIT = 6;
const shortDay = date => date.toLocaleDateString(undefined, {weekday:'short'}).toUpperCase();
const shortRange = date => date.toLocaleDateString('en-GB', {day:'numeric', month:'short'});
const value = item => item === undefined || item === null || item === '' ? '—' : item;

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
  return <div className="tj-nx-sheet-layer"><div className="tj-nx-scrim" onClick={onClose}/><section ref={dialog} className="tj-nx-sheet" role="dialog" aria-modal="true" aria-label="News filters">
    <button type="button" className="tj-nx-grab" aria-label="Close filters" onClick={onClose}><i/></button>
    <header><h2>Filters</h2><button type="button" className="tj-nx-reset" onClick={onReset}>Reset</button></header>
    <div className="tj-nx-sheet-body">
      <div className="tj-nx-group"><div><span>Date range</span></div><p>The feed covers last, current and next week.</p><section>{chip('Today', today, () => onToday())}{[[0,'This week'],[1,'Next week'],[-1,'Last week']].map(([offset, text]) => chip(text, !today && weekOffset === offset, () => onWeek(offset)))}</section></div>
      <div className="tj-nx-group"><div><span>Currencies</span><button type="button" onClick={() => onFilters(current => ({...current, currencies:[]}))}>All</button></div><section>{NEWS_CURRENCIES.map(currency => chip(currency, !filters.currencies.length || filters.currencies.includes(currency), () => onFilters(current => ({...current, currencies:toggleNewsCurrency(current.currencies, currency)}))))}</section></div>
      <div className="tj-nx-group"><div><span>Impact</span><button type="button" onClick={() => onFilters(current => ({...current, impact:{high:true, medium:true, low:true}}))}>All</button></div><section>{[['high','High'],['medium','Medium'],['low','Low']].map(([level, text]) => chip(text, filters.impact[level], () => onFilters(current => ({...current, impact:{...current.impact, [level]:!current.impact[level]}})), level))}</section></div>
      <div className="tj-nx-group"><div><span>Categories</span><button type="button" onClick={() => onCategories(allCategories)}>All</button></div><section>{allCategories.map(category => chip(category, categories.includes(category), () => onCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category])))}</section></div>
    </div>
    <footer><button type="button" onClick={onClose}>Show {count} event{count === 1 ? '' : 's'}</button></footer>
  </section></div>;
}

function EventCard({event, open, onToggle, renderDetails}) {
  const timing = newsEventTiming(event);
  return <article className={`tj-nx-event is-${event.impact}`}>
    <button type="button" aria-label={`Event details: ${event.title}, ${event.currency}, ${event.time}`} aria-expanded={open} onClick={onToggle}>
      <span className="tj-nx-event-top"><u className={`is-${event.impact}`}/>{event.time}<em>{event.currency}</em><span/><i>{timing}</i><ChevronDown size={16}/></span>
      <b>{event.title}</b>
      <span className="tj-nx-nums"><span><small>Actual</small><b>{value(event.actual)}</b></span><span><small>Forecast</small><b className={value(event.forecast) === '—' ? '' : 'is-forecast'}>{value(event.forecast)}</b></span><span><small>Previous</small><b>{value(event.previous)}</b></span></span>
    </button>
    {open && <div className="tj-nx-event-detail">{renderDetails(event)}</div>}
  </article>;
}

export default function MobileNews({tab, onTab, feed, dayKeys, byDay, count, filters, onFilters, categories, allCategories, onCategories, weekOffset, onWeek, canGoBack, selected, isSelected, onSelect, renderDetails, holidays, holidayNote, timezone, gmtLabel}) {
  const rootRef = useRef(null);
  const [sheet,setSheet] = useState(false), [today,setToday] = useState(false), [expanded,setExpanded] = useState({}), [activeDay,setActiveDay] = useState('');
  const todayKey = new Date().toDateString();
  const keys = useMemo(() => today ? dayKeys.filter(key => key === todayKey) : dayKeys, [today, dayKeys, todayKey]);
  const shownCount = today ? (byDay[todayKey] || []).length : count;
  const scroller = () => phoneScrollTarget(rootRef.current);
  const closeSheet = useCallback(() => setSheet(false), []);
  useNavStep('news-filters', sheet, closeSheet);
  const chooseWeek = offset => { setToday(false); setActiveDay(''); onWeek(offset); };
  const chooseToday = () => { setToday(true); setActiveDay(''); onWeek(0); };
  const reset = () => { onFilters(DEFAULT_NEWS_FILTERS); onCategories(allCategories); chooseWeek(0); };
  const filterCount = newsFilterCount(filters, categories, allCategories, weekOffset) + (today ? 1 : 0);
  useEffect(() => {
    const content = scroller();
    if(!content || tab !== 'calendar') return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const limit = content.getBoundingClientRect().top + 130;
      let current = '';
      rootRef.current?.querySelectorAll('[data-news-day]').forEach(section => { if(section.getBoundingClientRect().top <= limit) current = section.dataset.newsDay; });
      if(current) setActiveDay(current);
    };
    const onScroll = () => { if(!frame) frame = requestAnimationFrame(update); };
    content.addEventListener('scroll', onScroll, {passive:true});
    return () => { content.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [tab]);
  const jumpToDay = key => { setActiveDay(key); const content = scroller(), section = rootRef.current?.querySelector(`[data-news-day="${key}"]`); if(!content || !section) return; const top=content===document.scrollingElement ? window.scrollY+section.getBoundingClientRect().top-104 : content.scrollTop+section.getBoundingClientRect().top-content.getBoundingClientRect().top-104; scrollPhoneTo(rootRef.current,{top,behavior:'smooth'}); };
  const first = keys[0] ? new Date(keys[0]) : null, last = keys.length ? new Date(keys.at(-1)) : null;
  const current = keys.includes(activeDay) ? activeDay : keys[0];
  return <main className="tj-nx" aria-label="News" ref={rootRef}>
    <PhoneHeaderSlot><div className="tj-nx-header"><button type="button" aria-label="News filters" onClick={() => setSheet(true)}><span><SlidersHorizontal size={16}/>{filterCount > 0 && <b>{filterCount}</b>}</span></button></div></PhoneHeaderSlot>
    <NewsReleaseHero/>
    <div className="tj-nx-seg" role="tablist" aria-label="News view" style={{'--seg-index':tab === 'holidays' ? 1 : 0}}><i aria-hidden="true"/>{[['calendar','Event list'],['holidays','Bank holidays']].map(([id, text]) => <button type="button" role="tab" key={id} aria-selected={tab === id} onClick={() => onTab(id)}>{text}</button>)}</div>
    {tab === 'holidays' ? <div className="tj-nx-holidays">
      <header><h2>Upcoming bank holidays</h2><p>Thin liquidity and gaps are common around these dates.</p></header>
      {holidays.map((holiday, index) => <article key={`${holiday.name}-${index}`} className="tj-nx-holiday"><span className="tj-nx-holiday-date"><small>{holiday.dateValue.toLocaleDateString(undefined, {month:'short'})}</small><b>{holiday.dateValue.getDate()}</b></span><span><em>{holiday.country}</em><b>{holiday.name}</b></span><i>{holiday.status}</i></article>)}
      <p className="tj-nx-note">{holidayNote}</p>
    </div> : <>
      <div className="tj-nx-week"><div><b>{today ? 'Today' : newsWeekTitle(weekOffset)}</b><small>{first ? `${shortRange(first)} – ${shortRange(last)}` : 'No dates in this view'} · {gmtLabel}</small></div><div><button type="button" aria-label="Previous news week" disabled={!canGoBack} onClick={() => chooseWeek(weekOffset - 1)}><span><ChevronLeft size={16}/></span></button><button type="button" aria-label="Next news week" disabled={weekOffset >= 1} onClick={() => chooseWeek(weekOffset + 1)}><span><ChevronRight size={16}/></span></button></div></div>
      <div className="tj-nx-quick">{[['today','Today'],[0,'This week'],[1,'Next week'],[-1,'Last week']].map(([id, text]) => { const on = id === 'today' ? today : !today && weekOffset === id; return <button type="button" key={id} aria-pressed={on} onClick={() => id === 'today' ? chooseToday() : chooseWeek(id)}><span>{text}</span></button>; })}</div>
      {feed.source === 'loading' ? <div className="tj-nx-empty"><div className="tj-spinner"/><p>Loading calendar…</p></div>
      : !keys.length ? <div className="tj-nx-empty"><p><b>{feed.source === 'unavailable' ? 'Calendar feed unavailable' : 'No events match this range and these filters.'}</b></p><p>{feed.source === 'unavailable' ? 'No live or cached calendar data is available. Check ForexFactory directly before planning around releases.' : 'The feed supports last, current and next week.'}</p>{feed.source !== 'unavailable' && <button type="button" onClick={reset}>Reset filters</button>}</div>
      : <>
        <div className="tj-nx-days">{keys.map(key => { const date = new Date(key), events = byDay[key]; return <button type="button" key={key} aria-pressed={key === current} aria-label={`${date.toLocaleDateString(undefined, {weekday:'long', day:'numeric'})}, ${events.length} event${events.length === 1 ? '' : 's'}`} onClick={() => jumpToDay(key)}><small>{shortDay(date)}</small><b>{String(date.getDate()).padStart(2, '0')}</b><span>{newsImpactDots(events, 4).map((impact, index) => <u key={index} className={`is-${impact}`}/>)}</span></button>; })}</div>
        {keys.map(key => { const date = new Date(key), events = byDay[key], timing = newsDayTiming(key, todayKey), open = !!expanded[key], shown = open ? events : events.slice(0, DAY_LIMIT); return <section key={key} className="tj-nx-day" data-news-day={key}>
          <div className="tj-nx-day-head"><b>{shortDay(date)} {String(date.getDate()).padStart(2, '0')}</b>{newsImpactDots(events, 8).map((impact, index) => <u key={index} className={`is-${impact}`}/>)}<small>{events.length} event{events.length === 1 ? '' : 's'}</small><i className={timing === 'Today' ? 'is-today' : ''}>{timing}</i></div>
          {shown.map((event, index) => <EventCard key={`${event.title}-${event.currency}-${event.time}-${index}`} event={event} open={isSelected(event)} onToggle={() => onSelect(isSelected(event) ? null : event)} renderDetails={renderDetails}/>)}
          {events.length > DAY_LIMIT && <button type="button" className="tj-nx-more" onClick={() => setExpanded(state => ({...state, [key]:!open}))}><span>{open ? 'Show less' : `Show ${events.length - DAY_LIMIT} more`}</span></button>}
        </section>; })}
      </>}
      <div className="tj-nx-foot"><span>All times shown in {timezone} {gmtLabel}</span><a href={FF_URL} target="_blank" rel="noopener noreferrer">Open FF <ExternalLink size={12}/></a></div>
    </>}
    {sheet && <FilterSheet filters={filters} onFilters={onFilters} categories={categories} allCategories={allCategories} onCategories={onCategories} weekOffset={weekOffset} onWeek={chooseWeek} today={today} onToday={chooseToday} onReset={reset} count={shownCount} onClose={closeSheet}/>}
  </main>;
}
