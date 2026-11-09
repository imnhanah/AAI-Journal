import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell, Calculator, ChevronRight, CircleDollarSign, CirclePlus, FileUp, Flag, Landmark, ShieldCheck, Tag, TrendingUp, Trophy, User} from 'lucide-react';
import BackButton from './BackButton.jsx';
import {getBackNavigation, useNavStep} from './useBackNavigation.js';
import {useLeaveGuard} from './useLeaveGuard.js';
import './mobileAccountSettings2.css';

const ICONS = {user:User, start:TrendingUp, coin:CircleDollarSign, cap:CirclePlus, comm:Tag, calc:Calculator, flag:Flag, trophy:Trophy, shield:ShieldCheck, bank:Landmark, bell:Bell, file:FileUp};
const Icon = ({name}) => { const Glyph = ICONS[name]; return <span className="tj-ma-icon">{Glyph && <Glyph size={18}/>}</span>; };

function Popup({title, hint, onClose, footer, dirty = false, children}) {
  const layer = useRef(null), close = useRef(onClose);
  close.current = onClose;
  // A history step: hardware back closes this popup, and edits in it ask before being lost.
  const stepKey = `popup:${title}`;
  useNavStep(stepKey, true, onClose);
  useLeaveGuard(dirty, stepKey);
  const dismiss = () => { const nav = getBackNavigation(); if (nav.enabled) nav.back(); else close.current(); };
  useEffect(() => {
    const node = layer.current, opener = document.activeElement;
    // Focus must move inside, or Escape would reach the screen behind.
    (node.querySelector('input:not(:disabled)') || node.querySelector('.tj-ma-sheet'))?.focus({preventScroll:true});
    // Escape closes only this popup, never the settings screen behind it.
    const keydown = event => { if (event.key === 'Escape' && !document.querySelector('.tj-floating-picker')) { event.preventDefault(); event.stopPropagation(); dismiss(); } };
    node.addEventListener('keydown', keydown);
    return () => { node.removeEventListener('keydown', keydown); if (opener?.isConnected) opener.focus(); };
  }, []);
  return createPortal(<div className="tj-ma-layer" ref={layer}>
    <button type="button" className="tj-ma-scrim" aria-label={`Close ${title}`} onClick={dismiss}/>
    <section className="tj-ma-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <i aria-hidden="true"/>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      <div className="tj-ma-sheet-body">{children}</div>
      {footer !== null && <footer>{footer || <button type="button" onClick={onClose}>Done</button>}</footer>}
    </section>
  </div>, document.querySelector('.tj-root') || document.body);
}

// A control that opens its fields in a popup.
function usePopup(item) {
  const [open, setOpen] = useState(false);
  return {open:() => setOpen(true), popup:open && <Popup title={item.title || item.label} hint={item.hint} onClose={() => setOpen(false)}>{item.node}</Popup>};
}

function Row({item, plain = false}) {
  const {open, popup} = usePopup(item);
  return <>
    <button type="button" className={`tj-ma-row ${plain ? 'is-plain' : ''}`} aria-haspopup="dialog" onClick={open}>{!plain && <Icon name={item.icon}/>}<span className="tj-ma-copy"><strong>{item.label}</strong></span><span className="tj-ma-value">{item.value}</span><ChevronRight className="tj-ma-chev" size={16} aria-hidden="true"/></button>
    {popup}
  </>;
}

function Toggle({item}) {
  return <div className="tj-ma-row is-static"><Icon name={item.icon}/><span className="tj-ma-copy"><strong>{item.label}</strong>{item.note && <small>{item.note}</small>}</span>
    <button type="button" className="tj-ma-switch" role="switch" aria-label={item.label} aria-checked={!!item.on} disabled={item.disabled} onClick={item.onChange}><i aria-hidden="true"/></button></div>;
}

function Stat({item}) {
  const {open, popup} = usePopup(item);
  return <><button type="button" className={`tj-ma-stat ${item.empty ? 'is-empty' : ''}`} aria-haspopup="dialog" onClick={open}><small>{item.label}</small><b>{item.empty ? 'Set' : item.value}</b>{item.sub && <em>{item.sub}</em>}</button>{popup}</>;
}

function Plan({item}) {
  const {open, popup} = usePopup({...item, title:'Challenge plan'});
  const total = Math.max(1, Number(item.count) || 1), level = Number(item.level) || 1;
  return <>
    <button type="button" className="tj-ma-plan" aria-haspopup="dialog" onClick={open}>
      <span className="tj-ma-plan-head"><strong>{item.mode}</strong><span>Level {Math.min(level, total)} of {total}</span></span>
      <span className="tj-ma-plan-bar" aria-hidden="true" style={{gridTemplateColumns:`repeat(${total},minmax(0,1fr))`}}>{Array.from({length:total}, (_, index) => <i key={index} className={index + 1 < level ? 'is-done' : index + 1 === level ? 'is-now' : ''}/>)}</span>
      <span className="tj-ma-link">Edit plan<ChevronRight size={14} aria-hidden="true"/></span>
    </button>
    {popup}
  </>;
}

