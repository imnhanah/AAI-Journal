import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Bell, Clock, Flag, Megaphone, Newspaper, PiggyBank, ShieldAlert, ShieldCheck, Target, Trophy, X } from 'lucide-react';
import { clearNotification, fetchMyNotifications, markNotificationRead, memberAccessUiEnabled } from './memberAccess.js';
import { claimNoticeKey, NOTICE_EVENT, NOTICE_TOAST_MS, NOTICE_UNDO_MS, addNotice, adminToNotice, groupNotices, markAllRead, markRead, noticeTime, noticesSwitchedOn, normalizeNotice, readNotices, removeIds, restoreItems, saveNoticesSwitch, writeNotices } from './appNotices.js';
import './memberAccess.css';

const ICONS = { guard: ShieldAlert, claim: Trophy, fail: Flag, savings: PiggyBank, missed: Clock, goal: Target, news: Newspaper, admin: Megaphone };

const panelPlace = node => { const r = node?.getBoundingClientRect?.(); return r ? { top: Math.round(r.bottom + 10), right: Math.max(12, Math.round(window.innerWidth - r.right)) } : { top: 64, right: 12 }; };

const usePhone = () => {
  const query = '(max-width:767px)';
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const sync = () => setPhone(media.matches);
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  return phone;
};

