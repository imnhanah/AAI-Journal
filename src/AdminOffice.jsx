import OfficeEnrollment from './OfficeEnrollment.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Ban, Check, ChevronRight, Crown, Info, KeyRound, Lock, Megaphone, Pencil, ScrollText, Search, ShieldCheck, Trash2, Pause, Undo2, Users, UserRound, X } from 'lucide-react';
import { ANNOUNCE_LIMITS, FEATURES, PLAN_DEFAULTS, officeApi, officeIsLive, setOfficeLockHandler, offCount, offReasons } from './adminOfficeApi.js';
import './adminOffice.css';

// Administration Office, stages 1 and 2: the door (authenticator code + PIN), the member list and the member panel.
// Owner-only. The server is the real gate; this screen only ever shows what the server returns.

const IDLE_SECONDS = 15 * 60;
const phoneQuery = '(max-width:767px)';
function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(phoneQuery).matches);
  useEffect(() => {
    const list = window.matchMedia?.(phoneQuery);
    if (!list) return undefined;
    const sync = () => setPhone(list.matches);
    list.addEventListener?.('change', sync);
    return () => list.removeEventListener?.('change', sync);
  }, []);
  return phone;
}
const initials = email => (String(email || '?').split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 2) || '?').toUpperCase();
const clock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function PlanChip({ plan }) {
  if (plan === 'owner') return <span className="chip gold"><Crown size={13} aria-hidden="true"/>Owner</span>;
  return <span className={`chip ${plan === 'premium' ? 'acc' : ''}`}>{plan === 'premium' ? 'Premium' : 'Free'}</span>;
}
function StatusChip({ row }) {
  if (row.status === 'suspended') return <span className="chip gold"><Pause size={13} aria-hidden="true"/>Suspended</span>;
  if (row.status === 'banned') return <span className="chip bad"><Ban size={13} aria-hidden="true"/>Banned</span>;
  if (row.status === 'deleting') return <span className="chip bad"><Trash2 size={13} aria-hidden="true"/>Deleting</span>;
  return null;
}
const OffBadge = ({ row, onOpen }) => !offCount(row) ? null : onOpen
  ? <button type="button" className="offb" title={offReasons(row).join(', ')} aria-label={`${offCount(row)} restrictions. Open ${row.email}`} onClick={event => { event.stopPropagation(); onOpen(row, true); }}>{offCount(row)} off</button>
  : <span className="offb">{offCount(row)} off</span>;
const rowClass = row => row.plan === 'owner' ? 'o' : row.plan === 'premium' ? 'p' : '';

// Six boxes. Digits only, auto-advance, backspace and paste work.
function PinRow({ value, onChange, masked, label, autoFocus, error }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');
  const set = (index, char) => {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join(''));
  };
  return <div className={`pin ${error ? 'err' : ''}`} role="group" aria-label={label}>
    {digits.map((digit, index) => <input key={index} ref={node => { refs.current[index] = node; }} autoFocus={autoFocus && index === 0}
      type={masked ? 'password' : 'text'} inputMode="numeric" autoComplete="one-time-code" maxLength={1} value={digit} aria-label={`${label} digit ${index + 1}`}
      onChange={event => {
        const char = event.target.value.replace(/\D/g, '').slice(-1);
        set(index, char);
        if (char && index < 5) refs.current[index + 1]?.focus();
      }}
      onKeyDown={event => {
        if (event.key === 'Backspace' && !digits[index] && index > 0) refs.current[index - 1]?.focus();
        if (event.key === 'Enter') event.currentTarget.form?.requestSubmit();
      }}
      onPaste={event => {
        const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        event.preventDefault();
        onChange(pasted);
        refs.current[Math.min(pasted.length, 5)]?.focus();
      }}/>)}
  </div>;
}

