import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Trash2} from 'lucide-react';

export default function ProfileDeleteDialog({name, value, onChange, busy, ready = false, error, onCancel, onConfirm}) {
  const anchor = useRef(null), dialog = useRef(null);
  const [root, setRoot] = useState(null);
  useLayoutEffect(() => {setRoot(anchor.current?.closest('.tj-root'));}, []);
  useEffect(() => {
    if (!root) return;
    const modal = anchor.current?.closest('.tj-modal');
    const previous = document.activeElement, wasInert = modal?.inert;
    if (modal) modal.inert = true;
    dialog.current?.querySelector('input')?.focus();
    return () => {if (modal) modal.inert = wasInert; previous?.isConnected && previous.focus?.();};
  }, [root]);
  const content = <div className="tj-profile-delete-overlay" onMouseDown={event => {if (event.target === event.currentTarget && !busy) onCancel();}}>
    <div className="tj-profile-delete-backdrop" aria-hidden="true" onMouseDown={() => {if(!busy)onCancel();}}/>
    <section ref={dialog} className="tj-profile-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-delete-title" aria-describedby="profile-delete-description" aria-busy={busy} onKeyDown={event => {
      if (event.key === 'Escape') {event.stopPropagation();if (!busy) onCancel();}
      if (event.key === 'Tab') {
        const controls = dialog.current?.querySelectorAll('input:not(:disabled), button:not(:disabled)');
        if (!controls?.length) {event.preventDefault();return;}
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
      }
    }}>
      <i aria-hidden="true" className="tj-sheet-handle"/>
      <div className="tj-profile-delete-icon"><Trash2 size={21}/></div>
      <h3 id="profile-delete-title">Schedule profile deletion?</h3>
      <p id="profile-delete-description">This starts a 14-day deletion countdown. An administrator can cancel it while it runs.</p>
      <ul><li>Your account becomes read-only straight away</li><li>You can still view and export your records during the 14 days</li><li>Nothing is erased when you confirm, and your data on this device is kept</li></ul>
      <label>Type <strong>{name}</strong> to confirm<input className="tj-input" aria-label="Profile name to confirm deletion" autoComplete="off" placeholder={name} value={value} disabled={busy} onChange={event => onChange(event.target.value)}/></label>
      {error && <p role="alert" className="tj-profile-delete-error">{error}</p>}
      <div className="tj-profile-delete-actions"><button type="button" className="tj-btn-outline" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="tj-danger-button" disabled={busy || !ready || !name || value !== name} onClick={onConfirm}>{busy ? 'Scheduling…' : 'Schedule deletion'}</button></div>
    </section>
  </div>;
  // Render alongside the outer modal so its disabled content cannot trap the confirmation.
  return <><span ref={anchor}/>{root && createPortal(content, root)}</>;
}
