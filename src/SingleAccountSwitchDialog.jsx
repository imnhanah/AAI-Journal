import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {UsersRound, Check, X} from 'lucide-react';
import './singleAccountSwitchDialog.css';

export default function SingleAccountSwitchDialog({accountNames, keptAccountName = 'Account 1', onCancel, onConfirm}) {
  const anchor = useRef(null), dialog = useRef(null);
  const [root, setRoot] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  useLayoutEffect(() => {setRoot(anchor.current?.closest('.tj-root'));}, []);
  useEffect(() => {
    if (!root) return;
    const modal = anchor.current?.closest('.tj-modal');
    const previous = document.activeElement, wasInert = modal?.inert;
    if (modal) modal.inert = true;
    dialog.current?.querySelector('input')?.focus();
    return () => {if (modal) modal.inert = wasInert; if (previous?.isConnected) previous.focus?.();};
  }, [root]);
  const content = <div className="tj-single-switch-overlay" onMouseDown={event => {if (event.target === event.currentTarget) onCancel();}}>
    <section ref={dialog} className="tj-single-switch-dialog" role="dialog" aria-modal="true" aria-labelledby="single-switch-title" aria-describedby="single-switch-description" onKeyDown={event => {
      if (event.key === 'Escape') {event.stopPropagation();onCancel();}
      if (event.key === 'Tab') {
        const controls = dialog.current?.querySelectorAll('input:not(:disabled), button:not(:disabled)');
        const first = controls?.[0], last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
      }
    }}>
      <header><span className="tj-single-switch-icon"><UsersRound size={19}/></span><div><h3 id="single-switch-title">Switch to Single account?</h3><p id="single-switch-description">Only {keptAccountName} stays in this workspace.</p></div></header>
      <section className="tj-single-switch-deleted"><div className="tj-single-switch-section-heading"><strong>Will be deleted</strong><div>{accountNames.map((name, index) => <span key={index}>{name || `Account ${index + 2}`}</span>)}</div></div><ul><li><X/>Every Account 2+ result and challenge record</li><li><X/>Account-specific settings</li><li><X/>Trades tagged only to another account</li></ul></section>
      <section className="tj-single-switch-kept"><div className="tj-single-switch-section-heading"><strong>Will be kept</strong></div><ul><li><Check/>{keptAccountName} and its trades</li><li><Check/><span>Trades shared with {keptAccountName} <small>· they keep only {keptAccountName}’s P&amp;L</small></span></li></ul></section>
      <label className="tj-single-switch-ack"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/>I understand this is permanent once I save</label>
      <footer><button type="button" className="tj-btn-outline" onClick={onCancel}>Keep Multiple</button><button type="button" className="tj-single-switch-confirm" disabled={!acknowledged} onClick={() => {if (acknowledged) onConfirm();}}>Delete extra account data and switch</button></footer>
    </section>
  </div>;
  return <><span ref={anchor}/>{root && createPortal(content, root)}</>;
}
