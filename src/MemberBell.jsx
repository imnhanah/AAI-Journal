import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Bell, Megaphone, ShieldCheck, X } from 'lucide-react';
import { clearNotification, fetchMyNotifications, markNotificationRead, memberAccessUiEnabled } from './memberAccess.js';
import './memberAccess.css';

const whenText = iso => { const ms = Date.now() - Date.parse(iso); if (!Number.isFinite(ms)) return ''; if (ms < 3600000) return 'Just now'; if (ms < 86400000) return `${Math.floor(ms / 3600000)} h ago`; return `${Math.floor(ms / 86400000)} d ago`; };

const panelPlace = node => { const r = node?.getBoundingClientRect?.(); return r ? { top: Math.round(r.bottom + 10), right: Math.max(12, Math.round(window.innerWidth - r.right)) } : { top: 64, right: 12 }; };

// The member's bell: announcements from Admin. Tap to read (marks it read), × clears it from this member's view only.
export default function MemberBell({ userId }) {
  const [notes, setNotes] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const epoch = useRef(0);
  const [reading, setReading] = useState(null);
  const box = useRef(null);
  const load = useCallback(async () => {
    if (!memberAccessUiEnabled || !userId) return;
    const mine = epoch.current;
    const result = await fetchMyNotifications();
    if (mine !== epoch.current) return;
    if (result.error) { setFailed(true); return; }
    setFailed(false); setNotes(result.notes);
  }, [userId]);
  useEffect(() => {
    epoch.current += 1;
    setNotes(null); setOpen(false); setReading(null);
    if (!memberAccessUiEnabled || !userId) return undefined;
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    const timer = setInterval(load, 5 * 60 * 1000);
    window.addEventListener('focus', onVisible); document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, [userId, load]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => { if (event.key === 'Escape') { setOpen(false); setReading(null); } };
    const onDown = event => { const inside = box.current?.contains(event.target) || panelRef.current?.contains(event.target); if (!inside) { setOpen(false); setReading(null); } };
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown);
    // While the panel is open nothing else floats above it: the quick-action button is hidden.
    document.documentElement.classList.add('tj-bell-open');
    return () => { document.documentElement.classList.remove('tj-bell-open'); document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);
  if (!memberAccessUiEnabled || !userId || (!notes && !failed)) return null;

  const list = notes || [];
  const unread = list.filter(note => !note.read).length;
  const read = async note => {
    setReading(note.id);
    if (note.read) return;
    const mine = epoch.current;
    setNotes(current => current.map(item => item.id === note.id ? { ...item, read: true } : item));
    const ok = await markNotificationRead(note.id);
    // A failed mark-read must not leave a false "read" state; a late answer from a previous account is discarded.
    if (mine === epoch.current && !ok) setNotes(current => current && current.map(item => item.id === note.id ? { ...item, read: false } : item));
  };
  const clear = async note => {
    const mine = epoch.current;
    const before = notes;
    setNotes(current => current.filter(item => item.id !== note.id)); setReading(null);
    if (!(await clearNotification(note.id)) && mine === epoch.current) setNotes(before);
  };
  const current = reading && list.find(note => note.id === reading);

  return <div className="tj-bell-wrap" ref={box}>
    <button type="button" className="tj-bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => { setOpen(value => !value); setReading(null); if (!open) load(); }}>
      <Bell size={17}/>{unread > 0 && <b aria-hidden="true">{unread > 9 ? '9+' : unread}</b>}
    </button>
    {open && createPortal(<div className="tj-bell-panel" ref={panelRef} style={panelPlace(box.current)} role="dialog" aria-label="Notifications">
      {current ? <div className="tj-bell-reader">
        <div className="tj-bell-rt"><button type="button" aria-label="Back to notifications" onClick={() => setReading(null)}><ArrowLeft size={16}/></button><span>Message</span></div>
        <div className="tj-bell-letter"><div className="tj-bell-lh"><ShieldCheck size={16}/><div><b>AAICOREFX</b><small>From Admin</small></div></div><h4>{current.title}</h4><p>{current.body}</p>{current.createdAt && <small>{whenText(current.createdAt)}</small>}</div>
        <button type="button" className="tj-bell-clear" onClick={() => clear(current)}><X size={14}/>Clear this message</button>
      </div> : <>
        <div className="tj-bell-head"><b>Notifications</b></div>
        {failed && !notes && <p className="tj-bell-empty">Notifications are unavailable right now.</p>}
        {notes && !list.length && <p className="tj-bell-empty">All cleared.</p>}
        <ul>{list.map(note => <li key={note.id} className={note.read ? '' : 'unread'}>
          <button type="button" className="tj-bell-item" onClick={() => read(note)}><span className="tj-bell-ico"><Megaphone size={15}/></span><span className="tj-bell-text"><b>{note.title}<i>From Admin</i></b><span>{note.body}</span><em>Tap to read</em></span></button>
          <button type="button" className="tj-bell-x" aria-label={`Clear ${note.title}`} onClick={() => clear(note)}><X size={14}/></button>
        </li>)}</ul>
        <p className="tj-bell-hint">The × clears a message from your view only.</p>
      </>}
    </div>, box.current?.closest('.tj-root') || document.body)}
  </div>;
}
