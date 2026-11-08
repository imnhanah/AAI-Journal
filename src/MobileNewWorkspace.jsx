import React, {useLayoutEffect, useRef, useState} from 'react';
import {Upload, X} from 'lucide-react';
import {getBackNavigation} from './useBackNavigation.js';
import {useLeaveGuard} from './useLeaveGuard.js';
import './mobileNewWorkspace.css';

// The phone sheet for a new workspace. AddAccountModal still owns the draft and creates the account;
// this lays it out, so a workspace made here is exactly the same as one made on desktop.
function Field({label, prefix, suffix, ...input}) {
  return <label className="tj-nw-field"><span>{label}</span><span className="tj-nw-input">{prefix && <em>{prefix}</em>}<input {...input}/>{suffix && <em>{suffix}</em>}</span></label>;
}

function Switch({label, on, disabled, onChange}) {
  return <button type="button" className="tj-nw-switch" role="switch" aria-label={label} aria-checked={on} disabled={disabled} onClick={onChange}><i aria-hidden="true"/></button>;
}

const hintFor = ({named, currency, accountsReady}) => {
  if (!named && !currency) return 'Name and currency are required.';
  if (!named) return 'Add a workspace name.';
  if (!currency) return 'Choose a currency.';
  if (!accountsReady) return 'Each account needs a name and a balance above zero.';
  return 'Ready to create';
};

