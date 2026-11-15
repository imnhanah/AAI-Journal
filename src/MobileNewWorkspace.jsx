import React, {useRef, useState} from 'react';
import {AlertTriangle, Check, ChevronDown, ChevronLeft, CreditCard, Layers, ShieldCheck, Upload} from 'lucide-react';
import {getBackNavigation} from './useBackNavigation.js';
import {useLeaveGuard} from './useLeaveGuard.js';
import './mobileNewWorkspace.css';

const SINGLE = 'standard', MULTI = 'multi_balance';

function Field({label, prefix, suffix, ...input}) {
  return <label className="tj-nw-field"><span>{label}</span><span className="tj-nw-input">{prefix && <em>{prefix}</em>}<input {...input}/>{suffix && <em>{suffix}</em>}</span></label>;
}

function Switch({label, on, onChange}) {
  return <button type="button" className="tj-nw-switch" role="switch" aria-label={label} aria-checked={on} onClick={onChange}><i aria-hidden="true"/></button>;
}

function More({id, title, summary, open, onToggle, children}) {
  return <section className={`tj-nw-more ${open ? 'is-open' : ''}`}>
    <button type="button" className="tj-nw-more-head" aria-expanded={open} aria-controls={`tj-nw-more-${id}`} onClick={() => onToggle(id)}><span><b>{title}</b><small>{summary}</small></span><ChevronDown size={18} aria-hidden="true"/></button>
    {open && <div className="tj-nw-more-body" id={`tj-nw-more-${id}`}>{children}</div>}
  </section>;
}

const hintFor = ({named, currency}) => {
  if (!named && !currency) return 'Name and currency are required.';
  if (!named) return 'Add an account name.';
  return 'Choose a currency.';
};