function Saving({item}) {
  const {open, popup} = usePopup(item);
  return <>
    <button type="button" className="tj-ma-saving" aria-haspopup="dialog" onClick={open}><span className="tj-ma-ring" style={{'--ring':`${Math.min(100, Math.max(0, Number(item.percent) || 0))}%`}}><i>{Number(item.percent) || 0}%</i></span><span className="tj-ma-copy"><strong>{item.label}</strong><small>{item.note}</small></span><span className="tj-ma-value">{item.value}</span><ChevronRight className="tj-ma-chev" size={16} aria-hidden="true"/></button>
    {popup}
  </>;
}

function Entry({item}) {
  if (item.hidden) return null;
  if (item.type === 'toggle') return <Toggle item={item}/>;
  if (item.type === 'sub') return <div className="tj-ma-sub"><Row item={item} plain/></div>;
  if (item.type === 'stats') return <div className="tj-ma-sub"><div className="tj-ma-stats">{item.items.map(stat => <Stat key={stat.label} item={stat}/>)}</div></div>;
  if (item.type === 'plan') return <Plan item={item}/>;
  if (item.type === 'saving') return <Saving item={item}/>;
  if (item.type === 'add') return <button type="button" className="tj-ma-row is-add" onClick={item.onClick}>{item.label}</button>;
  if (item.type === 'node') return <div className={`tj-ma-node ${item.className || ''}`}>{item.node}</div>;
  return <Row item={item}/>;
}

const Group = ({title, items}) => <>
  <h2 className="tj-ma-label">{title}</h2>
  <div className="tj-ma-group">{items.map(item => <Entry key={item.key || item.label} item={item}/>)}</div>
</>;

export function ChoiceChips({label, options, value, onChange, disabled = false}) {
  return <div className="tj-ma-field"><span>{label}</span><div className="tj-ma-chips" role="radiogroup" aria-label={label}>{options.map(([optionValue, optionLabel]) => <button type="button" key={optionValue} role="radio" aria-checked={optionValue === value} disabled={disabled} onClick={() => onChange(optionValue)}><span>{optionLabel}</span></button>)}</div></div>;
}

export function TextField({label, suffix, ...input}) {
  return <label className="tj-ma-field"><span>{label}</span><span className="tj-ma-input">{<input {...input}/>}{suffix && <em aria-hidden="true">{suffix}</em>}</span></label>;
}

const TABS = [['account','Account'],['goals','Goals & Risk'],['danger','Danger']];

export default function MobileAccountSettings({initialTab = 'account', onClose, summaryRef, hero, account, goals, danger, onSave, saveDisabled, saveTitle, saving, dirty}) {
  useLeaveGuard(!!dirty, 'account');
  const [tab, setTab] = useState(initialTab);
  const scroll = useRef(null);
  const choose = next => { setTab(next); scroll.current?.scrollTo({top:0}); };
  return <div className="tj-ma">
    <div className="tj-ma-scroll" ref={scroll}>
      <header className="tj-ma-head">
        <div className="tj-ma-title"><BackButton/><h1>Account settings</h1><span aria-hidden="true"/></div>
        <div className="tj-ma-tabs" role="tablist" aria-label="Account settings sections">{TABS.map(([value, label]) => <button type="button" key={value} role="tab" aria-selected={tab === value} className={value === 'danger' ? 'is-danger' : ''} onClick={() => choose(value)}><span>{label}</span></button>)}</div>
      </header>
      <section className="tj-ma-hero" ref={summaryRef} hidden={tab === 'danger'}>
        <small>{hero.label}</small>
        <strong className={hero.negative ? 'is-negative' : ''}>{hero.value}</strong>
        <div className="tj-ma-pills" data-scroll-row="true">
          {hero.accounts.map(item => <button type="button" key={item.id} aria-pressed={item.id === hero.selectedId} onClick={() => hero.onSelect(item.id)}><span><b>{(item.name || '?').trim().charAt(0).toUpperCase()}</b>{item.name}</span></button>)}
          {hero.onAdd && <button type="button" className="is-add" onClick={hero.onAdd}><span>+ Add</span></button>}
        </div>
        <div className="tj-ma-mode"><span>{hero.countLabel}</span><div className="tj-ma-seg" role="group" aria-label="Account type">{hero.types.map(([value, label, disabled]) => <button type="button" key={value} aria-pressed={value === hero.type} disabled={disabled} onClick={() => hero.onType(value)}><span>{label}</span></button>)}</div></div>
      </section>
      {tab === 'account' && <main className="tj-ma-main">{account}</main>}
      {tab === 'goals' && <main className="tj-ma-main">{goals}</main>}
      {tab === 'danger' && <main className="tj-ma-main"><h2 className="tj-ma-label">Danger zone</h2>{danger}</main>}
      <p className="tj-ma-foot">Settings stay private to this workspace.</p>
    </div>
    {dirty && <div className="tj-ma-savebar"><button type="button" onClick={onClose}>Discard</button><button type="button" className="is-save" disabled={saveDisabled} title={saveTitle} onClick={onSave}>{saving ? 'Saving…' : 'Save settings'}</button></div>}
  </div>;
}

export {Group, Icon, Popup};