export default function MobileNewWorkspace({draft, currencies, canMultiple, multipleReason, allowImport, importState, onImportFile, moneyShort, symbol, onClose, onCreate}) {
  const d = draft, multiple = d.isMultiple;
  const [tab, setTab] = useState('account');
  const file = useRef(null), body = useRef(null);
  const named = !!d.name.trim(), currency = !!d.baseCurrency;
  const accountsReady = !multiple || (d.accounts.length >= 2 && d.accounts.every(item => String(item.name || '').trim() && Number(item.startingBalance) > 0));
  const ready = named && currency && accountsReady;
  useLeaveGuard(d.touched && !d.creating, 'new-workspace');
  const leave = () => { const nav = getBackNavigation(); if (nav.enabled) nav.back(); else onClose(); };
  const choose = next => { setTab(next); body.current?.scrollTo({top:0}); };
  // The form shared with desktop puts a typed balance on the new Account 2. On the phone it stays on
  // the first account. It moves only when the balance is new, so edits to the accounts survive Single and back.
  const carry = useRef(false), carried = useRef('');
  const chooseMultiple = () => { carry.current = !multiple && Number(d.balance) > 0 && d.balance !== carried.current; d.setMultiple(true); };
  useLayoutEffect(() => {
    if (!carry.current || !multiple) return;
    carry.current = false; carried.current = d.balance;
    const [primary, second] = d.accounts;
    d.updateAccount(primary.id, 'startingBalance', d.balance);
    if (Number(second.startingBalance) === Number(d.balance)) d.updateAccount(second.id, 'startingBalance', '');
  });
  return <div className="tj-nw">
    <i className="tj-nw-grab" aria-hidden="true"/>
    <header className="tj-nw-head"><button type="button" className="tj-nw-close" aria-label="Close" disabled={d.creating} onClick={leave}><span><X size={18}/></span></button><small>New workspace</small></header>
    <div className="tj-nw-name"><input aria-label="Workspace name" placeholder="Workspace name" autoComplete="off" value={d.name} onChange={event => d.setName(event.target.value)}/></div>
    <div className="tj-nw-sum">
      <div><small>Starting balance</small><b>{moneyShort(d.base, d.baseCurrency)}</b></div>
      <div><small>Accounts</small><b>{multiple ? d.accounts.length : 1}</b></div>
      <div><small>Currency</small><b className={currency ? '' : 'is-dim'}>{d.baseCurrency || 'Choose'}</b></div>
    </div>
    <div className="tj-nw-seg tj-nw-tabs" role="tablist" aria-label="Workspace sections">{[['account', 'Account & Challenge'], ['goals', 'Goals & Risk']].map(([value, label]) => <button type="button" key={value} role="tab" aria-selected={tab === value} onClick={() => choose(value)}>{label}</button>)}</div>
    <div className="tj-nw-body" ref={body}>
      {tab === 'account' ? <>
        <section className="tj-nw-group">
          <h3>Account<span className={currency ? 'is-ok' : ''}>{currency ? `${d.baseCurrency} selected` : 'Currency required'}</span></h3>
          <div className="tj-nw-label">Currency</div>
          <div className="tj-nw-chips" role="radiogroup" aria-label="Currency" data-scroll-row="true">{currencies.map(item => <button type="button" key={item.code} role="radio" aria-checked={item.code === d.baseCurrency} onClick={() => d.setBaseCurrency(item.code)}>{item.code}</button>)}</div>
          <div className="tj-nw-label is-spaced">Account type</div>
          <div className="tj-nw-seg" role="group" aria-label="Account type"><button type="button" aria-pressed={!multiple} onClick={() => d.setMultiple(false)}>Single</button><button type="button" aria-pressed={multiple} disabled={!canMultiple} title={canMultiple ? undefined : multipleReason} onClick={chooseMultiple}>Multiple</button></div>
          {!canMultiple && multipleReason && <p className="tj-nw-note">{multipleReason}</p>}
          {multiple
            ? <div className="tj-nw-accounts">{d.accounts.map((item, index) => <div className="tj-nw-account" key={item.id}>
                <span className="tj-nw-input"><input aria-label={`Account ${index + 1} name`} placeholder={`Account ${index + 1}`} value={item.name} onChange={event => d.updateAccount(item.id, 'name', event.target.value)}/></span>
                <span className="tj-nw-input"><em>{symbol(d.baseCurrency)}</em><input aria-label={`Account ${index + 1} balance`} inputMode="decimal" placeholder="0" value={item.startingBalance || ''} onChange={event => d.updateAccount(item.id, 'startingBalance', event.target.value)}/></span>
                <button type="button" className="tj-nw-remove" aria-label={`Remove account ${index + 1}`} disabled={d.accounts.length <= 2} onClick={() => d.removeAccount(item.id)}><b><X size={14}/></b></button>
              </div>)}<button type="button" className="tj-nw-add" onClick={d.addAccount}>+ Add account</button></div>
            : <Field label="Balance" prefix={symbol(d.baseCurrency)} inputMode="decimal" placeholder="0" value={d.balance || ''} onChange={event => d.setBalance(event.target.value)}/>}
          {allowImport && <>
            <button type="button" className="tj-nw-upload" disabled={d.creating} onClick={() => file.current?.click()}><span><Upload size={20} aria-hidden="true"/></span><span><b>{importState.fileName || 'Import trades'}</b><small>{importState.summary || 'Optional · broker file or CSV'}</small></span></button>
            <input ref={file} className="tj-nw-file" type="file" accept=".html,.htm,.csv,.txt,.tsv" tabIndex={-1} aria-hidden="true" onChange={event => { onImportFile(event.target.files?.[0] || null); event.target.value = ''; }}/>
            {importState.error && <p className="tj-nw-error" role="alert">{importState.error}</p>}
            {importState.progress != null && <p className="tj-nw-note" role="status">Importing trades… {importState.progress}%</p>}
          </>}
        </section>
        <section className="tj-nw-group"><h3>Costs</h3><div className="tj-nw-two">
          <Field label="Breakeven cap" prefix={symbol(d.baseCurrency)} inputMode="decimal" placeholder="0" value={d.breakevenCap || ''} onChange={event => d.setBreakevenCap(event.target.value)}/>
          <Field label="Commission" prefix={symbol(d.baseCurrency)} inputMode="decimal" placeholder="0" value={d.commission || ''} onChange={event => d.setCommission(event.target.value)}/>
        </div></section>
        <section className="tj-nw-group">
          <div className="tj-nw-toggle"><b>Position calculator</b><Switch label="Position calculator" on={d.positionOn} onChange={() => d.setPositionOn(value => !value)}/></div>
          {d.positionOn && <div className="tj-nw-reveal tj-nw-two"><Field label="Risk per trade" suffix="%" inputMode="decimal" value={d.risk} onChange={event => d.setRisk(event.target.value)}/><Field label="Stop loss" suffix="pips" inputMode="decimal" placeholder="Optional" value={d.stopLoss} onChange={event => d.setStopLoss(event.target.value)}/></div>}
        </section>
        {!multiple && <section className="tj-nw-group">
          <div className="tj-nw-toggle"><b>Challenge</b><Switch label="Challenge" on={d.challengeOn && d.base > 0} disabled={!(d.base > 0)} onChange={() => d.setChallengeOn(value => !value)}/></div>
          <p className="tj-nw-reveal tj-nw-note">{d.base > 0 ? (d.challengeOn ? 'The balance above is used as the challenge balance.' : 'Uses this balance and starts at Level 1.') : 'Add a balance first to turn this on.'}</p>
        </section>}
      </> : <>
        <section className="tj-nw-group"><h3>Goals</h3><div className="tj-nw-two">
          <Field label="Monthly target" suffix="%" inputMode="decimal" placeholder="0" value={d.monthlyGoal} onChange={event => d.setMonthlyGoal(event.target.value)}/>
          <Field label="Yearly target" suffix="%" inputMode="decimal" placeholder="0" value={d.yearlyGoal} onChange={event => d.setYearlyGoal(event.target.value)}/>
        </div></section>
        <section className="tj-nw-group"><h3>Risk guardrails</h3><div className="tj-nw-two">
          <Field label="Max daily loss" suffix="%" inputMode="decimal" placeholder="0" value={d.dailyLoss} onChange={event => d.setDailyLoss(event.target.value)}/>
          <Field label="Max monthly loss" suffix="%" inputMode="decimal" placeholder="0" value={d.monthlyLoss} onChange={event => d.setMonthlyLoss(event.target.value)}/>
        </div></section>
      </>}
    </div>
    <footer className="tj-nw-foot">
      <p aria-live="polite">{hintFor({named, currency, accountsReady})}</p>
      <div><button type="button" disabled={d.creating} onClick={leave}>Cancel</button><button type="button" className="is-primary" disabled={!ready || d.creating} onClick={onCreate}>{d.creating ? 'Creating…' : 'Create workspace'}</button></div>
    </footer>
  </div>;
}
