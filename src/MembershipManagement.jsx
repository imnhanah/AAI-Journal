import ImageAccessManagement from './ImageAccessManagement.jsx';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Crown, Pencil, Search, ShieldCheck, X } from 'lucide-react';
import { changeMembership, listMembershipAccounts } from './membershipAdmin.js';
import { membershipPreviewEnabled } from './membership.js';
import { Popup } from './MobileAccountSettings.jsx';
import './membershipManagement.css';

const PAGE_SIZE = 25;
const label = membership => membership === 'owner' ? 'Owner' : 'Free';
const cloudLabel = membershipPreviewEnabled ? 'Cloud writes' : 'Cloud sync';
const cloudEnabled = account => membershipPreviewEnabled ? account.cloud_writes_allowed : account.cloud_flag;
const FILTERS = [['all', 'All'], ['owner', 'Owners'], ['free', 'Free']];
const initials = email => (String(email || '?').split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 2) || '?').toUpperCase();
const tint = email => [...String(email || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
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

const Avatar = ({ account, size = '' }) => {
  const owner = account.membership === 'owner';
  return <span className={`jm-av ${owner ? 'is-owner' : `is-t${tint(account.email)}`} ${size}`} aria-hidden="true">{initials(account.email)}{owner && <i><Crown size={10}/></i>}</span>;
};
const Pill = ({ membership }) => <em className={`jm-pill ${membership === 'owner' ? 'is-owner' : ''}`}>{membership === 'owner' && <Crown size={11} aria-hidden="true"/>}{label(membership)}</em>;

export default function MembershipManagement({ userId, onAccessLost }) {
  const phone = usePhone();
  const [search, setSearch] = useState('');
  const [request, setRequest] = useState({ search: '', cursors: [null] });
  const [page, setPage] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const active = useRef(false);
  const submitting = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setError('');
    listMembershipAccounts({ search: request.search, cursor: request.cursors.at(-1), pageSize: PAGE_SIZE })
      .then(result => { if (!cancelled) setPage(result); })
      .catch(problem => {
        if (cancelled) return;
        if (problem.code === '42501') onAccessLost();
        else setError(problem.message || 'Could not load memberships.');
      });
    return () => { cancelled = true; };
  }, [request, onAccessLost]);
  // Typing searches by itself after a short pause. The Search button still searches at once.
  useEffect(() => {
    const text = search.trim();
    if (text === request.search) return undefined;
    const timer = window.setTimeout(() => { setEditing(null); setReviewing(false); setStatus(''); setRequest({ search: text, cursors: [null] }); }, 350);
    return () => window.clearTimeout(timer);
  }, [search, request.search]);

  const nextCloudFor = ({ account, membership, cloudAllowed }) => !membershipPreviewEnabled && account.membership === 'free' && membership === 'free' ? account.cloud_flag : cloudAllowed;
  const closeEditor = () => { setEditing(null); setReviewing(false); };
  const submit = async event => {
    event?.preventDefault();
    if (!editing || submitting.current) return;
    const { account, membership, cloudAllowed } = editing;
    submitting.current = true;
    try {
      setBusy(true);
      setError('');
      setStatus('');
      const saved = await changeMembership(account, membership, cloudAllowed);
      if (!active.current) return;
      setPage(current => current && { ...current, rows: current.rows.map(row => row.user_id === saved.user_id ? saved : row) });
      closeEditor();
      setStatus(`Saved ${label(saved.membership)}. ${cloudLabel} ${cloudEnabled(saved) ? 'enabled' : 'disabled'}.`);
    } catch (problem) {
      if (!active.current) return;
      if (problem.code === '42501') onAccessLost();
      else setError(problem.message || 'Could not save the change.');
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  };

  const navigate = cursors => { closeEditor(); setStatus(''); setRequest({ ...request, cursors }); };
  const rows = page?.rows || [];
  const owners = rows.filter(row => row.membership === 'owner').length;
  const counts = { all: rows.length, owner: owners, free: rows.length - owners };
  const shown = rows.filter(row => filter === 'all' || row.membership === filter).sort((a, b) => Number(b.membership === 'owner') - Number(a.membership === 'owner'));
  const partial = request.cursors.length > 1 || page?.hasMore;
  const changed = editing && (editing.membership !== editing.account.membership || editing.cloudAllowed !== editing.account.cloud_writes_allowed);

  const editor = editing && <div className="jm-editor">
    <div className="jm-ewho"><Avatar account={editing.account} size="is-lg"/><div><strong>{editing.account.email || 'No email address'}</strong><small>Current: {label(editing.account.membership)}</small></div></div>
    {!reviewing ? <>
      <div className="jm-choice" role="radiogroup" aria-label="Membership">
        {['free', 'owner'].map(value => <button type="button" key={value} role="radio" aria-checked={editing.membership === value} className={`${editing.membership === value ? 'is-on' : ''} ${value === 'owner' ? 'is-owner' : ''}`} disabled={busy} onClick={() => setEditing({ ...editing, membership: value, cloudAllowed: false })}>{value === 'owner' && <Crown size={15} aria-hidden="true"/>}{label(value)}</button>)}
      </div>
      {editing.membership === 'owner'
        ? <label className="jm-check"><input type="checkbox" checked={editing.cloudAllowed} disabled={busy} onChange={event => setEditing({ ...editing, cloudAllowed: event.target.checked })}/><span>{membershipPreviewEnabled ? 'Allow cloud writes' : 'Enable cloud sync'}</span></label>
        : <p className="jm-note">{membershipPreviewEnabled ? 'Free accounts save new work on this device. Previously synced data remains available for recovery.' : 'Changing an Owner to Free turns off their cloud sync. Saving an existing Free account preserves its current cloud sync setting.'}</p>}
      <div className="jm-actions">
        <button type="button" className="jm-btn" disabled={busy} onClick={closeEditor}>Cancel</button>
        <button type="button" className="jm-btn is-pri" disabled={busy || !changed} onClick={() => setReviewing(true)}>Review change</button>
      </div>
    </> : <>
      <div className="jm-diff" aria-label="Membership change"><div><small>Now</small><Pill membership={editing.account.membership}/></div><ChevronRight size={18} aria-hidden="true"/><div><small>New</small><Pill membership={editing.membership}/></div></div>
      {editing.account.membership === 'owner' && editing.membership === 'free' && cloudEnabled(editing.account)
        ? <p className="jm-warn" role="alert">{cloudLabel} will be turned off for this account.</p>
        : <p className="jm-note">{cloudLabel} will be {nextCloudFor(editing) ? 'enabled' : 'disabled'}. Existing cloud data remains available for recovery.</p>}
      <div className="jm-actions">
        <button type="button" className="jm-btn" disabled={busy} onClick={() => setReviewing(false)}>Back</button>
        <button type="button" className="jm-btn is-pri" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Confirm change'}</button>
      </div>
    </>}
  </div>;

  return <section className="tj-membership" aria-label="Memberships">
    <header className="jm-head"><span className="jm-ico"><ShieldCheck size={22}/></span><div><h2>Memberships</h2><p>See who is an Owner and whether their cloud sync is on.</p></div></header>
    <div className="jm-stats" aria-label={partial ? 'Totals for this page of accounts' : 'Totals'}>
      <div><small>Members</small><b>{page ? counts.all : '–'}</b></div>
      <div className="is-owner"><small>Owners</small><b>{page ? counts.owner : '–'}</b></div>
      <div><small>Synced</small><b>{page ? rows.filter(cloudEnabled).length : '–'}</b></div>
    </div>
    <div className="jm-bar">
      <div className="jm-seg" role="group" aria-label="Filter members">{FILTERS.map(([value, text]) => <button type="button" key={value} aria-pressed={filter === value} className={filter === value ? 'is-on' : ''} onClick={() => setFilter(value)}>{text}<em>{page ? counts[value] : 0}</em></button>)}</div>
      <form className="jm-search" onSubmit={event => { event.preventDefault(); closeEditor(); setStatus(''); setRequest({ search: search.trim(), cursors: [null] }); }}>
        <Search size={16} aria-hidden="true"/>
        <input aria-label="Search by email" placeholder="Search by email" maxLength={254} value={search} onChange={event => setSearch(event.target.value)}/>
        {search && <button type="button" className="jm-x" aria-label="Clear search" onClick={() => setSearch('')}><X size={14}/></button>}
        <button type="submit" className="jm-btn is-pri" disabled={busy}>Search</button>
      </form>
    </div>
    {status && <p className="jm-msg" role="status"><Check size={14}/>{status}</p>}
    {error && <p className="jm-msg is-err" role="alert">{error} <button type="button" className="jm-btn" disabled={busy} onClick={() => navigate(request.cursors)}>Refresh</button></p>}
    {!page && !error && <p className="jm-msg" role="status">Loading accounts…</p>}
    {page && rows.length === 0 && <p className="jm-empty">No matching accounts.</p>}
    {page && rows.length > 0 && shown.length === 0 && <p className="jm-empty">No {filter === 'owner' ? 'Owners' : 'Free members'} on this page.</p>}
    {shown.length > 0 && <>
      <div className="jm-th" aria-hidden="true"><span>Member</span><span>Plan</span><span>{cloudLabel}</span><span/></div>
      <ul className="jm-list" aria-label="Registered accounts">
        {shown.map(account => {
          const open = editing?.account.user_id === account.user_id;
          return <li key={account.user_id} className={`jm-row ${account.membership === 'owner' ? 'is-owner' : ''} ${open ? 'is-open' : ''}`}>
            <div className="jm-main"><Avatar account={account}/><strong title={account.email || undefined}>{account.email || 'No email address'}</strong></div>
            <span className="jm-plan"><Pill membership={account.membership}/></span>
            <span className={`jm-sync ${cloudEnabled(account) ? 'is-on' : ''}`}><i aria-hidden="true"/>{cloudLabel} {cloudEnabled(account) ? 'on' : 'off'}<span className="jm-sr"> ({cloudEnabled(account) ? 'enabled' : 'disabled'})</span></span>
            <button type="button" className="jm-edit" disabled={busy || userId === account.user_id}
              aria-label={`Edit membership for ${account.email || 'account'}`}
              onClick={() => { setStatus(''); setError(''); setReviewing(false); setEditing({ account, membership: account.membership, cloudAllowed: account.cloud_writes_allowed }); }}><Pencil size={15}/></button>
            {open && !phone && <div className="jm-inline">{editor}</div>}
          </li>;
        })}
      </ul>
    </>}
    {page && <ImageAccessManagement accounts={shown} onAccessLost={onAccessLost}/>}
    {editing && phone && <Popup title="Edit membership" hint={reviewing ? 'Check the change before it is saved.' : undefined} onClose={closeEditor} footer={null}>{editor}</Popup>}
    {page && partial && <nav className="jm-pages" aria-label="Account pages">
      <button type="button" className="jm-btn" disabled={busy || request.cursors.length === 1} onClick={() => navigate(request.cursors.slice(0, -1))}>Previous</button>
      <button type="button" className="jm-btn" disabled={busy || !page.hasMore} onClick={() => navigate([...request.cursors, page.rows.at(-1).user_id])}>Next</button>
    </nav>}
  </section>;
}
