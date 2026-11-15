import React, {useRef} from 'react';
import {Upload, X} from 'lucide-react';
import {getBackNavigation} from './useBackNavigation.js';
import {useLeaveGuard} from './useLeaveGuard.js';
import './mobileNewWorkspace.css';

function Field({label, prefix, suffix, ...input}) {
  return <label className="tj-nw-field"><span>{label}</span><span className="tj-nw-input">{prefix && <em>{prefix}</em>}<input {...input}/>{suffix && <em>{suffix}</em>}</span></label>;
}

function Switch({label, on, onChange}) {
  return <button type="button" className="tj-nw-switch" role="switch" aria-label={label} aria-checked={on} onClick={onChange}><i aria-hidden="true"/></button>;
}

const hintFor = ({named, currency}) => {
  if (!named && !currency) return 'Name and currency are required.';
  if (!named) return 'Add an account name.';
  return 'Choose a currency.';
};

export default function MobileNewWorkspace({draft, currencies, allowImport, importState, onImportFile, moneyShort, symbol, onClose, onCreate}) {
  const d = draft;
  const file = useRef(null);
  const named = !!d.name.trim(), currency = !!d.baseCurrency;
  const ready = named && currency;
  useLeaveGuard(d.touched && !d.creating, 'new-workspace');
  const leave = () => { const nav = getBackNavigation(); if (nav.enabled) nav.back(); else onClose(); };
  return <div className="tj-nw">
    <i className="tj-nw-grab" aria-hidden="true"/>
    <header className="tj-nw-head"><button type="button" className="tj-nw-close" aria-label="Close" disabled={d.creating} onClick={leave}><span><X size={18}/></span></button><small>New account</small></header>
    <div className="tj-nw-name"><input aria-label="Account name" placeholder="Account name" autoComplete="off" value={d.name} onChange={e => d.setName(e.target.value)}/></div>
    <div className="tj-nw-sum">
      <div><small>Starting balance</small><b>{moneyShort(d.base, d.baseCurrency)}</b></div>
      <div><small>Currency</small><b className={currency ? '' : 'is-dim'}>{d.baseCurrency || 'Choose'}</b></div>
    </div>
    <div className="tj-nw-body">
      <section className="tj-nw-group">
        <h3>Account<span className={currency ? '' : 'is-warn'}>{currency ? `${d.baseCurrency} selected` : 'Currency required'}</span></h3>
        <div className="tj-nw-label">Currency</div>
        <div className="tj-nw-chips" role="radiogroup" aria-label="Currency" data-scroll-row="true">{currencies.map(item => <button type="button" key={item.code} role="radio" aria-checked={item.code === d.baseCurrency} onClick={() => d.setBaseCurrency(item.code)}>{item.code}</button>)}</div>
        <Field label="Balance" prefix={symbol(d.baseCurrency)} inputMode="decimal" placeholder="0" value={d.balance || ''} onChange={e => d.setBalance(e.target.value)}/>
        {allowImport && <>
          <button type="button" className="tj-nw-upload" disabled={d.creating} onClick={() => file.current?.click()}><span><Upload size={20} aria-hidden="true"/></span><span><b>{importState.fileName || 'Import trades'}</b><small>{importState.summary || 'Optional · broker file or CSV'}</small></span></button>
          <input ref={file} className="tj-nw-file" type="file" accept=".html,.htm,.csv,.txt,.tsv" tabIndex={-1} aria-hidden="true" onChange={e => { onImportFile(e.target.files?.[0] || null); e.target.value = ''; }}/>
          {importState.error && <p className="tj-nw-error" role="alert">{importState.error}</p>}
          {importState.progress != null && <p className="tj-nw-note" role="status">Importing trades… {importState.progress}%</p>}
        </>}
        <p className="tj-nw-note">Need several balances? Switch to Multiple in Account settings after creation.</p>
      </section>
      <section className="tj-nw-group"><h3>Costs</h3><div className="tj-nw-two">
        <Field label="Breakeven cap" prefix={symbol(d.baseCurrency)} inputMode="decimal" placeholder="0" value={d.breakevenCap || ''} onChange={e => d.setBreakevenCap(e.target.value)}/>
        <Field label="Commission" prefix={symbol(d.baseCurrency)} inputMode="decimal" placeholder="0" value={d.commission || ''} onChange={e => d.setCommission(e.target.value)}/>
      </div></section>
      <section className="tj-nw-group">
        <div className="tj-nw-toggle"><b>Position calculator</b><Switch label="Position calculator" on={d.positionOn} onChange={() => d.setPositionOn(v => !v)}/></div>
        {d.positionOn && <div className="tj-nw-reveal tj-nw-two"><Field label="Risk per trade" suffix="%" inputMode="decimal" value={d.risk} onChange={e => d.setRisk(e.target.value)}/><Field label="Stop loss" suffix="pips" inputMode="decimal" placeholder="Optional" value={d.stopLoss} onChange={e => d.setStopLoss(e.target.value)}/></div>}
      </section>
      <section className="tj-nw-group"><h3>Goals</h3><div className="tj-nw-two">
        <Field label="Monthly target" suffix="%" inputMode="decimal" placeholder="0" value={d.monthlyGoal} onChange={e => d.setMonthlyGoal(e.target.value)}/>
        <Field label="Yearly target" suffix="%" inputMode="decimal" placeholder="0" value={d.yearlyGoal} onChange={e => d.setYearlyGoal(e.target.value)}/>
      </div></section>
      <section className="tj-nw-group"><h3>Risk guardrails</h3><div className="tj-nw-two">
        <Field label="Max daily loss" suffix="%" inputMode="decimal" placeholder="0" value={d.dailyLoss} onChange={e => d.setDailyLoss(e.target.value)}/>
        <Field label="Max monthly loss" suffix="%" inputMode="decimal" placeholder="0" value={d.monthlyLoss} onChange={e => d.setMonthlyLoss(e.target.value)}/>
      </div></section>
    </div>
    <footer className="tj-nw-foot">
      <p aria-live="polite">{!ready && hintFor({named, currency})}</p>
      <div><button type="button" disabled={d.creating} onClick={leave}>Cancel</button><button type="button" className="is-primary" disabled={!ready || d.creating} onClick={onCreate}>{d.creating ? 'Creating…' : 'Create account'}</button></div>
    </footer>
  </div>;
}
