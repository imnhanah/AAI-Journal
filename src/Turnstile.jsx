import { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'cloudflare-turnstile-script';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  const existing = document.getElementById(SCRIPT_ID);
  if (existing) return new Promise((resolve, reject) => {
    existing.addEventListener('load', () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not initialise.')), { once: true });
    existing.addEventListener('error', () => reject(new Error('Turnstile could not load.')), { once: true });
  });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID; script.src = SCRIPT_URL; script.async = true; script.defer = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not initialise.'));
    script.onerror = () => reject(new Error('Turnstile could not load.'));
    document.head.appendChild(script);
  });
}

// Explicit rendering gives the auth form one widget instance and avoids the
// duplicate widgets implicit rendering can create during React Strict Mode.
export default function Turnstile({ siteKey, resetKey, onSuccess, onExpire, onError }) {
  const element = useRef(null);
  const widgetId = useRef(null);
  const callbacks = useRef({ onSuccess, onExpire, onError });
  const [ready, setReady] = useState(false);
  callbacks.current = { onSuccess, onExpire, onError };
  useEffect(() => {
    let cancelled = false;
    if (!siteKey || !element.current) return undefined;
    loadTurnstile().then((turnstile) => {
      if (cancelled || widgetId.current !== null) return;
      widgetId.current = turnstile.render(element.current, {
        sitekey: siteKey, theme: 'auto', size: 'flexible',
        callback: (token) => { setReady(true); callbacks.current.onSuccess(token); },
        'expired-callback': () => { setReady(true); callbacks.current.onExpire(); },
        'error-callback': () => { setReady(true); callbacks.current.onError(); },
      });
      setReady(true);
    }).catch(() => { if (!cancelled) { setReady(true); callbacks.current.onError(); } });
    return () => {
      cancelled = true;
      if (widgetId.current !== null && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);
  useEffect(() => { if (widgetId.current !== null && window.turnstile) window.turnstile.reset(widgetId.current); }, [resetKey]);
  return <div className="auth-turnstile" aria-live="polite" aria-busy={!ready}><div ref={element}/></div>;
}
