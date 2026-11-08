import React, { useCallback, useState } from 'react';
import { CSS, NewTradeModal } from './TradingJournal.jsx?header-controls=122';

// This component is dynamically imported only by the Vite development entry
// point. It deliberately has no auth or database dependencies.
const mockAccount = {
  id: 'local-validation-account',
  name: 'Local validation journal',
  balance: 10000,
  baseCurrency: 'USD',
  workspaceType: 'standard',
  balances: [],
  trades: [],
  rules: [],
  defaultRiskMethod: 'pips',
  defaultRiskPct: 1,
  defaultStopLossPips: 10,
  defaultCommission: 0,
  positionSizeEnabled: false,
};

export default function LocalTradeValidationHarness() {
  const [open, setOpen] = useState(true);
  const [intercepted, setIntercepted] = useState(false);
  const saveLocally = useCallback(() => {
    // Intentionally do not persist, log, or send the submitted trade.
    setIntercepted(true);
  }, []);

  return <main className="tj-root" style={{ minHeight:'100vh', padding:'24px', background:'var(--tj-bg)' }}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div role="status" style={{ maxWidth:'760px', margin:'0 auto', padding:'14px 18px', border:'2px solid var(--tj-amber)', borderRadius:'12px', background:'var(--tj-panel)', color:'var(--tj-text)', fontWeight:800 }}>
      LOCAL VALIDATION TEST — NO DATA SAVED
      <span style={{ display:'block', marginTop:'4px', fontSize:'13px', fontWeight:500 }}>This development-only screen uses the real trade form. Save is intercepted in memory; no Supabase request is made.</span>
    </div>
    {intercepted && <p role="status" style={{ maxWidth:'760px', margin:'16px auto', padding:'12px 16px', border:'1px solid var(--tj-green)', borderRadius:'10px', background:'var(--tj-panel)', color:'var(--tj-green)' }}>Validation passed. Save was intercepted locally; no data was sent or stored.</p>}
    {!open && <button type="button" onClick={() => { setIntercepted(false); setOpen(true); }} style={{ display:'block', margin:'24px auto' }}>Open local trade form</button>}
    {open && <NewTradeModal
      account={mockAccount}
      typeTags={[]}
      mistakeTags={[]}
      confluenceSessions={[]}
      markups={[]}
      rules={[]}
      instruments={['EUR/USD', 'GBP/USD', 'XAU/USD']}
      defaultCommission={0}
      riskPresets={[]}
      onClose={() => setOpen(false)}
      onSave={saveLocally}
    />}
    <div role="status" style={{ position:'fixed', right:'16px', bottom:'16px', zIndex:10001, maxWidth:'min(360px, calc(100vw - 32px))', padding:'10px 12px', borderRadius:'10px', background:intercepted ? 'var(--tj-green)' : 'var(--tj-amber)', color:'var(--on-accent)', fontSize:'13px', fontWeight:800, boxShadow:'var(--tj-shadow)' }}>{intercepted ? 'VALIDATION PASSED — SAVE INTERCEPTED LOCALLY' : 'LOCAL VALIDATION TEST — NO DATA SAVED'}</div>
  </main>;
}
