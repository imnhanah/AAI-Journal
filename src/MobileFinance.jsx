import React,{useEffect,useRef,useState} from 'react';
import {ArrowDownToLine,ArrowUpFromLine,Repeat2,Plus,X} from 'lucide-react';
import {ThemeSelect,ThemeDate,ConfirmDeleteButton} from './JournalControls';
import './mobileFinance.css';
import {DECIMAL_INPUT_MODE} from './mobileFinanceConstants.js';
import SavingsPlanCard from './SavingsPlanCard.jsx';

export default function MobileFinance(p) {
  const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[fade,setFade]=useState(false);
  const dialog=useRef(null),swipe=useRef(null),filters=useRef(null);
  useEffect(()=>{
    const el=filters.current;
    const update=()=>setFade(el.scrollLeft+el.clientWidth<el.scrollWidth-2);
    update();const observer=new ResizeObserver(update);observer.observe(el);el.addEventListener('scroll',update);
    return()=>{observer.disconnect();el.removeEventListener('scroll',update);};
  },[]);
  useEffect(()=>{
    if(!open)return;
    const prior=document.activeElement;
    const states=[...document.querySelectorAll('.tj-topbar,.tj-mobile-bottom')].map(node=>[node,node.inert]);
    states.forEach(([node])=>{node.inert=true;});
    dialog.current.querySelector('.tj-phone-finance-close')?.focus();
    const keydown=event=>{
      if(event.key==='Escape'){event.stopPropagation();if(!saving)setOpen(false);}
      if(event.key==='Tab'){
        const nodes=[...dialog.current.querySelectorAll('button,input,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length);
        const first=nodes[0],last=nodes.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',keydown);
    return()=>{document.removeEventListener('keydown',keydown);states.forEach(([node,inert])=>{node.inert=inert;});requestAnimationFrame(()=>prior?.isConnected&&prior.focus());};
  },[open,saving]);
  const submit=async()=>{setSaving(true);setError('');try{if(await p.onRecord())setOpen(false);}catch(err){setError(err.message);}finally{setSaving(false);}};
  const ready=p.savings.reduce((sum,s)=>sum+s.allocation.remaining,0);
  const close=()=>{if(!saving)setOpen(false);};
  const accountPicker=(label)=><ThemeSelect label={label} variant="account-card" value={p.balanceId} onChange={e=>p.onBalance(e.target.value)}>{p.balances.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</ThemeSelect>;
  const icon=type=>type==='deposit'?<ArrowDownToLine size={18}/>:type==='transfer'?<Repeat2 size={18}/>:<ArrowUpFromLine size={18}/>;
  return <>
    <div className="tj-phone-finance" {...(open?{inert:''}:{})}>
      <div className="tj-phone-finance-account">{accountPicker('Finance account')}</div>
      <div className="tj-phone-finance-stats">
        <section className={`tj-phone-finance-capital ${p.totals.tradingBalance<0?'is-negative':''}`}><small>AVAILABLE CAPITAL</small><strong className={p.totals.tradingBalance<0?'tj-red':'tj-green'}>{p.money(p.totals.tradingBalance)}</strong><span>Trading account balance</span></section>
        <section className="tj-phone-finance-total"><small>TOTAL SAVINGS</small><strong>{p.money(p.totals.savings)}</strong><span>{p.savings.length} savings accounts</span></section>
        <section className="tj-phone-finance-ready"><small>READY TO SAVE</small><strong className="tj-green">{p.money(ready)}</strong><span>Baseline {p.money(p.baseline)}</span></section>
        <section className="tj-phone-finance-flow"><div><small>CASH FLOW</small><span>{p.money(p.totals.deposits-p.totals.withdrawals)} net</span></div><i><b style={{width:`${p.totals.deposits+p.totals.withdrawals?100*p.totals.deposits/(p.totals.deposits+p.totals.withdrawals):0}%`}}/></i><footer><span className="tj-green">{p.money(p.totals.deposits)} deposits</span><span className="tj-red">{p.money(-p.totals.withdrawals)} withdrawals</span></footer></section>
      </div>
      <button type="button" className="tj-btn-primary tj-phone-finance-add" onClick={()=>{setError('');setOpen(true);}}><Plus size={20}/> Record movement</button>
      <header className="tj-phone-finance-caption"><strong>CASH MOVEMENTS</strong><span>Capital ledger</span></header>
      <div className="tj-phone-finance-filter-wrap"><div className="tj-phone-finance-filters" data-scroll-row="true" ref={filters}>{[['all','All'],['deposit','Deposits'],['withdrawal','Withdrawals'],['transfer','Transfers']].map(([value,label])=><button key={value} type="button" aria-pressed={p.filter===value} onClick={()=>p.onFilter(value)}>{label}</button>)}</div>{fade&&<div className="tj-phone-finance-filter-fade" aria-hidden="true"/>}</div>
      <section className="tj-phone-finance-ledger" aria-label="Cash movements">
        {p.movements.map((m,index)=><React.Fragment key={m.id}>
          {(!index||p.movements[index-1].year!==m.year)&&<header><strong>{m.year}</strong><span>{p.allMovements.filter(item=>item.year===m.year).length} movements</span></header>}
          <div className={`tj-phone-finance-movement is-${m.type}`}>
            <i>{icon(m.type)}</i><strong>{m.title}</strong><b>{m.type==='deposit'?'+':'-'}{p.money(Math.abs(m.amount)).replace(/^\+/, '')}</b>
            <p><time dateTime={m.isoDate}>{m.day} {m.month}</time>{m.accountName&&` · ${m.accountName}`}{m.note&&` · ${m.note}`}</p>
            <ConfirmDeleteButton title="Delete movement" className="tj-phone-finance-delete" onClick={()=>p.onDelete(m.id)}>···</ConfirmDeleteButton>
          </div>
        </React.Fragment>)}
        {!p.movements.length&&<p>No cash movements yet. Add a deposit, withdrawal, or transfer when it happens.</p>}
      </section>
      {p.totalMovements>6&&<button type="button" className="tj-phone-finance-older" aria-expanded={p.showOlder} onClick={p.onOlder}>{p.showOlder?'Show recent movements':'Show older movements'}</button>}
      <header className="tj-phone-finance-caption"><strong>SAVINGS PLANS</strong><span>{p.savings.length} accounts</span></header>
      <section className="tj-phone-finance-plans" aria-label="Savings plans">{p.savings.map(s=>{
        return <SavingsPlanCard key={s.id} saving={s} saved={s.saved} allocation={s.allocation} ownerName={s.ownerName || p.balances.find(b=>b.id===s.ownerBalanceId)?.name || ''} money={p.money} onTransfer={()=>{p.onPlanned(s);setError('');setOpen(true);}}/>;
      })}{!p.savings.length&&<p>Add a savings account in Account Settings to use transfers.</p>}</section>
    </div>
    {open&&<div className="tj-phone-finance-layer"><div className="tj-phone-finance-backdrop" onClick={close}/><section className="tj-phone-finance-sheet" role="dialog" aria-modal="true" aria-label="New movement" ref={dialog}>
      <button type="button" className="tj-phone-finance-handle" aria-label="Close movement form" onClick={close} onTouchStart={e=>{swipe.current=e.touches[0].clientY;}} onTouchEnd={e=>{if(swipe.current!=null&&e.changedTouches[0].clientY-swipe.current>60)close();swipe.current=null;}}><span/></button>
      <header><h2>New movement</h2><button type="button" className="tj-phone-finance-close" aria-label="Close movement form" onClick={close}><X size={20}/></button></header>
      <div className="tj-phone-finance-sheet-body">
        <div className="tj-phone-finance-tabs" role="tablist" aria-label="Movement type">{[['deposit','Add funds'],['withdrawal','Withdraw'],['transfer','Transfer']].map(([value,label])=><button key={value} type="button" role="tab" aria-selected={p.type===value} onClick={()=>p.onType(value)}>{label}</button>)}</div>
        {!(p.type==='withdrawal'&&p.source==='savings')&&<label><span>{p.type==='transfer'?'Source account':'Account'}</span>{accountPicker('Movement account')}</label>}
        {p.type==='withdrawal'&&<label><span>Withdraw from</span><ThemeSelect label="Withdraw from" value={p.source} onChange={e=>p.onSource(e.target.value)}><option value="trading">Trading account</option><option value="savings">Savings account</option></ThemeSelect></label>}
        {p.requiresSavings&&<label><span>{p.type==='transfer'?'Transfer target':'Withdrawal account'}</span><ThemeSelect label="Savings account" variant="account-card" value={p.savingsId} onChange={e=>p.onSavings(e.target.value)}><option value="" disabled>Select savings account</option>{p.allSavings.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</ThemeSelect></label>}
        <label><span>Amount <span>({p.currency})</span></span><div className="tj-phone-finance-amount"><b aria-hidden="true">{p.currency==='USD'?'$':p.currency}</b><input aria-label="Movement amount" type="number" inputMode={DECIMAL_INPUT_MODE} min="0.01" step="0.01" placeholder="0.00" value={p.amount} onChange={e=>p.onAmount(e.target.value)}/></div></label>
        <div className="tj-phone-finance-date-note"><label><span>Date</span><ThemeDate value={p.date} onChange={e=>p.onDate(e.target.value)} label="Movement date"/></label><label><span>Note</span><input aria-label="Movement note" value={p.note} placeholder="Optional reference" onChange={e=>p.onNote(e.target.value)}/></label></div>
        {error&&<p role="alert">{error}</p>}
      </div>
      <footer><button type="button" className="tj-btn-primary" disabled={saving||!(Number(p.amount)>0)||!p.date||(p.requiresSavings&&!p.savingsId)||!p.balanceId} onClick={submit}><ArrowDownToLine size={18}/> Record movement</button></footer>
    </section></div>}
  </>;
}
