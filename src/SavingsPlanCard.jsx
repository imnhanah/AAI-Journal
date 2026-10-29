import React, {useState} from 'react';
import {ArrowUpRight, Landmark} from 'lucide-react';
import {savingsCardModel} from './savingsCardModel.js';
import './savingsPlanCard.css';

export default function SavingsPlanCard({saving, saved, allocation, ownerName, money, onTransfer}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const model=savingsCardModel(saving,saved,allocation);
  const balanceMoney=value=>money(value).replace(/^\+/, '');
  // Presentation only: give long formatted figures room without changing values.
  const longAmounts=[model.saved,model.target,model.goalRemaining,model.profit,model.retained,model.allocated,model.paid,model.ready].some(value=>money(value).length>13);
  const record=async()=>{
    if(busy || !(model.ready>0))return;
    setBusy(true);setError('');
    try {await onTransfer();} catch(reason) {setError(reason.message || String(reason));}
    finally {setBusy(false);}
  };
  return <article className={`tj-savings-orbit${longAmounts?' tj-savings-orbit-long':''}`} aria-label={saving.name}>
    <header className="tj-savings-orbit-header"><div><small>Savings plan</small><h3>{saving.name}</h3><span>{ownerName}{ownerName?' · ':''}{saving.interval || 'Weekly'}</span></div><span className="tj-savings-orbit-rate">{model.rate}% allocation</span></header>
    <div className="tj-savings-orbit-summary"><div><span className="tj-savings-orbit-label">Saved balance</span><strong className="tj-savings-orbit-money">{balanceMoney(model.saved)}</strong><span className="tj-savings-orbit-target">Target {balanceMoney(model.target)}</span></div><div className="tj-savings-orbit-ring" role="progressbar" aria-label="Savings goal progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.progress} style={{'--savings-progress':`${model.progress}%`}}><div><Landmark size={18} aria-hidden="true"/><strong>{model.progress.toFixed(0)}%</strong><span>of goal</span></div></div></div>
    <div className="tj-savings-orbit-remaining"><span>Remaining to your goal</span><strong>{balanceMoney(model.goalRemaining)}</strong></div>
    <section className="tj-savings-orbit-allocation" aria-label="Profit allocation breakdown"><div className="tj-savings-orbit-profit"><div><small>Current profit</small><strong>{balanceMoney(model.profit)}</strong></div><span>{model.rate}% allocation</span></div><div className="tj-savings-orbit-split" role="img" aria-label={`${100-model.rate}% retained; ${model.rate}% allocated to savings`}><i style={{flex:100-model.rate}}/><b style={{flex:model.rate}}/></div><div className="tj-savings-orbit-destinations"><div><span>Retained · {100-model.rate}%</span><strong>{balanceMoney(model.retained)}</strong></div><div><span>To savings · {model.rate}%</span><strong>{money(model.allocated)}</strong></div></div>{model.paid>0&&<div className="tj-savings-orbit-paid"><span>Already transferred</span><strong>{balanceMoney(model.paid)}</strong></div>}</section>
    <footer className="tj-savings-orbit-footer"><div><span>Ready to transfer</span><strong>{money(model.ready)}</strong></div><button type="button" className="tj-btn-primary tj-savings-orbit-transfer" disabled={busy || !(model.ready>0)} onClick={record}>{busy?'Saving…':'Record transfer'}<ArrowUpRight size={16} aria-hidden="true"/></button></footer>
    {error&&<p role="alert" className="tj-savings-orbit-error">{error}</p>}
  </article>;
}
