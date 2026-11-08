import React,{useEffect,useRef,useState} from 'react';
import PhoneHeaderSlot from './PhoneHeaderSlot.jsx';
import {ArrowDown,ArrowRightLeft,ArrowUp,MoreHorizontal,Trash2,X} from 'lucide-react';
import {ThemeSelect,ThemeDate,ConfirmDeleteButton} from './JournalControls';
import './mobileFinance.css';
import {DECIMAL_INPUT_MODE} from './mobileFinanceConstants.js';
import {addToAmount,financeMonthGroups,financeMovementIssue,financeMovementSign} from './mobileFinanceModel.js';
import SavingsPlanCard from './SavingsPlanCard.jsx';

const TYPES=[['deposit','Add funds',ArrowDown],['withdrawal','Withdraw',ArrowUp],['transfer','Transfer',ArrowRightLeft]];
const typeIcon=(type,size=20)=>{const Icon=(TYPES.find(item=>item[0]===type)||TYPES[1])[2];return <Icon size={size} strokeWidth={2} aria-hidden="true"/>;};
const noPlus=value=>String(value).replace(/^\+/,'');
const figureSize=value=>value.length>16?'is-longest':value.length>12?'is-long':'';

export default function MobileFinance(p) {
  const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[tab,setTab]=useState('movements'),[menuId,setMenuId]=useState(null);
  const dialog=useRef(null),swipe=useRef(null);
  const menu=menuId==null?null:p.allMovements.find(item=>item.id===menuId)||null;
  const sheetOpen=open||!!menu;
  const closeMenu=()=>setMenuId(null);
  useEffect(()=>{if(menuId!=null&&!menu)setMenuId(null);},[menuId,menu]);
  useEffect(()=>{
    if(!sheetOpen)return;
    const prior=document.activeElement;
    const states=[...document.querySelectorAll('.tj-topbar,.tj-mobile-bottom')].map(node=>[node,node.inert]);
    states.forEach(([node])=>{node.inert=true;});
    dialog.current?.querySelector('.tj-phone-finance-close')?.focus();
    const keydown=event=>{
      if(event.key==='Escape'){event.stopPropagation();closeMenu();if(!saving)setOpen(false);}
      if(event.key==='Tab'&&dialog.current){
        const nodes=[...dialog.current.querySelectorAll('button,input,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length);
        const first=nodes[0],last=nodes.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    // The delete button keeps Escape to itself, so the options sheet has to hear it first.
    const early=!open;
    document.addEventListener('keydown',keydown,early);
    return()=>{document.removeEventListener('keydown',keydown,early);states.forEach(([node,inert])=>{node.inert=inert;});requestAnimationFrame(()=>prior?.isConnected&&prior.focus());};
  },[sheetOpen,saving]);
  useEffect(()=>{setError('');},[p.amount,p.date,p.savingsId,p.type,p.source,p.balanceId]);
  const submit=async()=>{
    const issue=financeMovementIssue({amount:p.amount,date:p.date,requiresSavings:p.requiresSavings,savingsId:p.savingsId,balanceId:p.balanceId});
    if(issue){setError(issue);return;}
    setSaving(true);setError('');try{if(await p.onRecord())setOpen(false);}catch(err){setError(err.message);}finally{setSaving(false);}
  };
  const ready=p.savings.reduce((sum,s)=>sum+s.allocation.remaining,0);
  const close=()=>{if(!saving)setOpen(false);};
  const openNew=type=>{p.onType(type);setError('');setOpen(true);};
  const capital=p.money(p.totals.tradingBalance);
  const flowTotal=p.totals.deposits+p.totals.withdrawals;
  const groups=financeMonthGroups(p.movements,p.allMovements);
  const count=p.savings.length;
  return <>
    <div className="tj-phone-finance" {...(sheetOpen?{inert:''}:{})}>
      {p.balances.length>1&&<div className="tj-phone-finance-account"><PhoneHeaderSlot><ThemeSelect label="Finance account" variant="account-card" value={p.balanceId} onChange={e=>p.onBalance(e.target.value)}>{p.balances.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</ThemeSelect></PhoneHeaderSlot></div>}
      <section className="tj-phone-finance-hero">
        <small>Available capital</small>
        <strong className={`${p.totals.tradingBalance<0?'is-negative':''} ${figureSize(capital)}`}>{capital}</strong>
        <span>Trading account balance</span>
        <div className="tj-phone-finance-actions">{TYPES.map(([value,label])=><button key={value} type="button" data-type={value} onClick={()=>openNew(value)}><i>{typeIcon(value)}</i>{label}</button>)}</div>
      </section>
      <section className="tj-phone-finance-flow">
        <small>Cash flow · funds in vs out</small>
        <div className="tj-phone-finance-net"><strong className={p.totals.deposits-p.totals.withdrawals<0?'is-negative':undefined}>{p.money(p.totals.deposits-p.totals.withdrawals)}</strong><span>net</span></div>
        <div className="tj-phone-finance-flow-bar" aria-hidden="true">{p.totals.deposits>0&&<i style={{flex:p.totals.deposits/(flowTotal||1)}}/>}{p.totals.withdrawals>0&&<b style={{flex:p.totals.withdrawals/(flowTotal||1)}}/>}</div>
        <footer><span className="is-in">{p.money(p.totals.deposits)} deposits</span><span className="is-out">{p.money(-p.totals.withdrawals)} withdrawals</span></footer>
      </section>
      <div className="tj-phone-finance-tiles">
        <section className="is-savings"><small>Total savings</small><div><strong className={figureSize(noPlus(p.money(p.totals.savings)))}>{noPlus(p.money(p.totals.savings))}</strong><span>{count} savings account{count===1?'':'s'}</span></div></section>
        <section className="is-ready"><small>Ready to save</small><div><strong className={figureSize(noPlus(p.money(ready)))}>{noPlus(p.money(ready))}</strong><span>Baseline {p.money(p.baseline)} · profit ignores cash moves</span></div></section>
      </div>
      <div className="tj-phone-finance-tabs" role="tablist" aria-label="Finance sections" data-tab={tab}><i aria-hidden="true"/>{[['movements','Cash movements'],['savings','Savings plans']].map(([value,label])=><button key={value} type="button" role="tab" aria-selected={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</div>
      {tab==='movements'&&<>
        <div className="tj-phone-finance-filters">{[['all','All'],['deposit','Deposits'],['withdrawal','Withdrawals'],['transfer','Transfers']].map(([value,label])=><button key={value} type="button" aria-pressed={p.filter===value} onClick={()=>p.onFilter(value)}><span>{label}</span></button>)}</div>
        <section className="tj-phone-finance-ledger" aria-label="Cash movements">
          {groups.map(group=><React.Fragment key={group.key}>
            <header><strong>{group.label}</strong><span>{group.count} movement{group.count===1?'':'s'}</span></header>
            {group.items.map(m=><div className={`tj-phone-finance-movement is-${m.type}`} key={m.id}>
              <i>{typeIcon(m.type)}</i>
              <strong>{m.title}</strong>
              <b>{financeMovementSign(m.type)}{noPlus(p.money(Math.abs(m.amount)))}</b>
              <p>{[m.accountName,m.note].filter(Boolean).join(' · ')}</p>
              <time dateTime={m.isoDate}>{Number(m.day)} {m.month}</time>
              <button type="button" className="tj-phone-finance-more" aria-label={`Options for ${m.title}`} onClick={()=>setMenuId(m.id)}><MoreHorizontal size={16}/></button>
            </div>)}
          </React.Fragment>)}
          {!p.movements.length&&<p className="tj-phone-finance-empty">No movements here yet. Add funds, withdraw or transfer to see them.</p>}
        </section>
        {p.totalMovements>6&&<button type="button" className="tj-phone-finance-older" aria-expanded={p.showOlder} onClick={p.onOlder}>{p.showOlder?'Show recent movements':'Show older movements'}</button>}
      </>}
      {tab==='savings'&&<section className="tj-phone-finance-plans" aria-label="Savings plans">{p.savings.map(s=>{
        return <SavingsPlanCard key={s.id} saving={s} saved={s.saved} allocation={s.allocation} ownerName={s.ownerName || p.balances.find(b=>b.id===s.ownerBalanceId)?.name || ''} money={p.money} onTransfer={()=>{p.onPlanned(s);setError('');setOpen(true);}}/>;
      })}{!p.savings.length&&<p className="tj-phone-finance-empty">Add a savings account in Account Settings to use transfers.</p>}</section>}
    </div>
    {open&&<div className="tj-phone-finance-layer"><div className="tj-phone-finance-backdrop" onClick={close}/><section className="tj-phone-finance-sheet" data-type={p.type} role="dialog" aria-modal="true" aria-label="New movement" ref={dialog}>
      <button type="button" className="tj-phone-finance-handle" aria-label="Close movement form" onClick={close} onTouchStart={e=>{swipe.current=e.touches[0].clientY;}} onTouchEnd={e=>{if(swipe.current!=null&&e.changedTouches[0].clientY-swipe.current>60)close();swipe.current=null;}}><span/></button>
      <header><div><small>Record</small><h2>New movement</h2></div><button type="button" className="tj-phone-finance-close" aria-label="Close movement form" onClick={close}><X size={18}/></button></header>
      <div className="tj-phone-finance-sheet-body">
        <div className="tj-phone-finance-types" role="tablist" aria-label="Movement type">{TYPES.map(([value,label])=><button key={value} type="button" role="tab" aria-selected={p.type===value} onClick={()=>p.onType(value)}>{typeIcon(value,15)}{label}</button>)}</div>
        <div className="tj-phone-finance-amount"><b aria-hidden="true">{p.currency==='USD'?'$':p.currency}</b><input aria-label={`Movement amount in ${p.currency}`} type="number" inputMode={DECIMAL_INPUT_MODE} min="0.01" step="0.01" placeholder="0.00" value={p.amount} style={{width:`${Math.max(4,String(p.amount).length)+1}ch`}} onChange={e=>p.onAmount(e.target.value)}/></div>
        <div className="tj-phone-finance-quick">{[10,25,50,100].map(value=><button key={value} type="button" aria-label={`Add ${value}`} onClick={()=>p.onAmount(addToAmount(p.amount,value))}><span>+{value}</span></button>)}</div>
        {p.type==='withdrawal'&&<fieldset className="tj-phone-finance-choice"><legend>Withdraw from</legend><div>{[['trading','Trading account'],['savings','Savings account']].map(([value,label])=><button key={value} type="button" aria-pressed={p.source===value} onClick={()=>p.onSource(value)}>{label}</button>)}</div></fieldset>}
        {p.balances.length>1&&!(p.type==='withdrawal'&&p.source==='savings')&&<fieldset className="tj-phone-finance-choice"><legend>{p.type==='transfer'?'From account':'Account'}</legend><div>{p.balances.map(b=><button key={b.id} type="button" aria-pressed={p.balanceId===b.id} onClick={()=>p.onBalance(b.id)}>{b.name}</button>)}</div></fieldset>}
        {p.requiresSavings&&<fieldset className="tj-phone-finance-choice"><legend>{p.type==='transfer'?'To':'Withdrawal account'}</legend>{p.allSavings.length?<div>{p.allSavings.map(s=><button key={s.id} type="button" aria-pressed={p.savingsId===s.id} onClick={()=>p.onSavings(s.id)}>{s.name}</button>)}</div>:<p>Add a savings account in Account Settings to use this.</p>}</fieldset>}
        <label><span>Date</span><ThemeDate value={p.date} onChange={e=>p.onDate(e.target.value)} label="Movement date"/></label>
        <label><span>Note</span><input aria-label="Movement note" value={p.note} placeholder="Optional reference" onChange={e=>p.onNote(e.target.value)}/></label>
        {error&&<p role="alert">{error}</p>}
      </div>
      <footer><button type="button" className="tj-phone-finance-record" disabled={saving} onClick={submit}>{typeIcon(p.type,16)} {saving?'Saving…':'Record movement'}</button></footer>
    </section></div>}
    {menu&&<div className="tj-phone-finance-layer"><div className="tj-phone-finance-backdrop" onClick={closeMenu}/><section className="tj-phone-finance-sheet tj-phone-finance-menu" role="dialog" aria-modal="true" aria-label="Movement options" ref={dialog}>
      <button type="button" className="tj-phone-finance-handle tj-phone-finance-close" aria-label="Close movement options" onClick={closeMenu} onTouchStart={e=>{swipe.current=e.touches[0].clientY;}} onTouchEnd={e=>{if(swipe.current!=null&&e.changedTouches[0].clientY-swipe.current>60)closeMenu();swipe.current=null;}}><span/></button>
      <div className="tj-phone-finance-menu-summary"><b>{financeMovementSign(menu.type)}{noPlus(p.money(Math.abs(menu.amount)))}</b><span>{menu.title} · {Number(menu.day)} {menu.month} {menu.year}</span>{(menu.accountName||menu.note)&&<p>{[menu.accountName,menu.note].filter(Boolean).join(' · ')}</p>}</div>
      <ConfirmDeleteButton title="Delete movement" className="tj-phone-finance-delete" onClick={async()=>{await p.onDelete(menu.id);closeMenu();}}><Trash2 size={18} aria-hidden="true"/>Delete movement</ConfirmDeleteButton>
    </section></div>}
  </>;
}
