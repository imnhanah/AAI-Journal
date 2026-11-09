import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRightLeft, ArrowUp, ArrowUpRight, ChevronDown, History, Info, Landmark, MoreHorizontal, Plus, Search, Shield, Target, Trash2, Wallet, X } from 'lucide-react';
import { ThemeDate } from './JournalControls';
import { useConfirmation } from './ConfirmationDialog.jsx';
import { DECIMAL_INPUT_MODE } from './mobileFinanceConstants.js';
import { financeMonthGroups, financeMovementIssue, financeMovementSign } from './mobileFinanceModel.js';
import { savingsCardModel } from './savingsCardModel.js';
import './desktopFinance.css';

// Desktop Finance v2 (FINANCE_V2 in TradingJournal.jsx), after aaicorefx-desktop-finance.html.
// It takes the same props as the phone Finance screen, so both record and show the same data.
const TYPES = { deposit: ['Add funds', 'Funds added', ArrowDown, 'Record deposit', 'Money coming into your trading account.'], withdrawal: ['Withdraw', 'Funds withdrawn', ArrowUp, 'Record withdrawal', 'Money leaving your trading account or a savings account.'], transfer: ['Transfer', 'Moved to savings', ArrowRightLeft, 'Record transfer', 'Move money from trading capital into savings.'] };
const TONE = { deposit: 'is-gain', withdrawal: 'is-loss', transfer: 'is-blue' };
const noPlus = (value) => String(value).replace(/^\+/, '');

function Ring({ value, size = 170 }) {
  const r = 70, c = 2 * Math.PI * r, [shown, setShown] = useState(0);
  useEffect(() => { const frame = requestAnimationFrame(() => setShown(value || 0)); return () => cancelAnimationFrame(frame); }, [value]);
  return <div className="fn2-rg" style={{ width: size, height: size }} role="progressbar" aria-label="Savings goal progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value || 0)}>
    <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r={r} className="fn2-rg-track"/><circle cx="80" cy="80" r={r} className="fn2-rg-value" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} transform="rotate(-90 80 80)"/></svg>
    <div><b>{(value || 0) % 1 ? (value || 0).toFixed(1) : Math.round(value || 0)}%</b><small>of goal</small></div>
  </div>;
}

function Popover({ anchor, onClose, children, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const away = (event) => { if (!ref.current?.contains(event.target) && !anchor?.contains(event.target)) onClose(); };
    const escape = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape, true); };
  }, [anchor, onClose]);
  return <div className="fn2-pop" ref={ref} role="menu" aria-label={label}>{children}</div>;
}

function PlanCard({ saving, money, onTransfer }) {
  const model = savingsCardModel(saving, saving.saved, saving.allocation), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const plain = (value) => noPlus(money(value));
  const transfer = async () => { if (busy || !(model.ready > 0)) return; setBusy(true); setError(''); try { await onTransfer(saving); } catch (reason) { setError(reason?.message || String(reason)); } finally { setBusy(false); } };
  return <section className="fn2-card fn2-sv" aria-label={saving.name}>
    <div className="fn2-ph"><div><span className="fn2-eb2">Savings plan</span><h3>{saving.name}</h3><span className="fn2-sub">{[saving.ownerName, saving.interval || 'Weekly'].filter(Boolean).join(' · ')}</span></div><span className="fn2-al">{model.rate}% allocation</span></div>
    <div className="fn2-sm"><Ring value={model.progress}/><div className="fn2-sn"><small>Saved balance</small><strong>{plain(model.saved)}</strong><div className="fn2-sc"><div><small>Target</small><b>{plain(model.target)}</b></div><div><small>Remaining</small><b>{plain(model.goalRemaining)}</b></div></div></div></div>
    <div className="fn2-sx"><div className="fn2-sxh"><small>Current profit</small><b className={model.profit < 0 ? 'is-loss' : 'is-gain'}>{money(model.profit)}</b><span>{model.rate}% allocation</span></div>
      <div className="fn2-sp2" aria-hidden="true"><i style={{ width: `${100 - model.rate}%` }}/><u style={{ width: `${model.rate}%` }}/></div>
      <div className="fn2-sl2"><div><small>Retained · {100 - model.rate}%</small><b>{plain(model.retained)}</b></div><div><small>Already moved</small><b>{plain(model.paid)}</b></div><div><small>To savings · {model.rate}%</small><b className="is-gain">{plain(model.allocated)}</b></div></div></div>
    <div className="fn2-pt"><div><small>Ready to transfer</small><b className="is-gain">{plain(model.ready)}</b><p>{model.ready > 0 ? 'Profit available above your starting baseline.' : 'Nothing to move until this plan is in profit.'}</p></div><button type="button" className="fn2-btn" disabled={busy || !(model.ready > 0)} onClick={transfer}>{busy ? 'Saving…' : 'Record transfer'}<ArrowUpRight size={14} strokeWidth={2.4}/></button></div>
    {error && <p className="fn2-err" role="alert">{error}</p>}
  </section>;
}

