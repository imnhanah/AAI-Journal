import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Trash2, RefreshCw, AlertTriangle, ChevronRight} from 'lucide-react';
import './settingsDangerZone.css';
import {MOBILE_MEDIA} from './mobileNavigation.js';
import PhoneWorkspaceDangerSheet from './PhoneWorkspaceDangerSheet.jsx';

export default function SettingsDangerZone({account, accountNames, onReset, onDelete, inline = false, panelCard = false}) {
  const [phone,setPhone]=useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  useEffect(()=>{const media=window.matchMedia(MOBILE_MEDIA),change=()=>{setPhone(media.matches);setOpen(false);};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const container = useRef(null);
  const trigger = useRef(null);
  const dialog = useRef(null);
  const inFlight = useRef(false);
  const workspaceName = account.name || 'account';
  useEffect(() => {
    if (!open || phone || panelCard) return;
    const dismiss = event => {if (!container.current?.contains(event.target)) setOpen(false);};
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open,phone,panelCard]);
  useEffect(() => {
    if (!action) return;
    const modal = trigger.current?.closest('.tj-modal');
    const previousInert = modal?.inert;
    if (modal) modal.inert = true;
    dialog.current?.querySelector('input, button')?.focus();
    return () => {if (modal) modal.inert = previousInert; trigger.current?.focus();};
  }, [action]);
  const close = () => {if (!inFlight.current) setAction(null);};
  const request = next => {
    setOpen(false); setAction(next); setAcknowledged(false); setTypedName(''); setError('');
  };
  const allowed = action === 'reset' ? acknowledged : typedName === workspaceName;
  const confirm = async () => {
    if (!allowed || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await (action === 'reset' ? onReset() : onDelete(account));
      if (result === false) setError('The operation could not be completed. Check the error message and try again.');
      else setAction(null);
    } catch {
      setError('The operation could not be completed. Please try again.');
    } finally {inFlight.current = false; setBusy(false);}
  };
  const root = trigger.current?.closest('.tj-root');
  const confirmation = action && <div className="tj-settings-danger-overlay" onMouseDown={event => {if (event.target === event.currentTarget) close();}}>
    <section ref={dialog} className={`tj-settings-danger-dialog ${action === 'delete' ? 'is-delete' : ''}`} role="dialog" aria-modal="true" aria-labelledby="settings-danger-title" aria-describedby="settings-danger-description" aria-busy={busy} onKeyDown={event => {
      if (event.key === 'Escape') {event.stopPropagation();close();}
      if (event.key === 'Tab') {
        const controls = dialog.current?.querySelectorAll('input:not(:disabled), button:not(:disabled)');
        if (!controls?.length) {event.preventDefault();return;}
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
      }
    }}>
      <div className="tj-settings-danger-icon">{action === 'reset' ? <RefreshCw size={21}/> : <Trash2 size={21}/>}</div>
      <h3 id="settings-danger-title">{action === 'reset' ? 'Reset' : 'Delete'} {workspaceName} account?</h3>
      <p id="settings-danger-description">{action === 'reset' ? 'This erases all trade history and check-ins for this account. Your settings stay as they are.' : 'This permanently deletes the account and everything in it: every trade, markup, review, and history entry.'}</p>
      <div className="tj-settings-danger-accounts">{accountNames.map((name, index) => <span key={index}>{name}</span>)}</div>
      {action === 'reset' ? <label className="tj-settings-danger-ack"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)}/>I understand this can't be undone</label> : <label className="tj-settings-danger-name">Type <strong>{workspaceName}</strong> to confirm<input className="tj-input" aria-label="Account name to confirm deletion" autoComplete="off" placeholder={workspaceName} disabled={busy} value={typedName} onChange={event => setTypedName(event.target.value)}/></label>}
      {error && <p className="tj-settings-danger-error" role="alert">{error}</p>}
      <div className="tj-settings-danger-buttons"><button type="button" className="tj-btn-outline" disabled={busy} onClick={close}>Cancel</button><button type="button" className="tj-settings-danger-confirm" disabled={!allowed || busy} onClick={confirm}>{busy ? (action === 'reset' ? 'Resetting…' : 'Deleting…') : (action === 'reset' ? 'Reset data' : 'Delete account')}</button></div>
    </section>
  </div>;
  if (inline) return <div ref={container}>
    <div className="tj-ma-danger">
      <button ref={trigger} type="button" onClick={() => request('reset')}><span className="tj-ma-icon is-red"><RefreshCw size={18}/></span><span className="tj-ma-copy"><strong>Reset account data</strong><small>Erases all trade history and check-ins for {workspaceName}. Settings stay.</small></span></button>
      <button type="button" className="is-delete" onClick={() => request('delete')}><span className="tj-ma-icon is-red"><Trash2 size={18}/></span><span className="tj-ma-copy"><strong>Delete account</strong><small>Permanently removes {workspaceName} and all its data.</small></span></button>
    </div>
    {root && confirmation ? createPortal(confirmation, root) : confirmation}
  </div>;
  // Desktop panel: a quiet card that opens in place. Reset and Delete still go through the same confirmation dialog.
  if (!phone && panelCard) return <div className={`tj-dz ${open ? 'is-open' : ''}`} ref={container}>
    <button ref={trigger} type="button" className="tj-dz-head" aria-expanded={open} aria-controls="settings-danger-body" onClick={() => setOpen(value => !value)}><span className="tj-dz-icon"><AlertTriangle size={17}/></span><span className="tj-dz-copy"><strong>Danger zone</strong><small>Reset or delete this account</small></span><ChevronRight size={17} className="tj-dz-chev" aria-hidden="true"/></button>
    <div className="tj-dz-body" id="settings-danger-body" aria-hidden={!open}><div><div className="tj-dz-list">
      <div className="tj-dz-row"><span><strong>Reset account data</strong><small>Erases all trade history and check-ins for this account. Your settings stay.</small></span><button type="button" className="tj-dz-btn" tabIndex={open ? 0 : -1} onClick={() => request('reset')}><RefreshCw size={14}/> Reset</button></div>
      <div className="tj-dz-row"><span><strong>Delete account</strong><small>Permanently removes this account and everything in it.</small></span><button type="button" className="tj-dz-btn is-delete" tabIndex={open ? 0 : -1} onClick={() => request('delete')}><Trash2 size={14}/> Delete</button></div>
    </div></div></div>
    {root && confirmation ? createPortal(confirmation, root) : confirmation}
  </div>;
  return <div className="tj-settings-danger-menu" ref={container} onKeyDown={event => {if (event.key === 'Escape' && open) {event.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
    <button ref={trigger} type="button" className="is-danger" aria-expanded={open} aria-controls="settings-danger-popover" onClick={() => setOpen(value => !value)}>Danger Zone</button>
    {open && phone && <PhoneWorkspaceDangerSheet workspaceName={workspaceName} trigger={trigger} onClose={()=>setOpen(false)} onRequest={request}/>}
    {open && !phone && <section id="settings-danger-popover" className="tj-settings-danger-popover" aria-label="Account danger zone">
      <header><strong><Trash2 size={14}/> Danger zone</strong><small>{workspaceName}</small></header>
      <div><span><strong>Reset account data</strong><small>Erases all trade history and check-ins for this account, but keeps your settings.</small></span><button type="button" onClick={() => request('reset')}><RefreshCw size={12}/> Reset</button></div>
      <div><span><strong>Delete account</strong><small>Permanently deletes this account and everything in it: every trade, markup, review, and history entry.</small></span><button type="button" onClick={() => request('delete')}>Delete</button></div>
    </section>}
    {root && confirmation ? createPortal(confirmation, root) : confirmation}
  </div>;
}
