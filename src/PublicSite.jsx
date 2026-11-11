import React, { useEffect, useState } from 'react';
import AuthPage from './AuthPage';
import './public-site.css';
import LandingPage from './LandingPage';
import { FinancialDisclaimerDialog } from './FinancialDisclaimer.jsx';

// Routes that used to exist and now land on the home page.
const RETIRED_PATHS = new Set([`/${['l', 'a', 'n', 'd', 'i', 'n', 'g'].join('')}`, '/pricing']);

export function PlatformLogo({ platform }) {
  if (platform === 'ctrader') return <svg className="pub-platform-logo pub-platform-logo-ctrader" viewBox="0 0 40 40" role="img" aria-label="cTrader"><circle cx="20" cy="20" r="19" fill="var(--pub-platform-red)"/><path d="M28.5 13.8a10.3 10.3 0 1 0 0 12.4l-4.3-3.1a5 5 0 1 1 0-6.2z" fill="var(--pub-platform-mark)"/></svg>;
  const version = platform === 'mt4' ? '4' : '5';
  return <svg className="pub-platform-logo" viewBox="0 0 40 40" role="img" aria-label={`MetaTrader ${version}`}><circle cx="20" cy="11" r="8.5" fill="var(--pub-platform-green)"/><circle cx="11.6" cy="25.4" r="8.5" fill="var(--pub-platform-blue)"/><circle cx="28.4" cy="25.4" r="8.5" fill="var(--pub-platform-gold)"/><path d="M20 14.6 14.8 23m10.4 0L20 14.6M16.4 25.4h7.2" fill="none" stroke="var(--pub-platform-mark)" strokeWidth="2.7" strokeLinecap="round"/><text x="20" y="29.2" textAnchor="middle" fill="var(--pub-platform-mark)" fontSize="9" fontWeight="800">{version}</text></svg>;
}

export function Brand() { return <span className="pub-brand"><span className="pub-brand-mark"><img className="pub-logo-dark" src="/brand/logo-dark.png" width="48" height="48" alt=""/><img className="pub-logo-light" src="/brand/logo-light.png" width="48" height="48" alt=""/></span>AAICOREFX</span>; }

export default function PublicSite({ onAuthed, user }) {
  const [path, setPath] = useState(window.location.pathname);
  const [financialDisclaimerOpen, setFinancialDisclaimerOpen] = useState(false);

  useEffect(() => {
    if (!RETIRED_PATHS.has(window.location.pathname)) return;
    window.history.replaceState({}, '', '/');
    setPath('/');
  }, []);
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const navigate = (next) => { window.history.pushState({}, '', next); setPath(next); window.scrollTo(0, 0); };
  const authMode = path === '/signup' ? 'signup' : path === '/login' ? 'login' : null;

  if (authMode) return <AuthPage key={authMode} initialMode={authMode} onModeChange={(mode) => navigate(mode === 'signup' ? '/signup' : '/login')} onBack={() => navigate('/')} onAuthed={onAuthed}/>;

  return <>
    <LandingPage user={user} onNavigate={navigate} onDisclaimer={() => setFinancialDisclaimerOpen(true)} PlatformLogo={PlatformLogo}/>
    {financialDisclaimerOpen && <FinancialDisclaimerDialog onClose={() => setFinancialDisclaimerOpen(false)}/>}
  </>;
}