export default function DesktopFinanceV2(p) {
  const confirm = useConfirmation();
  const [tab, setTab] = useState('movements');
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(null);
  const [accountMenu, setAccountMenu] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const amountRef = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => { setError(''); }, [p.amount, p.date, p.savingsId, p.type, p.source, p.balanceId]);
  useEffect(() => { if (drawer) requestAnimationFrame(() => amountRef.current?.focus()); }, [drawer]);
  useEffect(() => {
    if (!drawer) return undefined;
    const keys = (event) => { if (event.key === 'Escape' && !saving) { event.preventDefault(); setDrawer(false); } };
    document.addEventListener('keydown', keys); return () => document.removeEventListener('keydown', keys);
  }, [drawer, saving]);
  const notify = (message) => { clearTimeout(toastTimer.current); setToast({ message, id: Date.now() }); toastTimer.current = setTimeout(() => setToast(null), 2200); };
  const currencySymbol = p.currency === 'USD' ? '$' : p.currency;
  const capital = p.totals.tradingBalance;
  const flow = p.totals.deposits + p.totals.withdrawals;
  const ready = p.savings.reduce((sum, item) => sum + item.allocation.remaining, 0);
  const needle = query.trim().toLowerCase();
  const shown = p.movements.filter((movement) => !needle || [movement.title, movement.note, movement.accountName].join(' ').toLowerCase().includes(needle));
  const groups = financeMonthGroups(shown, shown);
  const counts = { all: p.allMovements.length, deposit: 0, withdrawal: 0, transfer: 0 };
  p.allMovements.forEach((movement) => { counts[movement.type] = (counts[movement.type] || 0) + 1; });
  const transfers = p.allMovements.filter((movement) => movement.type === 'transfer');
  const balance = p.balances.find((item) => item.id === p.balanceId) || p.balances[0] || null;
  const openNew = (type) => { p.onType(type); setError(''); setDrawer(true); };
  const submit = async () => {
    if (saving) return;
    const issue = financeMovementIssue({ amount: p.amount, date: p.date, requiresSavings: p.requiresSavings, savingsId: p.savingsId, balanceId: p.balanceId });
    if (issue) { setError(issue); amountRef.current?.focus(); return; }
    setSaving(true); setError('');
    const type = p.type;
    try { if (await p.onRecord()) { setDrawer(false); notify(type === 'deposit' ? 'Deposit recorded' : type === 'withdrawal' ? 'Withdrawal recorded' : 'Moved to savings'); if (type === 'transfer') setTab('savings'); } }
    catch (reason) { setError(reason?.message || String(reason)); }
    finally { setSaving(false); }
  };
  const remove = async (movement) => {
    setMenu(null);
    if (!await confirm({ title: 'Delete this movement?', description: `${movement.title} of ${noPlus(p.money(Math.abs(movement.amount)))} on ${movement.date} will be removed from your finance ledger.`, confirmLabel: 'Delete movement', tone: 'danger' })) return;
    await p.onDelete(movement.id); notify('Movement deleted');
  };
  const planTransfer = (item) => { p.onPlanned(item); setError(''); setDrawer(true); };
  const flowIn = flow ? p.totals.deposits / flow * 100 : 0;

  return <main className="fn2" aria-label="Finance">
    <section className="fn2-hero">
      <div className="fn2-hl"><span className="fn2-eb">Grow · Finance</span><h1><em>Keep cash flow intentional.</em><br/>Keep the balance plan visible.</h1><p>Logged trades contribute to your account result. Track cash movements and savings without mixing them into your trading statistics.</p>
        <div className="fn2-act">{Object.entries(TYPES).map(([type, [label, , Icon]], index) => <button type="button" key={type} className={`fn2-btn${index ? ' is-ghost' : ''}`} onClick={() => openNew(type)}><Icon size={16}/>{type === 'transfer' ? 'Move to savings' : label}</button>)}</div></div>
      <div className="fn2-bal">
        <div className="fn2-bh"><span className="fn2-eb2">Available capital</span>
          <button type="button" className="fn2-acc" aria-haspopup="menu" aria-expanded={!!accountMenu} onClick={(event) => setAccountMenu(accountMenu ? null : event.currentTarget)}><Landmark size={14}/><i>{p.balances.length}</i>{balance?.name || 'Primary account'}<ChevronDown size={13}/></button>
          {accountMenu && <Popover anchor={accountMenu} label="Finance account" onClose={() => setAccountMenu(null)}>
            {p.balances.map((item) => <button type="button" role="menuitemradio" aria-checked={item.id === p.balanceId} key={item.id} className={`fn2-pi${item.id === p.balanceId ? ' is-on' : ''}`} onClick={() => { p.onBalance(item.id); setAccountMenu(null); }}><i>{(item.name || 'A').slice(0, 1).toUpperCase()}</i><span><b>{item.name}</b><small>{item.baseCurrency || p.currency}</small></span>{item.id === p.balanceId && <Shield size={14}/>}</button>)}
            {p.balances.length < 2 && <p className="fn2-pn">Only one account is connected. Add more in Account Settings.</p>}
          </Popover>}
        </div>
        <b className={capital < 0 ? 'is-loss' : 'is-gain'}>{p.money(capital)}</b><span>Trading account balance</span>
        <div className="fn2-flow" aria-hidden="true"><u style={{ width: `${flowIn}%` }}/><s style={{ width: `${flow ? 100 - flowIn : 0}%` }}/></div>
        <div className="fn2-fl"><span className="is-gain">{p.money(p.totals.deposits)} deposits</span><span className="is-loss">{p.money(-p.totals.withdrawals)} withdrawals</span></div>
        <div className="fn2-bs"><div><small>Total savings</small><b className="is-pu">{noPlus(p.money(p.totals.savings))}</b></div><div><small>Net cash flow</small><b className={p.totals.deposits - p.totals.withdrawals < 0 ? 'is-loss' : 'is-gain'}>{p.money(p.totals.deposits - p.totals.withdrawals)}</b></div><div><small>Ready to save</small><b>{noPlus(p.money(ready))}</b></div></div>
        <p className="fn2-base">Cash-adjusted baseline {p.money(p.baseline)} · savings profit ignores cash movements</p>
      </div>
    </section>

    <nav className="fn2-tb" role="tablist" aria-label="Finance sections">{[['movements', 'Cash movements', History, p.allMovements.length], ['savings', p.savings.length === 1 ? 'Savings plan' : 'Savings plans', Target, p.savings.length]].map(([id, label, Icon, count]) => <button type="button" role="tab" key={id} aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}><Icon size={16}/>{label}<b>{count}</b></button>)}</nav>

    {tab === 'movements' ? <section className="fn2-card fn2-led" aria-label="Cash movements">
      <div className="fn2-lh"><div className="fn2-chips" role="group" aria-label="Movement filter">{[['all', 'All'], ['deposit', 'Deposits'], ['withdrawal', 'Withdrawals'], ['transfer', 'Transfers']].map(([id, label]) => <button type="button" key={id} aria-pressed={p.filter === id} className={p.filter === id ? 'is-on' : ''} onClick={() => p.onFilter(id)}>{label}<b>{counts[id] || 0}</b></button>)}</div>
        <label className="fn2-sr"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" aria-label="Search movements"/></label></div>
      <div className={`fn2-th${p.balanceAfter ? '' : ' is-nobal'}`}><span>Date</span><span>Movement</span><span className="is-r">Amount</span>{p.balanceAfter && <span className="is-r">Balance after</span>}<span/></div>
      {groups.length ? groups.map((group) => { const net = group.items.reduce((sum, item) => sum + (item.type === 'deposit' ? item.amount : item.type === 'withdrawal' ? -item.amount : 0), 0); return <div key={group.key}>
        <div className="fn2-gh"><b>{group.label}</b><span>{group.count} movement{group.count === 1 ? '' : 's'}</span><em className={net < 0 ? 'is-loss' : 'is-gain'}>{net ? `${p.money(net)} net` : 'Transfers only'}</em></div>
        {group.items.map((movement) => { const Icon = TYPES[movement.type]?.[2] || ArrowUp; return <div className={`fn2-mv${p.balanceAfter ? '' : ' is-nobal'}`} key={movement.id}>
          <div className="fn2-dt"><b>{movement.day}</b><small>{movement.month}</small></div>
          <div className="fn2-mt"><span className={`fn2-ti ${TONE[movement.type]}`}><Icon size={17}/></span><div><b>{movement.title}</b><span>{[movement.accountName, movement.note].filter(Boolean).join(' · ') || 'No note'}</span></div></div>
          <strong className={TONE[movement.type]}>{movement.type === 'transfer' ? '→ ' : financeMovementSign(movement.type)}{noPlus(p.money(Math.abs(movement.amount)))}</strong>
          {p.balanceAfter && <span className="fn2-rb">{p.balanceAfter[movement.id] == null ? '—' : noPlus(p.money(p.balanceAfter[movement.id]))}</span>}
          <span className="fn2-mw"><button type="button" className="fn2-ic2" aria-label={`Options for ${movement.title}`} aria-haspopup="menu" aria-expanded={menu?.id === movement.id} onClick={(event) => setMenu(menu?.id === movement.id ? null : { id: movement.id, anchor: event.currentTarget })}><MoreHorizontal size={16}/></button>
            {menu?.id === movement.id && <Popover anchor={menu.anchor} label="Movement options" onClose={() => setMenu(null)}><button type="button" role="menuitem" className="fn2-pdel" onClick={() => remove(movement)}><Trash2 size={15}/>Delete movement</button></Popover>}</span>
        </div>; })}
      </div>; }) : <div className="fn2-emp"><Wallet size={30} strokeWidth={1.6}/><b>{needle ? 'No movements match' : p.filter === 'all' ? 'No movements yet' : `No ${p.filter === 'deposit' ? 'deposits' : p.filter === 'withdrawal' ? 'withdrawals' : 'transfers'} yet`}</b><span>{needle ? 'Try a different search.' : 'Use the buttons above to record one.'}</span></div>}
      <div className="fn2-lf"><Shield size={14}/>Cash movements never change your trading statistics.</div>
    </section> : <div className="fn2-svg">
      <div className="fn2-col">{p.savings.length ? p.savings.map((item) => <PlanCard key={item.id} saving={item} money={p.money} onTransfer={planTransfer}/>) : <section className="fn2-card fn2-emp"><Target size={30} strokeWidth={1.6}/><b>No savings plans yet</b><span>Add a savings account in Account Settings to plan transfers.</span></section>}</div>
      <div className="fn2-col">
        <section className="fn2-card fn2-hs"><div className="fn2-ph"><div><span className="fn2-eb2">History</span><h3>Transfers to savings</h3></div><button type="button" className="fn2-btn is-ghost is-sm" onClick={() => openNew('transfer')} disabled={!p.allSavings.length}><Plus size={14} strokeWidth={2.4}/>Move money</button></div>
          {transfers.length ? transfers.map((movement) => <div className="fn2-hr" key={movement.id}><span className="fn2-ti is-blue"><ArrowRightLeft size={16}/></span><div><b>{noPlus(p.money(movement.amount))}</b><small>{movement.date} · {movement.note || movement.title}</small></div></div>) : <div className="fn2-emp is-sm"><ArrowRightLeft size={26} strokeWidth={1.6}/><b>No transfers yet</b><span>Moves to savings will be listed here.</span></div>}
        </section>
        <section className="fn2-card fn2-how"><span className="fn2-ic"><Info size={17}/></span><div><b>How savings plans work</b><p>Each plan sets aside its allocation of profit above your starting baseline; the rest stays in trading capital. Deposits and withdrawals are never counted as profit.</p></div></section>
      </div>
    </div>}

    {drawer && <div className="fn2-ov" role="presentation">
      <div className="fn2-bk" onClick={() => { if (!saving) setDrawer(false); }}/>
      <aside className="fn2-dr" role="dialog" aria-modal="true" aria-labelledby="fn2-dr-title" onKeyDown={(event) => { if (event.key === 'Enter' && event.target.tagName === 'INPUT' && event.target.type !== 'date') { event.preventDefault(); submit(); } }}>
        <header><div><span className="fn2-eb">Record</span><h2 id="fn2-dr-title">New movement</h2><p>{TYPES[p.type]?.[4]}</p></div><button type="button" className="fn2-x" aria-label="Close" onClick={() => setDrawer(false)} disabled={saving}><X size={18}/></button></header>
        <div className="fn2-db">
          <div className="fn2-tabs" role="tablist" aria-label="Movement type">{Object.entries(TYPES).map(([type, [label, , Icon]]) => <button type="button" role="tab" key={type} aria-selected={p.type === type} className={p.type === type ? 'is-on' : ''} onClick={() => p.onType(type)}><Icon size={15}/>{label}</button>)}</div>
          {p.type === 'withdrawal' && <div className="fn2-f"><small>Withdraw from</small><div className="fn2-seg">{[['trading', 'Trading account'], ['savings', 'Savings account']].map(([id, label]) => <button type="button" key={id} aria-pressed={p.source === id} className={p.source === id ? 'is-on' : ''} onClick={() => p.onSource(id)}>{label}</button>)}</div></div>}
          {!(p.type === 'withdrawal' && p.source === 'savings') && <div className="fn2-f"><small>{p.type === 'transfer' ? 'From account' : 'Account'}</small>{p.balances.length > 1 ? <div className="fn2-seg">{p.balances.map((item) => <button type="button" key={item.id} aria-pressed={p.balanceId === item.id} className={p.balanceId === item.id ? 'is-on' : ''} onClick={() => p.onBalance(item.id)}>{item.name}</button>)}</div> : <div className="fn2-sel"><Landmark size={15}/><i>1</i><span>{balance?.name || 'Primary account'}</span></div>}</div>}
          {p.requiresSavings && <div className="fn2-f"><small>{p.type === 'transfer' ? 'Move to' : 'Withdraw from savings'}</small>{p.allSavings.length ? <div className="fn2-seg">{p.allSavings.map((item) => <button type="button" key={item.id} aria-pressed={p.savingsId === item.id} className={p.savingsId === item.id ? 'is-on' : ''} onClick={() => p.onSavings(item.id)}><Target size={14}/>{item.name}{item.allocationPct ? ` · ${item.allocationPct}%` : ''}</button>)}</div> : <p className="fn2-note">Add a savings account in Account Settings to use this.</p>}</div>}
          <div className="fn2-f"><small>Amount ({p.currency})</small><label className="fn2-in is-big"><em>{currencySymbol}</em><input ref={amountRef} aria-label={`Movement amount in ${p.currency}`} type="number" inputMode={DECIMAL_INPUT_MODE} min="0.01" step="0.01" placeholder="0.00" value={p.amount} onChange={(event) => p.onAmount(event.target.value)}/></label>
            <div className="fn2-qk">{[10, 25, 50, 100].map((value) => <button type="button" key={value} onClick={() => p.onAmount(String(value))}>{currencySymbol}{value}</button>)}</div></div>
          <div className="fn2-f"><small>Date</small><ThemeDate value={p.date} onChange={(event) => p.onDate(event.target.value)} label="Movement date"/></div>
          <div className="fn2-f"><small>Note <i>optional</i></small><label className="fn2-in"><input aria-label="Movement note" value={p.note} placeholder="Optional reference" onChange={(event) => p.onNote(event.target.value)}/></label></div>
        </div>
        <footer><p className="fn2-err" role="alert">{error}</p><div className="fn2-fb"><button type="button" className="fn2-btn is-ghost" onClick={() => setDrawer(false)} disabled={saving}>Cancel</button><button type="button" className="fn2-btn" onClick={submit} disabled={saving}>{React.createElement(TYPES[p.type]?.[2] || ArrowDown, { size: 16 })}{saving ? 'Saving…' : TYPES[p.type]?.[3] || 'Record movement'}</button></div></footer>
      </aside>
    </div>}
    {toast && <div className="fn2-toast" role="status" key={toast.id}>{toast.message}</div>}
  </main>;
}
