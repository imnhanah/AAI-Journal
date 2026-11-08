import React, { useEffect, useMemo, useState } from 'react';
import { AddAccountModal, CSS, EmptyJournalOnboarding } from './TradingJournal.jsx?header-controls=122';

// Loaded exclusively by the Vite development entry point. This screen never
// calls auth or database helpers: account creation exists only in React state.
const existingAccount = {
  id: 'local-existing-account', name: 'Demo', icon: 'USD', baseCurrency: 'USD',
  balance: 2500, workspaceType: 'standard', balances: [], trades: [{ id: 'real-trade', asset: 'EUR/USD', pnl: 37 }],
};

function selectedMode() {
  const requested = new URLSearchParams(window.location.search).get('mode');
  return ['new', 'existing', 'device'].includes(requested) ? requested : 'new';
}

function blockWriteRequests() {
  const originalFetch = window.fetch;
  const originalBeacon = navigator.sendBeacon?.bind(navigator);
  window.fetch = (input, init = {}) => {
    const requestMethod = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(requestMethod)) {
      return Promise.reject(new Error('Blocked by LOCAL ONBOARDING TEST'));
    }
    return originalFetch(input, init);
  };
  if (originalBeacon) navigator.sendBeacon = () => false;
  return () => {
    window.fetch = originalFetch;
    if (originalBeacon) navigator.sendBeacon = originalBeacon;
  };
}

function EmptyDataSummary({ account, kind }) {
  if (!account) return null;
  const existing = kind === 'existing';
  return <section className="tj-load-error-card" aria-label="Local journal data summary">
    <strong>{account.name}</strong>
    <span>{existing ? 'Existing user mock — this genuinely named “Demo” account is preserved.' : 'Mock journal created locally — no data was sent or stored.'}</span>
    <div className="tj-chip-row"><span className="tj-chip">{account.trades.length} trade{account.trades.length === 1 ? '' : 's'}</span><span className="tj-chip">0 reviews</span><span className="tj-chip">0 challenge records</span><span className="tj-chip">Analytics: no fabricated statistics</span></div>
  </section>;
}

export default function LocalOnboardingHarness() {
  const [mode, setMode] = useState(selectedMode);
  const [account, setAccount] = useState(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => blockWriteRequests(), []);

  useEffect(() => {
    setCreating(false);
    setAccount(mode === 'existing' ? existingAccount : null);
  }, [mode]);

  const description = useMemo(() => mode === 'device'
    ? 'Fresh device-only journal: it begins with no accounts, trades, reviews, or synthetic history.'
    : mode === 'existing'
      ? 'Existing-user mock: a user-created account named “Demo” and its own trade are retained.'
      : 'Fresh authenticated-user mock: it begins with no accounts, trades, reviews, or challenge records.', [mode]);

  const createAccountLocally = async (fields) => {
    // This is deliberately an in-memory adapter, rather than the production persistence helper.
    setAccount({ ...fields, trades: [], reviews: [], challengeRecords: [] });
    setCreating(false);
    return true;
  };
  const chooseMode = (nextMode) => {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('mode', nextMode);
    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
    setMode(nextMode);
  };

  return <main className="tj-root" style={{ minHeight: '100vh', padding: '24px', background: 'var(--tj-bg)' }}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="tj-load-error-card" role="status" style={{ maxWidth: '780px', margin: '0 auto 18px' }}>
      <strong>LOCAL ONBOARDING TEST — NO DATA SAVED.</strong>
      <span>This development-only page uses the real onboarding and account-creation components. Writes are blocked, and creation is held only in memory.</span>
    </section>
    <section className="tj-load-error-card" style={{ maxWidth: '780px', margin: '0 auto 18px' }}>
      <div className="tj-chip-row" aria-label="Test scenario"><button type="button" className={`tj-chip ${mode === 'new' ? 'tj-chip-active' : ''}`} onClick={() => chooseMode('new')}>Fresh new user</button><button type="button" className={`tj-chip ${mode === 'existing' ? 'tj-chip-active' : ''}`} onClick={() => chooseMode('existing')}>Existing user</button><button type="button" className={`tj-chip ${mode === 'device' ? 'tj-chip-active' : ''}`} onClick={() => chooseMode('device')}>Fresh device-only</button></div>
      <span>{description}</span>
      <small>Reloading intentionally resets this local mock state. It never creates an account in Supabase, browser storage, or any remote service.</small>
    </section>
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      {!account && <EmptyJournalOnboarding onCreate={() => setCreating(true)} />}
      {account && <EmptyDataSummary account={account} kind={mode} />}
      {account && mode !== 'existing' && <button type="button" className="tj-btn-outline" onClick={() => setAccount(null)}>Reset local mock</button>}
    </div>
    {creating && <AddAccountModal onClose={() => setCreating(false)} onCreate={createAccountLocally} canCreateMultiBalance allowImport={false} />}
    <div role="status" style={{ position: 'fixed', right: '16px', bottom: '16px', zIndex: 10001 }} className="tj-toast">LOCAL ONBOARDING TEST — NO DATA SAVED.</div>
  </main>;
}
