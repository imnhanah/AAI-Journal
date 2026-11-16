import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Hourglass, Lock, RefreshCw } from 'lucide-react';
import { downloadCsv, exportMyRecords, fetchMyAccess, memberAccessUiEnabled, SUPPORT_EMAIL } from './memberAccess.js';
import './memberAccess.css';

// Reads the member's own access on start, on focus and on demand. Shows nothing while access is normal.
export function useMemberAccess(userId) {
  const [access, setAccess] = useState(null);
  const last = useRef(0);
  const current = useRef(userId);
  const paused = useRef(false);
  current.current = userId;
  const refresh = useCallback(async (force = false) => {
    if (!memberAccessUiEnabled || !userId) return;
    if (!force && Date.now() - last.current < 15000) return;
    last.current = Date.now();
    const result = await fetchMyAccess();
    if (current.current !== userId) return;
    // After scheduling deletion the pause holds until the server answers; a failed refresh never lifts it.
    if (paused.current && !result.available) return;
    paused.current = false;
    setAccess(result);
  }, [userId]);
  const markDeleting = useCallback(deletionAt => {
    paused.current = true;
    setAccess(current => ({ ...(current || {}), available: true, status: 'deleting', deletionAt, features: current?.features || {}, supportEmail: current?.supportEmail || SUPPORT_EMAIL }));
  }, []);
  useEffect(() => {
    setAccess(null); last.current = 0; paused.current = false;
    if (!memberAccessUiEnabled || !userId) return undefined;
    refresh(true);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, [userId, refresh]);
  return { access, refresh, markDeleting };
}

const dateText = iso => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export default function MemberAccessNotice({ access, onRetry }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!memberAccessUiEnabled || !access || (access.available && access.status === 'active')) return null;
  const support = <a href={`mailto:${access.supportEmail}`}>{access.supportEmail}</a>;
  const exportNow = async () => {
    setBusy(true); setMessage('');
    const result = await exportMyRecords();
    if (result.error) setMessage(result.error); else downloadCsv(result.csv);
    setBusy(false);
  };
  let tone = 'warn', Icon = AlertTriangle, title, body, action;
  if (!access.available) {
    title = 'We couldn’t confirm your access';
    body = <>Some changes may not save right now. Your drafts and local records stay on this device.</>;
    action = <button type="button" onClick={() => onRetry?.(true)}><RefreshCw size={14}/>Try again</button>;
  } else if (access.status === 'deleting') {
    tone = 'bad'; Icon = Hourglass;
    title = `Deletion countdown${access.deletionAt ? ` · ends ${dateText(access.deletionAt)}` : ''}`;
    body = <>Your account is read-only. You can still view and export your records. An administrator can cancel the countdown.</>;
    action = <button type="button" disabled={busy} onClick={exportNow}><Download size={14}/>{busy ? 'Preparing…' : 'Export my records (CSV)'}</button>;
  } else if (access.status === 'suspended') {
    Icon = Lock;
    title = 'Your account is suspended';
    body = <>Access is paused and your data is safe. Contact support at {support} to have it reactivated.</>;
  } else {
    tone = 'bad'; Icon = Lock;
    title = 'This account has been banned';
    body = <>Journal data access is blocked. If you think this is a mistake, contact {support}.</>;
  }
  return <section className={`tj-access-notice tj-access-${tone}`} role="status" aria-live="polite">
    <span className="tj-access-ico"><Icon size={18}/></span>
    <div><b>{title}</b><p>{body}</p>{message && <p role="alert">{message}</p>}</div>
    {action}
  </section>;
}
