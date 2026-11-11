import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {AlertTriangle, CheckCircle2, Info, X} from 'lucide-react';
import {createPortal} from 'react-dom';

const MobileAlertContext = createContext(() => {});

export const useMobileAlert = () => useContext(MobileAlertContext);

const toneFor = type => type === 'error' || type === 'warning' ? type : type === 'info' ? 'info' : 'success';
const iconFor = type => type === 'error' || type === 'warning' ? AlertTriangle : type === 'info' ? Info : CheckCircle2;

// Phone-only actions used to each carry their own top toast. Keeping one queue
// means setup, routine, and quick-menu feedback all respect the bottom dock.
export function MobileAlertProvider({children}) {
  const [alert, setAlert] = useState(null);
  const timer = useRef(null);
  const show = useCallback((message, options = {}) => {
    const next = typeof message === 'string'
      ? {message, ...options}
      : message;
    const type = toneFor(next?.type);
    clearTimeout(timer.current);
    setAlert({id: Date.now(), type, title: next?.title || '', message: next?.message || '', duration: next?.duration ?? (type === 'success' ? 2800 : 5000)});
  }, []);
  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setAlert(null);
  }, []);

  useEffect(() => {
    if (!alert) return undefined;
    timer.current = setTimeout(() => setAlert(null), alert.duration);
    return () => clearTimeout(timer.current);
  }, [alert]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const Glyph = alert ? iconFor(alert.type) : Info;
  return <MobileAlertContext.Provider value={show}>
    {children}
    {alert && createPortal(<div className={`tj-mobile-alert is-${alert.type}`} role={alert.type === 'error' || alert.type === 'warning' ? 'alert' : 'status'} aria-live={alert.type === 'error' || alert.type === 'warning' ? 'assertive' : 'polite'}>
      <span className="tj-mobile-alert-icon" aria-hidden="true"><Glyph size={19}/></span>
      <span className="tj-mobile-alert-copy">{alert.title && <strong>{alert.title}</strong>}<span>{alert.message}</span></span>
      <button type="button" aria-label="Dismiss notification" onClick={dismiss}><X size={17}/></button>
    </div>, document.body)}
  </MobileAlertContext.Provider>;
}
