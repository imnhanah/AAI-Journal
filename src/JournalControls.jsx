import React, { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './journal-controls.css';
import {displayWeekdays, weekStartOffset} from './displayPreferences';
import {timeParts, storedTime, displayTime} from './timePickerModel';
import MobileInstrumentPicker from './MobileInstrumentPicker.jsx';
import {MOBILE_MEDIA} from './mobileNavigation.js';
import {instrumentGroup} from './instrumentCatalog';

export const ThemedFields = React.createContext(false);

function Popup({ label, text, leading, children, disabled = false, compact = false, variant = '', className = '', required = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null), trigger = useRef(null), panel = useRef(null);
  const [position, setPosition] = useState(null);
  const id = useId();
  useEffect(() => {
    const outside = event => { if (!root.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useLayoutEffect(() => {
    if (!open) {setPosition(null); return;}
    const place = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      if (box.bottom < 0 || box.top > window.innerHeight) {setOpen(false);return;}
      const width = Math.min(Math.max(box.width, variant === 'date' || variant === 'time' ? 300 : variant === 'analytics-account' ? 190 : variant === 'calendar-account' ? 278 : compact ? 190 : 250), window.innerWidth - 24);
      const heightLimit = variant === 'date' ? 440 : variant === 'time' ? 380 : 330;
      const height = Math.min(panel.current?.scrollHeight || 280, heightLimit);
      const below = window.innerHeight - box.bottom - 12;
      const above = box.top - 12;
      const up = below < height && above > below;
      const spacious = variant === 'date' || variant === 'time';
      const maxHeight = Math.max(80, Math.min(heightLimit, spacious ? window.innerHeight - 24 : up ? above : below));
      const top = up ? box.top - Math.min(height,maxHeight) - 6 : box.bottom + 6;
      setPosition({position:'fixed',width,left:Math.max(12, Math.min(box.left,window.innerWidth-width-12)),top:Math.max(12, Math.min(top,window.innerHeight-Math.min(height,maxHeight)-12)),maxHeight,visibility:'visible'});
    };
    place();
    const scroll = event => { if (!panel.current?.contains(event.target)) place(); };
    window.addEventListener('resize', place);
    document.addEventListener('scroll', scroll, true);
    return () => {window.removeEventListener('resize',place);document.removeEventListener('scroll',scroll,true);};
  }, [open, compact, variant]);
  useEffect(() => {
    if (open && position) (panel.current?.querySelector('input[autofocus]') || panel.current?.querySelector('[aria-checked="true"], [aria-pressed="true"]') || panel.current?.querySelector('button:not(:disabled), input'))?.focus({preventScroll:true});
  }, [open, Boolean(position)]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <div ref={root} className={`tj-themed-control ${variant ? `tj-control-${variant}` : ''}`} onBlur={event => { if (!root.current?.contains(event.relatedTarget) && !panel.current?.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') {event.stopPropagation(); close();} }}>
    <button ref={trigger} type="button" className={`tj-input tj-picker-trigger ${className}`} disabled={disabled} aria-label={label} aria-required={required || undefined} aria-expanded={open} aria-controls={open ? id : undefined} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);panel.current?.querySelector('button[aria-checked="true"],button:not(:disabled)')?.focus();}}} onClick={() => setOpen(!open)}>{leading != null && <i className="tj-picker-leading" aria-hidden="true">{leading}</i>}{leading != null ? <em className="tj-picker-account-name">{text || 'Select…'}</em> : text || 'Select…'}<span aria-hidden="true">{open && ['calendar-account', 'analytics-account'].includes(variant) ? '⌃' : '⌄'}</span></button>
    {open && createPortal(<div ref={panel} id={id} className={`tj-picker-panel tj-floating-picker ${compact ? 'tj-picker-compact' : ''} ${variant ? `tj-picker-${variant}` : ''}`} style={position || {position:'fixed',visibility:'hidden',width:compact?160:250}} role="group" aria-label={label}>{children(close)}</div>, root.current?.closest('.tj-root,.public-site') || document.body)}
  </div>;
}

function ChoiceList({ options, value, onSelect, label }) {
  const root = useRef(null);
  useEffect(() => { const selected=root.current?.querySelector('[aria-checked="true"]'); if(selected)root.current.scrollTop=selected.offsetTop-root.current.offsetTop; }, []);
  const move = event => {
    const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
    let index = buttons.indexOf(document.activeElement);
    if (['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(event.key)) {
      event.preventDefault();
      index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index]?.focus();
    } else if (event.key.length === 1 && event.key !== ' ') {
      buttons.find(button => button.textContent.toLowerCase().startsWith(event.key.toLowerCase()))?.focus();
    }
  };
  return <div ref={root} className="tj-picker-options" role="radiogroup" aria-label={label} onKeyDown={move}>{options.map(option => <button type="button" key={option.value} className={option.className || ""} role="radio" aria-checked={String(value) === String(option.value)} disabled={option.disabled} onClick={() => onSelect(option.value)}>{option.label}</button>)}</div>;
}

export function ThemeSelect({ value, onChange, children, label, leading, disabled, compact = false, variant = '', className = '', required = false, ...props }) {
  const options = React.Children.toArray(children).filter(React.isValidElement).map(child => ({value:child.props.value ?? child.props.children, label:child.props.children, disabled:child.props.disabled, className:child.props.className}));
  const title = label || props['aria-label'] || 'Select';
  const isAccountPicker = ['account-card', 'analytics-account', 'calendar-account'].includes(variant);
  const accountLeading = leading ?? (isAccountPicker ? (value ? options.filter(item => String(item.value) !== '').findIndex(item => String(item.value) === String(value)) + 1 : 'A') : undefined);
  return <Popup label={title} leading={accountLeading} disabled={disabled} required={required} className={className} compact={compact} variant={variant || 'select'} text={options.find(item => String(item.value) === String(value))?.label}>{close => <><strong>{title}</strong><ChoiceList options={options} value={value} label={title} onSelect={next => {onChange?.({target:{value:String(next), name:props.name}}); close();}}/></>}</Popup>;
}

const pad = value => String(value).padStart(2,'0');
export function ThemeInstrument({value, onChange, options}) {
  const [phone,setPhone]=useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  useEffect(()=>{const media=window.matchMedia(MOBILE_MEDIA),change=()=>setPhone(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  const [query,setQuery] = useState('');
  const compact = text => String(text || '').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const matches = options.filter(item => compact(item).includes(compact(query)));
  if(phone)return <MobileInstrumentPicker value={value} onChange={onChange} options={options}/>;
  return <Popup label="Instrument" text={value || 'Select'}>{close => <><strong>Instrument</strong><input autoFocus className="tj-input tj-picker-search" aria-label="Search instruments" placeholder="Search instruments" value={query} onChange={event=>setQuery(event.target.value)}/><ChoiceList label="Instruments" options={matches.map(item=>({value:item,label:<><b>{item}</b><small className="tj-instrument-group-label">{instrumentGroup(item)}</small></>}))} value={value} onSelect={next=>{onChange(next);setQuery('');close();}}/>{!matches.length && <p>No matching instruments.</p>}</>}</Popup>;
}
export function ThemeRiskReward({value, onChange, disabled = false, customValues = []}) {
  const values=[...new Set([2,2.5,3,3.5,4,5,...customValues.map(Number).filter(item=>Number.isFinite(item)&&item>0)])].sort((a,b)=>a-b);
  const options=values.map(item=>({value:String(item),label:String(item)}));
  const text=value === '' || value == null ? 'Select or enter' : String(value);
  return <Popup label="Risk:Reward (R)" disabled={disabled} text={text}>{close => <><strong>Risk:Reward (R)</strong><input autoFocus type="number" min="0" step="0.1" className="tj-input tj-picker-search" aria-label="Custom risk reward" placeholder="Enter custom value" value={value ?? ''} onChange={event=>onChange(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();close();}}}/><ChoiceList label="Risk reward presets" options={options} value={value} onSelect={next=>{onChange(next);close();}}/></>}</Popup>;
}
export function ThemeTime({ value = '', onChange, label = 'Time', format = '12', disabled = false, required = false, className = '' }) {
  const now = new Date();
  const current = timeParts(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
  const {hour, minute, period} = value ? timeParts(value) : current;
  const is24 = format === '24';
  const hour24 = value ? value.slice(0,2) : pad(now.getHours());
  const choose = (h, m, p) => onChange({target:{value:storedTime(h, m, p)}});
  const choose24 = (h,m) => onChange({target:{value:`${h}:${m || '00'}`}});
  return <Popup label={label} disabled={disabled} required={required} className={className} variant="time" text={is24 ? value || '--:--' : displayTime(value)}>{close => <><strong>{label}</strong><div className={`tj-time-columns ${is24 ? '' : 'tj-time-columns-12'}`}>
    <div><small>Hour</small><ChoiceList label="Hour" options={Array.from({length:is24?24:12},(_,i)=>({value:pad(is24?i:i+1),label:pad(is24?i:i+1)}))} value={is24?hour24:hour} onSelect={next=>is24?choose24(next,minute):choose(next,minute,period)}/></div>
    <div><small>Minute</small><ChoiceList label="Minute" options={Array.from({length:60},(_,i)=>({value:pad(i),label:pad(i)}))} value={minute} onSelect={next=>is24?choose24(hour24,next):choose(hour,next,period)}/></div>
    {!is24 && <div><small>AM / PM</small><ChoiceList label="AM or PM" options={['AM','PM'].map(next=>({value:next,label:next}))} value={period} onSelect={next=>choose(hour,minute,next)}/></div>}
    </div><button type="button" className="tj-picker-clear" onClick={close}>Done</button><button type="button" className="tj-picker-clear" onClick={() => {onChange({target:{value:''}});close();}}>Clear time</button></>}</Popup>;
}

export function ThemeDate({ value = '', onChange, label = 'Date', disabled = false, required = false, min, max, className = '' }) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const [month, setMonth] = useState(new Date(parsed.getFullYear(),parsed.getMonth(),1));
  useEffect(() => { if(value) setMonth(new Date(`${value.slice(0,7)}-01T12:00:00`)); }, [value]);
  const year=month.getFullYear(), index=month.getMonth(), days=new Date(year,index+1,0).getDate();
  return <Popup label={label} disabled={disabled} required={required} className={className} variant="date" text={value || 'Choose date'}>{close => <><strong>{label}</strong><div className="tj-date-heading"><button type="button" aria-label="Previous month" onClick={()=>setMonth(new Date(year,index-1,1))}>‹</button><strong>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong><button type="button" aria-label="Next month" onClick={()=>setMonth(new Date(year,index+1,1))}>›</button></div><input className="tj-input" aria-label={`Enter ${label} as YYYY-MM-DD`} placeholder="YYYY-MM-DD" defaultValue={value} key={value} onBlur={event => {const next=event.target.value;const date=new Date(`${next}T12:00:00`);if(/^\d{4}-\d{2}-\d{2}$/.test(next)&&!isNaN(date)&&(!min||next>=min)&&(!max||next<=max)&&`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`===next)onChange({target:{value:next}});}}/><div className="tj-date-days">{displayWeekdays().map(day=><small key={day}>{day}</small>)}{Array.from({length:weekStartOffset(month)},(_,i)=><span key={`blank${i}`}/>)}{Array.from({length:days},(_,i)=>{const next=`${year}-${pad(index+1)}-${pad(i+1)}`;return <button type="button" key={next} disabled={(min && next<min)||(max && next>max)} className={next===today ? 'tj-picker-current' : ''} aria-label={next} aria-pressed={value===next} onClick={()=>{onChange({target:{value:next}});close();}}>{i+1}</button>;})}</div><div className="tj-date-actions"><button type="button" className="tj-picker-clear" disabled={(min&&today<min)||(max&&today>max)} onClick={()=>{onChange({target:{value:today}});close();}}>Today</button><button type="button" className="tj-picker-clear" onClick={()=>{onChange({target:{value:''}});close();}}>Clear date</button></div></>}</Popup>;
}

export function ConfirmDeleteButton({children, onClick, className='', title, disabled, ...props}) {
  const [armed,setArmed] = useState(false);
  const [busy,setBusy] = useState(false);
  const button = useRef(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!armed) return;
    const cancel = event => {if (!button.current?.contains(event.target)) setArmed(false);};
    const other = event => {if (event.detail !== button.current) setArmed(false);};
    const timeout = window.setTimeout(()=>setArmed(false),6000);
    document.addEventListener('pointerdown',cancel);
    window.addEventListener('tj:delete-armed',other);
    return ()=>{clearTimeout(timeout);document.removeEventListener('pointerdown',cancel);window.removeEventListener('tj:delete-armed',other);};
  }, [armed]);
  return <button {...props} ref={button} type="button" disabled={disabled || busy} className={`${className} ${armed ? 'tj-inline-delete-confirm' : ''}`} aria-label={armed ? `Confirm ${title || props['aria-label'] || 'deletion'}` : props['aria-label'] || title} title={armed ? 'Click again to confirm deletion. Escape cancels.' : title} onBlur={()=>setArmed(false)} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setArmed(false);}}} onClick={async event=>{
    event.stopPropagation();
    if (inFlight.current) return;
    if (!armed) {window.dispatchEvent(new CustomEvent('tj:delete-armed',{detail:button.current}));setArmed(true);return;}
    inFlight.current=true;setBusy(true);setArmed(false);
    try {await onClick?.(event);} finally {inFlight.current=false;setBusy(false);}
  }}>{armed ? 'Confirm' : children}</button>;
}
