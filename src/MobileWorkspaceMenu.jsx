import React, {useEffect, useRef, useState} from 'react';
import {Check, Pencil, Plus} from 'lucide-react';
import {ConfirmDeleteButton} from './JournalControls';
import {Popup, TextField} from './MobileAccountSettings';
import {useNavStep} from './useBackNavigation.js';
import './mobileProfileSettings.css';
import './mobileDailyRoutine.css';
import './mobileSetupLists.css';
import './mobileWorkspaceMenu.css';

const initial = name => (name || '?').trim().charAt(0).toUpperCase();
const nameTaken = (accounts, name, except) => accounts.some(item => item.id !== except && item.name.trim().toLowerCase() === name.toLowerCase());

function EditSheet({workspace, accounts, onClose, onRename, onDelete}) {
  const [name, setName] = useState(workspace.name), [busy, setBusy] = useState(false);
  const text = name.trim(), taken = nameTaken(accounts, text, workspace.id);
  const save = async () => { setBusy(true); const saved = await onRename(workspace, text); setBusy(false); if (saved !== false) onClose(); };
  const canDelete = accounts.length > 1;
  return <Popup title="Edit workspace" hint={canDelete ? 'Deleting a workspace removes all of its trades. This can’t be undone.' : 'Keep at least one workspace.'} onClose={onClose} dirty={text !== workspace.name.trim()} footer={<>
    <button type="button" disabled={busy || !text || taken} onClick={save}>{busy ? 'Saving…' : 'Save name'}</button>
    {canDelete && <ConfirmDeleteButton className="tj-mr-delete" title={`Delete ${workspace.name}`} onClick={() => onDelete(workspace)}>Delete workspace</ConfirmDeleteButton>}
  </>}>
    <TextField label="Workspace name" value={name} autoComplete="off" onChange={event => setName(event.target.value)}/>
    {taken && <p className="tj-mp-status is-error" role="alert">You already have a workspace with this name.</p>}
  </Popup>;
}

export default function MobileWorkspaceMenu({accounts, activeId, figures, onSelect, onClose, onRename, onDelete, onCreate}) {
  const [manage, setManage] = useState(false), [editingId, setEditingId] = useState(null);
  useNavStep('workspace-menu', true, onClose);
  const panel = useRef(null), close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const key = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); } };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  const editing = accounts.find(item => item.id === editingId);

  return <>
    <button type="button" className="tj-wm-shade" aria-label="Close workspaces" onClick={onClose}/>
    <section className="tj-wm" ref={panel} role="dialog" aria-label="Workspaces">
      <div className="tj-wm-head">
        <div><h3>Workspaces</h3><small>{accounts.length} available</small></div>
        <button type="button" className="tj-wm-manage" aria-pressed={manage} onClick={() => setManage(value => !value)}><span>{manage ? 'Done' : 'Manage'}</span></button>
      </div>
      <div className="tj-wm-list">{accounts.map(item => {
        const current = item.id === activeId, {balance, pnl, pnlTone} = figures(item);
        return <button type="button" key={item.id} className={`tj-wm-row ${current ? 'is-current' : ''}`} aria-current={current ? 'true' : undefined} aria-haspopup={manage ? 'dialog' : undefined} onClick={() => manage ? setEditingId(item.id) : onSelect(item)}>
          <span className="tj-wm-avatar">{initial(item.name)}</span>
          <span className="tj-wm-copy"><strong>{item.name}</strong><small>{current ? 'Current' : 'Switch to this'}</small></span>
          <span className="tj-wm-figures"><b>{balance}</b><small className={`is-${pnlTone}`}>{pnl} P&amp;L</small></span>
          {manage ? <Pencil className="tj-wm-edit" size={16} aria-hidden="true"/> : current && <span className="tj-wm-check"><Check size={14} strokeWidth={3} aria-hidden="true"/></span>}
        </button>;
      })}</div>
      <button type="button" className="tj-wm-add" onClick={onCreate}><Plus size={18} aria-hidden="true"/>Add workspace</button>
    </section>
    {editing && <EditSheet workspace={editing} accounts={accounts} onClose={() => setEditingId(null)} onRename={onRename} onDelete={async workspace => { const deleted = await onDelete(workspace); if (deleted !== false) setEditingId(null); }}/>}
  </>;
}