// One bell for the whole app: Admin messages (always shown) plus the app's own alerts (savings, guard, challenge, goals, news).
// A new notice shows for 6 seconds (a toast on desktop, a banner on phones), then stays here until read or cleared.
export default function MemberBell({ userId, onAction }) {
  const phone = usePhone();
  const [notes, setNotes] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(null);
  const [items, setItems] = useState(() => readNotices(userId));
  const [on, setOn] = useState(() => noticesSwitchedOn(userId));
  const [hidden, setHidden] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [hold, setHold] = useState(false);
  const [undo, setUndo] = useState(null);
  const [ringing, setRinging] = useState(false);
  const [drag, setDrag] = useState(null);
  const panelRef = useRef(null);
  const epoch = useRef(0);
  const box = useRef(null);
  const itemsRef = useRef(items);
  const onRef = useRef(on);
  const seenAdmin = useRef(null);
  const pending = useRef(new Map());
  const undoTimer = useRef(0);
  const dragStart = useRef(null);
  itemsRef.current = items;
  onRef.current = on;

  const announce = useCallback(next => { setToast({ ...next, run: Date.now() }); setHold(false); setRinging(true); }, []);
  useEffect(() => { if (!ringing) return undefined; const timer = setTimeout(() => setRinging(false), 900); return () => clearTimeout(timer); }, [ringing]);

  const load = useCallback(async () => {
    if (!memberAccessUiEnabled || !userId) return;
    const mine = epoch.current;
    const result = await fetchMyNotifications();
    if (mine !== epoch.current) return;
    if (result.error) { setFailed(true); return; }
    setFailed(false); setNotes(result.notes);
    // The first load is the baseline. Later arrivals that are unread get their own toast. Admin messages ignore the member's switch.
    const unreadNow = result.notes.filter(note => !note.read);
    if (seenAdmin.current) {
      const fresh = unreadNow.find(note => !seenAdmin.current.has(note.id));
      if (fresh) announce({ id: `admin:${fresh.id}`, kind: 'admin', title: fresh.title, text: fresh.body, from: 'Admin' });
    }
    seenAdmin.current = new Set(result.notes.map(note => note.id));
  }, [userId, announce]);

  useEffect(() => {
    epoch.current += 1;
    pending.current.forEach(timer => clearTimeout(timer)); pending.current.clear();
    seenAdmin.current = null;
    setNotes(null); setOpen(false); setReading(null); setHidden(new Set()); setUndo(null); setToast(null);
    setItems(readNotices(userId)); setOn(noticesSwitchedOn(userId));
    if (!memberAccessUiEnabled || !userId) return undefined;
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    const timer = setInterval(load, 5 * 60 * 1000);
    window.addEventListener('focus', onVisible); document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, [userId, load]);

  useEffect(() => { writeNotices(userId, items); }, [userId, items]);

  // Alerts from anywhere in the app arrive as one event. The member's switch only turns the app's own alerts off.
  useEffect(() => {
    if (!userId) return undefined;
    const receive = event => {
      if (!onRef.current) return;
      const notice = normalizeNotice(event.detail);
      if (!notice || itemsRef.current.some(item => item.id === notice.id) || !claimNoticeKey(userId, notice.id)) return;
      const result = addNotice(itemsRef.current, notice);
      if (!result.added) return;
      itemsRef.current = result.items; setItems(result.items);
      if (notice.quiet) setRinging(true); else announce(notice);
    };
    window.addEventListener(NOTICE_EVENT, receive);
    return () => window.removeEventListener(NOTICE_EVENT, receive);
  }, [userId, announce]);

  // A clear that is still inside its undo time reaches the server if the page closes first.
  useEffect(() => {
    const flush = () => { pending.current.forEach((timer, id) => { clearTimeout(timer); clearNotification(id); }); pending.current.clear(); };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => { if (event.key === 'Escape') { setOpen(false); setReading(null); } };
    const onDown = event => { const inside = box.current?.contains(event.target) || panelRef.current?.contains(event.target); if (!inside) { setOpen(false); setReading(null); } };
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown);
    // While the panel is open nothing else floats above it: the quick-action button is hidden.
    document.documentElement.classList.add('tj-bell-open');
    return () => { document.documentElement.classList.remove('tj-bell-open'); document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const rows = useMemo(() => [...items, ...(notes || []).filter(note => !hidden.has(note.id)).map(adminToNotice)], [items, notes, hidden]);
  const { now: needNow, earlier } = useMemo(() => groupNotices(rows), [rows]);
  const unread = rows.filter(row => !row.read).length;
  if (!userId) return null;

  const read = async note => {
    setReading(note.id);
    if (note.read) return;
    const mine = epoch.current;
    setNotes(current => current.map(item => item.id === note.id ? { ...item, read: true } : item));
    const ok = await markNotificationRead(note.id);
    // A failed mark-read must not leave a false "read" state; a late answer from a previous account is discarded.
    if (mine === epoch.current && !ok) setNotes(current => current && current.map(item => item.id === note.id ? { ...item, read: false } : item));
  };

  // Clearing waits out its undo time before the server hears about it, so Undo is always honest.
  const clear = async list => {
    const mine = epoch.current;
    const apps = list.filter(row => row.source === 'app');
    const admins = list.filter(row => row.source === 'admin');
    if (!list.length) return;
    setReading(null);
    if (apps.length) setItems(current => removeIds(current, apps.map(row => row.id)));
    if (admins.length) {
      setHidden(current => new Set([...current, ...admins.map(row => row.adminId)]));
      admins.forEach(row => {
        pending.current.set(row.adminId, setTimeout(async () => {
          pending.current.delete(row.adminId);
          const ok = await clearNotification(row.adminId);
          if (mine !== epoch.current) return;
          setHidden(current => { const next = new Set(current); next.delete(row.adminId); return next; });
          setNotes(current => current && (ok ? current.filter(item => item.id !== row.adminId) : current));
        }, NOTICE_UNDO_MS));
      });
    }
    clearTimeout(undoTimer.current);
    setUndo({ apps, admins: admins.map(row => row.adminId) });
    undoTimer.current = setTimeout(() => setUndo(null), NOTICE_UNDO_MS);
  };
  const takeBack = () => {
    if (!undo) return;
    clearTimeout(undoTimer.current);
    if (undo.apps.length) setItems(current => restoreItems(current, undo.apps));
    undo.admins.forEach(id => { clearTimeout(pending.current.get(id)); pending.current.delete(id); });
    if (undo.admins.length) setHidden(current => { const next = new Set(current); undo.admins.forEach(id => next.delete(id)); return next; });
    setUndo(null);
  };
  const readAll = () => {
    setItems(current => markAllRead(current));
    const mine = epoch.current;
    (notes || []).filter(note => !note.read).forEach(async note => {
      setNotes(list => list && list.map(item => item.id === note.id ? { ...item, read: true } : item));
      const ok = await markNotificationRead(note.id);
      if (mine === epoch.current && !ok) setNotes(list => list && list.map(item => item.id === note.id ? { ...item, read: false } : item));
    });
  };
  const flip = () => { const next = !on; setOn(next); saveNoticesSwitch(userId, next); };
  const choose = row => {
    if (row.source === 'admin') { read({ id: row.adminId, read: row.read }); return; }
    setItems(current => markRead(current, row.id));
    if (row.to && onAction) { setOpen(false); onAction(row.to); }
  };
  const openFromToast = () => { setToast(null); setOpen(true); };

  const swipe = row => ({
    onPointerDown: event => { if (event.target.closest('button.tj-nb-x')) return; dragStart.current = { id: row.id, x: event.clientX, moved: false }; setDrag({ id: row.id, dx: 0 }); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Not every device captures. */ } },
    onPointerMove: event => { const start = dragStart.current; if (!start || start.id !== row.id) return; const dx = Math.min(0, event.clientX - start.x); if (dx < -6) start.moved = true; setDrag({ id: row.id, dx }); },
    onPointerUp: () => { const start = dragStart.current; dragStart.current = null; const dx = drag?.id === row.id ? drag.dx : 0; setDrag(null); if (start?.moved && dx < -90) clear([row]); else if (!start?.moved) choose(row); },
    onPointerCancel: () => { dragStart.current = null; setDrag(null); },
  });

  const renderRow = (row, index) => {
    const Icon = ICONS[row.kind] || Bell;
    const dragging = drag?.id === row.id;
    return <li key={row.id} className={`tj-nb-row${row.read ? '' : ' unread'}`} data-kind={row.kind} style={{ '--i': index }}>
      <span className="tj-nb-swipe" aria-hidden="true" style={{ opacity: dragging ? Math.min(1, Math.abs(drag.dx) / 90) : 0 }}>Clear</span>
      <div className="tj-nb-item" role="button" tabIndex={0} {...swipe(row)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(row); } }} style={dragging ? { transform: `translateX(${drag.dx}px)`, transition: 'none' } : undefined}>
        <span className="tj-nb-ico"><Icon size={16}/></span>
        <span className="tj-nb-text"><span className="tj-nb-top"><b>{row.title}</b><time>{row.source === 'admin' ? `Admin · ${noticeTime(row.at)}` : noticeTime(row.at)}</time></span><span className="tj-nb-line">{row.text}</span></span>
        {row.label && <em className="tj-nb-go">{row.label}</em>}
        {!row.read && <i className="tj-nb-dot" aria-label="Unread"/>}
      </div>
      <button type="button" className="tj-nb-x" aria-label={`Clear ${row.title}`} onClick={() => clear([row])}><X size={14}/></button>
    </li>;
  };

  const current = reading && notes?.find(note => note.id === reading);
  const ToastIcon = toast ? (ICONS[toast.kind] || Bell) : Bell;
  const summary = !rows.length ? 'Nothing waiting' : unread ? `${unread} unread` : "You're all caught up";
  const mount = box.current?.closest('.tj-root') || document.body;

  return <div className="tj-bell-wrap" ref={box}>
    <button type="button" className={`tj-bell${ringing ? ' ring' : ''}`} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => { setOpen(value => !value); setReading(null); setToast(null); if (!open) load(); }}>
      <Bell size={17}/>{unread > 0 && <b aria-hidden="true" key={unread}>{unread > 9 ? '9+' : unread}</b>}
    </button>
    {toast && !open && createPortal(<div key={toast.run} className={`tj-nb-toast${phone ? ' is-phone' : ''}${hold ? ' is-held' : ''}`} data-kind={toast.kind} role="status" aria-live="polite"
      onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}
      onPointerDown={event => { if (phone) { dragStart.current = { y: event.clientY, moved: false }; setHold(true); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ } } }}
      onPointerMove={event => { const start = dragStart.current; if (phone && start && event.clientY - start.y < -36) { dragStart.current = null; setToast(null); } }}
      onPointerUp={() => { const start = dragStart.current; dragStart.current = null; setHold(false); if (phone && start) openFromToast(); }}>
      <span className="tj-nb-ico"><ToastIcon size={17}/></span>
      <span className="tj-nb-text"><span className="tj-nb-top"><small>AAICOREFX{toast.from ? ` · ${toast.from}` : ''}</small>{phone && <small>now</small>}</span><b>{toast.title}</b><span className="tj-nb-line">{toast.text}</span></span>
      {!phone && <button type="button" className="tj-nb-open" onClick={openFromToast}>View</button>}
      {!phone && <button type="button" className="tj-nb-x" aria-label="Dismiss" onClick={() => setToast(null)}><X size={14}/></button>}
      <i className="tj-nb-drain" style={{ animationDuration: `${NOTICE_TOAST_MS}ms` }} onAnimationEnd={() => setToast(null)} aria-hidden="true"/>
    </div>, mount)}
    {open && createPortal(<><div className="tj-nb-dim" aria-hidden="true"/><div className={`tj-nb-panel${phone ? ' is-phone' : ''}`} ref={panelRef} style={phone ? undefined : panelPlace(box.current)} role="dialog" aria-label="Notifications">
      {current ? <div className="tj-bell-reader">
        <div className="tj-bell-rt"><button type="button" aria-label="Back to notifications" onClick={() => setReading(null)}><ArrowLeft size={16}/></button><span>Message</span></div>
        <div className="tj-bell-letter"><div className="tj-bell-lh"><ShieldCheck size={16}/><div><b>AAICOREFX</b><small>From Admin</small></div></div><h4>{current.title}</h4><p>{current.body}</p>{current.createdAt && <small>{noticeTime(Date.parse(current.createdAt))}</small>}</div>
        <button type="button" className="tj-bell-clear" onClick={() => clear([adminToNotice(current)])}><X size={14}/>Clear this message</button>
      </div> : <>
        <div className="tj-nb-head"><div><b>Notifications</b><small>{summary}</small></div><span>{unread > 0 && <button type="button" onClick={readAll}>Mark all read</button>}{rows.length > 0 && <button type="button" onClick={() => clear(rows)}>Clear all</button>}</span></div>
        <div className="tj-nb-scroll">
          {failed && !notes && !rows.length && <p className="tj-bell-empty">Admin messages are unavailable right now.</p>}
          {!rows.length && !failed && <div className="tj-nb-empty"><span><ShieldCheck size={20}/></span><b>All clear</b><small>Nothing needs you right now.</small></div>}
          {needNow.length > 0 && <><h5>Needs you now</h5><ul>{needNow.map(renderRow)}</ul></>}
          {earlier.length > 0 && <><h5>Earlier</h5><ul>{earlier.map((row, index) => renderRow(row, index + needNow.length))}</ul></>}
        </div>
        <div className="tj-nb-foot"><span><b>App notifications</b><small>Admin messages always show.</small></span><button type="button" role="switch" aria-checked={on} aria-label="App notifications" className={`tj-nb-switch${on ? ' is-on' : ''}`} onClick={flip}><i/></button></div>
      </>}
    </div></>, mount)}
    {undo && createPortal(<div className="tj-nb-undo" role="status"><span>Cleared</span><button type="button" onClick={takeBack}>Undo</button></div>, mount)}
  </div>;
}