function Gate({ onUnlocked, onClose, note }) {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const first = step === 0;
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    const value = first ? code : pin;
    if (value.length < 6) { setError('Enter all 6 digits.'); return; }
    setError('');
    if (first) { setStep(1); return; }
    setBusy(true);
    try {
      const session = await officeApi.unlock({ code, pin });
      onUnlocked(session);
    } catch (problem) {
      setPin('');
      if (problem.code === 'authenticator_code_used') { setCode(''); setStep(0); setError('That code was already used. Wait for the next code.'); }
      else if (problem.code === 'wrong_code') { setCode(''); setStep(0); setError('That authenticator code isn’t right. Try the next one.'); }
      else if (problem.code === 'wrong_pin') setError(`Wrong PIN. ${problem.triesLeft} ${problem.triesLeft === 1 ? 'try' : 'tries'} left.`);
      else if (problem.code === 'locked') setError(`Too many wrong PINs. Locked until ${new Date(problem.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
      else setError('Could not open the office. Please try again.');
    } finally { setBusy(false); }
  };
  return <form className="gate" onSubmit={submit}><div className="gc">
    <div className="crest">{first ? <ShieldCheck size={26}/> : <Lock size={26}/>}</div>
    <div className="eyebrow" style={{ color: 'var(--brass)' }}>AAICOREFX · Administration Office</div>
    <div className="steps"><i className="on"/><i className={first ? '' : 'on'}/></div>
    <h2>{first ? 'Authenticator code' : 'Admin PIN'}</h2>
    <p>{first ? 'Open your authenticator app and enter the 6-digit code.' : 'One shared 6-digit PIN for both Owner accounts.'}</p>
    {first
      ? <PinRow key="code" value={code} onChange={setCode} label="Authenticator code" autoFocus error={!!error}/>
      : <PinRow key="pin" value={pin} onChange={setPin} masked label="Admin PIN" autoFocus error={!!error}/>}
    {note && !error && <div className="note" role="status" style={{ textAlign: 'left', marginBottom: 8, borderColor: 'rgba(88,214,168,.4)', background: 'rgba(88,214,168,.08)', color: '#c8f5e3' }}><Check size={16}/><span>{note}</span></div>}
    {error && <div className="note bad" role="alert" style={{ textAlign: 'left' }}><AlertTriangle size={16}/><span>{error}</span></div>}
    <div className="mf" style={{ justifyContent: 'space-between' }}>
      <button type="button" className="btn ghost" onClick={first ? onClose : () => { setStep(0); setError(''); }}>{first ? 'Close' : 'Back'}</button>
      <button type="submit" className="btn pri" disabled={busy}>{busy ? 'Checking…' : first ? 'Continue' : 'Unlock'}</button>
    </div>
    <div className="hint" style={{ marginTop: 10 }}>The door locks itself after 15 minutes without activity.</div>
  </div></form>;
}

const FILTERS = [['all', 'All'], ['owner', 'Owners'], ['premium', 'Premium'], ['free', 'Free']];

function MembersView({ phone, onEdit, refreshKey }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(search), 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    let cancelled = false;
    setError('');
    officeApi.listMembers({ search: query, filter }).then(result => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setError('Could not load members.'); });
    return () => { cancelled = true; };
  }, [query, filter, refreshKey]);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = async () => {
    setLoadingMore(true);
    try { const next = await officeApi.listMembers({ search: query, filter, after: data.nextAfter }); setData(current => ({ ...next, rows: [...current.rows, ...next.rows] })); }
    catch { setError('Could not load more members.'); }
    finally { setLoadingMore(false); }
  };
  const counts = data?.counts || { all: 0, owner: 0, premium: 0, free: 0, restricted: 0 };
  const rows = data?.rows || [];
  const searchBox = <div className="search"><Search size={16} aria-hidden="true"/><input aria-label="Search by email" id="ao-search" placeholder="Search by email" maxLength={254} value={search} onChange={event => setSearch(event.target.value)}/></div>;
  const status = error ? <div className="note bad" role="alert"><AlertTriangle size={16}/><span>{error}</span></div> : !data ? <div className="empty" role="status">Loading members…</div> : data.hasMore ? <button type="button" className="btn" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading…' : 'Load more members'}</button> : null;

  if (phone) return <>
    <div className="hero"><div className="eyebrow">In your office</div><div className="big"><b>{counts.all}</b><span className="muted">members</span></div>
      <div className="stack"><i style={{ flex: Math.max(counts.owner, .2), background: 'var(--brass)' }}/><i style={{ flex: Math.max(counts.premium, .2), background: 'var(--acc)' }}/><i style={{ flex: Math.max(counts.free, .2), background: '#6f6280' }}/></div>
      <div className="leg"><span style={{ '--c': 'var(--brass)' }}>{counts.owner} Owners</span><span style={{ '--c': 'var(--acc)' }}>{counts.premium} Premium</span><span style={{ '--c': '#6f6280' }}>{counts.free} Free</span>{counts.restricted ? <span style={{ '--c': 'var(--bad)' }}>{counts.restricted} restricted</span> : null}</div></div>
    <div className="frow">
      <div className="fseg" style={{ '--n': 4 }}>{FILTERS.map(([value, text]) => <button type="button" key={value} className={filter === value ? 'on' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{text}<em>{counts[value]}</em></button>)}</div>
      <button type="button" className={`rbadge ${counts.restricted ? 'hot' : ''} ${filter === 'restricted' ? 'on' : ''}`} aria-pressed={filter === 'restricted'} aria-label={`Restricted members, ${counts.restricted}`} onClick={() => setFilter(filter === 'restricted' ? 'all' : 'restricted')}><Ban size={14} aria-hidden="true"/>{counts.restricted}</button>
    </div>
    {searchBox}
    {status}
    {data && rows.length === 0 && <div className="empty">No members match.</div>}
    {rows.map(row => {
      const owner = row.plan === 'owner';
      const over = row.account_limit != null && row.accounts_used > row.account_limit;
      return <div key={row.user_id} className={`mcard ${rowClass(row)}`} role={owner ? undefined : 'button'} tabIndex={owner ? undefined : 0} aria-label={owner ? undefined : `Edit ${row.email}`} style={owner ? undefined : { cursor: 'pointer' }} onClick={owner ? undefined : () => onEdit(row, false)} onKeyDown={owner ? undefined : event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onEdit(row, false); } }}>
        <div className={`av ${owner ? 'o' : ''}`}>{initials(row.email)}</div>
        <div className="em">{row.email}</div>
        <div className="sub"><PlanChip plan={row.plan}/><StatusChip row={row}/><OffBadge row={row} onOpen={owner ? undefined : onEdit}/><span className="muted" style={{ fontSize: "var(--text-min)" }}><i className={`dot ${row.journal_sync ? 'on' : ''}`} style={{ marginRight: 4 }}/>{row.journal_sync ? 'Synced' : 'Local'}</span></div>
        <div className="rt"><b className={over ? 'over' : ''}>{row.accounts_used}{row.account_limit == null ? '' : `/${row.account_limit}`}</b><span>{owner ? <Lock size={14}/> : <ChevronRight size={14}/>}</span></div>
      </div>;
    })}
    <div className="hint" style={{ padding: '4px 10px' }}>Owners are fixed in the database and can’t be edited here.</div>
  </>;

  return <>
    <div className="blot"><div className="bl"><small>Members</small><b>{counts.all}</b></div><div className="bl g"><small>Owners</small><b>{counts.owner}</b></div><div className="bl p"><small>Premium</small><b>{counts.premium}</b></div><div className="bl r"><small>Restricted</small><b>{counts.restricted}</b></div></div>
    <div className="tool"><div className="pills" role="group" aria-label="Filter members">{[...FILTERS, ['restricted', 'Restricted']].map(([value, text]) => <button type="button" key={value} className={filter === value ? 'on' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{text}<em>{counts[value]}</em></button>)}</div>{searchBox}</div>
    <div className="ledger"><div className="lhead" aria-hidden="true"><span>Member</span><span>Plan</span><span>Status</span><span>Accounts</span><span>Cloud sync</span><span/></div>
      <div className="lscroll">
        {status}
        {data && rows.length === 0 && <div className="empty">No members match.</div>}
        {rows.map(row => {
          const owner = row.plan === 'owner';
          const over = row.account_limit != null && row.accounts_used > row.account_limit;
          return <div key={row.user_id} className={`lrow ${rowClass(row)}`}>
            <div className="who"><div className={`av ${owner ? 'o' : ''}`}>{initials(row.email)}</div><span title={row.email}>{row.email}</span></div>
            <div><PlanChip plan={row.plan}/></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{row.status === 'active' ? <span className="muted">Active</span> : <StatusChip row={row}/>}<OffBadge row={row} onOpen={owner ? undefined : onEdit}/></div>
            <div className={`cnt ${over ? 'over' : ''}`}>{row.accounts_used}{row.account_limit == null ? ' · no limit' : ` / ${row.account_limit}`}</div>
            <div className="muted"><i className={`dot ${row.journal_sync ? 'on' : ''}`}/>Cloud sync {row.journal_sync ? 'on' : 'off'}</div>
            {owner ? <span/> : <button type="button" className="ib" aria-label={`Edit ${row.email}`} onClick={() => onEdit(row, false)}><Pencil size={15}/></button>}
          </div>;
        })}
      </div>
      <div className="lfoot"><span><ShieldCheck size={14} style={{ verticalAlign: '-2px' }}/> Owners are fixed in the database. No trading data is ever shown here.</span><span>{rows.length} of {counts.all}</span></div></div>
  </>;
}

function Switch({ on, onClick, label, disabled }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`sw ${on ? 'on' : ''}`} onClick={onClick}/>;
}

// Asks for the PIN (and a reason or the typed email when the action needs it) before anything changes.
function ConfirmModal({ title, body, confirmLabel, tone = 'pri', needsReason, needsCode, typedTarget, onRun, onClose, icon: Icon }) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = pin.length === 6 && (!typedTarget || typed === typedTarget) && (!needsCode || code.trim().length >= 8);
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    if (pin.length < 6) { setError('Enter all 6 digits.'); return; }
    setBusy(true);
    setError('');
    try { await onRun({ pin, reason: reason.trim(), code: code.trim() }); }
    catch (problem) {
      setPin('');
      if (problem.code === 'wrong_pin') setError(`Wrong PIN. ${problem.triesLeft ?? ''} tries left before a lockout.`.replace('  ', ' '));
      else if (problem.code === 'bad_code') setError('That backup code is not valid.');
      else if (problem.code === 'stale') setError('This member was changed elsewhere. Close this and reopen them.');
      else setError('That did not go through. Nothing was changed.');
    } finally { setBusy(false); }
  };
  return <>
    <div className="scrim" style={{ zIndex: 55 }} onClick={onClose}/>
    <form className="modal" role="alertdialog" aria-modal="true" aria-label={title} onSubmit={submit}>
      <h3>{title}</h3>
      <p>{body}</p>
      {needsReason && <div className="fld"><small>Reason (only Owners can see this)</small><input className="in" placeholder="Short note for the activity log" maxLength={120} value={reason} onChange={event => setReason(event.target.value)}/></div>}
      {needsCode && <div className="fld"><small>One of your backup codes</small><input className="in" autoComplete="off" placeholder="e.g. 4F7K-92QD" value={code} onChange={event => setCode(event.target.value)}/></div>}
      {typedTarget && <div className="fld"><small>Type <b>{typedTarget}</b> to confirm</small><input className="in" autoComplete="off" value={typed} onChange={event => setTyped(event.target.value)}/></div>}
      <PinRow value={pin} onChange={setPin} masked label="Admin PIN" autoFocus={!typedTarget} error={!!error}/>
      {error ? <div className="note bad" role="alert"><AlertTriangle size={16}/><span>{error}</span></div> : <div className="hint">Enter your PIN to confirm.</div>}
      <div className="mf">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className={`btn ${tone}`} disabled={busy || !ready}>{Icon && <Icon size={15}/>}{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </form>
  </>;
}

function MemberPanel({ row, focusFeatures, onClose, onChanged }) {
  const toDraft = source => ({ plan: source.plan, journal_sync: source.journal_sync, image_access: source.image_access, features: { ...source.features }, multiple_accounts_allowed: source.multiple_accounts_allowed !== false, account_limit: source.account_limit ?? null });
  const [draft, setDraft] = useState(() => toDraft(row));
  const [modal, setModal] = useState(null);
  const [apply, setApply] = useState(false);
  const featRef = useRef(null);
  useEffect(() => { if (focusFeatures) setTimeout(() => featRef.current?.scrollIntoView({ block: 'start' }), 40); }, [focusFeatures]);
  useEffect(() => { setDraft(toDraft(row)); setApply(false); }, [row.revision]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(row)) || apply;
  const over = draft.account_limit != null && row.accounts_used > draft.account_limit;
  const st = row.status;
  const set = patch => setDraft(current => ({ ...current, ...patch }));
  const done = (saved, message) => { setModal(null); onChanged(saved, message); };

  const save = ({ pin }) => officeApi.updateMember({ user_id: row.user_id, plan: draft.plan, journal_sync: draft.journal_sync, image_access: draft.image_access, features: draft.features, multiple_accounts_allowed: draft.multiple_accounts_allowed, account_limit: draft.account_limit, apply_plan_defaults: apply, expected_revision: row.revision, pin })
    .then(saved => done(saved, 'Saved · logged in the records'));
  const status = (action, message) => ({ pin, reason }) => officeApi.setStatus({ user_id: row.user_id, action, reason, expected_revision: row.revision, pin }).then(saved => done(saved, message));
  const startSave = () => setModal(draft.plan !== row.plan ? { type: 'planq' } : { type: 'save' });
  const applyDefaults = () => {
    const base = PLAN_DEFAULTS[draft.plan];
    set({ account_limit: base.account_limit, multiple_accounts_allowed: base.multiple_accounts_allowed, features: { ...base.features } });
    setApply(true);
    setModal({ type: 'save' });
  };
  const planName = draft.plan === 'premium' ? 'Premium' : 'Free';
  const base = PLAN_DEFAULTS[draft.plan];

  return <>
    <div className="scrim" onClick={onClose}/>
    <aside className="drawer" aria-label={`Member ${row.email}`}>
      <div className="handle"/>
      <div className="dh"><div><h3>{row.email}</h3><div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}><PlanChip plan={row.plan}/><StatusChip row={row}/></div></div><button type="button" className="ib" aria-label="Close" onClick={onClose}><X size={16}/></button></div>
      <div className="db">
        {st === 'deleting' && <><div className="note bad"><Trash2 size={16}/><span>Permanent deletion is scheduled. Until then they can sign in read-only and export their records.</span></div><button type="button" className="btn pri" onClick={() => setModal({ type: 'undo', action: 'cancel_delete' })}><Undo2 size={15}/>Cancel deletion and restore</button></>}
        {st === 'banned' && <><div className="note bad"><Ban size={16}/><span>Banned. Journal data access is blocked. Sign-in blocking is being verified.</span></div><button type="button" className="btn pri" onClick={() => setModal({ type: 'undo', action: 'unban' })}><Undo2 size={15}/>Unban</button></>}
        {st === 'suspended' && <><div className="note warn"><Pause size={16}/><span>Suspended. Blocked from the app, data kept safe.</span></div><button type="button" className="btn pri" onClick={() => setModal({ type: 'undo', action: 'reactivate' })}><Undo2 size={15}/>Reactivate</button></>}
        <div className="blk"><h4>Plan</h4>
          <div className="opt">{['free', 'premium'].map(value => <button type="button" key={value} className={draft.plan === value ? 'on' : ''} aria-pressed={draft.plan === value} onClick={() => set({ plan: value })}>{value === 'premium' ? 'Premium' : 'Free'}<small>{value === 'premium' ? 'Upgraded' : 'Standard'}</small></button>)}</div>
          <div className="hint" style={{ marginTop: 8, textAlign: 'left' }}>Owner isn’t offered here. It can’t be assigned from the app.</div></div>
        <div className="blk"><h4>Sync</h4>
          <div className="tg"><div>Journal cloud sync<small>Regular journal synchronization</small></div><Switch on={draft.journal_sync} label="Journal cloud sync" onClick={() => set({ journal_sync: !draft.journal_sync })}/></div>
          <div className="tg"><div>Cloud image uploads<small>New screenshot uploads. Separate from journal sync.</small></div><Switch on={draft.image_access} label="Cloud image uploads" onClick={() => set({ image_access: !draft.image_access })}/></div></div>
        <div className="blk" ref={featRef}><h4>Features</h4>
          {FEATURES.map(([key, name]) => <div className="tg" key={key}><div>{name}<small>{draft.features[key] ? 'Full access' : 'Read-only. Old records stay visible, no new entries.'}</small></div><Switch on={!!draft.features[key]} label={name} onClick={() => set({ features: { ...draft.features, [key]: !draft.features[key] } })}/></div>)}</div>
        <div className="blk"><h4>Accounts</h4>
          <div className="tg"><div>Multiple accounts<small>{draft.multiple_accounts_allowed ? 'Can create Single and Multiple accounts.' : 'Single accounts only. Any Multiple account they already have stays, they just can’t create a new one.'}</small></div><Switch on={draft.multiple_accounts_allowed} label="Multiple accounts" onClick={() => set({ multiple_accounts_allowed: !draft.multiple_accounts_allowed })}/></div>
          <div className="eyebrow" style={{ margin: '10px 0 6px' }}>Account limit</div>
          <div className="step"><button type="button" aria-label="Lower the limit" onClick={() => set({ account_limit: draft.account_limit == null ? Math.max(1, row.accounts_used) : Math.max(1, draft.account_limit - 1) })}>−</button><b>{draft.account_limit == null ? 'No limit' : draft.account_limit}</b><button type="button" aria-label="Raise the limit" disabled={draft.account_limit == null} onClick={() => set({ account_limit: Math.min(99, draft.account_limit + 1) })}>+</button><span className="muted">{row.accounts_used} in use</span>{draft.account_limit != null && <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={() => set({ account_limit: null })}>No limit</button>}</div>
          {over && <div className="note warn" style={{ marginTop: 10 }}><AlertTriangle size={16}/><span>They already have {row.accounts_used} accounts and keep all of them, but can’t create another until they’re under {draft.account_limit}. They’ll see: “Your plan allows {draft.account_limit} accounts. You have {row.accounts_used}.”</span></div>}</div>
        <button type="button" className="btn pri" disabled={!dirty} onClick={startSave}><Lock size={15}/>Save changes · needs PIN</button>
        <div className="blk"><h4>Access</h4>
          <div className="acts">
            <button type="button" className="btn gold" disabled={st !== 'active'} onClick={() => setModal({ type: 'danger', kind: 'suspend' })}><Pause size={15}/>Suspend</button>
            <button type="button" className="btn bad" disabled={st === 'banned'} onClick={() => setModal({ type: 'danger', kind: 'ban' })}><Ban size={15}/>Ban</button>
            <button type="button" className="btn bad" disabled={st === 'deleting'} onClick={() => setModal({ type: 'danger', kind: 'delete' })}><Trash2 size={15}/>Delete</button>
          </div>
          <div className="hint" style={{ marginTop: 8, textAlign: 'left' }}>Suspend keeps everything and is reversible. Ban blocks journal data access and their email. Delete starts a 14-day read-only countdown first.</div></div>
        <div className="note"><ShieldCheck size={16}/><span>Private trading records, balances and screenshots are never shown to Owners.</span></div>
      </div>
    </aside>
    {modal?.type === 'planq' && <>
      <div className="scrim" style={{ zIndex: 55 }} onClick={() => setModal(null)}/>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Apply plan settings">
        <h3>Also apply {planName} settings?</h3>
        <p>You’re changing the plan to <b>{planName}</b>. Do you want to give them the standard {planName} settings too?</p>
        <div className="blk"><h4>{planName} standard</h4><div className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>{FEATURES.filter(([key]) => base.features[key]).length === 5 ? 'All five features on' : 'Trade Logs and Finance on, Challenge, Case Studies and Strategy Testing off'}<br/>{base.account_limit} account{base.account_limit === 1 ? '' : 's'}<br/>{base.multiple_accounts_allowed ? 'Multiple accounts allowed' : 'Single accounts only'}</div></div>
        <div className="note"><Info size={16}/><span>“No” changes only the plan and keeps everything you set by hand.</span></div>
        <div className="mf"><button type="button" className="btn" onClick={() => setModal({ type: 'save' })}>No, keep my settings</button><button type="button" className="btn pri" onClick={applyDefaults}>Yes, apply {planName} settings</button></div>
      </div></>}
    {modal?.type === 'save' && <ConfirmModal title="Confirm with your PIN" body="Changing a member’s plan, features or limits needs a fresh PIN." confirmLabel="Confirm" onRun={save} onClose={() => setModal(null)}/>}
    {modal?.type === 'undo' && <ConfirmModal title={{ reactivate: 'Reactivate this member?', unban: 'Unban this member?', cancel_delete: 'Cancel the deletion?' }[modal.action]} body={`${row.email} goes back to Active.`} confirmLabel="Confirm" onRun={status(modal.action, 'Done · logged')} onClose={() => setModal(null)}/>}
    {modal?.type === 'danger' && <ConfirmModal
      icon={{ suspend: Pause, ban: Ban, delete: Trash2 }[modal.kind]}
      tone={modal.kind === 'suspend' ? 'gold' : 'bad'}
      title={{ suspend: 'Suspend this member?', ban: 'Ban this member?', delete: 'Delete this member?' }[modal.kind]}
      body={{ suspend: `${row.email} is blocked from the app straight away. Nothing is deleted. You can reactivate them any time.`, ban: `${row.email} is blocked from their journal data and their email is blocked from creating a new account. Data is kept.`, delete: `${row.email} gets 14 days of read-only access to export their records. You can cancel during the 14 days.` }[modal.kind]}
      needsReason={modal.kind !== 'suspend'} typedTarget={modal.kind === 'delete' ? row.email : undefined}
      confirmLabel={{ suspend: 'Suspend', ban: 'Ban', delete: 'Start 14-day countdown' }[modal.kind]}
      onRun={status(modal.kind, { suspend: 'Suspended · logged', ban: 'Banned · logged', delete: 'Countdown started · logged' }[modal.kind])} onClose={() => setModal(null)}/>}
  </>;
}


// The Mailroom: write once, address it, review, send. One-way messages from Admin.
function Mailroom({ phone, onReview, resetKey, sentKey }) {
  const blank = { mode: 'all', groups: [], people: [], title: '', body: '' };
  const [draft, setDraft] = useState(blank);
  const [members, setMembers] = useState([]);
  const [history, setHistory] = useState(null);
  useEffect(() => { setDraft(blank); }, [resetKey]);
  useEffect(() => { let live = true; officeApi.listMembers({}).then(result => { if (live) setMembers(result.rows); }).catch(() => {}); return () => { live = false; }; }, []);
  useEffect(() => { let live = true; officeApi.listAnnouncements().then(list => { if (live) setHistory(list); }).catch(() => { if (live) setHistory([]); }); return () => { live = false; }; }, [sentKey]);
  const set = patch => setDraft(current => ({ ...current, ...patch }));
  const active = members.filter(row => row.status === 'active');
  const recipients = draft.mode === 'all' ? active : draft.mode === 'group' ? active.filter(row => draft.groups.includes(row.plan)) : active.filter(row => draft.people.includes(row.user_id));
  const label = draft.mode === 'all' ? `all users (${recipients.length})` : draft.mode === 'group' ? `${draft.groups.map(group => group === 'premium' ? 'Premium' : 'Free').join(' + ') || 'no group'} (${recipients.length})` : `${recipients.length} selected ${recipients.length === 1 ? 'person' : 'people'}`;
  const ready = draft.title.trim() && draft.body.trim() && recipients.length > 0;
  const review = () => onReview({ title: draft.title, body: draft.body, audience: { mode: draft.mode, groups: draft.groups, user_ids: draft.people }, label });

  const composer = <>
    <div className="seg2">{[['all', 'Everyone', 'All active users'], ['group', 'A group', 'Free or Premium'], ['pick', 'Pick people', 'One or several']].map(([id, name, sub]) => <button type="button" key={id} className={draft.mode === id ? 'on' : ''} aria-pressed={draft.mode === id} onClick={() => set({ mode: id })}><b>{name}</b><small>{sub}</small></button>)}</div>
    {draft.mode === 'group' && <div className="chips" style={{ marginBottom: 10 }}>{['free', 'premium'].map(group => <button type="button" key={group} className={draft.groups.includes(group) ? 'on' : ''} aria-pressed={draft.groups.includes(group)} onClick={() => set({ groups: draft.groups.includes(group) ? draft.groups.filter(x => x !== group) : [...draft.groups, group] })}>{draft.groups.includes(group) && <Check size={13}/>}{group === 'premium' ? 'Premium' : 'Free'}</button>)}</div>}
    {draft.mode === 'pick' && <div className="pick">{members.map(row => <label key={row.user_id}><input type="checkbox" checked={draft.people.includes(row.user_id)} disabled={row.status !== 'active'} onChange={() => set({ people: draft.people.includes(row.user_id) ? draft.people.filter(x => x !== row.user_id) : [...draft.people, row.user_id] })}/> <span>{row.email}</span> <PlanChip plan={row.plan}/></label>)}</div>}
    <div className="note" style={{ margin: '10px 0' }}><Users size={16}/><span>Addressed to <b>{label}</b>.{draft.mode !== 'pick' ? ' To mix groups, such as 3 Premium and 2 Free people, choose “Pick people”.' : ''} Suspended, banned and deleting members are skipped.</span></div>
    <div className="fld"><div className="cnt2"><small>Title</small><span className={draft.title.length >= 32 ? 'warn' : ''}>{draft.title.length}/{ANNOUNCE_LIMITS.title}</span></div><input className="in" maxLength={ANNOUNCE_LIMITS.title} placeholder="e.g. Scheduled maintenance" value={draft.title} onChange={event => set({ title: event.target.value })}/></div>
    <div className="fld"><div className="cnt2"><small>Message · plain text, short and clear</small><span className={draft.body.length >= 100 ? 'warn' : ''}>{draft.body.length}/{ANNOUNCE_LIMITS.body}</span></div><textarea className="in" maxLength={ANNOUNCE_LIMITS.body} style={{ minHeight: 76 }} placeholder="e.g. The journal will be read-only for 20 minutes on Friday at 02:00 UTC." value={draft.body} onChange={event => set({ body: event.target.value })}/></div>
  </>;
  const letter = <div className="paper"><div className="lh"><div className="crest"><ShieldCheck size={16}/></div><div><b>AAICOREFX</b><small>Office of the Administration</small></div></div><h4>{draft.title || 'Your title'}</h4><p>{draft.body || 'Your message appears here, exactly as members will read it.'}</p><div className="sig">From Admin</div></div>;
  const sent = history === null ? <div className="hint">Loading…</div> : !history.length ? <div className="hint">Nothing sent yet.</div>
    : history.map(item => <div className="notif" key={item.id}><div className="nb"><Megaphone size={16}/></div><div style={{ flex: 1, minWidth: 0 }}><b>{item.title}</b><p>{item.to} · {item.sent}</p><span className="chip ok">{item.read} of {item.total} read</span></div></div>);
  const sendBtn = <button type="button" className="btn pri" disabled={!ready} onClick={review}><Lock size={15}/>Review and send · needs PIN</button>;

  return phone
    ? <>
      <div className="eyebrow">1 · Address it</div>{composer}<div className="eyebrow">2 · Preview</div>{letter}<div className="eyebrow">Sent</div><div className="list">{sent}</div>
      <div className="sendbar"><button type="button" className="btn pri" style={{ width: '100%', padding: 13 }} disabled={!ready} onClick={review}><Lock size={15}/>Review and send · needs PIN</button></div></>
    : <div className="mailg">
      <div className="card sc">{composer}{sendBtn}</div>
      <div className="card sc"><div className="eyebrow" style={{ marginBottom: 8 }}>What members will read</div>{letter}<div className="eyebrow" style={{ margin: '16px 0 8px' }}>Sent</div><div className="list">{sent}</div></div>
    </div>;
}


// The Records: append-only ledger. Scrolls inside its own frame, filters by category, searches text.
const CAT_LABEL = { sec: 'Security', security: 'Security', mem: 'Members', member: 'Members', members: 'Members', ann: 'Mail', announcement: 'Mail', announcements: 'Mail', mail: 'Mail' };
function LogView({ phone }) {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ rows: null, hasMore: false });
  const [more, setMore] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setQuery(search), 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    let live = true;
    setState(current => ({ ...current, rows: null }));
    officeApi.listLog({ category, search: query }).then(result => { if (live) setState(result); }).catch(() => { if (live) setState({ rows: [], hasMore: false, failed: true }); });
    return () => { live = false; };
  }, [category, query]);
  const loadOlder = async () => {
    const last = state.rows[state.rows.length - 1];
    setMore(true);
    try { const next = await officeApi.listLog({ category, search: query, before_id: last.id }); setState(current => ({ rows: [...current.rows, ...next.rows], hasMore: next.hasMore })); }
    finally { setMore(false); }
  };
  const cats = [['all', 'All'], ['sec', 'Security'], ['mem', 'Members'], ['ann', phone ? 'Mail' : 'Announcements']];
  const filter = phone
    ? <div className="fseg" style={{ '--n': 4, flex: '0 0 auto' }}>{cats.map(([id, name]) => <button type="button" key={id} className={category === id ? 'on' : ''} aria-pressed={category === id} onClick={() => setCategory(id)}>{name}</button>)}</div>
    : <div className="pills">{cats.map(([id, name]) => <button type="button" key={id} className={category === id ? 'on' : ''} aria-pressed={category === id} onClick={() => setCategory(id)}>{name}</button>)}</div>;
  const box = <label className="search"><Search size={15}/><input placeholder="Search the records" value={search} aria-label="Search the records" onChange={event => setSearch(event.target.value)}/></label>;
  const rows = state.rows;
  const withDays = [];
  let day = '';
  (rows || []).forEach(item => { if (item.day !== day) { day = item.day; withDays.push({ sep: day }); } withDays.push(item); });
  const empty = rows && !rows.length ? <div className="empty">{state.failed ? 'The records could not be loaded.' : 'Nothing matches.'}</div> : null;
  const olderBtn = state.hasMore ? <button type="button" className="btn" style={{ margin: 12 }} disabled={more} onClick={loadOlder}>{more ? 'Loading…' : 'Load older entries'}</button> : null;

  if (phone) return <>
    {filter}{box}
    <div className="tl">{rows === null ? <div className="hint">Loading…</div> : withDays.map(item => item.sep ? <div className="tdy" key={`d-${item.sep}`}>{item.sep}</div>
      : <div className={`te ${item.ok ? '' : 'f'}`} key={item.id}><div className="tx"><b>{item.a}</b><small>{item.who} · {item.tg}</small></div><div className="rt"><span className="tt">{item.time}</span>{!item.ok ? <i className="bad">Failed</i> : category === 'all' && CAT_LABEL[item.cat] ? <i>{CAT_LABEL[item.cat]}</i> : null}</div></div>)}{empty}{olderBtn}</div>
    <div className="hint"><Lock size={12}/> Append-only · {rows ? rows.length : 0} entries</div></>;

  return <>
    <div className="tool">{filter}{box}</div>
    <div className="ledger"><div className="grow h"><span>Time</span><span>Who</span><span>Action</span><span>Target</span><span style={{ textAlign: 'right' }}>Result</span></div>
      <div className="lscroll">{rows === null ? <div className="empty">Loading…</div> : withDays.map(item => item.sep ? <div className="dsep" key={`d-${item.sep}`}>{item.sep}</div>
        : <div className="grow r" key={item.id}><span className="tm">{item.time}</span><span><span className={`chip ${item.who === 'aaicorefx' ? 'gold' : 'acc'}`} style={{ padding: '1px 8px' }}>{item.who}</span></span><span title={item.a}>{item.a}</span><span className="muted" title={item.tg}>{item.tg}</span><span style={{ textAlign: 'right' }}><span className={`tag ${item.ok ? 'ok' : 'bad'}`}>{item.ok ? 'Success' : 'Failed'}</span></span></div>)}{empty}{olderBtn}</div>
      <div className="lfoot"><span><Lock size={12}/> Append-only. PINs, codes and private trading data are never written here.</span><span>{rows ? rows.length : 0} entries{state.hasMore ? ' · scroll for more' : ''}</span></div></div></>;
}


function ChangePinModal({ onDone, onClose }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const full = next.length === 6 && again.length === 6;
  const match = full && next === again;
  const ready = cur.length === 6 && match && next !== cur;
  const submit = async event => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError('');
    try { await officeApi.changePin({ current_pin: cur, new_pin: next }); onDone(); }
    catch (problem) { setCur(''); setError(problem.code === 'wrong_pin' ? `Your current PIN is wrong. ${problem.triesLeft ?? ''} tries left before a lockout.`.replace('  ', ' ') : problem.code === 'same_pin' ? 'Choose a PIN different from your current one.' : 'That did not go through. Nothing was changed.'); }
    finally { setBusy(false); }
  };
  return <>
    <div className="scrim" style={{ zIndex: 55 }} onClick={onClose}/>
    <form className="modal" role="dialog" aria-modal="true" aria-label="Change PIN" onSubmit={submit}>
      <h3>Change your PIN</h3>
      <div className="steps"><i className="on"/><i className="on"/></div>
      <p>Pick a new 6-digit PIN. The old one stops working and the office locks so you sign in again.</p>
      <div className="eyebrow" style={{ textAlign: 'center' }}>Current PIN</div><PinRow value={cur} onChange={setCur} masked label="Current PIN" autoFocus/>
      <div className="eyebrow" style={{ textAlign: 'center' }}>New PIN</div><PinRow value={next} onChange={setNext} masked label="New PIN"/>
      <div className="eyebrow" style={{ textAlign: 'center' }}>Confirm new PIN</div><PinRow value={again} onChange={setAgain} masked label="Confirm new PIN"/>
      {error ? <div className="note bad" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>
        : full && !match ? <div className="note bad"><AlertTriangle size={16}/><span>The two PINs don’t match.</span></div>
          : match ? <div className="note"><Check size={16}/><span>PINs match.</span></div>
            : <div className="note"><Info size={16}/><span>Enter the new PIN twice.</span></div>}
      <div className="mf"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn pri" disabled={!ready || busy}><Lock size={15}/>{busy ? 'Working…' : 'Save new PIN'}</button></div>
    </form></>;
}

function CodesModal({ codes, onClose }) {
  return <>
    <div className="scrim" style={{ zIndex: 55 }}/>
    <div className="modal" role="dialog" aria-modal="true" aria-label="Your backup codes">
      <h3>Your backup codes</h3>
      <p>Shown only once. Save them in a password manager or print them. Each code works a single time.</p>
      <div className="codes">{codes.map(code => <span key={code}>{code}</span>)}</div>
      <div className="mf"><button type="button" className="btn pri" onClick={onClose}>I’ve saved them</button></div>
    </div></>;
}

// The Vault: what protects the office. Recovery (forgot PIN, lost authenticator) is not available until approved.
function VaultView({ phone, onAction, refreshKey }) {
  const [info, setInfo] = useState(null);
  useEffect(() => { let live = true; officeApi.getSecurity().then(result => { if (live) setInfo(result); }).catch(() => {}); return () => { live = false; }; }, [refreshKey]);
  const on = !!info?.backup_codes;
  const tiles = [
    [KeyRound, 'Admin PIN', 'Your own 6-digit PIN, separate for each Owner account. Stored as a secure hash, never in plain text.', <button type="button" className="btn" onClick={() => onAction('pin')}>Change PIN</button>],
    [ShieldCheck, 'Authenticator app', 'Your own authenticator, asked every time you open the office.', <span className="chip ok"><Check size={13}/>Linked</span>],
    [ScrollText, 'Backup codes', 'Optional. Eight one-time codes if you lose your phone. Turning on or off signs you out of the office. Turning off needs one code.', info?.backup_codes === null ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="btn" onClick={() => onAction('codes-on')}>Turn on</button><button type="button" className="btn" onClick={() => onAction('codes-off')}>Turn off</button></div> : <Switch on={on} label="Backup codes" disabled={!info} onClick={() => onAction(on ? 'codes-off' : 'codes-on')}/>],
    [Lock, 'Auto-lock', 'The door locks after 15 minutes of inactivity. Pending actions are cancelled.', <span className="chip">15 min</span>],
    [Crown, 'Owner accounts', 'Fixed in the database to your two verified IDs. Can’t be changed from the app.', <span className="chip gold"><Crown size={13}/>{info?.owners ?? 2} Owners</span>],
  ];
  const recovery = <div className="note"><Info size={16}/><span>Forgot your PIN or lost your authenticator? Self-service recovery isn’t available yet. It will be switched on only after it’s been tested and approved.</span></div>;
  return phone
    ? <>{tiles.map(([Icon, name, text, control]) => <div className="prow" key={name}><div className="ic"><Icon size={18}/></div><span><b>{name}</b><small>{text}</small></span><div>{control}</div></div>)}{recovery}<button type="button" className="prow" onClick={() => onAction('goto-user')}><div className="ic"><UserRound size={18}/></div><span><b>Member view</b><small>Preview what members see in each situation</small></span><ChevronRight size={16}/></button></>
    : <><div className="vault">{tiles.map(([Icon, name, text, control]) => <div className="vt" key={name}><div className="ic"><Icon size={20}/></div><div style={{ flex: 1 }}><b>{name}</b><p>{text}</p>{control}</div></div>)}</div><div style={{ marginTop: 14 }}>{recovery}</div></>;
}


const VSTATES = [['normal', 'Normal'], ['limit', 'Over account limit'], ['multi', 'Single accounts only'], ['susp', 'Suspended'], ['del', 'Deletion window'], ['ban', 'Banned login'], ['off', 'Feature switched off']];

// Front of House: a safe preview of what a member sees in each situation. Nothing here touches a real member.
function MemberPreview({ phone, refreshKey }) {
  const [state, setState] = useState('normal');
  const [notes, setNotes] = useState(null);
  const [bell, setBell] = useState(false);
  const [reading, setReading] = useState(null);
  useEffect(() => {
    let live = true;
    officeApi.listAnnouncements().then(list => { if (live) setNotes([...list.slice(0, 3).map((item, index) => ({ id: item.id, title: item.title, body: item.body, admin: true, unread: index === 0 })), { id: 'acct', title: 'Plan updated', body: 'Your plan is now Premium. Your settings were not changed.', admin: false, unread: false }]); }).catch(() => { if (live) setNotes([]); });
    return () => { live = false; };
  }, [refreshKey]);
  const list = notes || [];
  const unread = list.filter(item => item.unread).length;
  const read = id => { setNotes(current => current.map(item => item.id === id ? { ...item, unread: false } : item)); setReading(id); };
  const clear = id => { setNotes(current => current.filter(item => item.id !== id)); setReading(null); };
  const heading = text => <b className="serif" style={{ fontSize: 17 }}>{text}</b>;
  const note = reading && list.find(item => item.id === reading);

  let box;
  if (state === 'normal' && note) box = <div className="reader"><div className="rt"><button type="button" className="pback" aria-label="Back to messages" onClick={() => setReading(null)}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }}/></button><span className="eyebrow">Message</span></div>
    <div className="paper"><div className="lh"><div className="crest"><ShieldCheck size={16}/></div><div><b>AAICOREFX</b><small>{note.admin ? 'From Admin' : 'Account notice'}</small></div></div><h4>{note.title}</h4><p>{note.body}</p><div className="sig">{note.admin ? 'From Admin' : 'Your account'}</div></div>
    <button type="button" className="btn" onClick={() => clear(note.id)}><X size={15}/>Clear this message</button></div>;
  else if (state === 'normal') box = <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{heading('Dashboard')}<button type="button" className="bell" aria-label={`Notifications, ${unread} unread`} onClick={() => setBell(value => !value)}><Megaphone size={17}/>{unread ? <b>{unread}</b> : null}</button></div>
    {bell ? <><div className="list">{list.map(item => <div className={`notif ${item.unread ? 'unread' : ''}`} key={item.id} role="button" tabIndex={0} onClick={() => read(item.id)} onKeyDown={event => { if (event.key === 'Enter') read(item.id); }}><div className="nb"><Megaphone size={16}/></div><div style={{ paddingRight: 18, minWidth: 0 }}><b>{item.title}{item.admin && <span className="tagadmin">From Admin</span>}</b><p className="clamp">{item.body}</p><span className="more">Tap to read</span></div><button type="button" className="x" aria-label="Clear this message" onClick={event => { event.stopPropagation(); clear(item.id); }}><X size={14}/></button></div>)}{!list.length && <div className="empty">All cleared.</div>}</div><div className="hint">Tap a message to open it and mark it read. The × clears it from your view only.</div></>
      : <div className="empty">Tap the bell to open notifications.</div>}</>;
  else if (state === 'limit') box = <>{heading('Create account')}<div className="note warn"><AlertTriangle size={16}/><span>Your plan allows 2 accounts. You have 5. All your accounts stay available, but you can’t create another right now.</span></div><button type="button" className="btn" disabled>Create account</button></>;
  else if (state === 'multi') box = <>{heading('Create account')}<div className="copt"><div><b>Single</b><small>One account, one balance</small></div><div className="off"><b>Multiple</b><small>Not available</small></div></div><div className="note warn"><Info size={16}/><span>Multiple accounts aren’t included for your account. Any Multiple account you already have stays as it is. You can create Single accounts.</span></div><button type="button" className="btn pri">Create Single account</button></>;
  else if (state === 'susp') box = <div style={{ textAlign: 'center', padding: 16 }}><h3 className="serif">Your account is suspended</h3><p className="muted">Access is paused and your data is safe. Contact support at aaicorefx@gmail.com to have it reactivated.</p></div>;
  else if (state === 'del') box = <><div className="banner" style={{ background: 'rgba(242,135,143,.1)', border: '1px solid rgba(242,135,143,.4)' }}><span><Trash2 size={14}/> Permanent deletion in <b>11 days</b>. Read-only now.</span><button type="button" className="btn pri">Export my records (CSV)</button></div><div className="empty">Everything is visible but can’t be edited.</div></>;
  else if (state === 'ban') box = <div style={{ textAlign: 'center', padding: 12 }}><h3 className="serif">Sign in</h3><div className="note bad" style={{ textAlign: 'left' }}><Ban size={16}/><span>This account has been banned. Contact aaicorefx@gmail.com if you think this is a mistake.</span></div><p className="muted">Creating a new account with this email isn’t possible.</p></div>;
  else box = <>{heading('Finance')}<div className="note warn"><Info size={16}/><span>Finance is switched off for your account. Old records stay visible, but you can’t add or change anything.</span></div><button type="button" className="btn" disabled>Add movement</button></>;

  const pick = id => { setState(id); setBell(false); setReading(null); };
  const states = VSTATES.map(([id, name]) => <button type="button" key={id} className={state === id ? 'on' : ''} aria-pressed={state === id} onClick={() => pick(id)}>{name}</button>);
  const stage = <div className="ubox">{box}</div>;
  const hint = <div className="hint">A safe preview. No real member is affected.</div>;
  return phone ? <><div className="fgrid">{states}</div>{stage}{hint}</> : <><div className="vis"><div className="vlist">{states}</div><div className="vstage">{stage}</div></div>{hint}</>;
}

const NAV = [
  ['members', 'Members', 'The register', Users],
  ['ann', 'Announcements', 'Mailroom', Megaphone],
  ['log', 'Activity log', 'Records', ScrollText],
  ['sec', 'Security', 'The vault', KeyRound],
  ['user', 'Member view', 'Front of house', UserRound],
];
const TITLES = { members: ['The Register', 'Plans, features, limits and access for every member.'], user: ['Front of House', 'What members see in each situation.'], sec: ['The Vault', 'PIN, authenticator, backup codes and who holds the keys.'], log: ['The Records', 'Every action and every failed PIN, written once and never changed.'], ann: ['The Mailroom', 'Write once, address it, send it. One-way messages from Admin.'] };

export default function AdminOffice({ onClose }) {
  const phone = usePhone();
  const [session, setSession] = useState(null);
  const [enrollmentReady, setEnrollmentReady] = useState(!officeIsLive);
  const [note, setNote] = useState('');
  const [left, setLeft] = useState(IDLE_SECONDS);
  const activityDeadline = useRef(0);
  const [tab, setTab] = useState('members');
  const frame = useRef(null);
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [sendDraft, setSendDraft] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [sentKey, setSentKey] = useState(0);
  const [vaultModal, setVaultModal] = useState(null);
  const [secKey, setSecKey] = useState(0);
  const openMember = useCallback((row, focusFeatures) => setEditing({ row, focusFeatures: !!focusFeatures }), []);
  const changed = useCallback((saved, message) => { setEditing(current => current && { ...current, row: saved, focusFeatures: false }); setRefreshKey(value => value + 1); setNotice(message); setTimeout(() => setNotice(''), 2800); }, []);

  const lock = useCallback((message = '') => { officeApi.lock?.(); setEditing(null); setSendDraft(null); setVaultModal(null); setSession(null); setNote(message); setLeft(IDLE_SECONDS); }, []);
  useEffect(() => {
    if (!session) return undefined;
    const update = () => setLeft(Math.max(0, Math.ceil((activityDeadline.current - Date.now()) / 1000)));
    const timer = setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [session]);
  useEffect(() => { if (session && left <= 0) lock('Locked after 15 minutes of inactivity.'); }, [left, session, lock]);
  const closeOffice = useCallback(() => {
    if (session) officeApi.lock();
    onClose();
  }, [session, onClose]);
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') closeOffice(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeOffice]);
  useEffect(() => { setOfficeLockHandler(code => lock(code === 'locked' ? 'Locked after too many wrong attempts.' : 'The office was locked. Please sign in again.')); return () => setOfficeLockHandler(null); }, [lock]);
  const touch = () => {
    if (!session) return;
    if (Date.now() >= activityDeadline.current) { lock('Locked after 15 minutes of inactivity.'); return; }
    activityDeadline.current = Date.now() + IDLE_SECONDS * 1000;
    setLeft(IDLE_SECONDS);
  };
  const title = TITLES[tab];

  const content = officeIsLive && !enrollmentReady
    ? <OfficeEnrollment onClose={onClose} onReady={message => { setEnrollmentReady(true); if (message) setNote(message); }}/>
    : !session
    ? <Gate note={note} onClose={onClose} onUnlocked={result => { activityDeadline.current = Date.now() + IDLE_SECONDS * 1000; setSession(result); setNote(''); setLeft(IDLE_SECONDS); }}/>
    : phone
      ? <div className="pw">
        <div className="ph"><div style={{ flex: 1, minWidth: 0 }}><div className="eyebrow">{{ ann: 'Announcements', log: 'Activity log', sec: 'Security', user: 'Member view' }[tab] || 'Members'}</div><h1>{{ ann: 'Mailroom', log: 'Records', sec: 'Vault', user: 'Front of House' }[tab] || 'Register'}</h1></div>
          <div className="ring" style={{ '--p': `${left / 9}%` }}><i/><span>{clock(left)}</span></div>
          <button type="button" className="pback" aria-label="Close the office" onClick={closeOffice}><X size={16}/></button></div>
        <div className="pscroll">{tab === 'user' ? <MemberPreview phone refreshKey={sentKey}/> : tab === 'sec' ? <VaultView phone onAction={type => type === 'goto-user' ? setTab('user') : setVaultModal({ type })} refreshKey={secKey}/> : tab === 'log' ? <LogView phone/> : tab === 'ann' ? <Mailroom phone onReview={setSendDraft} resetKey={resetKey} sentKey={sentKey}/> : <MembersView phone onEdit={openMember} refreshKey={refreshKey}/>}</div>
        <div className="dock">
          <button type="button" className={`t ${tab === 'members' ? 'on' : ''}`} aria-current={tab === 'members' ? 'page' : undefined} onClick={() => setTab('members')}><Users/>Members</button>
          <button type="button" className={`t ${tab === 'ann' ? 'on' : ''}`} aria-current={tab === 'ann' ? 'page' : undefined} onClick={() => setTab('ann')}><Megaphone/>Mail</button>
          <button type="button" className="mid" aria-label="Lock the door" onClick={() => lock()}><Lock/></button>
          <button type="button" className={`t ${tab === 'log' ? 'on' : ''}`} aria-current={tab === 'log' ? 'page' : undefined} onClick={() => setTab('log')}><ScrollText/>Records</button>
          <button type="button" className={`t ${tab === 'sec' ? 'on' : ''}`} aria-current={tab === 'sec' ? 'page' : undefined} onClick={() => setTab('sec')}><KeyRound/>Vault</button>
        </div></div>
      : <div className="office">
        <aside className="rail">
          <div className="plate"><div className="crest"><ShieldCheck size={20}/></div><div><small>AAICOREFX</small><b>Administration Office</b></div></div>
          <div className="signed"><div className="av o">OW</div><div><b>Owner</b><small>Signed in</small></div></div>
          <nav className="nav" aria-label="Administration Office">{NAV.map(([id, label, sub, Icon, soon]) => <button type="button" key={id} className={tab === id ? 'on' : ''} disabled={!!soon} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)} style={soon ? { opacity: .45, cursor: 'default' } : undefined}><Icon size={17} aria-hidden="true"/><span><b>{label}</b><small>{soon ? 'Coming soon' : sub}</small></span></button>)}</nav>
          <div className="door"><div className="dl"><span className="eyebrow">Office door</span><b>{clock(left)}</b></div><div className="meter"><i style={{ width: `${left / 9}%` }}/></div><button type="button" className="btn ghost" onClick={() => lock()}><Lock size={15}/>Lock the door</button></div>
        </aside>
        <main className="main"><div className="mh"><div><div className="eyebrow">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>{title[0]}</h1><p>{title[1]}</p></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="chip gold"><Crown size={13}/>Owner access</span><button type="button" className="ib" aria-label="Close the office" onClick={closeOffice}><X size={16}/></button></div></div>
          <div className="mc">{tab === 'user' ? <MemberPreview refreshKey={sentKey}/> : tab === 'sec' ? <VaultView onAction={type => setVaultModal({ type })} refreshKey={secKey}/> : tab === 'log' ? <LogView/> : tab === 'ann' ? <Mailroom onReview={setSendDraft} resetKey={resetKey} sentKey={sentKey}/> : <MembersView onEdit={openMember} refreshKey={refreshKey}/>}</div></main></div>;

  return <div className={`ao ${phone ? 'is-phone' : ''}`} role="dialog" aria-modal="true" aria-label="Administration Office" onPointerDown={touch} onKeyDown={touch}>
    <div className={`ao-frame ${phone ? 'phone' : ''}`} ref={frame}>{content}
      {session && editing && <MemberPanel key={editing.row.user_id} row={editing.row} focusFeatures={editing.focusFeatures} onClose={() => setEditing(null)} onChanged={changed}/>}
      {session && sendDraft && <ConfirmModal icon={Megaphone} title="Send this announcement?" body={`To ${sendDraft.label}. It appears as a “From Admin” message in their bell.`} confirmLabel="Send" onClose={() => setSendDraft(null)}
        onRun={({ pin }) => officeApi.sendAnnouncement({ title: sendDraft.title, body: sendDraft.body, audience: sendDraft.audience, pin }).then(() => { setSendDraft(null); setResetKey(value => value + 1); setSentKey(value => value + 1); setNotice('Sent · members see it in their bell'); setTimeout(() => setNotice(''), 2800); })}/>}
      {session && vaultModal?.type === 'pin' && <ChangePinModal onClose={() => setVaultModal(null)} onDone={() => lock('Shared PIN changed. Both Owners must unlock again.')}/>}
      {session && vaultModal?.type === 'codes-on' && <ConfirmModal icon={KeyRound} title="Turn on backup codes?" body="You’ll get eight one-time codes, shown once. Keep them somewhere safe." confirmLabel="Turn on" onClose={() => setVaultModal(null)}
        onRun={({ pin }) => officeApi.backupCodesEnable({ pin }).then(result => { setVaultModal({ type: 'codes', codes: result.codes }); })}/>}
      {session && vaultModal?.type === 'codes-off' && <ConfirmModal icon={KeyRound} tone="bad" needsCode title="Turn off backup codes?" body="Enter one of your backup codes and your PIN to switch this off." confirmLabel="Turn off" onClose={() => setVaultModal(null)}
        onRun={({ pin, code }) => officeApi.backupCodesDisable({ code, pin }).then(() => lock('Backup codes are off. Please sign in again.'))}/>}
      {session && vaultModal?.type === 'codes' && <CodesModal codes={vaultModal.codes} onClose={() => lock('Backup codes are on. Please sign in again.')}/>}
      {notice && <div className="toast" role="status"><Check size={16}/>{notice}</div>}</div>
  </div>;
}

// Shown in place of the old Memberships panel when the Office is switched on.
export function AdminOfficeLauncher() {
  const [open, setOpen] = useState(false);
  return <section className="ao-launch" aria-label="Administration Office">
    <div className="ao-launch-card">
      <span className="ao-launch-ico"><ShieldCheck size={24}/></span>
      <div><h2>Administration Office</h2><p>Members, plans, features and limits. Protected by your authenticator code and PIN.</p></div>
      <button type="button" className="ao-launch-btn" onClick={() => setOpen(true)}><Lock size={15}/>Open the office</button>
    </div>
    {open && createPortal(<div className="ao-layer"><AdminOffice onClose={() => setOpen(false)}/></div>, document.body)}
  </section>;
}
