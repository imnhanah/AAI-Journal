import React, { useState } from 'react';
import { CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { FINANCIAL_DISCLAIMER_VERSION } from './financialDisclaimer.js';
import './financialDisclaimer.css';

export const FINANCIAL_DISCLAIMER_TEXT = 'AAICOREFX is provided solely for educational, informational, and personal trade-journaling purposes. It does not provide financial, investment, legal, tax, or trading advice, and it does not recommend any security, strategy, or course of action. Trading financial markets involves substantial risk and may result in the loss of some or all capital. Any decisions you make using information, calculations, analytics, plans, or records within this application are entirely your own responsibility. Past performance and journal results do not guarantee future outcomes. Consider consulting a qualified, licensed financial professional before making investment decisions.';

function DisclaimerCopy() {
  return <p className="fd-copy">{FINANCIAL_DISCLAIMER_TEXT}</p>;
}

export function FinancialDisclaimerDialog({ onClose }) {
  return <div className="fd-dialog-backdrop" role="presentation">
    <section className="fd-dialog" role="dialog" aria-modal="true" aria-labelledby="financial-disclaimer-title">
      <header><span className="fd-icon"><ShieldAlert size={19}/></span><div><small>LEGAL</small><h2 id="financial-disclaimer-title">Financial Disclaimer</h2></div><button className="fd-close" type="button" onClick={onClose} aria-label="Close financial disclaimer"><X size={18}/></button></header>
      <DisclaimerCopy/>
      <footer><span>Version {FINANCIAL_DISCLAIMER_VERSION}</span><button className="fd-button fd-button-primary" type="button" onClick={onClose}>Close</button></footer>
    </section>
  </div>;
}

export function FinancialDisclaimerGate({ onAccept, onLogout, busy = false, error = '' }) {
  const [acknowledged, setAcknowledged] = useState(false);
  return <main className="fd-gate-root">
    <section className="fd-gate" aria-labelledby="financial-consent-title">
      <span className="fd-icon fd-icon-large"><ShieldAlert size={22}/></span>
      <small>BEFORE YOU BEGIN</small>
      <h1 id="financial-consent-title">A quick acknowledgement</h1>
      <p className="fd-lead">This journal helps you record and review your trading activity. It does not provide financial advice.</p>
      <div className="fd-statement"><DisclaimerCopy/></div>
      <label className="fd-check"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/><span>I have read and understand the Financial Disclaimer.</span></label>
      {error && <p className="fd-error" role="alert">{error}</p>}
      <div className="fd-gate-actions"><button className="fd-button fd-button-quiet" type="button" onClick={onLogout} disabled={busy}>Sign out</button><button className="fd-button fd-button-primary" type="button" onClick={onAccept} disabled={!acknowledged || busy}>{busy ? 'Saving…' : <><CheckCircle2 size={16}/> Continue to journal</>}</button></div>
      <p className="fd-version">Disclaimer version {FINANCIAL_DISCLAIMER_VERSION}</p>
    </section>
  </main>;
}