export default function MobileNewWorkspace({draft, currencies, allowImport, importState, onImportFile, moneyShort, symbol, onClose, onCreate}) {
  const d = draft;
  const file = useRef(null);
  const [step, setStep] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [openMore, setOpenMore] = useState(null);
  const named = !!d.name.trim(), currency = !!d.baseCurrency;
  const ready = named && currency;
  const multi = d.type === MULTI;
  const typeName = multi ? 'Multiple accounts' : 'Single account';
  useLeaveGuard(d.touched && !d.creating, 'new-workspace');
  const leave = () => { const nav = getBackNavigation(); if (nav.enabled) nav.back(); else onClose(); };
  const back = () => { if (step > 1) setStep(step - 1); else leave(); };
  const toggleMore = id => setOpenMore(current => current === id ? null : id);
  const next = () => { if (step < 3) setStep(step + 1); else setConfirming(true); };
  const types = [[SINGLE, 'Single', 'One account, one set of trades', <CreditCard size={24} aria-hidden="true"/>], [MULTI, 'Multiple', 'Several accounts side by side', <Layers size={24} aria-hidden="true"/>]];
  return <div className="tj-nw tj-nw2">
    <i className="tj-nw-grab" aria-hidden="true"/>
    <header className="tj-nw2-head">
      <button type="button" className="tj-nw2-back" aria-label={step > 1 ? 'Back' : 'Close'} disabled={d.creating} onClick={back}><span><ChevronLeft size={20}/></span></button>
      <b>Create new account</b>
      <small>{step} of 3</small>
    </header>
    <div className="tj-nw2-bar" aria-hidden="true">{[1, 2, 3].map(n => <i key={n} className={n <= step ? 'is-on' : ''}/>)}</div>
    <div className="tj-nw-body">
      {step === 1 && <>
        <div className="tj-nw2-title"><h1>How will you trade?</h1><p>Pick the account type. You only get to choose once.</p></div>
        <div className="tj-nw2-types" role="radiogroup" aria-label="Account type">
          {types.map(([value, label, text, icon]) => <button type="button" key={value} role="radio" aria-checked={d.type === value} className="tj-nw2-type" onClick={() => d.setType(value)}><span className="tj-nw2-type-ic">{icon}</span><span><b>{label}</b><small>{text}</small></span><span className="tj-nw2-ck"><Check size={14} strokeWidth={3} aria-hidden="true"/></span></button>)}
        </div>
        <div className="tj-nw2-warn" role="note"><AlertTriangle size={18} aria-hidden="true"/><div><b>Can't be changed later</b><span>To switch types, create a new account.</span></div></div>
      </>}
      {step === 2 && <>
        <div className="tj-nw2-title"><h1>Name your account</h1><p>Add the basics. Everything else is optional.</p></div>
        <section className="tj-nw-group">
          <h3>Account<span className={currency ? '' : 'is-warn'}>{currency ? `${d.baseCurrency} selected` : 'Currency required'}</span></h3>
          <Field label="Account name" aria-label="Account name" placeholder="e.g. Main account" autoComplete="off" value={d.name} onChange={e => d.setName(e.target.value)}/>
          <div className="tj-nw-label is-spaced">Currency</div>
          <div className="tj-nw-chips" role="radiogroup" aria-label="Currency" data-scroll-row="true">{currencies.map(item => <button type="button" key={item.code} role="radio" aria-checked={item.code === d.baseCurrency} onClick={() => d.setBaseCurrency(item.code)}>{item.code}</button>)}</div>
          <div className="tj-nw-gap" aria-hidden="true"/>
          <Field label="Starting balance" prefix={symbol(d.baseCurrency)} inputMode="decimal" placeholder="0" value={d.balance || ''} onChange={e => d.setBalance(e.target.value)}/>
          {allowImport && <>
            <button type="button" className="tj-nw-upload" disabled={d.creating} onClick={() => file.current?.click()}><span><Upload size={20} aria-hidden="true"/></span><span><b>{importState.fileName || 'Import trades'}</b><small>{importState.summary || 'Optional · broker file or CSV'}</small></span></button>
            <input ref={file} className="tj-nw-file" type="file" accept=".html,.htm,.csv,.txt,.tsv" tabIndex={-1} aria-hidden="true" onChange={e => { onImportFile(e.target.files?.[0] || null); e.target.value = ''; }}/>
            {importState.error && <p className="tj-nw-error" role="alert">{importState.error}</p>}
            {importState.progress != null && <p className="tj-nw-note" role="status">Importing trades… {importState.progress}%</p>}
          </>}
        </section>
        <div className="tj-nw2-optional">Optional settings</div>
        <More id="costs" title="Costs" summary="Breakeven cap and commission" open={openMore === 'costs'} onToggle={toggleMore}>
          <div className="tj-nw-two">
            <Field label="Breakeven cap" prefix={symbol(d.baseCurrency)} inputMode="decimal" placeholder="0" value={d.breakevenCap || ''} onChange={e => d.setBreakevenCap(e.target.value)}/>
            <Field label="Commission" prefix={symbol(d.baseCurrency)} inputMode="decimal" placeholder="0" value={d.commission || ''} onChange={e => d.setCommission(e.target.value)}/>
          </div>
        </More>
        <More id="position" title="Position calculator" summary={d.positionOn ? 'On' : 'Off'} open={openMore === 'position'} onToggle={toggleMore}>
          <div className="tj-nw-toggle"><b>Position calculator</b><Switch label="Position calculator" on={d.positionOn} onChange={() => d.setPositionOn(v => !v)}/></div>
          {d.positionOn && <div className="tj-nw-reveal tj-nw-two"><Field label="Risk per trade" suffix="%" inputMode="decimal" value={d.risk} onChange={e => d.setRisk(e.target.value)}/><Field label="Stop loss" suffix="pips" inputMode="decimal" placeholder="Optional" value={d.stopLoss} onChange={e => d.setStopLoss(e.target.value)}/></div>}
        </More>
        <More id="goals" title="Goals" summary={d.monthlyGoal || d.yearlyGoal ? 'Active' : 'Monthly and yearly targets'} open={openMore === 'goals'} onToggle={toggleMore}>
          <div className="tj-nw-two">
            <Field label="Monthly target" suffix="%" inputMode="decimal" placeholder="0" value={d.monthlyGoal} onChange={e => d.setMonthlyGoal(e.target.value)}/>
            <Field label="Yearly target" suffix="%" inputMode="decimal" placeholder="0" value={d.yearlyGoal} onChange={e => d.setYearlyGoal(e.target.value)}/>
          </div>
        </More>
        <More id="guardrails" title="Risk guardrails" summary={d.dailyLoss || d.monthlyLoss ? 'Active' : 'Daily and monthly loss limits'} open={openMore === 'guardrails'} onToggle={toggleMore}>
          <div className="tj-nw-two">
            <Field label="Max daily loss" suffix="%" inputMode="decimal" placeholder="0" value={d.dailyLoss} onChange={e => d.setDailyLoss(e.target.value)}/>
            <Field label="Max monthly loss" suffix="%" inputMode="decimal" placeholder="0" value={d.monthlyLoss} onChange={e => d.setMonthlyLoss(e.target.value)}/>
          </div>
        </More>
      </>}
      {step === 3 && <>
        <div className="tj-nw2-title"><h1>Looks good?</h1><p>Review, then create it.</p></div>
        <div className="tj-nw2-hero">
          <small>New account</small>
          <strong>{d.name.trim()}</strong>
          <em>{moneyShort(d.base, d.baseCurrency)}</em>
          <div><span className="is-accent"><ShieldCheck size={13} aria-hidden="true"/>{typeName}</span><span>{d.baseCurrency}</span></div>
        </div>
        <div className="tj-nw2-rows">
          <div><span>Type</span><b>{typeName}</b></div>
          <div><span>Currency</span><b>{d.baseCurrency}</b></div>
          {importState.fileName && <div><span>Import</span><b>{importState.fileName}</b></div>}
          <div><span>Type can be changed</span><b>Never</b></div>
        </div>
      </>}
    </div>
    <footer className="tj-nw-foot">
      <p aria-live="polite">{step === 2 && !ready ? hintFor({named, currency}) : ''}</p>
      <button type="button" className="is-primary" disabled={(step > 1 && !ready) || d.creating} onClick={next}>{d.creating ? 'Creating…' : step === 3 ? 'Create account' : 'Continue'}</button>
    </footer>
    {confirming && <div className="tj-nw2-sheet" role="presentation" onClick={e => { if (e.target === e.currentTarget && !d.creating) setConfirming(false); }}>
      <div className="tj-nw2-sheet-card" role="alertdialog" aria-modal="true" aria-labelledby="tj-nw2-sheet-title">
        <i className="tj-nw-grab" aria-hidden="true"/>
        <span className="tj-nw2-sheet-ic"><AlertTriangle size={24} aria-hidden="true"/></span>
        <h3 id="tj-nw2-sheet-title">{multi ? 'Create a Multiple account?' : 'Create a Single account?'}</h3>
        <p>The account type is locked once it is saved. To use a different type later, you would create a new account.</p>
        <button type="button" className="is-primary" disabled={!ready || d.creating} onClick={() => { setConfirming(false); onCreate(); }}>{d.creating ? 'Creating…' : 'Yes, create account'}</button>
        <button type="button" disabled={d.creating} onClick={() => setConfirming(false)}>Go back</button>
      </div>
    </div>}
  </div>;
}
